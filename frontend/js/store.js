// store.js — Локальное состояние приложения

const STORAGE_KEY = 'taskbot_cache';

const state = {
    userId: null,
    selectedDate: todayISO(),
    tasks: [],          // задачи для выбранного дня
    weekProgress: {},   // { 'YYYY-MM-DD': { total, completed } }
    streak: 0,
    bestStreak: 0,
};

// Сохранение в localStorage
function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            streak: state.streak,
            bestStreak: state.bestStreak,
            weekProgress: state.weekProgress,
            userId: state.userId,
        }));
    } catch (e) { /* игнорируем */ }
}

// Загрузка из localStorage
function load() {
    try {
        const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (cached.streak !== undefined) state.streak = cached.streak;
        if (cached.bestStreak !== undefined) state.bestStreak = cached.bestStreak;
        if (cached.weekProgress) state.weekProgress = cached.weekProgress;
        if (cached.userId) state.userId = cached.userId;
    } catch (e) { /* игнорируем */ }
}

function todayISO() {
    return new Date().toISOString().split('T')[0];
}

export const store = {
    get userId() { return state.userId; },
    set userId(v) { state.userId = v; save(); },

    get selectedDate() { return state.selectedDate; },
    set selectedDate(v) { state.selectedDate = v; },

    get tasks() { return state.tasks; },
    set tasks(v) { state.tasks = v; },

    get streak() { return state.streak; },
    set streak(v) { state.streak = v; save(); },

    get bestStreak() { return state.bestStreak; },
    set bestStreak(v) { state.bestStreak = v; save(); },

    get weekProgress() { return state.weekProgress; },
    setWeekProgress(date, data) {
        state.weekProgress[date] = data;
        save();
    },

    load,
};
