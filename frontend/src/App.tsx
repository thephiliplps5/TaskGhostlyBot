import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { setSupabaseToken } from './lib/supabase';
import { upsertUser, fetchTasksForDate } from './api/tasks';
import { toISO } from './lib/utils';
// import { Header } from './components/Header';
// import { CalendarStrip } from './components/CalendarStrip';
// import { TaskList } from './components/TaskList';
// import { ProfileSheet } from './components/ProfileSheet';
// import { AddTaskSheet } from './components/AddTaskSheet';
// import { AnimatePresence } from 'framer-motion';

export default function App() {
  const { 
    user, 
    setUser, 
    setTasks, 
    isLoading, 
    setLoading
  } = useStore();

  useEffect(() => {
    async function initApp() {
      try {
        const tg = (window as any).Telegram?.WebApp;
        tg?.expand();
        tg?.ready();
        
        const initData = tg?.initData || "";
        
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
           console.error("Auth failed:", await authRes.text());
           setLoading(false);
           return;
        }
        
        const authData = await authRes.json();
        setSupabaseToken(authData.token);
        
        const telegramId = authData.user.id;
        const firstName = authData.user.first_name || '';
        const username = authData.user.username || '';
        const dbUser = await upsertUser(telegramId, firstName, username);
        
        if (dbUser) {
           setUser(dbUser);
           const todayTasks = await fetchTasksForDate(telegramId, toISO(new Date()));
           setTasks(todayTasks);
        }
      } catch (err) {
        console.error("Init Error", err);
      } finally {
        setLoading(false);
      }
    }
    
    // In dev mode without TG, we might need a mock initData
    initApp();
  }, []);

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
         <p style={{ color: '#8E8E93' }}>Пожалуйста, откройте приложение через Telegram.</p>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh', paddingBottom: '96px', background: 'var(--bg)' }}>
      {/* 
        <Header />
        <CalendarStrip />
        <TaskList />
        
        <AnimatePresence>
          {isProfileOpen && <ProfileSheet />}
        </AnimatePresence>
        
        <AddTaskSheet /> 
      */}
      <div style={{ padding: '16px', color: '#fff' }}>
        <h1 style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>TaskBot React v2.0</h1>
        <p style={{ textAlign: 'center', color: '#8E8E93' }}>Привет, {user.first_name}!</p>
        <p style={{ textAlign: 'center', marginTop: '16px' }}>Компоненты загружаются...</p>
      </div>
    </div>
  );
}
