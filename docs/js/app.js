// app.js — Главный контроллер приложения

import { store } from './store.js';
import {
    fetchUser, upsertUser, fetchTasksForDate, createTask, updateTask,
    deleteTask, toggleTaskComplete, fetchUserStats, fetchWeekProgress,
    batchCreateRecurringTasks, setUserId
} from './supabase.js';
import {
    renderWeekStrip, renderStreak, renderDayProgress,
    renderTaskList, renderTasksTitle, renderStats, showToast, toISO, haptic
} from './ui.js';

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

async function init() {
    store.load();

    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#0E0E0F');
        tg.setBackgroundColor('#0E0E0F');
    }

    // Получаем данные пользователя из Telegram
    let userId = null;
    let firstName = 'Пользователь';
    let username = '';

    if (tg?.initDataUnsafe?.user?.id) {
        userId    = tg.initDataUnsafe.user.id;
        firstName = tg.initDataUnsafe.user.first_name || firstName;
        username  = tg.initDataUnsafe.user.username  || '';
    } else {
        // DEV MODE
        userId = parseInt(localStorage.getItem('dev_user_id') || '0');
        if (!userId) {
            userId = 99999999;
            localStorage.setItem('dev_user_id', userId);
        }
        firstName = localStorage.getItem('dev_name') || 'Dev User';
        console.warn('[DEV MODE] userId:', userId);
    }

    store.userId = userId;
    setUserId(userId);

    // Обновляем шапку сразу из кэша/Telegram данных
    renderProfileHeader(firstName);

    // Создаём/обновляем профиль пользователя в БД
    const user = await upsertUser(userId, firstName, username).catch(console.error);
    if (user) {
        store.streak    = user.streak    || 0;
        store.bestStreak = user.best_streak || 0;
    }
    renderStreak(store.streak);

    store.selectedDate = toISO(new Date());

    await Promise.all([
        loadWeekProgress(),
        loadTasksForDate(store.selectedDate),
    ]);

    renderWeekStrip(onDayClick);
    setupEventListeners();
    setupCalendar();
}

// ============================================================
// ПРОФИЛЬ В ШАПКЕ
// ============================================================

function renderProfileHeader(name) {
    const avatarEl = document.getElementById('user-avatar');
    const nameEl   = document.getElementById('user-name');
    if (avatarEl) avatarEl.textContent = (name || '?')[0].toUpperCase();
    if (nameEl)   nameEl.textContent   = name || 'Пользователь';
}

// ============================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================

