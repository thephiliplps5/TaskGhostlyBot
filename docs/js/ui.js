// ui.js — Рендер компонентов

import { store } from './store.js';

// ============================================================
// НЕДЕЛЯ (7 дней)
// ============================================================

const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function renderWeekStrip(onDayClick) {
    const strip = document.getElementById('week-strip');
    strip.innerHTML = '';

    const today = new Date();
    const todayISO = toISO(today);

    // Начало недели (Понедельник)
    const startOfWeek = new Date(today);
    const dayOfWeek = (today.getDay() + 6) % 7; // 0=пн
    startOfWeek.setDate(today.getDate() - dayOfWeek);

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const iso = toISO(d);
        const isPast = iso < todayISO;
        const isToday = iso === todayISO;
        const isFuture = iso > todayISO;
        const isSelected = iso === store.selectedDate;

        const progress = store.weekProgress[iso];
        const isDone = progress && progress.total > 0 && progress.completed === progress.total;
        const isPartial = progress && progress.total > 0 && progress.completed > 0 && !isDone;

        const div = document.createElement('div');
        div.className = [
            'week-day',
            isToday ? 'today' : '',
            isSelected && !isToday ? 'selected' : '',
            isDone ? 'done' : '',
            isPartial ? 'partial' : '',
            isFuture ? 'future' : '',
        ].filter(Boolean).join(' ');

        div.setAttribute('data-date', iso);
        div.setAttribute('aria-label', `${DAY_LABELS[d.getDay()]}, ${d.getDate()}`);

        div.innerHTML = `
            <span class="week-day-label">${DAY_LABELS[d.getDay()]}</span>
            <div class="week-day-circle">
                <span>${d.getDate()}</span>
            </div>
        `;

        div.addEventListener('click', () => onDayClick(iso));
        strip.appendChild(div);
    }
}


// ============================================================
// STREAK
// ============================================================

export function renderStreak(streak) {
    const num = document.getElementById('streak-number');
    const flame = document.getElementById('flame-icon');

    // Анимация числа
    animateNumber(num, parseInt(num.textContent) || 0, streak, 600);

    const svgFlame = `
    <svg width="40" height="40" viewBox="0 0 24 24" fill="url(#flame-grad)" stroke="none">
        <defs>
            <linearGradient id="flame-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stop-color="#FF453A" />
                <stop offset="50%" stop-color="#FF9F0A" />
                <stop offset="100%" stop-color="#FFD60A" />
            </linearGradient>
        </defs>
        <path d="M12 2C12 2 15 6 15 10C15 11 14.5 12 14 13C14 13 16 11 18 13C19 14.2 20 16 20 18C20 21 17 22 12 22C7 22 4 20 4 17C4 14.5 5.5 12.5 7 11C8.5 9.5 9 7 9 7C9 7 10 9 11 10C12 11 12.5 10 12.5 10C12.5 10 11 7 12 2Z" />
    </svg>`;

    const svgSleep = `
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 4h6l-6 8h6" />
        <path d="M11 12h5l-5 8h5" />
    </svg>`;

    if (streak === 0) {
        flame.innerHTML = svgSleep;
        flame.classList.add('zero');
    } else {
        flame.innerHTML = svgFlame;
        flame.classList.remove('zero');
    }
}

function animateNumber(el, from, to, duration) {
    if (from === to) { el.textContent = to; return; }
    const start = performance.now();
    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(from + (to - from) * ease);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}


// ============================================================
// ПРОГРЕСС ДНЯ
// ============================================================

export function renderDayProgress(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.is_completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const bar = document.getElementById('progress-bar');
    const label = document.getElementById('progress-label');

    bar.style.width = percent + '%';
    label.textContent = `${completed} / ${total} задач`;

    if (percent === 100 && total > 0) {
        bar.classList.add('full');
    } else {
        bar.classList.remove('full');
    }
}


// ============================================================
// СПИСОК ЗАДАЧ
// ============================================================

const CATEGORY_LABELS = {
    work: 'Работа', personal: 'Личное',
    health: 'Здоровье', study: 'Учёба'
};

