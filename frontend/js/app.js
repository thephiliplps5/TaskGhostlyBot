// app.js — Главный контроллер приложения
// Инициализация, роутинг, обработчики событий

import { store } from './store.js';
import {
    fetchUser, fetchTasksForDate, createTask, updateTask,
    deleteTask, toggleTaskComplete, fetchUserStats, fetchWeekProgress, setUserId
} from './supabase.js';
import {
    renderWeekStrip, renderStreak, renderDayProgress,
    renderTaskList, renderTasksTitle, renderStats, showToast, toISO, haptic
} from './ui.js';

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

async function init() {
    // Восстанавливаем кэш
    store.load();

    // Telegram WebApp
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#0E0E0F');
        tg.setBackgroundColor('#0E0E0F');
    }

    // Получаем telegram_id из initData
    let userId = null;

    if (tg?.initDataUnsafe?.user?.id) {
        userId = tg.initDataUnsafe.user.id;
    } else {
        // DEV MODE: тестовый ID без Telegram
        userId = parseInt(localStorage.getItem('dev_user_id') || '0');
        if (!userId) {
            userId = 99999999; // фиктивный ID для разработки
            localStorage.setItem('dev_user_id', userId);
        }
        console.warn('[DEV MODE] Using fake userId:', userId);
    }

    store.userId = userId;
    setUserId(userId);

    // Проверяем/создаём пользователя
    await fetchUser(userId).catch(console.error);

    // Сегодня
    store.selectedDate = toISO(new Date());

    // Загружаем данные
    await Promise.all([
        loadWeekProgress(),
        loadTasksForDate(store.selectedDate),
        loadStreak(),
    ]);

    // Рендерим
    renderWeekStrip(onDayClick);

    // Обработчики событий
    setupEventListeners();
}


// ============================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================

async function loadStreak() {
    const user = await fetchUser(store.userId);
    if (user) {
        store.streak = user.streak || 0;
        store.bestStreak = user.best_streak || 0;
    }
    renderStreak(store.streak);
}

async function loadTasksForDate(dateISO) {
    const tasks = await fetchTasksForDate(store.userId, dateISO);
    store.tasks = tasks;
    renderTaskList(tasks, { onToggle: handleToggleTask, onEdit: openEditSheet });
    renderDayProgress(tasks);
    renderTasksTitle(dateISO);
}

async function loadWeekProgress() {
    // Получаем даты недели (пн-вс)
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7;
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - dayOfWeek + i);
        dates.push(toISO(d));
    }

    const progress = await fetchWeekProgress(store.userId, dates);
    for (const p of progress) {
        store.setWeekProgress(p.date, { total: p.total_tasks, completed: p.completed_tasks });
    }
}


// ============================================================
// ОБРАБОТЧИКИ
// ============================================================

async function onDayClick(dateISO) {
    haptic('light');
    store.selectedDate = dateISO;
    renderWeekStrip(onDayClick);
    await loadTasksForDate(dateISO);
}

async function handleToggleTask(taskId, newCompleted) {
    // Оптимистичное обновление UI
    const tasks = store.tasks.map(t =>
        t.id === taskId ? { ...t, is_completed: newCompleted } : t
    );
    store.tasks = tasks;
    renderTaskList(tasks, { onToggle: handleToggleTask, onEdit: openEditSheet });
    renderDayProgress(tasks);

    try {
        await toggleTaskComplete(taskId, newCompleted);
        // Обновляем прогресс недели
        const today = toISO(new Date());
        const completed = tasks.filter(t => t.is_completed).length;
        store.setWeekProgress(store.selectedDate, { total: tasks.length, completed });
        renderWeekStrip(onDayClick);
    } catch (e) {
        // Откат при ошибке
        console.error('Toggle error:', e);
        await loadTasksForDate(store.selectedDate);
        showToast('Ошибка. Попробуй снова.');
    }
}


// ============================================================
// BOTTOM SHEET — Добавление / редактирование задачи
// ============================================================

let editingTask = null;

const sheetState = {
    priority: 'medium',
    category: 'personal',
    recurring: '',
    date: null,
};

const priorityLabels = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
const categoryLabels = { work: 'Работа', personal: 'Личное', health: 'Здоровье', study: 'Учёба' };
const repeatLabels   = { '': 'Нет', daily: 'Каждый день', '1,2,3,4,5': 'Пн–Пт', '6,7': 'Выходные' };

function openAddSheet() {
    editingTask = null;
    sheetState.priority = 'medium';
    sheetState.category = 'personal';
    sheetState.recurring = '';
    sheetState.date = store.selectedDate;

    document.getElementById('sheet-title').textContent = 'Новая задача';
    document.getElementById('task-title-input').value = '';
    document.getElementById('btn-delete-task').hidden = true;
    updateSheetFields();
    showSheet();
}

function openEditSheet(task) {
    editingTask = task;
    sheetState.priority = task.priority || 'medium';
    sheetState.category = task.category || 'personal';
    sheetState.recurring = task.recur_pattern || '';
    sheetState.date = task.date;

    document.getElementById('sheet-title').textContent = 'Редактировать';
    document.getElementById('task-title-input').value = task.title;
    document.getElementById('btn-delete-task').hidden = false;
    updateSheetFields();
    showSheet();
}

function updateSheetFields() {
    // Дата
    const d = new Date(sheetState.date + 'T00:00:00');
    const today = toISO(new Date());
    const tomorrow = toISO(new Date(Date.now() + 86400000));
    let dateLabel = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    if (sheetState.date === today)    dateLabel = 'Сегодня';
    if (sheetState.date === tomorrow) dateLabel = 'Завтра';
    document.getElementById('field-date-value').textContent = dateLabel;
    document.getElementById('task-date-input').value = sheetState.date;

    document.getElementById('field-priority-value').textContent = priorityLabels[sheetState.priority] || 'Средний';
    document.getElementById('field-category-value').textContent = categoryLabels[sheetState.category] || 'Личное';
    document.getElementById('field-repeat-value').textContent   = repeatLabels[sheetState.recurring] || 'Нет';
}

