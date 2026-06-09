-- ============================================
-- СБРОС СТАРЫХ ДАННЫХ И ТАБЛИЦ (ДЛЯ ПЕРЕХОДА НА V2)
-- ============================================
DROP TABLE IF EXISTS task_completions CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- 1. ПОЛЬЗОВАТЕЛИ
-- ============================================
CREATE TABLE users (
    telegram_id BIGINT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 0,
    notify_time TEXT DEFAULT '09:00',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. ЗАДАЧИ (ШАБЛОНЫ И ОДИНОЧНЫЕ)
-- ============================================
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    category TEXT DEFAULT 'personal',
    is_recurring BOOLEAN DEFAULT FALSE,
    recur_pattern TEXT, -- 'daily', 'weekdays', 'weekends' или NULL
    start_date DATE NOT NULL,
    end_date DATE, -- NULL значит бесконечно
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. ВЫПОЛНЕНИЯ ЗАДАЧ (ИСТОРИЯ)
-- ============================================
CREATE TABLE task_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_id, date) -- Нельзя создать две записи о выполнении одной задачи в один день
);

-- ============================================
-- 4. RLS ПОЛИТИКИ (БЕЗОПАСНОСТЬ TIER-1)
-- ============================================
-- Включаем RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

-- Функция для получения ID пользователя из JWT
-- Наш кастомный сервер кладёт telegram_id в поле sub токена.
CREATE OR REPLACE FUNCTION public.telegram_id() RETURNS BIGINT AS $$
  SELECT (NULLIF(current_setting('request.jwt.claim.sub', true), ''))::bigint;
$$ LANGUAGE SQL STABLE;

-- ПОЛИТИКИ ДЛЯ USERS
CREATE POLICY "Users can read own profile" ON users
FOR SELECT USING (telegram_id = public.telegram_id());

CREATE POLICY "Users can insert own profile" ON users
FOR INSERT WITH CHECK (telegram_id = public.telegram_id());

CREATE POLICY "Users can update own profile" ON users
FOR UPDATE USING (telegram_id = public.telegram_id());

-- ПОЛИТИКИ ДЛЯ TASKS
CREATE POLICY "Users can manage own tasks" ON tasks
FOR ALL USING (user_id = public.telegram_id());

-- ПОЛИТИКИ ДЛЯ TASK_COMPLETIONS
CREATE POLICY "Users can manage own completions" ON task_completions
FOR ALL USING (user_id = public.telegram_id());

-- Для бота (service_role) нужно разрешить всё, так как он использует service_key
-- service_key игнорирует RLS по умолчанию, поэтому отдельные политики не нужны.

-- ============================================
-- 5. RPC (ХРАНИМЫЕ ПРОЦЕДУРЫ ДЛЯ ОПТИМИЗАЦИИ)
-- ============================================
-- Функция для быстрого получения задач на конкретный день с их статусом выполнения
CREATE OR REPLACE FUNCTION get_daily_tasks(p_user_id BIGINT, p_date DATE)
RETURNS TABLE (
    id UUID,
    title TEXT,
    priority TEXT,
    category TEXT,
    is_recurring BOOLEAN,
    recur_pattern TEXT,
    is_completed BOOLEAN,
    completion_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.title,
        t.priority,
        t.category,
        t.is_recurring,
        t.recur_pattern,
        COALESCE(tc.is_completed, FALSE) AS is_completed,
        tc.id AS completion_id
    FROM tasks t
    LEFT JOIN task_completions tc ON tc.task_id = t.id AND tc.date = p_date
    WHERE t.user_id = p_user_id
      AND t.start_date <= p_date
      AND (t.end_date IS NULL OR t.end_date >= p_date)
      AND (
          t.is_recurring = FALSE 
          OR t.recur_pattern = 'daily'
          OR (t.recur_pattern = 'weekdays' AND extract(dow from p_date) BETWEEN 1 AND 5)
          OR (t.recur_pattern = 'weekends' AND extract(dow from p_date) IN (0, 6))
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