async function loadStreak() {
    const user = await fetchUser(store.userId);
    if (user) {
        store.streak     = user.streak      || 0;
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
    const tasks = store.tasks.map(t =>
        t.id === taskId ? { ...t, is_completed: newCompleted } : t
    );
    store.tasks = tasks;
    renderTaskList(tasks, { onToggle: handleToggleTask, onEdit: openEditSheet });
    renderDayProgress(tasks);

    try {
        await toggleTaskComplete(taskId, newCompleted);
        const completed = tasks.filter(t => t.is_completed).length;
        store.setWeekProgress(store.selectedDate, { total: tasks.length, completed });
        renderWeekStrip(onDayClick);

        // Проверяем — если все выполнены, показываем мотивацию
        if (newCompleted && tasks.every(t => t.is_completed) && tasks.length > 0) {
            showToast('🔥 Все задачи выполнены!');
            haptic('medium');
        }
    } catch (e) {
        console.error('Toggle error:', e);
        await loadTasksForDate(store.selectedDate);
        showToast('Ошибка. Попробуй снова.');
    }
}

// ============================================================
// КАСТОМНЫЙ КАЛЕНДАРЬ
// ============================================================

const MONTHS_RU = [
    'Январь','Февраль','Март','Апрель','Май','Июнь',
    'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
];

let calState = { year: 0, month: 0 };  // текущий отображаемый месяц

function setupCalendar() {
    document.getElementById('cal-prev').addEventListener('click', (e) => {
        e.stopPropagation();
        haptic('light');
        calState.month--;
        if (calState.month < 0) { calState.month = 11; calState.year--; }
        renderCalendarGrid();
    });

    document.getElementById('cal-next').addEventListener('click', (e) => {
        e.stopPropagation();
        haptic('light');
        calState.month++;
        if (calState.month > 11) { calState.month = 0; calState.year++; }
        renderCalendarGrid();
    });
}

function openCalendar() {
    const selected = new Date(sheetState.date + 'T00:00:00');
    calState.year  = selected.getFullYear();
    calState.month = selected.getMonth();

    closeAllPickers();
    const calPicker = document.getElementById('calendar-picker');
    calPicker.hidden = false;
    document.getElementById('field-date').classList.add('open');
    renderCalendarGrid();
}

function closeCalendar() {
    document.getElementById('calendar-picker').hidden = true;
    document.getElementById('field-date').classList.remove('open');
}

function renderCalendarGrid() {
    const label = document.getElementById('cal-month-label');
    const grid  = document.getElementById('cal-grid');

    label.textContent = `${MONTHS_RU[calState.month]} ${calState.year}`;
    grid.innerHTML = '';

    const today = toISO(new Date());

    // Первый день месяца (0=вс...6=сб → 0=пн...6=вс)
    const firstDay = new Date(calState.year, calState.month, 1);
    let startOffset = (firstDay.getDay() + 6) % 7; // 0=пн

    // Пустые ячейки до 1-го числа
    for (let i = 0; i < startOffset; i++) {
        const empty = document.createElement('button');
        empty.className = 'cal-day empty';
        grid.appendChild(empty);
    }

    // Дни месяца
    const daysInMonth = new Date(calState.year, calState.month + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj  = new Date(calState.year, calState.month, d);
        const iso      = toISO(dateObj);
        const dow      = dateObj.getDay(); // 0=вс, 6=сб
        const isWknd   = dow === 0 || dow === 6;
        const isPast   = iso < today;
        const isToday  = iso === today;
        const isSelected = iso === sheetState.date;

        const btn = document.createElement('button');
        btn.className = [
            'cal-day',
            isToday    ? 'today'    : '',
            isSelected ? 'selected' : '',
            isPast     ? 'past'     : '',
            isWknd     ? 'weekend'  : '',
        ].filter(Boolean).join(' ');

        btn.textContent = d;
        btn.addEventListener('click', () => {
            haptic('light');
            sheetState.date = iso;
            updateDateFieldLabel();
            closeCalendar();
        });

        grid.appendChild(btn);
    }
}

// ============================================================
// BOTTOM SHEET
// ============================================================

let editingTask = null;

const sheetState = {
    priority:  'medium',
    category:  'personal',
    recurring: '',
    date:      null,
};

const priorityLabels = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
const categoryLabels = { work: 'Работа', personal: 'Личное', health: 'Здоровье', study: 'Учёба' };
const repeatLabels   = { '': 'Нет', daily: 'Каждый день', '1,2,3,4,5': 'Пн–Пт', '6,7': 'Выходные' };

function openAddSheet() {
    editingTask = null;
    sheetState.priority  = 'medium';
    sheetState.category  = 'personal';
    sheetState.recurring = '';
    sheetState.date      = store.selectedDate;

    document.getElementById('sheet-title').textContent = 'Новая задача';
    document.getElementById('task-title-input').value  = '';
    document.getElementById('btn-delete-task').hidden  = true;
    updateSheetFields();
    showSheet();
}

function openEditSheet(task) {
    editingTask = task;
    sheetState.priority  = task.priority     || 'medium';
    sheetState.category  = task.category     || 'personal';
    sheetState.recurring = task.recur_pattern || '';
    sheetState.date      = task.date;

    document.getElementById('sheet-title').textContent = 'Редактировать';
    document.getElementById('task-title-input').value  = task.title;
    document.getElementById('btn-delete-task').hidden  = false;
    updateSheetFields();
    showSheet();
}

function updateSheetFields() {
    updateDateFieldLabel();
    document.getElementById('field-priority-value').textContent = priorityLabels[sheetState.priority] || 'Средний';
    document.getElementById('field-category-value').textContent = categoryLabels[sheetState.category] || 'Личное';
    document.getElementById('field-repeat-value').textContent   = repeatLabels[sheetState.recurring]  || 'Нет';
}

function updateDateFieldLabel() {
    const today    = toISO(new Date());
    const tomorrow = toISO(new Date(Date.now() + 86400000));
    const yesterday = toISO(new Date(Date.now() - 86400000));

    let label;
    if (sheetState.date === today)     label = 'Сегодня';
    else if (sheetState.date === tomorrow)    label = 'Завтра';
    else if (sheetState.date === yesterday)   label = 'Вчера';
    else {
        const d = new Date(sheetState.date + 'T00:00:00');
        label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
    }
    document.getElementById('field-date-value').textContent = label;
}

function showSheet() {
    document.getElementById('sheet-overlay').hidden = false;
    document.getElementById('task-sheet').hidden    = false;
    closeAllPickers();
    setTimeout(() => document.getElementById('task-title-input').focus(), 100);
}

function hideSheet() {
    document.getElementById('sheet-overlay').hidden = true;
    document.getElementById('task-sheet').hidden    = true;
    closeAllPickers();
    closeCalendar();
    document.getElementById('task-title-input').blur();
}

function closeAllPickers() {
    ['priority-picker', 'category-picker', 'repeat-picker'].forEach(id => {
        document.getElementById(id).hidden = true;
    });
    closeCalendar();
}

function togglePicker(pickerId) {
    const isOpen = !document.getElementById(pickerId).hidden;
    closeAllPickers();
    if (!isOpen) document.getElementById(pickerId).hidden = false;
}

// ============================================================
// СОХРАНЕНИЕ ЗАДАЧИ
// ============================================================

async function saveTask() {
    const title = document.getElementById('task-title-input').value.trim();
    if (!title) {
        showToast('Введи название задачи');
        document.getElementById('task-title-input').focus();
        return;
    }

    const btn = document.getElementById('btn-save-task');
    btn.disabled = true;
    btn.textContent = '...';

    try {
        if (editingTask) {
            // Редактирование существующей задачи
            await updateTask(editingTask.id, {
                title,
                date:          sheetState.date,
                priority:      sheetState.priority,
                category:      sheetState.category,
                is_recurring:  !!sheetState.recurring,
                recur_pattern: sheetState.recurring || null,
            });
            showToast('✅ Задача обновлена');

        } else if (sheetState.recurring) {
            // Новая повторяющаяся задача → создаём на 30 дней вперёд
            await batchCreateRecurringTasks({
                userId:      store.userId,
                title,
                startDate:   sheetState.date,
                priority:    sheetState.priority,
                category:    sheetState.category,
                recurPattern: sheetState.recurring,
            });
            const count = sheetState.recurring === 'daily' ? 30
                : sheetState.recurring === '1,2,3,4,5' ? '~22'
                : '~8';
            showToast(`🔁 Создано на ~${count} дней`);

        } else {
            // Обычная задача
            await createTask({
                userId:      store.userId,
                title,
                date:        sheetState.date,
                priority:    sheetState.priority,
                category:    sheetState.category,
                isRecurring: false,
                recurPattern: null,
            });
            showToast('✅ Задача добавлена');
        }

        haptic('medium');
        hideSheet();
        await loadTasksForDate(store.selectedDate);
        await loadWeekProgress();
        renderWeekStrip(onDayClick);

    } catch (e) {
        console.error('Save task error:', e);
        showToast('Ошибка сохранения: ' + (e.message || ''));
    } finally {
        btn.disabled = false;
        btn.textContent = 'Сохранить';
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
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================

function setupEventListeners() {
    document.getElementById('btn-add-task').addEventListener('click', () => {
        haptic('light');
        openAddSheet();
    });

    document.getElementById('btn-stats').addEventListener('click', () => {
        haptic('light');
        showStatsScreen();
    });

    document.getElementById('btn-back-stats').addEventListener('click', () => {
        haptic('light');
        showHomeScreen();
    });

    document.getElementById('btn-save-task').addEventListener('click', saveTask);

    document.getElementById('btn-cancel-sheet').addEventListener('click', () => {
        haptic('light');
        hideSheet();
    });

    document.getElementById('sheet-overlay').addEventListener('click', hideSheet);
    document.getElementById('btn-delete-task').addEventListener('click', handleDeleteTask);

    document.getElementById('task-title-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveTask();
    });

    // ---- Поле даты → открывает кастомный календарь ----
    document.getElementById('field-date').addEventListener('click', () => {
        haptic('light');
        const cal = document.getElementById('calendar-picker');
        if (!cal.hidden) {
            closeCalendar();
        } else {
            closeAllPickers();
            openCalendar();
        }
    });

    // ---- Пикеры ----
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

    // Клик по опции пикера
    document.querySelectorAll('.picker-option').forEach(btn => {
        btn.addEventListener('click', () => {
            haptic('light');
            const picker = btn.closest('.picker');
            picker.querySelectorAll('.picker-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const value = btn.dataset.value;
            const label = btn.dataset.label;

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
