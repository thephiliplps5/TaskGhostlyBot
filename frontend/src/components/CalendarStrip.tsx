import { useStore } from '../store/useStore';
import { toISO } from '../lib/utils';

export function CalendarStrip() {
  const { selectedDate, setSelectedDate, weekProgress } = useStore();

  const generateWeek = (centerDateStr: string) => {
    const centerDate = new Date(centerDateStr);
    const day = centerDate.getDay(); // 0 is Sunday
    // Get Monday of the current week
    const diff = centerDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(centerDate.setDate(diff));
    
    const week = [];
    const shortDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      week.push({
        date: toISO(d),
        label: shortDays[i],
        dayNum: d.getDate()
      });
    }
    return week;
  };

  const weekDays = generateWeek(selectedDate);
  const todayIso = toISO(new Date());

  return (
    <div className="week-strip">
      {weekDays.map(({ date, label, dayNum }) => {
        const isToday = date === todayIso;
        const isSelected = date === selectedDate;
        const progress = weekProgress[date];
        
        let extraClass = '';
        if (isToday) extraClass += ' today';
        if (isSelected) extraClass += ' selected';
        if (date > todayIso) extraClass += ' future';
        
        if (progress) {
          if (progress.total > 0 && progress.completed === progress.total) extraClass += ' done';
          else if (progress.completed > 0) extraClass += ' partial';
        }

        return (
          <div 
            key={date} 
            className={`week-day ${extraClass.trim()}`}
            onClick={() => setSelectedDate(date)}
          >
            <span className="week-day-label">{label}</span>
            <div className="week-day-circle">
              <span>{dayNum}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
