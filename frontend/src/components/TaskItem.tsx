import { motion } from 'framer-motion';
import type { DailyTask } from '../types';

interface TaskItemProps {
  task: DailyTask;
  isLocked: boolean;
  isBusy: boolean;
  onToggle: (taskId: string, currentStatus: boolean, completionId?: string) => void;
}

export function TaskItem({ task, isLocked, isBusy, onToggle }: TaskItemProps) {
  let categoryClass = '';
  if (task.category === 'work') categoryClass = 'cat-work';
  else if (task.category === 'personal') categoryClass = 'cat-personal';
  else if (task.category === 'health') categoryClass = 'cat-health';
  else if (task.category === 'study') categoryClass = 'cat-study';

  const categoryLabels: Record<string, string> = {
    work: '💼 Работа',
    personal: '👤 Личное',
    health: '💪 Здоровье',
    study: '📚 Учёба'
  };

  return (
    <div 
      className={`task-item ${task.is_completed ? 'completed' : ''} ${isLocked ? 'locked' : ''}`}
      data-priority={task.priority}
      style={{ opacity: isBusy ? 0.6 : 1, pointerEvents: isBusy ? 'none' : 'auto' }}
      onClick={() => {
        if (!isLocked && !isBusy) onToggle(task.id, task.is_completed, task.completion_id);
      }}
    >
      <motion.div 
        className="task-checkbox"
        animate={task.is_completed ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.2 }}
      />
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          <span className={`task-category ${categoryClass}`}>{categoryLabels[task.category] || task.category}</span>
          {task.is_recurring && <span className="task-recurring-icon">🔁</span>}
        </div>
      </div>
    </div>
  );
}
