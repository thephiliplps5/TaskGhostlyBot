export interface User {
  telegram_id: number;
  username?: string;
  first_name?: string;
  streak: number;
  best_streak: number;
  total_tasks: number;
  notify_time: string;
}

export interface Task {
  id: string;
  user_id: number;
  title: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  is_recurring: boolean;
  recur_pattern?: 'daily' | 'weekdays' | 'weekends';
  start_date: string;
  end_date?: string;
}

export interface DailyTask extends Task {
  is_completed: boolean;
  completion_id?: string;
}

export interface WeekProgress {
  total: number;
  completed: number;
}
