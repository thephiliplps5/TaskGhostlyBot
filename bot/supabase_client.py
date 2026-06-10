import os
import logging
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

logger = logging.getLogger(__name__)

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
# Задачи (V2 — через RPC get_daily_tasks)
# ============================================

async def get_tasks_for_date(user_id: int, date_str: str) -> list:
    """
    Получить задачи пользователя на дату (YYYY-MM-DD).
    Использует RPC get_daily_tasks из schema_v2, которая:
    - Подтягивает задачи с start_date <= date и (end_date IS NULL или end_date >= date)
    - Учитывает повторяющиеся задачи (daily, weekdays, weekends)
    - LEFT JOIN с task_completions для статуса выполнения
    """
    sb = get_supabase()
    result = sb.rpc("get_daily_tasks", {
        "p_user_id": user_id,
        "p_date": date_str
    }).execute()
    return result.data or []


# ============================================
# Streak — вызывается из scheduler (V2)
# ============================================

async def process_streak_for_all_users(yesterday: str) -> None:
    """
    Запускается каждую ночь: обновляет streak всем пользователям.
    V2: Использует get_daily_tasks RPC для подсчёта задач за вчера.
    """
    sb = get_supabase()

    # Получаем всех пользователей
    users = sb.table("users").select(
        "telegram_id, streak, best_streak"
    ).execute().data

    for user in users:
        uid = user["telegram_id"]

        # Получаем задачи за вчера через RPC (учитывает повторяющиеся!)
        tasks = sb.rpc("get_daily_tasks", {
            "p_user_id": uid,
            "p_date": yesterday
        }).execute().data

        if not tasks:
            # Нет задач — streak не меняется
            continue

        total = len(tasks)
        completed = sum(1 for t in tasks if t.get("is_completed", False))
        is_perfect = (total == completed and total > 0)

        if is_perfect:
            new_streak = user["streak"] + 1
            new_best = max(user["best_streak"], new_streak)
            sb.table("users").update({
                "streak": new_streak,
                "best_streak": new_best,
                "last_active_date": yesterday
            }).eq("telegram_id", uid).execute()
            logger.info(f"[Streak] User {uid}: streak {user['streak']} → {new_streak}")
        else:
            # Не все выполнены — streak сбрасывается
            sb.table("users").update({
                "streak": 0,
                "last_active_date": yesterday
            }).eq("telegram_id", uid).execute()
            logger.info(f"[Streak] User {uid}: streak reset (completed {completed}/{total})")