export function renderTaskList(tasks, { onToggle, onEdit }) {
    const list = document.getElementById('task-list');
    const empty = document.getElementById('tasks-empty');
    const count = document.getElementById('tasks-count');

    list.innerHTML = '';

    if (tasks.length === 0) {
        empty.hidden = false;
        count.textContent = '';
        return;
    }

    empty.hidden = true;
    const completed = tasks.filter(t => t.is_completed).length;
    count.textContent = `${completed}/${tasks.length}`;

    // Сортировка: невыполненные сначала, потом по приоритету
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sorted = [...tasks].sort((a, b) => {
        if (a.is_completed !== b.is_completed)
            return a.is_completed ? 1 : -1;
        return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
    });

    for (const task of sorted) {
        const item = createTaskElement(task, { onToggle, onEdit });
        list.appendChild(item);
    }
}

function createTaskElement(task, { onToggle, onEdit }) {
    const todayISO = toISO(new Date());
    const isToday = task.date === todayISO;

    const div = document.createElement('div');
    div.className = `task-item${task.is_completed ? ' completed' : ''}${!isToday ? ' locked' : ''}`;
    div.setAttribute('data-id', task.id);
    div.setAttribute('data-priority', task.priority);

    div.innerHTML = `
        <button class="task-checkbox" aria-label="${task.is_completed ? 'Отменить' : 'Выполнить'}" ${!isToday ? 'disabled' : ''}></button>
        <div class="task-body">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-meta">
                <span class="task-category cat-${task.category}">
                    ${CATEGORY_LABELS[task.category] || task.category}
                </span>
                ${task.is_recurring ? '<span class="task-recurring-icon">🔁</span>' : ''}
            </div>
        </div>
    `;

    // Чекбокс
    div.querySelector('.task-checkbox').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isToday) return; // заблокировано через CSS/disabled, но для подстраховки
        haptic('light');
        onToggle(task.id, !task.is_completed);
    });

    // Редактирование по тапу на тело (можно разрешить смотреть, но не редактировать дату)
    div.addEventListener('click', () => {
        // Если хотим запретить открытие листа:
        // if (!isToday) return;
        onEdit(task);
    });

    return div;
}


// ============================================================
// ЗАГОЛОВОК ЗАДАЧ (дата)
// ============================================================

export function renderTasksTitle(dateISO) {
    const el = document.getElementById('tasks-date-title');
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (dateISO === today)     el.textContent = 'Задачи на сегодня';
    else if (dateISO === tomorrow)   el.textContent = 'Задачи на завтра';
    else if (dateISO === yesterday)  el.textContent = 'Задачи за вчера';
    else {
        const d = new Date(dateISO + 'T00:00:00');
        el.textContent = 'Задачи на ' + d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    }
}


// ============================================================
// СТАТИСТИКА
// ============================================================

export function renderStats(user, tasks30days) {
    document.getElementById('stat-streak').textContent = user.streak || 0;
    document.getElementById('stat-best').textContent = user.best_streak || 0;

    // Процент выполнения за 30 дней
    const total = tasks30days.length;
    const done = tasks30days.filter(t => t.is_completed).length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    document.getElementById('stat-rate').textContent = rate + '%';

    renderHeatmap(tasks30days);
}

function renderHeatmap(tasks) {
    const heatmap = document.getElementById('heatmap');
    heatmap.innerHTML = '';

    // Группируем по дате
    const byDate = {};
    for (const t of tasks) {
        if (!byDate[t.date]) byDate[t.date] = { total: 0, done: 0 };
        byDate[t.date].total++;
        if (t.is_completed) byDate[t.date].done++;
    }

    // 30 дней назад → сегодня
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        const data = byDate[iso];

        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';

        if (data && data.total > 0) {
            const pct = data.done / data.total;
            if (pct === 1)       cell.setAttribute('data-level', '4');
            else if (pct >= 0.7) cell.setAttribute('data-level', '3');
            else if (pct >= 0.4) cell.setAttribute('data-level', '2');
            else                 cell.setAttribute('data-level', '1');
        }

        cell.title = iso;
        heatmap.appendChild(cell);
    }
}


// ============================================================
// TOAST
// ============================================================

let toastTimer = null;
export function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.hidden = false;
    // Форс-рефлоу
    toast.getBoundingClientRect();
    toast.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { toast.hidden = true; }, 200);
    }, duration);
}


// ============================================================
// UTILS
// ============================================================

export function toISO(date) {
    return date.toISOString().split('T')[0];
}

export function haptic(type = 'light') {
    try {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(type);
    } catch (e) { /* не в Telegram */ }
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
