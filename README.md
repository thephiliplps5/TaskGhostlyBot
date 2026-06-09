# TaskBot 🔥

Telegram Mini App для ежедневного трекинга задач с системой серий (streak).

## Структура

```
taskbot/
├── bot/            # Python Telegram Bot (локально)
├── frontend/       # Mini App (GitHub Pages)
└── supabase/       # Схема базы данных
```

## Быстрый старт

### 1. Supabase

1. Создай проект на [supabase.com](https://supabase.com)
2. Запусти `supabase/schema.sql` в SQL Editor
3. Скопируй **Project URL** и **anon key** (Settings → API)

### 2. Frontend

Отредактируй `frontend/js/supabase.js`:
```js
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

### 3. Telegram Bot (локально)

```bash
cd bot
pip install -r requirements.txt
```

Заполни `bot/.env`:
```env
BOT_TOKEN=your_token_from_botfather
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
MINI_APP_URL=https://yourusername.github.io/taskbot
```

Запуск:
```bash
python bot.py
```

### 4. GitHub Pages

1. `git init && git add . && git commit -m "init"`
2. Push на GitHub
3. Settings → Pages → Source: **Deploy from branch → main → /frontend**
4. Скопируй URL → вставь в `MINI_APP_URL` в `.env` и в `@BotFather → Edit Bot → Edit Menu Button`

## Команды бота

| Команда | Действие |
|---|---|
| `/start` | Открыть Mini App |
| `/tasks` | Задачи на сегодня |
| `/streak` | Текущая серия 🔥 |
| `/notify HH:MM` | Время уведомлений |
