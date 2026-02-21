import { Injectable, signal } from '@angular/core';

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    duration: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
    private nextId = 0;
    toasts = signal<Toast[]>([]);

    show(message: string, type: Toast['type'] = 'info', duration?: number): void {
        // Prevent duplicate toasts with the same message
        const existing = this.toasts().find(t => t.message === message);
        if (existing) return;

        const defaultDuration = type === 'error' ? 6000 : type === 'warning' ? 5000 : 3500;
        const toast: Toast = {
            id: this.nextId++,
            message,
            type,
            duration: duration ?? defaultDuration
        };

        this.toasts.update(list => [...list, toast]);

        setTimeout(() => this.dismiss(toast.id), toast.duration);
    }

    success(message: string): void {
        this.show(message, 'success');
    }

    error(message: string): void {
        this.show(message, 'error');
    }

    warning(message: string): void {
        this.show(message, 'warning');
    }

    info(message: string): void {
        this.show(message, 'info');
    }

    dismiss(id: number): void {
        this.toasts.update(list => list.filter(t => t.id !== id));
    }
}
