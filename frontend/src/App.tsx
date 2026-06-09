import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { setSupabaseToken } from './lib/supabase';
import { fetchUserByTelegramId, fetchTasksForDate } from './api/tasks';
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
        const dbUser = await fetchUserByTelegramId(telegramId);
        
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
      <div className="flex items-center justify-center min-h-screen text-white">
         <div className="animate-spin text-4xl">⏳</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
         <h1 className="text-2xl font-bold mb-2">Ошибка авторизации</h1>
         <p className="text-gray-400">Пожалуйста, откройте приложение через Telegram.</p>
      </div>
    );
  }

  return (
    <div className="app-container relative overflow-hidden bg-background min-h-screen pb-24">
      {/* 
        <Header />
        <CalendarStrip />
        <TaskList />
        
        <AnimatePresence>
          {isProfileOpen && <ProfileSheet />}
        </AnimatePresence>
        
        <AddTaskSheet /> 
      */}
      <div className="p-4">
        <h1 className="text-3xl font-bold mb-4 text-center">TaskBot React v2.0</h1>
        <p className="text-center text-gray-400">Привет, {user.first_name}!</p>
        <p className="text-center mt-4">Компоненты загружаются...</p>
      </div>
    </div>
  );
}
