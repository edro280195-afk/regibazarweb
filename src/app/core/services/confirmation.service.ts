import { Injectable, signal } from '@angular/core';

export interface ConfirmModalData {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info' | 'success' | 'question';
    icon?: string; // Optional custom emoji/icon
}

@Injectable({
    providedIn: 'root'
})
export class ConfirmationService {
    modalState = signal<{ isOpen: boolean; data: ConfirmModalData | null }>({
        isOpen: false,
        data: null
    });

    private resolveRef: ((value: boolean) => void) | null = null;

    confirm(data: ConfirmModalData): Promise<boolean> {
        this.modalState.set({ isOpen: true, data });
        return new Promise<boolean>((resolve) => {
            this.resolveRef = resolve;
        });
    }

    close(result: boolean) {
        this.modalState.set({ isOpen: false, data: null });
        if (this.resolveRef) {
            this.resolveRef(result);
            this.resolveRef = null;
        }
    }
}
