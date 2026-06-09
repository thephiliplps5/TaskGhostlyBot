import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
