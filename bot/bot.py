import asyncio
import hashlib
import hmac
import json
import logging
import os
from urllib.parse import unquote

from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    Message, InlineKeyboardMarkup, InlineKeyboardButton,
    WebAppInfo, CallbackQuery
)
from dotenv import load_dotenv

from scheduler import setup_scheduler
from supabase_client import upsert_user, get_user_streak, get_tasks_for_date

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("BOT_TOKEN")
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://yourusername.github.io/taskbot")
TIMEZONE = os.getenv("TIMEZONE", "Europe/Moscow")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


# ============================================
# ВЕРИФИКАЦИЯ initData от Telegram
# ============================================

def verify_telegram_init_data(init_data: str, bot_token: str) -> dict | None:
    """
    Верифицирует initData от Telegram Mini App.
    Возвращает данные пользователя или None если подпись неверна.
    """
    try:
        params = dict(pair.split("=", 1) for pair in init_data.split("&"))
        received_hash = params.pop("hash", None)
        if not received_hash:
            return None

        data_check_string = "\n".join(
            f"{k}={unquote(v)}" for k, v in sorted(params.items())
        )

        secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(computed_hash, received_hash):
            return None

        user_data = json.loads(unquote(params.get("user", "{}")))
        return user_data
    except Exception as e:
        logger.error(f"initData verification error: {e}")
        return None


# ============================================
# КОМАНДЫ БОТА
# ============================================

@dp.message(CommandStart())
async def cmd_start(message: Message):
    """Регистрация пользователя + кнопка открыть Mini App"""
    user = message.from_user

    # Сохраняем пользователя в Supabase
    await upsert_user(
        telegram_id=user.id,
        username=user.username or "",
        first_name=user.first_name or ""
    )

    keyboard = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="📋 Открыть TaskBot",
            web_app=WebAppInfo(url=MINI_APP_URL)
        )
    ]])

    await message.answer(
        f"👋 Привет, {user.first_name}!\n\n"
        f"TaskBot поможет тебе отслеживать ежедневные задачи "
        f"и строить серии успешных дней 🔥\n\n"
        f"Нажми кнопку ниже, чтобы начать:",
        reply_markup=keyboard
    )

    logger.info(f"User registered: {user.id} (@{user.username})")


@dp.message(Command("streak"))
async def cmd_streak(message: Message):
    """Показать текущую серию"""
    data = await get_user_streak(message.from_user.id)
    streak = data.get("streak", 0)
    best = data.get("best_streak", 0)

    flame = "🔥" * min(streak, 5) if streak > 0 else "💤"

    await message.answer(
        f"{flame} *Текущая серия:* {streak} дн.\n"
        f"🏆 *Рекорд:* {best} дн.",
        parse_mode="Markdown"
    )


@dp.message(Command("tasks"))
async def cmd_tasks(message: Message):
    """Показать задачи на сегодня"""
    from datetime import date
    today = date.today().isoformat()
    tasks = await get_tasks_for_date(message.from_user.id, today)

    if not tasks:
        await message.answer("📭 Задач на сегодня нет. Открой приложение, чтобы добавить!")
        return

    priority_icons = {"high": "🔴", "medium": "🟡", "low": "🟢"}
    lines = []
    for t in tasks:
        icon = "✅" if t["is_completed"] else "☐"
        priority = priority_icons.get(t["priority"], "•")
        lines.append(f"{icon} {priority} {t['title']}")

    completed = sum(1 for t in tasks if t["is_completed"])
    text = (
        f"📋 *Задачи на сегодня* ({completed}/{len(tasks)} выполнено)\n\n"
        + "\n".join(lines)
    )

    keyboard = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="📱 Открыть приложение",
            web_app=WebAppInfo(url=MINI_APP_URL)
        )
    ]])

    await message.answer(text, parse_mode="Markdown", reply_markup=keyboard)


@dp.message(Command("notify"))
async def cmd_notify(message: Message):
    """Изменить время уведомления. Использование: /notify 08:30"""
    args = message.text.split()
    if len(args) != 2:
        await message.answer("Использование: /notify HH:MM\nПример: /notify 08:30")
        return

    time_str = args[1]
    try:
        from datetime import time as dtime
        parts = time_str.split(":")
        dtime(int(parts[0]), int(parts[1]))  # валидация
    except Exception:
        await message.answer("❌ Неверный формат времени. Используй HH:MM")
        return

    from supabase_client import get_supabase
    get_supabase().table("users").update({
        "notify_time": time_str
    }).eq("telegram_id", message.from_user.id).execute()

    await message.answer(f"✅ Уведомление установлено на {time_str}")


@dp.message(Command("help"))
async def cmd_help(message: Message):
    await message.answer(
        "📖 *Команды TaskBot:*\n\n"
        "/start — открыть приложение\n"
        "/tasks — задачи на сегодня\n"
        "/streak — текущая серия 🔥\n"
        "/notify HH:MM — время уведомлений\n"
        "/help — эта справка",
        parse_mode="Markdown"
    )


# ============================================
# ЗАПУСК
# ============================================

async def main():
    logger.info("Starting TaskBot...")

    # Запускаем scheduler
    scheduler = setup_scheduler(bot, TIMEZONE)

    # Устанавливаем команды в меню бота
    from aiogram.types import BotCommand
    await bot.set_my_commands([
        BotCommand(command="start", description="Открыть TaskBot"),
        BotCommand(command="tasks", description="Задачи на сегодня"),
        BotCommand(command="streak", description="Моя серия 🔥"),
        BotCommand(command="notify", description="Время уведомлений"),
        BotCommand(command="help", description="Помощь"),
    ])

    logger.info("Bot is running... (polling mode)")

    try:
        # Запускаем aiohttp сервер параллельно
        from api import create_app
        from aiohttp import web
        
        app = create_app()
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, '0.0.0.0', 8000)
        await site.start()
        logger.info("API server is running on http://0.0.0.0:8000")

        # Запускаем polling
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        scheduler.shutdown()
        await bot.session.close()
        await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
