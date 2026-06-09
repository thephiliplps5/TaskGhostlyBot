import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { setSupabaseToken } from './lib/supabase';
import { upsertUser, fetchTasksForDate } from './api/tasks';
import { Header } from './components/Header';
import { CalendarStrip } from './components/CalendarStrip';
import { StreakBlock } from './components/StreakBlock';
import { TaskList } from './components/TaskList';
import { AddTaskSheet } from './components/AddTaskSheet';
// import { ProfileSheet } from './components/ProfileSheet';
// import { AnimatePresence } from 'framer-motion';

export default function App() {
  const { 
    user, 
    setUser, 
    setTasks, 
    isLoading, 
    setLoading,
    authError,
    setAuthError,
    selectedDate
  } = useStore();

  useEffect(() => {
    async function initApp() {
      try {
        const tg = (window as any).Telegram?.WebApp;
        tg?.expand();
        tg?.ready();
        
        const initData = tg?.initData || "";
        if (!initData) {
          setAuthError("Нет initData от Telegram. Откройте внутри Telegram.");
          setLoading(false);
          return;
        }
        
        // Fetch JWT from our Python bot backend via Localtunnel (HTTPS)
        const authRes = await fetch('https://true-places-prove.loca.lt/api/auth', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Bypass-Tunnel-Reminder': 'true'
          },
          body: JSON.stringify({ initData })
        });
        
        if (!authRes.ok) {
           const errText = await authRes.text();
           console.error("Auth failed:", errText);
           setAuthError(`API Error (${authRes.status}): ${errText}`);
           setLoading(false);
           return;
        }
        
        const authData = await authRes.json();
        setSupabaseToken(authData.token);
        
        const telegramId = authData.user.id;
        const firstName = authData.user.first_name || '';
        const username = authData.user.username || '';
        const { user: dbUser, error: dbError } = await upsertUser(telegramId, firstName, username);
        
        if (dbUser) {
           setUser(dbUser);
           const todayTasks = await fetchTasksForDate(telegramId, selectedDate);
           setTasks(todayTasks);
        } else {
           setAuthError(`DB Error: ${dbError?.message || JSON.stringify(dbError)}`);
        }
      } catch (err: any) {
        console.error("Init Error", err);
        setAuthError(`Catch Error: ${err?.message || String(err)}`);
      } finally {
        setLoading(false);
      }
    }
    
    initApp();
  }, []);

  // Fetch tasks when selectedDate changes
  useEffect(() => {
    if (user && selectedDate) {
      const fetchSelected = async () => {
        const dailyTasks = await fetchTasksForDate(user.telegram_id, selectedDate);
        setTasks(dailyTasks);
      };
      fetchSelected();
    }
  }, [selectedDate, user, setTasks]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#fff' }}>
         <div style={{ fontSize: '40px', animation: 'spin 1s linear infinite' }}>⏳</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '16px', textAlign: 'center', color: '#fff' }}>
         <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Ошибка авторизации</h1>
         <p style={{ color: '#8E8E93', marginBottom: '16px' }}>Пожалуйста, откройте приложение через Telegram.</p>
         {authError && (
           <div style={{ background: 'rgba(255,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid red', maxWidth: '100%', wordBreak: 'break-all' }}>
              <p style={{ color: '#ff4444', fontSize: '13px' }}>{authError}</p>
           </div>
         )}
      </div>
    );
  }

  return (
    <div className="app-container" style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh', paddingBottom: '96px', background: 'var(--bg)' }}>
      <Header />
      <CalendarStrip />
      <StreakBlock />
      <TaskList />
      
      {/* <AnimatePresence>
        {isProfileOpen && <ProfileSheet />}
      </AnimatePresence> */}
      
      <AddTaskSheet /> 
    </div>
  );
}
