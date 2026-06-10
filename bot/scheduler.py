import asyncio
import logging
import os
from datetime import datetime, timedelta, date

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from aiogram import Bot

from supabase_client import get_supabase, get_tasks_for_date, process_streak_for_all_users

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


async def morning_notifications_job(bot: Bot, timezone_str: str) -> None:
    """
    Запускается в 09:00 каждое утро.
    Отправляет пользователям уведомление о задачах на сегодня.
    V2: Использует get_daily_tasks RPC, проверяет notify_time вместо notify_enabled.
    """
    tz = pytz.timezone(timezone_str)
    today = datetime.now(tz).strftime("%Y-%m-%d")
    current_hour_min = datetime.now(tz).strftime("%H:%M")
    sb = get_supabase()

    # Получаем пользователей с notify_time = текущее время (±1 мин не проверяем, 
    # т.к. job запускается ровно в указанное время, но можно расширить)
    users = sb.table("users").select(
        "telegram_id, first_name, streak, notify_time"
    ).execute().data

    for user in users:
        uid = user["telegram_id"]
        user_notify_time = user.get("notify_time", "09:00")
        
        # Проверяем, совпадает ли время уведомления с текущим часом
        # Формат notify_time: "HH:MM"
        if user_notify_time != current_hour_min:
            continue

        # Получаем задачи через V2 RPC
        tasks = await get_tasks_for_date(uid, today)
        
        # Считаем невыполненные
        uncompleted = [t for t in tasks if not t.get("is_completed", False)]

        if not uncompleted:
            continue  # Все выполнены или нет задач — не беспокоим

        name = user.get("first_name", "")
        streak = user.get("streak", 0)
        task_count = len(uncompleted)

        streak_text = f"🔥 Серия: {streak} дн." if streak > 0 else ""

        text = (
            f"☀️ Доброе утро, {name}!\n\n"
            f"У тебя {task_count} {'задача' if task_count == 1 else 'задачи' if 2 <= task_count <= 4 else 'задач'} на сегодня.\n"
            f"{streak_text}\n\n"
            f"Открой приложение, чтобы начать!"
        )

        try:
            await bot.send_message(uid, text)
            logger.info(f"[Scheduler] Notification sent to {uid}")
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

    # Утренние уведомления — каждый час проверяем, кому пора отправить
    # (пользователи могут настраивать разное время)
    scheduler.add_job(
        morning_notifications_job,
        CronTrigger(minute=0, timezone=timezone_str),  # Каждый час в :00
        args=[bot, timezone_str],
        id="hourly_notifications",
        name="Hourly notification check",
        replace_existing=True
    )

    scheduler.start()
    logger.info(f"[Scheduler] Started. Timezone: {timezone_str}")
    return scheduler
