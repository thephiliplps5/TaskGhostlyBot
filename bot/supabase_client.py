import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Service role клиент — полный доступ к БД (только в боте, никогда на фронтенде!)
_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


# ============================================
# Пользователи
# ============================================

async def upsert_user(telegram_id: int, username: str, first_name: str) -> dict:
    """Создать или обновить пользователя при /start"""
    sb = get_supabase()
    result = sb.table("users").upsert({
        "telegram_id": telegram_id,
        "username": username,
        "first_name": first_name,
    }, on_conflict="telegram_id").execute()
    return result.data[0] if result.data else {}


async def get_user(telegram_id: int) -> dict | None:
    sb = get_supabase()
    result = sb.table("users").select("*").eq("telegram_id", telegram_id).single().execute()
    return result.data


async def get_user_streak(telegram_id: int) -> dict:
    sb = get_supabase()
    result = sb.table("users").select("streak, best_streak").eq("telegram_id", telegram_id).single().execute()
    return result.data or {"streak": 0, "best_streak": 0}


# ============================================
# Задачи
# ============================================

async def get_tasks_for_date(user_id: int, date: str) -> list:
    """Получить задачи пользователя на дату (YYYY-MM-DD)"""
    sb = get_supabase()
    result = sb.table("tasks").select("*").eq("user_id", user_id).eq("date", date).order("created_at").execute()
    return result.data or []


async def get_week_summary(user_id: int, dates: list[str]) -> list:
    """Прогресс по задачам за список дат"""
    sb = get_supabase()
    result = sb.table("week_progress").select("*").eq("user_id", user_id).in_("date", dates).execute()
    return result.data or []


# ============================================
# Streak — вызывается из scheduler
# ============================================

async def process_streak_for_all_users(yesterday: str) -> None:
    """Запускается каждую ночь: обновляет streak всем пользователям"""
    sb = get_supabase()

    # Получаем всех пользователей
    users = sb.table("users").select("telegram_id, streak, best_streak, last_active_date").execute().data

    for user in users:
        uid = user["telegram_id"]

        # Считаем задачи за вчера
        tasks = sb.table("tasks").select("is_completed").eq("user_id", uid).eq("date", yesterday).execute().data

        if not tasks:
            # Нет задач — streak не меняется
            continue

        total = len(tasks)
        completed = sum(1 for t in tasks if t["is_completed"])
        is_perfect = (total == completed)

        # Логируем день
        sb.table("day_logs").upsert({
            "user_id": uid,
            "date": yesterday,
            "total_tasks": total,
            "completed_tasks": completed,
            "is_perfect": is_perfect
        }, on_conflict="user_id,date").execute()

        if is_perfect:
            new_streak = user["streak"] + 1
            new_best = max(user["best_streak"], new_streak)
            sb.table("users").update({
                "streak": new_streak,
                "best_streak": new_best,
                "last_active_date": yesterday
            }).eq("telegram_id", uid).execute()
        else:
            # Не все выполнены — streak сбрасывается
            sb.table("users").update({
                "streak": 0,
                "last_active_date": yesterday
            }).eq("telegram_id", uid).execute()
