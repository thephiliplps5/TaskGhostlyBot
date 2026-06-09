import { useStore } from '../store/useStore';
import { TaskItem } from './TaskItem';
import { supabase } from '../lib/supabase';
import { toISO } from '../lib/utils';

export function TaskList() {
  const { tasks, setTasks, selectedDate, user } = useStore();

  const handleToggle = async (taskId: string, currentStatus: boolean, completionId?: string) => {
    if (!user) return;
    const newStatus = !currentStatus;

    // Optimistic UI update
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, is_completed: newStatus };
      }
      return t;
    });
    setTasks(updatedTasks);

    // Save to DB
    if (newStatus) {
      const { data, error } = await supabase
        .from('task_completions')
        .insert({
          task_id: taskId,
          user_id: user.telegram_id,
          date: selectedDate,
          is_completed: true
        })
        .select()
        .single();
        
      if (!error && data) {
        setTasks(updatedTasks.map(t => t.id === taskId ? { ...t, completion_id: data.id } : t));
      } else {
        console.error("Complete error", error);
        // Revert on error
        setTasks(tasks);
      }
    } else {
      if (completionId) {
        const { error } = await supabase
          .from('task_completions')
          .delete()
          .eq('id', completionId);
          
        if (error) {
          console.error("Uncomplete error", error);
          setTasks(tasks);
        } else {
          setTasks(updatedTasks.map(t => t.id === taskId ? { ...t, completion_id: undefined } : t));
        }
      }
    }

    // Check if all tasks are completed for the day (to update streak animation later)
    const allNowCompleted = updatedTasks.length > 0 && updatedTasks.every(t => t.is_completed);
    if (allNowCompleted && selectedDate === toISO(new Date())) {
      // Trigger streak increment locally or rely on server
    }
  };

  const todayIso = toISO(new Date());
  const isLocked = selectedDate > todayIso;

  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">👻</div>
        <p>Здесь пока пусто!</p>
        <p className="empty-sub">Добавьте новую задачу ниже.</p>
      </div>
    );
  }

  const completedCount = tasks.filter(t => t.is_completed).length;

  return (
    <div className="tasks-section">
      <div className="tasks-header">
        <h3 className="section-title">Список задач</h3>
        <span className="tasks-count">{completedCount} / {tasks.length} выполнено</span>
      </div>
      
      <div className="task-list">
        {tasks.map(task => (
          <TaskItem 
            key={task.id} 
            task={task} 
            isLocked={isLocked} 
            onToggle={handleToggle} 
          />
        ))}
      </div>
    </div>
  );
}
