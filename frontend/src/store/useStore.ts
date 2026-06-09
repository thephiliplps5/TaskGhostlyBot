import { create } from 'zustand';
import type { User, DailyTask, WeekProgress } from '../types';
import { toISO } from '../lib/utils'; // I will create this

interface AppState {
  user: User | null;
  tasks: DailyTask[];
  selectedDate: string;
  isLoading: boolean;
  isProfileOpen: boolean;
  weekProgress: Record<string, WeekProgress>;
  
  setUser: (user: User) => void;
  setTasks: (tasks: DailyTask[]) => void;
  setSelectedDate: (date: string) => void;
  setLoading: (loading: boolean) => void;
  setProfileOpen: (isOpen: boolean) => void;
  setWeekProgress: (date: string, progress: WeekProgress) => void;
  
  // Computed-like action to update streak
  incrementStreak: () => void;
  decrementStreak: () => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  tasks: [],
  selectedDate: toISO(new Date()),
  isLoading: true,
  isProfileOpen: false,
  weekProgress: {},

  setUser: (user) => set({ user }),
  setTasks: (tasks) => set({ tasks }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setLoading: (loading) => set({ isLoading: loading }),
  setProfileOpen: (isOpen) => set({ isProfileOpen: isOpen }),
  setWeekProgress: (date, progress) => 
    set((state) => ({ 
      weekProgress: { ...state.weekProgress, [date]: progress } 
    })),
    
  incrementStreak: () => set((state) => ({
    user: state.user ? { ...state.user, streak: state.user.streak + 1 } : null
  })),
  decrementStreak: () => set((state) => ({
    user: state.user ? { ...state.user, streak: Math.max(0, state.user.streak - 1) } : null
  }))
}));
