import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmationService } from '../../../core/services/confirmation.service';

@Component({
    selector: 'app-confirm-modal',
    standalone: true,
    imports: [CommonModule],
    template: `
    @if (confirmService.modalState().isOpen) {
      <div class="modal-overlay" (click)="close(false)">
        <div class="modal-card" [class]="confirmService.modalState().data?.type" (click)="$event.stopPropagation()">
          
          <!-- Background Decoration -->
          <div class="modal-bg-decor">
            <svg class="flower-bg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 30 C50 10 70 10 70 30 C90 30 90 50 70 50 C70 70 50 70 50 50 C30 70 10 70 10 50 C10 30 30 30 50 30 Z" fill="#FFE4E1" opacity="0.4"/>
            </svg>
          </div>

          <!-- Icon Section -->
          <div class="modal-icon-wrapper">
             @if (confirmService.modalState().data?.type === 'danger') {
               <span class="icon-emoji">🗑️</span>
             } @else if (confirmService.modalState().data?.type === 'success') {
               <span class="icon-emoji">✨</span>
             } @else {
               <span class="icon-emoji">{{ confirmService.modalState().data?.icon || '🌸' }}</span>
             }
          </div>

          <h3>{{ confirmService.modalState().data?.title }}</h3>
          <p>{{ confirmService.modalState().data?.message }}</p>

          <div class="modal-actions">
            <button class="btn-cancel" (click)="close(false)">
              {{ confirmService.modalState().data?.cancelText || 'Cancelar' }}
            </button>
            <button class="btn-confirm" (click)="close(true)">
              {{ confirmService.modalState().data?.confirmText || 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
    styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(255, 240, 245, 0.4); /* Very light pink tint */
      backdrop-filter: blur(5px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease;
    }

    .modal-card {
      background: white;
      width: 90%;
      max-width: 340px;
      padding: 2rem 1.5rem;
      border-radius: 2rem;
      text-align: center;
      position: relative;
      box-shadow: 
        0 20px 50px rgba(255, 105, 180, 0.15),
        0 0 0 1px rgba(255, 255, 255, 0.8) inset;
      animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      overflow: hidden;
    }

    /* Modal Types */
    .modal-card.danger { border: 2px solid #FFB7B2; }
    .modal-card.success { border: 2px solid #B7E4C7; }
    .modal-card.info { border: 2px solid #A0C4FF; }

    .modal-bg-decor {
      position: absolute;
      top: -20px;
      right: -20px;
      width: 120px;
      height: 120px;
      z-index: 0;
      transform: rotate(15deg);
    }
    
    .modal-icon-wrapper {
      position: relative;
      z-index: 1;
      width: 70px;
      height: 70px;
      background: #FFF0F5;
      border-radius: 50%;
      margin: 0 auto 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 5px 15px rgba(255, 182, 193, 0.3);
      border: 3px solid white;
    }

    .icon-emoji { font-size: 2.2rem; }

    h3 {
      position: relative;
      z-index: 1;
      margin: 0 0 0.5rem;
      font-size: 1.3rem;
      color: #555;
      font-family: 'Pacifico', cursive, sans-serif; /* Fallback to standard if not loaded */
    }

    p {
      position: relative;
      z-index: 1;
      color: #888;
      font-size: 0.95rem;
      margin-bottom: 2rem;
      line-height: 1.5;
    }

    .modal-actions {
      position: relative;
      z-index: 1;
      display: flex;
      gap: 1rem;
      justify-content: center;
    }

    button {
      border: none;
      padding: 0.8rem 1.4rem;
      border-radius: 1rem;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    button:active { transform: scale(0.95); }

    .btn-cancel {
      background: #F8F9FA;
      color: #888;
    }
    .btn-cancel:hover { background: #E9ECEF; }

    .btn-confirm {
      background: linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(255, 154, 158, 0.4);
    }
    .btn-confirm:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(255, 154, 158, 0.6);
    }

    /* Danger override */
    .danger .btn-confirm {
      background: linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%);
      box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes popIn { from { opacity: 0; transform: scale(0.8) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  `]
})
export class ConfirmModalComponent {
    confirmService = inject(ConfirmationService);

    close(result: boolean) {
        this.confirmService.close(result);
    }
}
