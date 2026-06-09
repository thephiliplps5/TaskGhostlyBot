// supabase.js — Клиент Supabase для фронтенда
// Использует anon key (публичный) + RLS для изоляции данных

const SUPABASE_URL = 'https://soblvyvwwdmsfdmcaljh.supabase.co';   // ← заменить
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvYmx2eXZ3d2Rtc2ZkbWNhbGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NzU5NDQsImV4cCI6MjA5NjU1MTk0NH0.F7pq_ZGGp3sPRrE5_s_9BtMM_RsS9NV4ykHymVYWYrM';             // ← заменить

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// user_id текущего пользователя (устанавливается в app.js)
let _userId = null;

export function setUserId(id) {
    _userId = id;
    // Устанавливаем для RLS политик
    // (при каждом запросе передаём через заголовок)
}

export function getUserId() { return _userId; }


// ============================================================
// ПОЛЬЗОВАТЕЛИ
// ============================================================

export async function fetchUser(telegramId) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();
    if (error) console.error('fetchUser error:', error);
    return data;
}

// Создаёт пользователя если не существует (при первом открытии Mini App)
export async function upsertUser(telegramId, firstName, username) {
    const { data, error } = await supabase
        .from('users')
        .upsert({
            telegram_id: telegramId,
            first_name: firstName || '',
            username: username || '',
        }, { onConflict: 'telegram_id', ignoreDuplicates: false })
        .select()
        .maybeSingle();
    if (error) console.error('upsertUser error:', error);
    return data;
}


// ============================================================
// ЗАДАЧИ
// ============================================================

export async function fetchTasksForDate(userId, date) {
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .order('created_at', { ascending: true });
    if (error) console.error('fetchTasks error:', error);
    return data || [];
}

export async function createTask({ userId, title, date, priority, category, isRecurring, recurPattern }) {
    const { data, error } = await supabase
        .from('tasks')
        .insert({
            user_id: userId,
            title,
            date,
            priority: priority || 'medium',
            category: category || 'personal',
            is_recurring: isRecurring || false,
            recur_pattern: recurPattern || null,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// Создаёт повторяющуюся задачу сразу на 30 дней вперёд
export async function batchCreateRecurringTasks({ userId, title, startDate, priority, category, recurPattern }) {
    const rows = [];
    const start = new Date(startDate + 'T00:00:00');

    for (let i = 0; i <= 30; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const iso = d.toISOString().split('T')[0];

        // День недели: 0=вс, 1=пн ... 6=сб → переводим в 1=пн..7=вс
        const dow = d.getDay();
        const dayNum = dow === 0 ? 7 : dow;  // 1=пн, 7=вс
        const isWeekend = dayNum >= 6;

        let include = false;
        if (recurPattern === 'daily') {
            include = true;
        } else if (recurPattern === '1,2,3,4,5') {
            include = dayNum <= 5;
        } else if (recurPattern === '6,7') {
            include = isWeekend;
        }

        if (include) {
            rows.push({
                user_id: userId,
                title,
                date: iso,
                priority: priority || 'medium',
                category: category || 'personal',
                is_recurring: true,
                recur_pattern: recurPattern,
            });
        }
    }

    if (rows.length === 0) return [];

    const { data, error } = await supabase
        .from('tasks')
        .upsert(rows, { onConflict: 'user_id,title,date', ignoreDuplicates: true })
        .select();
    if (error) throw error;
    return data || [];
}

export async function updateTask(taskId, updates) {
    const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function toggleTaskComplete(taskId, isCompleted) {
    const { data, error } = await supabase
        .from('tasks')
        .update({
            is_completed: isCompleted,
            completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', taskId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteTask(taskId) {
    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
    if (error) throw error;
}


// ============================================================
// СТАТИСТИКА
// ============================================================

export async function fetchUserStats(userId) {
    const { data: user } = await supabase
        .from('users')
        .select('streak, best_streak')
        .eq('telegram_id', userId)
        .maybeSingle();

    // Задачи за последние 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: tasks } = await supabase
        .from('tasks')
        .select('date, is_completed')
        .eq('user_id', userId)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

    return { user: user || {}, tasks: tasks || [] };
}

export async function fetchWeekProgress(userId, dates) {
    const { data, error } = await supabase
        .from('week_progress')
        .select('*')
        .eq('user_id', userId)
        .in('date', dates);
    if (error) console.error('fetchWeekProgress error:', error);
    return data || [];
}
