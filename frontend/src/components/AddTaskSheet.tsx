import { useState } from 'react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import { toISO } from '../lib/utils';
import { fetchTasksForDate } from '../api/tasks';

export function AddTaskSheet() {
  const { user, selectedDate, setTasks } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('personal');
  const [repeat, setRepeat] = useState('');
  
  const handleSave = async () => {
    if (!title.trim() || !user) return;
    
    const newTask = {
      user_id: user.telegram_id,
      title: title.trim(),
      date: selectedDate,
      priority,
      category,
      is_recurring: !!repeat,
      recur_pattern: repeat || null,
      start_date: selectedDate
    };
    
    const { error } = await supabase.from('tasks').insert(newTask);
    if (error) {
      console.error("Add task error", error);
      alert("Ошибка при сохранении задачи");
    } else {
      setIsOpen(false);
      setTitle('');
      // Reload tasks
      const updatedTasks = await fetchTasksForDate(user.telegram_id, selectedDate);
      setTasks(updatedTasks);
    }
  };

  const todayIso = toISO(new Date());

  return (
    <>
      <button className="fab" onClick={() => setIsOpen(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="sheet-overlay" onClick={() => setIsOpen(false)} />
          <div className="bottom-sheet">
            <div className="sheet-handle" />
            <div className="sheet-content">
              <h3 className="sheet-title">Новая задача</h3>
              <input 
                className="task-input" 
                type="text" 
                placeholder="Название задачи..." 
                maxLength={120}
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
              
              <div className="sheet-fields">
                <div className="field-row">
                  <div className="field-icon">📅</div>
                  <div className="field-body">
                    <span className="field-label">Дата</span>
                    <span className="field-value">{selectedDate === todayIso ? 'Сегодня' : selectedDate}</span>
                  </div>
                </div>
                
                <div className="field-row">
                  <div className="field-icon">🎯</div>
                  <div className="field-body">
                    <span className="field-label">Приоритет</span>
                    <select 
                      className="field-value" 
                      style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none' }}
                      value={priority} 
                      onChange={e => setPriority(e.target.value)}
                    >
                      <option value="high">🔴 Высокий</option>
                      <option value="medium">🟡 Средний</option>
                      <option value="low">🟢 Низкий</option>
                    </select>
                  </div>
                </div>
                
                <div className="field-row">
                  <div className="field-icon">🏷</div>
                  <div className="field-body">
                    <span className="field-label">Категория</span>
                    <select 
                      className="field-value" 
                      style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none' }}
                      value={category} 
                      onChange={e => setCategory(e.target.value)}
                    >
                      <option value="work">💼 Работа</option>
                      <option value="personal">👤 Личное</option>
                      <option value="health">💪 Здоровье</option>
                      <option value="study">📚 Учёба</option>
                    </select>
                  </div>
                </div>
                
                <div className="field-row">
                  <div className="field-icon">🔁</div>
                  <div className="field-body">
                    <span className="field-label">Повтор</span>
                    <select 
                      className="field-value" 
                      style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none' }}
                      value={repeat} 
                      onChange={e => setRepeat(e.target.value)}
                    >
                      <option value="">✖ Нет</option>
                      <option value="daily">📆 Каждый день</option>
                      <option value="weekdays">🗓 Пн–Пт</option>
                      <option value="weekends">🛋 Выходные</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="sheet-actions">
                <div className="sheet-actions-right">
                  <button className="btn-secondary" onClick={() => setIsOpen(false)}>Отмена</button>
                  <button className="btn-primary" onClick={handleSave}>Сохранить</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
