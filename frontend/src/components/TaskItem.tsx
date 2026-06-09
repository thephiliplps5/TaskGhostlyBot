import type { DailyTask } from '../types';

interface TaskItemProps {
  task: DailyTask;
  isLocked: boolean;
  onToggle: (taskId: string, currentStatus: boolean, completionId?: string) => void;
}

export function TaskItem({ task, isLocked, onToggle }: TaskItemProps) {
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
      onClick={() => {
        if (!isLocked) onToggle(task.id, task.is_completed, task.completion_id);
      }}
    >
      <div className="task-checkbox" />
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
