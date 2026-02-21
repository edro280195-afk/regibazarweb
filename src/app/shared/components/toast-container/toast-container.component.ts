import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../../core/services/toast.service';

@Component({
    selector: 'app-toast-container',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast-item"
             [class]="'toast-' + toast.type"
             (click)="toastService.dismiss(toast.id)">
          <span class="toast-icon">{{ getIcon(toast.type) }}</span>
          <span class="toast-message">{{ toast.message }}</span>
          <button class="toast-close" (click)="toastService.dismiss(toast.id); $event.stopPropagation()">✕</button>
        </div>
      }
    </div>
  `,
    styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 420px;
      width: calc(100% - 40px);
      pointer-events: none;
    }

    .toast-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      border-radius: var(--radius-lg, 16px);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      font-family: var(--font-body, 'Quicksand', sans-serif);
      font-weight: 600;
      font-size: 0.9rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      pointer-events: all;
      cursor: pointer;
      animation: toastSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      transition: opacity 0.2s, transform 0.2s;
    }

    .toast-item:hover {
      transform: translateX(-4px);
    }

    .toast-icon {
      font-size: 1.2rem;
      flex-shrink: 0;
    }

    .toast-message {
      flex: 1;
      line-height: 1.4;
    }

    .toast-close {
      background: none;
      border: none;
      font-size: 1rem;
      cursor: pointer;
      opacity: 0.6;
      padding: 2px 6px;
      border-radius: 6px;
      transition: opacity 0.2s;
      flex-shrink: 0;
    }

    .toast-close:hover {
      opacity: 1;
    }

    /* Type-specific styles */
    .toast-success {
      background: rgba(34, 197, 94, 0.95);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .toast-success .toast-close { color: #fff; }

    .toast-error {
      background: rgba(239, 68, 68, 0.95);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .toast-error .toast-close { color: #fff; }

    .toast-warning {
      background: rgba(245, 158, 11, 0.95);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .toast-warning .toast-close { color: #fff; }

    .toast-info {
      background: var(--bg-card, rgba(255, 255, 255, 0.95));
      color: var(--text-dark, #4A2C40);
      border: 1px solid var(--border-soft, rgba(255, 182, 193, 0.4));
    }
    .toast-info .toast-close { color: var(--text-medium, #855C75); }

    @keyframes toastSlideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @media (max-width: 480px) {
      .toast-container {
        top: 10px;
        right: 10px;
        left: 10px;
        max-width: none;
        width: auto;
      }

      .toast-item {
        font-size: 0.85rem;
        padding: 12px 14px;
      }
    }
  `]
})
export class ToastContainerComponent {
    toastService = inject(ToastService);

    getIcon(type: Toast['type']): string {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return '💬';
        }
    }
}
