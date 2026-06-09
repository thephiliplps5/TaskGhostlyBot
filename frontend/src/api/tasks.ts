import { supabase } from '../lib/supabase';
import type { DailyTask, Task, User } from '../types';

export async function upsertUser(telegramId: number, firstName: string, username: string): Promise<User | null> {
    const { data, error } = await supabase
        .from('users')
        .upsert({
            telegram_id: telegramId,
            first_name: firstName || '',
            username: username || '',
        }, { onConflict: 'telegram_id', ignoreDuplicates: false })
        .select()
        .maybeSingle();
    
    if (error) {
        console.error('upsertUser error:', error);
        return null;
    }
    return data;
}

export async function fetchTasksForDate(telegramId: number, dateISO: string): Promise<DailyTask[]> {
    // Calling the RPC function created in schema_v2
    const { data, error } = await supabase.rpc('get_daily_tasks', {
        p_user_id: telegramId,
        p_date: dateISO
    });
    
    if (error) {
        console.error('fetchTasksForDate error:', error);
        return [];
    }
    return data || [];
}

export async function createTask(taskData: Partial<Task>): Promise<Task | null> {
    const { data, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();
        
    if (error) {
        console.error('createTask error:', error);
        return null;
    }
    return data;
}

export async function toggleTaskComplete(taskId: string, userId: number, date: string, isCompleted: boolean) {
    if (isCompleted) {
        // Insert completion record
        const { error } = await supabase
            .from('task_completions')
            .upsert({
                task_id: taskId,
                user_id: userId,
                date: date,
                is_completed: true
            }, { onConflict: 'task_id,date' });
            
        if (error) throw error;
    } else {
        // Delete completion record
        const { error } = await supabase
            .from('task_completions')
            .delete()
            .match({ task_id: taskId, date: date });
            
        if (error) throw error;
    }
}
