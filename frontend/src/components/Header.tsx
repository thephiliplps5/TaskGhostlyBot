import { useStore } from '../store/useStore';

export function Header() {
  const { user, setProfileOpen, selectedDate } = useStore();
  if (!user) return null;

  const dateObj = new Date(selectedDate);
  const monthNames = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'];
  const weekDays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  
  const monthStr = `${dateObj.getDate()} ${monthNames[dateObj.getMonth()]}`;
  const weekDayStr = weekDays[dateObj.getDay()];

  // Generates background based on telegram_id or username
  const avatarBg = `linear-gradient(135deg, var(--accent-blue), #5E5CE6)`;
  const initial = user.first_name ? user.first_name[0].toUpperCase() : 'U';

  return (
    <header className="app-header">
      <button className="avatar-btn" onClick={() => setProfileOpen(true)}>
        <div className="user-avatar" style={{ background: avatarBg }}>
          {initial}
        </div>
      </button>

      <div className="date-display">
        <h2 className="date-month-year">{monthStr}</h2>
        <div className="date-weekday">{weekDayStr}</div>
      </div>

      <button className="icon-btn" onClick={() => {/* Toggle calendar */}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>
    </header>
  );
}
