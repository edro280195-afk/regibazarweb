import { Injectable, signal } from '@angular/core';

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    emoji: string;
}

const TOAST_EMOJIS: Record<string, string[]> = {
    success: ['✨', '💖', '🎀', '🌸', '💅'],
    error: ['😿', '💔', '🥺', '😰', '⚡'],
    info: ['💫', '🦋', '✉️', '💭', '🔮'],
    warning: ['⚠️', '🌙', '💛', '🍯', '🔔']
};

@Injectable({ providedIn: 'root' })
export class ToastService {
    private nextId = 0;
    readonly toasts = signal<Toast[]>([]);

    show(message: string, type: Toast['type'] = 'info'): void {
        const emojis = TOAST_EMOJIS[type];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        const toast: Toast = { id: this.nextId++, message, type, emoji };
        this.toasts.update(t => [...t, toast]);
        setTimeout(() => this.dismiss(toast.id), 4000);
    }

    success(message: string): void { this.show(message, 'success'); }
    error(message: string): void { this.show(message, 'error'); }
    info(message: string): void { this.show(message, 'info'); }
    warning(message: string): void { this.show(message, 'warning'); }

    dismiss(id: number): void {
        this.toasts.update(t => t.filter(x => x.id !== id));
    }
}
