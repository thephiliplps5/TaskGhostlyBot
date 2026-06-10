import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { TaskItem } from './TaskItem';
import { toggleTaskComplete, fetchTasksForDate } from '../api/tasks';
import { toISO, haptic } from '../lib/utils';

export function TaskList() {
  const { tasks, setTasks, selectedDate, user } = useStore();
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const handleToggle = async (taskId: string, currentStatus: boolean, _completionId?: string) => {
    if (!user || busyTaskId) return; // Блокировка двойного клика
    
    const newStatus = !currentStatus;
    setBusyTaskId(taskId);

    // Haptic feedback
    haptic(newStatus ? 'success' : 'light');

    // Optimistic UI update
    const previousTasks = [...tasks];
    setTasks(tasks.map(t => 
      t.id === taskId ? { ...t, is_completed: newStatus } : t
    ));

    try {
      await toggleTaskComplete(taskId, user.telegram_id, selectedDate, newStatus);
      
      // Reload tasks to get fresh completion_id
      const freshTasks = await fetchTasksForDate(user.telegram_id, selectedDate);
      setTasks(freshTasks);
    } catch (err) {
      console.error("Toggle error:", err);
      haptic('error');
      // Revert on error
      setTasks(previousTasks);
    } finally {
      setBusyTaskId(null);
    }
  };

  const todayIso = toISO(new Date());
  const isLocked = selectedDate > todayIso;

  if (tasks.length === 0) {
    return (
      <motion.div 
        className="empty-state"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="empty-icon">👻</div>
        <p>Здесь пока пусто!</p>
        <p className="empty-sub">Нажмите + чтобы добавить задачу</p>
      </motion.div>
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
        <AnimatePresence mode="popLayout">
          {tasks.map((task, index) => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ delay: index * 0.03 }}
            >
              <TaskItem 
                task={task} 
                isLocked={isLocked}
                isBusy={busyTaskId === task.id}
                onToggle={handleToggle} 
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
