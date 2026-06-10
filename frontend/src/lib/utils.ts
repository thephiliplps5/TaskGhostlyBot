export function toISO(date: Date): string {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
}

export function haptic(style: 'light' | 'medium' | 'heavy' | 'error' | 'success' = 'light') {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    if (style === 'error') {
        tg.HapticFeedback.notificationOccurred('error');
    } else if (style === 'success') {
        tg.HapticFeedback.notificationOccurred('success');
    } else {
        tg.HapticFeedback.impactOccurred(style);
    }
}

export function showToast(message: string, durationMs: number = 2000) {
    // Will be used by Toast component later
    const event = new CustomEvent('taskbot-toast', { detail: { message, durationMs } });
    window.dispatchEvent(event);
}
