-- ============================================
-- TaskBot — Supabase Schema
-- Запустить в: Supabase → SQL Editor
-- ============================================

-- Включаем расширение UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    telegram_id     BIGINT PRIMARY KEY,
    username        TEXT,
    first_name      TEXT,
    streak          INT DEFAULT 0,
    best_streak     INT DEFAULT 0,
    last_active_date DATE,
    notify_time     TIME DEFAULT '09:00:00',
    notify_enabled  BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ТАБЛИЦА ЗАДАЧ
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    date            DATE NOT NULL,
    priority        TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    category        TEXT DEFAULT 'personal' CHECK (category IN ('work', 'personal', 'health', 'study')),
    is_completed    BOOLEAN DEFAULT FALSE,
    is_recurring    BOOLEAN DEFAULT FALSE,
    recur_pattern   TEXT,           -- 'daily' | '1,2,3' (пн=1...вс=7)
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрых запросов по дате
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);

-- ============================================
-- ТАБЛИЦА ЛОГОВ ДНЕЙ (для streak)
-- ============================================
CREATE TABLE IF NOT EXISTS day_logs (
    id              SERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    total_tasks     INT DEFAULT 0,
    completed_tasks INT DEFAULT 0,
    is_perfect      BOOLEAN DEFAULT FALSE,   -- все задачи выполнены
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_day_logs_user_date ON day_logs(user_id, date);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Включаем RLS для всех таблиц
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_logs ENABLE ROW LEVEL SECURITY;

-- Политики для users
-- Пользователь видит и редактирует только себя
CREATE POLICY "users_select_own" ON users
    FOR SELECT USING (telegram_id = (current_setting('app.user_id', TRUE))::BIGINT);

CREATE POLICY "users_update_own" ON users
    FOR UPDATE USING (telegram_id = (current_setting('app.user_id', TRUE))::BIGINT);

CREATE POLICY "users_insert_own" ON users
    FOR INSERT WITH CHECK (telegram_id = (current_setting('app.user_id', TRUE))::BIGINT);

-- Политики для tasks
CREATE POLICY "tasks_select_own" ON tasks
    FOR SELECT USING (user_id = (current_setting('app.user_id', TRUE))::BIGINT);

CREATE POLICY "tasks_insert_own" ON tasks
    FOR INSERT WITH CHECK (user_id = (current_setting('app.user_id', TRUE))::BIGINT);

CREATE POLICY "tasks_update_own" ON tasks
    FOR UPDATE USING (user_id = (current_setting('app.user_id', TRUE))::BIGINT);

CREATE POLICY "tasks_delete_own" ON tasks
    FOR DELETE USING (user_id = (current_setting('app.user_id', TRUE))::BIGINT);

-- Политики для day_logs
CREATE POLICY "day_logs_select_own" ON day_logs
    FOR SELECT USING (user_id = (current_setting('app.user_id', TRUE))::BIGINT);

-- ============================================
-- ФУНКЦИЯ: Автоматическое создание повторяющихся задач
-- ============================================
CREATE OR REPLACE FUNCTION generate_recurring_tasks(p_date DATE)
RETURNS void AS $$
DECLARE
    task_record RECORD;
    day_of_week INT;
BEGIN
    day_of_week := EXTRACT(DOW FROM p_date);
    -- Конвертируем: 0=вс→7, 1=пн→1 ... 6=сб→6
    IF day_of_week = 0 THEN day_of_week := 7; END IF;

    FOR task_record IN
        SELECT DISTINCT ON (user_id, title) *
        FROM tasks
        WHERE is_recurring = TRUE
          AND date < p_date
          AND (
              recur_pattern = 'daily'
              OR recur_pattern LIKE '%' || day_of_week || '%'
          )
    LOOP
        -- Создаём только если ещё нет на эту дату
        INSERT INTO tasks (user_id, title, date, priority, category, is_recurring, recur_pattern)
        VALUES (task_record.user_id, task_record.title, p_date,
                task_record.priority, task_record.category,
                TRUE, task_record.recur_pattern)
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ВЬЮШКА: Прогресс пользователя за неделю
-- ============================================
CREATE OR REPLACE VIEW week_progress AS
SELECT
    t.user_id,
    t.date,
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE t.is_completed = TRUE) as completed_tasks,
    CASE
        WHEN COUNT(*) = 0 THEN NULL
        ELSE ROUND(COUNT(*) FILTER (WHERE t.is_completed = TRUE)::NUMERIC / COUNT(*) * 100)
    END as completion_percent
FROM tasks t
GROUP BY t.user_id, t.date;
