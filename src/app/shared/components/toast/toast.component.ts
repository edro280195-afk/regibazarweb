import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto max-w-sm w-full rounded-2xl p-4 shadow-xl border flex items-start gap-3 cursor-pointer"
          [class]="getToastClass(toast.type)"
          style="animation: toastSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
          (click)="toastService.dismiss(toast.id)">
          <span class="text-2xl animate-bounce-in">{{ toast.emoji }}</span>
          <p class="text-sm font-medium flex-1 pt-0.5" (click)="toast.message.includes('actualizar') ? reload() : null">{{ toast.message }}</p>
          <button class="text-current opacity-50 hover:opacity-100 transition-opacity text-lg leading-none"
                  (click)="toastService.dismiss(toast.id); $event.stopPropagation()">×</button>
        </div>
      }
    </div>
  `
})
export class ToastComponent {
  toastService = inject(ToastService);

  getToastClass(type: string): string {
    const classes: Record<string, string> = {
      success: 'bg-gradient-to-r from-pink-50 to-green-50 border-green-200 text-green-800',
      error: 'bg-gradient-to-r from-pink-50 to-red-50 border-red-200 text-red-800',
      info: 'bg-gradient-to-r from-pink-50 to-purple-50 border-purple-200 text-purple-800',
      warning: 'bg-gradient-to-r from-pink-50 to-amber-50 border-amber-200 text-amber-800'
    };
    return classes[type] || classes['info'];
  }

  reload(): void {
    window.location.reload();
  }
}