function showSheet() {
    document.getElementById('sheet-overlay').hidden = false;
    document.getElementById('task-sheet').hidden = false;
    closeAllPickers();
    // Фокус на ввод
    setTimeout(() => document.getElementById('task-title-input').focus(), 100);
}

function hideSheet() {
    document.getElementById('sheet-overlay').hidden = true;
    document.getElementById('task-sheet').hidden = true;
    closeAllPickers();
    document.getElementById('task-title-input').blur();
}

function closeAllPickers() {
    ['priority-picker', 'category-picker', 'repeat-picker'].forEach(id => {
        document.getElementById(id).hidden = true;
    });
}

function togglePicker(pickerId) {
    const pickers = ['priority-picker', 'category-picker', 'repeat-picker'];
    pickers.forEach(id => {
        document.getElementById(id).hidden = (id !== pickerId) || !document.getElementById(id).hidden;
    });
}

async function saveTask() {
    const title = document.getElementById('task-title-input').value.trim();
    if (!title) {
        showToast('Введи название задачи');
        document.getElementById('task-title-input').focus();
        return;
    }

    const taskData = {
        userId: store.userId,
        title,
        date: sheetState.date,
        priority: sheetState.priority,
        category: sheetState.category,
        isRecurring: !!sheetState.recurring,
        recurPattern: sheetState.recurring || null,
    };

    try {
        if (editingTask) {
            await updateTask(editingTask.id, {
                title,
                date: sheetState.date,
                priority: sheetState.priority,
                category: sheetState.category,
                is_recurring: !!sheetState.recurring,
                recur_pattern: sheetState.recurring || null,
            });
            showToast('✅ Задача обновлена');
        } else {
            await createTask(taskData);
            showToast('✅ Задача добавлена');
        }

        haptic('medium');
        hideSheet();
        await loadTasksForDate(store.selectedDate);
        await loadWeekProgress();
        renderWeekStrip(onDayClick);
    } catch (e) {
        console.error('Save task error:', e);
        showToast('Ошибка сохранения');
    }
}

async function handleDeleteTask() {
    if (!editingTask) return;
    if (!confirm('Удалить задачу?')) return;

    try {
        await deleteTask(editingTask.id);
        haptic('medium');
        hideSheet();
        showToast('🗑 Задача удалена');
        await loadTasksForDate(store.selectedDate);
        await loadWeekProgress();
        renderWeekStrip(onDayClick);
    } catch (e) {
        console.error('Delete error:', e);
        showToast('Ошибка удаления');
    }
}


// ============================================================
// ЭКРАН СТАТИСТИКИ
// ============================================================

async function showStatsScreen() {
    const { user, tasks } = await fetchUserStats(store.userId);
    renderStats(user, tasks);

    document.getElementById('screen-home').classList.remove('active');
    document.getElementById('screen-stats').classList.add('active');
}

function showHomeScreen() {
    document.getElementById('screen-stats').classList.remove('active');
    document.getElementById('screen-home').classList.add('active');
}


// ============================================================
// SETUP EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    // FAB — добавить задачу
    document.getElementById('btn-add-task').addEventListener('click', () => {
        haptic('light');
        openAddSheet();
    });

    // Статистика
    document.getElementById('btn-stats').addEventListener('click', () => {
        haptic('light');
        showStatsScreen();
    });
    document.getElementById('btn-back-stats').addEventListener('click', () => {
        haptic('light');
        showHomeScreen();
    });

    // Sheet — сохранить
    document.getElementById('btn-save-task').addEventListener('click', saveTask);

    // Sheet — отмена
    document.getElementById('btn-cancel-sheet').addEventListener('click', () => {
        haptic('light');
        hideSheet();
    });

    // Sheet — оверлей
    document.getElementById('sheet-overlay').addEventListener('click', hideSheet);

    // Sheet — удалить
    document.getElementById('btn-delete-task').addEventListener('click', handleDeleteTask);

    // Enter в поле ввода = сохранить
    document.getElementById('task-title-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveTask();
    });

    // --- Пикеры ---
    document.getElementById('field-priority').addEventListener('click', () => {
        haptic('light');
        togglePicker('priority-picker');
    });
    document.getElementById('field-category').addEventListener('click', () => {
        haptic('light');
        togglePicker('category-picker');
    });
    document.getElementById('field-repeat').addEventListener('click', () => {
        haptic('light');
        togglePicker('repeat-picker');
    });

    // Выбор даты
    document.getElementById('task-date-input').addEventListener('change', (e) => {
        sheetState.date = e.target.value;
        updateSheetFields();
    });

    // Клик по опции пикера
    document.querySelectorAll('.picker-option').forEach(btn => {
        btn.addEventListener('click', () => {
            haptic('light');
            const picker = btn.closest('.picker');
            const value = btn.dataset.value;
            const label = btn.dataset.label;

            // Убираем active у других
            picker.querySelectorAll('.picker-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (picker.id === 'priority-picker') {
                sheetState.priority = value;
                document.getElementById('field-priority-value').textContent = label;
            } else if (picker.id === 'category-picker') {
                sheetState.category = value;
                document.getElementById('field-category-value').textContent = label;
            } else if (picker.id === 'repeat-picker') {
                sheetState.recurring = value;
                document.getElementById('field-repeat-value').textContent = label;
            }

            picker.hidden = true;
        });
    });
}


// ============================================================
// СТАРТ
// ============================================================

document.addEventListener('DOMContentLoaded', init);
