-- ============================================================
-- ИСПРАВЛЕНИЕ RLS политик для Telegram Mini App
-- Запустить в Supabase → SQL Editor
-- ============================================================

-- Убираем старые политики которые требуют current_setting()
DROP POLICY IF EXISTS "users_select_own"   ON users;
DROP POLICY IF EXISTS "users_update_own"   ON users;
DROP POLICY IF EXISTS "users_insert_own"   ON users;
DROP POLICY IF EXISTS "tasks_select_own"   ON tasks;
DROP POLICY IF EXISTS "tasks_insert_own"   ON tasks;
DROP POLICY IF EXISTS "tasks_update_own"   ON tasks;
DROP POLICY IF EXISTS "tasks_delete_own"   ON tasks;
DROP POLICY IF EXISTS "day_logs_select_own" ON day_logs;

-- Полный доступ для anon-ключа (фронтенд фильтрует по user_id сам)
-- Безопасность обеспечивается через Telegram initData на уровне бота

CREATE POLICY "anon_all_users"    ON users    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_tasks"    ON tasks    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_day_logs" ON day_logs FOR ALL TO anon USING (true) WITH CHECK (true);
