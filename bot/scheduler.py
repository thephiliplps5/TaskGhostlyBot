import asyncio
import logging
import os
from datetime import datetime, timedelta, date

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from aiogram import Bot

from supabase_client import get_supabase, process_streak_for_all_users

logger = logging.getLogger(__name__)


async def daily_streak_job(bot: Bot, timezone_str: str) -> None:
    """
    Запускается в 00:05 каждую ночь.
    Обрабатывает streak за вчерашний день.
    """
    tz = pytz.timezone(timezone_str)
    yesterday = (datetime.now(tz) - timedelta(days=1)).strftime("%Y-%m-%d")

    logger.info(f"[Scheduler] Processing streak for date: {yesterday}")

    try:
        await process_streak_for_all_users(yesterday)
        logger.info(f"[Scheduler] Streak processing complete for {yesterday}")
    except Exception as e:
        logger.error(f"[Scheduler] Streak error: {e}")


async def morning_notifications_job(bot: Bot) -> None:
    """
    Запускается в 09:00 каждое утро.
    Отправляет пользователям уведомление о задачах на сегодня.
    """
    today = date.today().isoformat()
    sb = get_supabase()

    # Получаем пользователей с включёнными уведомлениями
    users = sb.table("users").select(
        "telegram_id, first_name, notify_enabled, streak"
    ).eq("notify_enabled", True).execute().data

    for user in users:
        uid = user["telegram_id"]
        # Считаем задачи на сегодня
        tasks = sb.table("tasks").select("title, priority").eq(
            "user_id", uid
        ).eq("date", today).eq("is_completed", False).execute().data

        if not tasks:
            continue  # Нет задач — не беспокоим

        name = user.get("first_name", "")
        streak = user.get("streak", 0)
        task_count = len(tasks)

        streak_text = f"🔥 Серия: {streak} дн." if streak > 0 else ""

        text = (
            f"☀️ Доброе утро, {name}!\n\n"
            f"У тебя {task_count} задач{'а' if task_count == 1 else 'и' if task_count < 5 else ''} на сегодня.\n"
            f"{streak_text}\n\n"
            f"Открой приложение, чтобы начать!"
        )

        try:
            await bot.send_message(uid, text)
        except Exception as e:
            logger.warning(f"[Scheduler] Failed to notify {uid}: {e}")

        await asyncio.sleep(0.05)  # Rate limiting Telegram API


def setup_scheduler(bot: Bot, timezone_str: str = "Europe/Moscow") -> AsyncIOScheduler:
    """Инициализирует и запускает планировщик"""
    scheduler = AsyncIOScheduler(timezone=timezone_str)

    # Обработка streak — каждую ночь в 00:05
    scheduler.add_job(
        daily_streak_job,
        CronTrigger(hour=0, minute=5, timezone=timezone_str),
        args=[bot, timezone_str],
        id="daily_streak",
        name="Daily streak processing",
        replace_existing=True
    )

    # Утренние уведомления — каждый день в 09:00
    scheduler.add_job(
        morning_notifications_job,
        CronTrigger(hour=9, minute=0, timezone=timezone_str),
        args=[bot],
        id="morning_notifications",
        name="Morning task notifications",
        replace_existing=True
    )

    scheduler.start()
    logger.info(f"[Scheduler] Started. Timezone: {timezone_str}")
    return scheduler
