import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { createTask, fetchTasksForDate } from '../api/tasks';
import { toISO, haptic } from '../lib/utils';

export function AddTaskSheet() {
  const { user, selectedDate, setTasks } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('personal');
  const [repeat, setRepeat] = useState('');
  
  const resetForm = () => {
    setTitle('');
    setPriority('medium');
    setCategory('personal');
    setRepeat('');
  };

  const handleSave = async () => {
    if (!title.trim() || !user || isSaving) return;
    setIsSaving(true);
    
    const result = await createTask({
      user_id: user.telegram_id,
      title: title.trim(),
      priority: priority as 'low' | 'medium' | 'high',
      category,
      is_recurring: !!repeat,
      recur_pattern: (repeat || undefined) as any,
      start_date: selectedDate
    });
    
    if (result) {
      haptic('success');
      setIsOpen(false);
      resetForm();
      // Reload tasks
      const updatedTasks = await fetchTasksForDate(user.telegram_id, selectedDate);
      setTasks(updatedTasks);
    } else {
      haptic('error');
    }
    
    setIsSaving(false);
  };

  const todayIso = toISO(new Date());

  return (
    <>
      <button className="fab" onClick={() => { setIsOpen(true); haptic('light'); }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              className="sheet-overlay" 
              onClick={() => { setIsOpen(false); resetForm(); }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.div 
              className="bottom-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{ display: 'flex', flexDirection: 'column' }}
            >
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
                  autoFocus
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
                        style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none', WebkitAppearance: 'none' }}
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
                        style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none', WebkitAppearance: 'none' }}
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
                        style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none', WebkitAppearance: 'none' }}
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
                    <button className="btn-secondary" onClick={() => { setIsOpen(false); resetForm(); }}>Отмена</button>
                    <button 
                      className="btn-primary" 
                      onClick={handleSave}
                      disabled={isSaving || !title.trim()}
                      style={{ opacity: (isSaving || !title.trim()) ? 0.5 : 1 }}
                    >
                      {isSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
