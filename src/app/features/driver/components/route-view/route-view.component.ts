import {
  Component, OnInit, OnDestroy, signal, computed, ElementRef, ViewChild, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { SignalRService } from '../../../../core/services/signalr.service';
import { DeliveryRoute, RouteDelivery, ChatMessage } from '../../../../shared/models/models';
import { PushNotificationService } from '../../../../core/services/push-notification.service';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

declare var google: any;

@Component({
  selector: 'app-route-view',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  template: `
    <div class="driver-page">

      @if (loading()) {
        <div class="loading-screen">
          <div class="spinner-lg"></div>
          <p>Cargando tu ruta... 🚗</p>
        </div>
      }

      @if (toastMsg()) {
        <div class="toast-notification">{{ toastMsg() }}</div>
      }

      @if (route(); as r) {

        <div class="driver-header">
          <div class="header-left">
            <h1>🚗 Ruta #{{ r.id }}</h1>
            <span class="status-pill" [attr.data-status]="r.status">
              {{ r.status === 'Pending' ? '⏳ Lista para iniciar' : r.status === 'Active' ? '💨 En ruta' : '✅ Completada' }}
            </span>
          </div>
          <div class="delivery-counter">
            {{ deliveredCount() }}/{{ r.deliveries.length }} 💝
          </div>
        </div>

        <div class="map-wrap">
          <div class="map-container" #mapContainer></div>
          @if (gpsActive()) {
            <button class="btn-center-me" (click)="centerOnMe()">📍</button>
          }
          
          <div class="floating-actions">
            <button class="btn-fab-maps" (click)="openGoogleRoute(r)" title="Google Maps">🗺️</button>
            <button class="btn-fab-expense" (click)="openExpenseModal()" title="Gastos">⛽</button>
          </div>
        </div>

        <div class="bottom-sheet">
          <div class="sheet-drag-handle"></div>
          
          <div class="sheet-content">
            <div class="progress-section">
              <div class="progress-bar">
                <div class="progress-fill" [style.width.%]="progressPercent()"></div>
              </div>
              <span class="progress-label">{{ deliveredCount() }} de {{ r.deliveries.length }} entregas</span>
            </div>

            @if (r.status === 'Pending') {
              <button class="btn-action start" (click)="startRoute()">🚀 ¡Iniciar ruta, vamos!</button>
            }
            @if (r.status === 'Active' && !gpsActive()) {
              <button class="btn-action gps" (click)="startGps()">📍 Activar mi GPS</button>
            }

            <div class="deliveries" cdkDropList (cdkDropListDropped)="onDropDelivery($event)">
              @for (d of r.deliveries; track d.id) {
                <div class="delivery-card" cdkDrag
                     [cdkDragDisabled]="d.status === 'Delivered' || d.status === 'NotDelivered'"
                     [attr.data-status]="d.status"
                     [class.expanded]="expandedId() === d.id"
                     [class.is-current]="d.status === 'InTransit'"
                     [class.is-delivered]="d.status === 'Delivered'"
                     [class.is-failed]="d.status === 'NotDelivered'"
                     (click)="toggleExpand(d.id)">

                  @if (d.status === 'InTransit') {
                    <div class="current-badge">🏃 SIGUIENTE ENTREGA</div>
                  }

                  <div class="delivery-main">
                    <span class="delivery-num" [attr.data-status]="d.status">{{ d.sortOrder }}</span>
                    <div class="delivery-info">
                      <strong>{{ d.clientName }}</strong>
                      <span class="addr">📍 {{ d.address }}</span>
                      <span class="total">\${{ d.total | number: '1.2-2' }}</span>
                    </div>
                    @if (d.status !== 'Delivered' && d.status !== 'NotDelivered') {
                      <button class="btn-card-chat" (click)="openClientChat(d, $event)" title="Chat con clienta">💬</button>
                      <div class="drag-handle" cdkDragHandle>≡</div>
                    }
                  </div>

                  @if (expandedId() === d.id && (d.status === 'Pending' || d.status === 'InTransit')) {
                    <div class="delivery-actions" (click)="$event.stopPropagation()">
                      <button class="btn-navigate" (click)="navigateTo(d)">🗺️ Navegar a dirección</button>

                      @if (d.clientPhone) {
                        <div class="contact-btns">
                          <a [href]="'tel:' + d.clientPhone" class="btn-contact call">📞 Llamar</a>
                          <a [href]="'https://wa.me/52' + d.clientPhone" target="_blank" class="btn-contact wa">💬 WhatsApp</a>
                        </div>
                      }

                      @if (d.status === 'Pending' && r.status === 'Active') {
                        <button class="btn-transit" (click)="markInTransit(d.id)">🏃 Marcar en camino</button>
                      }

                      <div class="photo-section">
                        <label class="photo-btn">
                          📸 Tomar evidencia
                          <input type="file" accept="image/*" capture="environment"
                                 (change)="onPhotoCapture($event, d.id)" hidden>
                        </label>
                        @if (getPhotos(d.id).length > 0) {
                          <div class="photo-previews">
                            @for (p of getPhotos(d.id); track $index) {
                              <div class="photo-thumb">
                                <img [src]="p.preview" alt="Evidencia">
                                <button class="remove-photo" (click)="removePhoto(d.id, $index)">×</button>
                              </div>
                            }
                          </div>
                        }
                      </div>

                      <textarea [(ngModel)]="deliveryNotes[d.id]"
                                placeholder="Notas de entrega..."
                                class="notes-input"
                                rows="2">
                      </textarea>

                      @if ((d.balanceDue ?? d.total) > 0 && !(d.payments && d.payments.length > 0 && (d.balanceDue ?? 0) <= 0)) {
                        <div class="payment-selector">
                          <label>Cobro de \${{ (d.balanceDue ?? d.total) | number: '1.2-2' }}</label>
                          <select [(ngModel)]="paymentMethods[d.id]" class="form-select payment-input">
                            <option [value]="undefined" disabled selected>Selecciona método...</option>
                            <option value="Efectivo">💵 Efectivo</option>
                            <option value="Transferencia">💳 Transferencia</option>
                            <option value="Deposito">🏦 Depósito</option>
                          </select>
                        </div>
                      } @else if (d.payments && d.payments.length > 0) {
                        <div class="payment-selector paid">
                          <label>✅ Pagado: {{ d.payments.length }} pago(s)</label>
                        </div>
                      }

                      <div class="action-btns">
                        <button class="btn-deliver" (click)="markDelivered(d.id)" [disabled]="(d.balanceDue ?? d.total) > 0 && !paymentMethods[d.id]">💝 Entregado</button>
                        <button class="btn-fail" (click)="showFailModal(d.id)">😿 No pude</button>
                      </div>
                    </div>
                  }

                  @if (d.status === 'Delivered') {
                    <div class="done-summary">
                      ✅ Entregado {{ d.deliveredAt ? ('- ' + formatTime(d.deliveredAt)) : '' }}
                    </div>
                  }
                  @if (d.status === 'NotDelivered') {
                    <div class="fail-summary">❌ No entregado</div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }

      <button class="fab-chat-admin" (click)="toggleAdminChat()">
        👩‍💼
        @if (unreadAdminCount() > 0) {
          <span class="unread-dot">{{ unreadAdminCount() }}</span>
        }
      </button>

      @if (showAdminChat()) {
        <div class="modal-overlay" (click)="toggleAdminChat()">
          <div class="chat-modal" (click)="$event.stopPropagation()">
            <div class="chat-header admin-header">
              <div class="chat-header-info">
                <strong>Base Regi Bazar 🎀</strong>
                <span>Torre de Control</span>
              </div>
              <button class="close-btn" (click)="toggleAdminChat()">✕</button>
            </div>
            <div class="chat-body" #adminChatScroll>
              @if (adminMessages().length === 0) {
                <div class="chat-empty">
                  <span>👩‍💼</span>
                  <p>Escribe un mensaje a la base</p>
                </div>
              }
              @for (msg of adminMessages(); track msg.id) {
                <div class="msg-bubble"
                     [class.me]="msg.sender === 'Driver'"
                     [class.them]="msg.sender !== 'Driver'">
                  <span class="msg-text">{{ msg.text }}</span>
                  <span class="msg-time">{{ msg.timestamp | date: 'shortTime' }}</span>
                </div>
              }
            </div>
            <div class="chat-input-area">
              <input type="text"
                     [(ngModel)]="newAdminMessage"
                     (keydown.enter)="sendAdminChat()"
                     placeholder="Hablar con la base..."
                     autocomplete="off">
              <button class="send-btn" (click)="sendAdminChat()" [disabled]="!newAdminMessage.trim()">➤</button>
            </div>
          </div>
        </div>
      }

      @if (activeChatDelivery(); as delivery) {
        <div class="modal-overlay" (click)="closeClientChat()">
          <div class="chat-modal" (click)="$event.stopPropagation()">
            <div class="chat-header client-header">
              <div class="chat-header-info">
                <strong>{{ delivery.clientName }} 🌸</strong>
                <span>Entrega #{{ delivery.sortOrder }}</span>
              </div>
              <button class="close-btn" (click)="closeClientChat()">✕</button>
            </div>
            <div class="chat-body" #clientChatScroll>
              @if (clientChatMessages().length === 0) {
                <div class="chat-empty">
                  <span>🌸</span>
                  <p>Envía un mensaje a la clienta</p>
                </div>
              }
              @for (msg of clientChatMessages(); track msg.id) {
                <div class="msg-bubble"
                     [class.me]="msg.sender === 'Driver'"
                     [class.them]="msg.sender !== 'Driver'">
                  <span class="msg-text">{{ msg.text }}</span>
                  <span class="msg-time">{{ msg.timestamp | date: 'shortTime' }}</span>
                </div>
              }
            </div>
            <div class="chat-input-area">
              <input type="text"
                     [(ngModel)]="newClientMessage"
                     (keydown.enter)="sendClientChat()"
                     placeholder="Mensaje para la clienta..."
                     autocomplete="off">
              <button class="send-btn client" (click)="sendClientChat()" [disabled]="!newClientMessage.trim()">➤</button>
            </div>
          </div>
        </div>
      }

      @if (showExpenseModal()) {
        <div class="modal-overlay" (click)="closeExpenseModal()">
          <div class="bottom-modal" (click)="$event.stopPropagation()">
            <div class="bottom-modal-header">
              <strong>⛽ Registrar Gasto </strong>
              <button class="close-btn" (click)="closeExpenseModal()">✕</button>
            </div>
            <div class="bottom-modal-body">
              <label class="form-label">Tipo de gasto</label>
              <select [(ngModel)]="expenseForm.type" class="form-select">
                <option value="Gasolina">⛽ Gasolina</option>
                <option value="Caseta">🛣️ Caseta</option>
                <option value="Estacionamiento">🅿️ Estacionamiento</option>
                <option value="Otro">📝 Otro</option>
              </select>

              <label class="form-label">Monto</label>
              <input type="number" [(ngModel)]="expenseForm.amount" placeholder="$0.00" class="form-input" inputmode="decimal">

              <label class="form-label">Notas(opcional)</label>
              <input type="text" [(ngModel)]="expenseForm.notes" placeholder="Descripción breve..." class="form-input">

              <label class="photo-btn compact">
                📸 Foto del ticket
                <input type="file" accept="image/*" capture="environment" (change)="onExpensePhoto($event)" hidden>
              </label>
              @if (expenseForm.photo) {
                <span class="photo-attached">📎 {{ expenseForm.photo.name }}</span>
              }

              <button class="btn-action start" (click)="submitExpense()" [disabled]="submittingExpense() || !expenseForm.amount">
                {{ submittingExpense() ? 'Enviando...' : '💰 Registrar gasto' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (failModalId()) {
        <div class="modal-overlay" (click)="cancelFail()">
          <div class="bottom-modal" (click)="$event.stopPropagation()">
            <div class="bottom-modal-header">
              <strong>😿 ¿Por qué no pudiste? </strong>
              <button class="close-btn" (click)="cancelFail()">✕</button>
            </div>
            <div class="bottom-modal-body">
              <div class="reason-list">
                @for (reason of failReasons; track reason) {
                  <button class="reason-option"
                          [class.selected]="selectedReason() === reason"
                          (click)="selectedReason.set(reason)">
                    {{ reason }}
                  </button>
                }
              </div>
              <textarea [(ngModel)]="customReason" placeholder="Otra razón o detalle adicional..." class="notes-input" rows="2"></textarea>
              <button class="btn-action fail-confirm" (click)="confirmFail()" [disabled]="!selectedReason() && !customReason.trim()">
                Confirmar ❌
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    /* ═══════════════════════════════════════════
       BASE
       ═══════════════════════════════════════════ */
    :host { display: block; }

    .driver-page {
      padding: 1rem;
      padding-bottom: 6rem;
      background: #fdf2f8;
      min-height: 100vh;
      min-height: 100dvh;
      font-family: 'Segoe UI', Roboto, -apple-system, sans-serif;
      -webkit-tap-highlight-color: transparent;
    }

    /* LOADING */
    .loading-screen {
      display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; gap: 1rem;
    }
    .loading-screen p { color: #888; font-size: 1rem; }
    .spinner-lg {
      width: 48px; height: 48px; border: 4px solid #fce7f3; border-top-color: #ec4899; border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* TOAST */
    .toast-notification {
      position: fixed; top: env(safe-area-inset-top, 12px); left: 50%; transform: translateX(-50%); background: #1f2937; color: white; padding: 10px 20px; border-radius: 25px; font-size: 0.85rem; font-weight: 600; z-index: 5000; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25); animation: toastIn 0.3s ease-out; max-width: calc(100vw - 2rem); text-align: center;
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    /* ═══ HEADER ═══ */
    .driver-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
    .header-left { display: flex; flex-direction: column; gap: 6px; }
    .driver-header h1 { font-size: 1.3rem; margin: 0; color: #1f2937; }

    .status-pill { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; }
    .status-pill[data-status="Pending"]   { background: #fef3c7; color: #d97706; }
    .status-pill[data-status="Active"]    { background: #dbeafe; color: #2563eb; }
    .status-pill[data-status="Completed"] { background: #d1fae5; color: #059669; }

    .delivery-counter { font-size: 1.5rem; font-weight: 800; color: #ec4899; white-space: nowrap; }

    /* ═══ MAPA FIJO (UBER EATS STYLE) ═══ */
    .map-wrap {
      position: fixed; top: 0; left: 0; right: 0; height: 65vh; height: 65dvh; z-index: 10; overflow: hidden; background: #e5e7eb;
    }
    .map-container { width: 100%; height: 100%; }

    .btn-center-me {
      position: absolute; bottom: calc(5vh + 30px); right: 16px; width: 48px; height: 48px; border-radius: 50%; border: none; background: white; font-size: 1.4rem; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25); cursor: pointer; z-index: 20; display: flex; align-items: center; justify-content: center; transition: transform 0.1s;
    }
    .btn-center-me:active { transform: scale(0.92); }

    /* FLOTANTES MAPA */
    .floating-actions {
      position: absolute; top: env(safe-area-inset-top, 16px); left: 16px; display: flex; flex-direction: column; gap: 12px; z-index: 20;
    }
    .btn-fab-maps, .btn-fab-expense {
      width: 46px; height: 46px; border-radius: 14px; border: none; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15); font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.1s;
    }
    .btn-fab-maps:active, .btn-fab-expense:active { transform: scale(0.92) }

    /* ═══ BOTTOM SHEET ═══ */
    .bottom-sheet {
      position: relative; margin-top: 55vh; background: transparent; z-index: 30; padding-bottom: 2rem;
    }

    .sheet-content {
      background: white; border-radius: 24px 24px 0 0; min-height: 45vh; padding: 16px 16px 24px 16px; box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08); position: relative;
    }

    .sheet-drag-handle {
      position: absolute; top: -16px; left: 50%; transform: translateX(-50%); width: 40px; height: 5px; border-radius: 4px; background: rgba(255, 255, 255, 0.8); z-index: 35; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    /* ═══ PROGRESO ═══ */
    .progress-section { margin-bottom: 1rem; }
    .progress-bar { height: 8px; background: #fce7f3; border-radius: 10px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #ec4899, #db2777); border-radius: 10px; transition: width 0.5s ease; }
    .progress-label { display: block; font-size: 0.72rem; color: #9ca3af; text-align: right; margin-top: 4px; font-weight: 500; }

    /* ═══ BOTONES ACCION ═══ */
    .btn-action { width: 100%; padding: 14px; border-radius: 14px; border: none; font-weight: 800; font-size: 1rem; color: white; margin-bottom: 0.75rem; cursor: pointer; transition: transform 0.1s, opacity 0.15s; }
    .btn-action:active { transform: scale(0.97); }
    .btn-action:disabled { opacity: 0.5; pointer-events: none; }
    .btn-action.start { background: linear-gradient(135deg, #ec4899, #db2777); box-shadow: 0 4px 15px rgba(236, 72, 153, 0.3); }
    .btn-action.gps { background: linear-gradient(135deg, #3b82f6, #2563eb); }
    .btn-action.fail-confirm { background: linear-gradient(135deg, #f87171, #dc2626); margin-top: 0.75rem; }

    /* ═══ TARJETAS ENTREGA ═══ */
    .deliveries { display: flex; flex-direction: column; gap: 10px; }

    .delivery-card { background: white; border-radius: 1rem; border: 1.5px solid #f3f4f6; transition: border-color 0.2s, box-shadow 0.2s; overflow: hidden; }
    .delivery-card.is-current { border-color: #93c5fd; background: #f0f7ff; box-shadow: 0 2px 12px rgba(59, 130, 246, 0.12); }
    .delivery-card.is-delivered { opacity: 0.65; border-color: #d1fae5; }
    .delivery-card.is-failed { opacity: 0.55; border-color: #fecaca; }
    
    .cdk-drag-preview { box-sizing: border-box; border-radius: 1rem; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15); background: white; opacity: 0.9; }
    .cdk-drag-placeholder { opacity: 0.3; background: #fdf2f8; border: 2px dashed #ec4899; }
    .cdk-drag-animating { transition: transform 250ms cubic-bezier(0, 0, 0.2, 1); }
    .deliveries.cdk-drop-list-dragging .delivery-card:not(.cdk-drag-placeholder) { transition: transform 250ms cubic-bezier(0, 0, 0.2, 1); }

    .current-badge { background: linear-gradient(90deg, #3b82f6, #60a5fa); color: white; text-align: center; font-size: 0.7rem; font-weight: 800; padding: 4px; letter-spacing: 0.5px; }

    .delivery-main { display: flex; align-items: center; gap: 10px; padding: 12px; position: relative; }

    .drag-handle { font-size: 1.8rem; color: #cbd5e1; cursor: grab; padding: 0 10px; touch-action: none; display: flex; align-items: center; justify-content: center; height: 100%; }
    .drag-handle:active { cursor: grabbing; color: #94a3b8; }

    .delivery-num { width: 32px; height: 32px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem; flex-shrink: 0; color: #6b7280; }
    .delivery-num[data-status="InTransit"] { background: #dbeafe; color: #2563eb; }
    .delivery-num[data-status="Delivered"] { background: #d1fae5; color: #059669; }
    .delivery-num[data-status="NotDelivered"] { background: #fecaca; color: #dc2626; }

    .delivery-info { flex: 1; min-width: 0; }
    .delivery-info strong { display: block; font-size: 0.92rem; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .addr { font-size: 0.72rem; color: #9ca3af; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 2px 0; }
    .total { font-size: 0.85rem; font-weight: 800; color: #ec4899; }

    .btn-card-chat { background: #fdf2f8; border: 1.5px solid #fce7f3; color: #db2777; width: 40px; height: 40px; border-radius: 10px; font-size: 1.1rem; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
    .btn-card-chat:active { background: #fce7f3; }

    /* PANEL EXPANDIDO */
    .contact-btns { display: flex; gap: 8px; margin-bottom: 0.75rem; }
    .btn-contact { flex: 1; padding: 10px; border-radius: 12px; font-weight: 700; font-size: 0.85rem; text-align: center; text-decoration: none; color: white; transition: transform 0.1s; }
    .btn-contact:active { transform: scale(0.96); }
    .btn-contact.call { background: linear-gradient(135deg, #3b82f6, #2563eb); }
    .btn-contact.wa { background: linear-gradient(135deg, #22c55e, #16a34a); }

    .payment-selector { background: #fdf2f8; border: 1.5px solid #fbcfe8; padding: 12px; border-radius: 12px; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 6px; }
    .payment-selector.paid { background: #f0fdf4; border-color: #bbf7d0; color: #166534; font-weight: 700; flex-direction: row; align-items: center; }
    .payment-selector label { font-size: 0.82rem; font-weight: 700; color: #831843; }
    .payment-input { padding: 10px; border-radius: 10px; border: 1px solid #f9a8d4; font-size: 0.9rem; outline: none; background: white; }

    .delivery-actions { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 8px; animation: expandIn 0.2s ease-out; }
    @keyframes expandIn { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 500px; } }

    .btn-navigate, .btn-transit { width: 100%; padding: 10px; border-radius: 10px; border: none; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: transform 0.1s; }
    .btn-navigate:active, .btn-transit:active { transform: scale(0.97); }
    .btn-navigate { background: #f3f4f6; color: #374151; }
    .btn-transit  { background: #dbeafe; color: #2563eb; }

    .photo-section { display: flex; flex-direction: column; gap: 8px; }
    .photo-btn { display: flex; align-items: center; justify-content: center; padding: 10px; border-radius: 10px; border: 1.5px dashed #d1d5db; background: #fafafa; font-weight: 600; font-size: 0.85rem; cursor: pointer; color: #6b7280; text-align: center; }
    .photo-btn:active { background: #f3f4f6; }
    .photo-btn.compact { margin-top: 0.5rem; }

    .photo-previews { display: flex; gap: 8px; flex-wrap: wrap; }
    .photo-thumb { position: relative; width: 56px; height: 56px; border-radius: 8px; overflow: hidden; }
    .photo-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .remove-photo { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0, 0, 0, 0.6); color: white; border: none; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }

    .notes-input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1.5px solid #e5e7eb; font-size: 0.85rem; font-family: inherit; resize: none; outline: none; box-sizing: border-box; }
    .notes-input:focus { border-color: #ec4899; }

    .action-btns { display: flex; gap: 8px; }
    .btn-deliver, .btn-fail { flex: 1; padding: 12px; border-radius: 12px; border: none; font-weight: 800; font-size: 0.9rem; cursor: pointer; transition: transform 0.1s; }
    .btn-deliver:active, .btn-fail:active { transform: scale(0.96); }
    .btn-deliver { background: linear-gradient(135deg, #ec4899, #db2777); color: white; }
    .btn-fail { background: #f3f4f6; color: #6b7280; }

    .done-summary, .fail-summary { padding: 6px 12px 10px; font-size: 0.78rem; font-weight: 600; }
    .done-summary { color: #059669; }
    .fail-summary { color: #dc2626; }

    /* ═══ FAB ADMIN CHAT ═══ */
    .fab-chat-admin { position: fixed; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); right: 16px; width: 60px; height: 60px; border-radius: 50%; background: #1f2937; color: white; border: none; font-size: 1.6rem; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25); z-index: 999; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.15s; }
    .fab-chat-admin:active { transform: scale(0.9); }

    .unread-dot { position: absolute; top: -2px; right: -2px; background: #ef4444; border: 2px solid white; border-radius: 50%; min-width: 22px; height: 22px; font-size: 0.68rem; font-weight: 800; display: flex; align-items: center; justify-content: center; color: white; }

    /* ═══ MODAL OVERLAY ═══ */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); z-index: 2000; display: flex; align-items: flex-end; justify-content: center; }

    /* ═══ CHAT MODALS (Admin & Cliente) ═══ */
    .chat-modal { width: 100%; max-width: 500px; background: white; border-radius: 20px 20px 0 0; height: 85vh; height: 85dvh; max-height: 85dvh; display: flex; flex-direction: column; animation: slideUp 0.3s ease-out; overflow: hidden; }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

    .chat-header { padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; border-bottom: 1px solid #f3f4f6; }
    .admin-header  { background: #f8fafc; }
    .client-header { background: #fdf2f8; }

    .chat-header-info strong { display: block; font-size: 0.95rem; color: #1f2937; }
    .chat-header-info span   { font-size: 0.72rem; color: #9ca3af; }

    .close-btn { width: 36px; height: 36px; border-radius: 50%; border: none; background: #f3f4f6; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; flex-shrink: 0; }
    .close-btn:active { background: #e5e7eb; }

    .chat-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; background: #f9fafb; -webkit-overflow-scrolling: touch; }

    .chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #d1d5db; gap: 8px; }
    .chat-empty span { font-size: 2.5rem; }
    .chat-empty p { font-size: 0.85rem; margin: 0; }

    /* BURBUJAS */
    .msg-bubble { max-width: 80%; padding: 10px 14px; border-radius: 18px; font-size: 0.88rem; line-height: 1.4; display: flex; flex-direction: column; word-break: break-word; }
    .msg-bubble.me { align-self: flex-end; background: #ec4899; color: white; border-bottom-right-radius: 6px; }
    .msg-bubble.them { align-self: flex-start; background: white; border: 1px solid #e5e7eb; color: #374151; border-bottom-left-radius: 6px; }
    .msg-text { display: block; }
    .msg-time { display: block; font-size: 0.6rem; margin-top: 4px; opacity: 0.65; text-align: right; }

    /* INPUT CHAT */
    .chat-input-area { padding: 12px 14px; padding-bottom: calc(12px + env(safe-area-inset-bottom, 8px)); border-top: 1px solid #f3f4f6; display: flex; gap: 8px; background: white; flex-shrink: 0; }
    .chat-input-area input { flex: 1; padding: 11px 16px; border-radius: 25px; border: 1.5px solid #e5e7eb; font-size: 0.88rem; font-family: inherit; outline: none; min-width: 0; }
    .chat-input-area input:focus { border-color: #d1d5db; }

    .send-btn { width: 44px; height: 44px; border-radius: 50%; border: none; background: #1f2937; color: white; font-size: 1.1rem; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: transform 0.1s, opacity 0.15s; }
    .send-btn:disabled { opacity: 0.35; }
    .send-btn:active:not(:disabled) { transform: scale(0.9); }
    .send-btn.client { background: #ec4899; }

    /* ═══ BOTTOM MODALS (Gastos & Fail) ═══ */
    .bottom-modal { width: 100%; max-width: 500px; background: white; border-radius: 20px 20px 0 0; animation: slideUp 0.25s ease-out; overflow: hidden; }
    .bottom-modal-header { padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f3f4f6; }
    .bottom-modal-header strong { font-size: 1rem; }
    .bottom-modal-body { padding: 16px; padding-bottom: calc(16px + env(safe-area-inset-bottom, 8px)); }

    /* FORM ELEMENTS */
    .form-label { display: block; font-size: 0.78rem; font-weight: 600; color: #6b7280; margin-bottom: 4px; margin-top: 10px; }
    .form-label:first-child { margin-top: 0; }
    .form-input, .form-select { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1.5px solid #e5e7eb; font-size: 0.88rem; font-family: inherit; outline: none; box-sizing: border-box; background: white; }
    .form-input:focus, .form-select:focus { border-color: #ec4899; }
    .photo-attached { display: block; font-size: 0.78rem; color: #059669; margin-top: 4px; }

    /* FAIL REASONS */
    .reason-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    .reason-option { padding: 10px 14px; border-radius: 10px; border: 1.5px solid #e5e7eb; background: white; text-align: left; font-size: 0.88rem; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
    .reason-option.selected { border-color: #ec4899; background: #fdf2f8; }
    .reason-option:active { background: #f9fafb; }
  `]
})
export class RouteViewComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer') mapEl?: ElementRef;
  @ViewChild('adminChatScroll') adminChatScroll?: ElementRef;
  @ViewChild('clientChatScroll') clientChatScroll?: ElementRef;

  // SIGNALS DE ESTADO
  route = signal<DeliveryRoute | null>(null);
  loading = signal(true);
  gpsActive = signal(false);
  expandedId = signal(0);
  toastMsg = signal('');

  // COMPUTED SIGNALS (PERFORMANCE)
  deliveredCount = computed(() => {
    const r = this.route();
    if (!r) return 0;
    return r.deliveries.filter(d => d.status === 'Delivered').length;
  });

  progressPercent = computed(() => {
    const r = this.route();
    if (!r || r.deliveries.length === 0) return 0;
    return (this.deliveredCount() / r.deliveries.length) * 100;
  });

  // ADMIN CHAT
  showAdminChat = signal(false);
  adminMessages = signal<ChatMessage[]>([]);
  newAdminMessage = '';
  unreadAdminCount = signal(0);

  // CLIENT CHAT
  activeChatDelivery = signal<RouteDelivery | null>(null);
  clientChatMessages = signal<ChatMessage[]>([]);
  newClientMessage = '';

  // MODALS
  showExpenseModal = signal(false);
  submittingExpense = signal(false);
  failModalId = signal(0);
  selectedReason = signal('');
  customReason = '';
  failReasons = ['No estaba 🏠', 'Dirección incorrecta 📍', 'No contestó 📱', 'Rechazó pedido ❌'];

  // FORMS
  deliveryNotes: { [key: number]: string } = {};
  paymentMethods: { [key: number]: string } = {};
  photos: { [key: number]: { file: File; preview: string }[] } = {};
  expenseForm = {
    type: 'Gasolina',
    amount: null as number | null,
    notes: '',
    photo: null as File | null
  };

  // PRIVADOS
  private token = '';
  private map: any;
  private directionsService: any;
  private directionsRenderer: any;
  private driverMarker: any;
  private markers: any[] = [];
  private watchId?: number;
  private updateInterval?: ReturnType<typeof setInterval>;
  private lastLat = 0;
  private lastLng = 0;
  private lastGpsSendTime = 0;

  /** Set de IDs de mensajes ya agregados - evita duplicados SignalR + API */
  private adminMsgIds = new Set<number | string>();
  private clientMsgIds = new Set<number | string>();

  constructor(
    private routeParam: ActivatedRoute,
    private api: ApiService,
    private signalr: SignalRService,
    private pushService: PushNotificationService
  ) { }

  ngOnInit(): void {
    this.token = this.routeParam.snapshot.paramMap.get('token') || '';
    this.loadRoute();

    this.pushService.requestPermission().then(granted => {
      if (granted) console.log('✅ Notificaciones habilitadas para el chofer');
    });

    // SignalR: Admin Chat - con proteccion anti-duplicado
    this.signalr.adminChatUpdate$.subscribe(msg => {
      if (this.adminMsgIds.has(msg.id)) return;
      this.adminMsgIds.add(msg.id);
      this.adminMessages.update(msgs => [...msgs, msg]);

      if (this.showAdminChat()) {
        this.scrollToBottom('admin');
      } else {
        this.unreadAdminCount.update(c => c + 1);
        this.showToast('💬 Mensaje de la Base');
        this.pushService.notifyNewMessage('Base', msg.text || msg.message || 'Nuevo mensaje', 'admin');
      }
    });

    this.signalr.clientChatUpdate$.subscribe(msg => {
      if (this.clientMsgIds.has(msg.id)) return;
      this.clientMsgIds.add(msg.id);

      if (this.activeChatDelivery()?.id === msg.deliveryId) {
        this.clientChatMessages.update(msgs => [...msgs, msg]);
        this.scrollToBottom('client');
      } else {
        this.showToast('🌸 Mensaje de clienta');
        this.pushService.notifyNewMessage(msg.senderName || 'Clienta', msg.text || msg.message || 'Nuevo mensaje', 'driver');
      }
    });
  }

  ngOnDestroy(): void {
    if (this.watchId !== undefined) navigator.geolocation.clearWatch(this.watchId);
    if (this.updateInterval) clearInterval(this.updateInterval);
    this.signalr.disconnect();
  }

  // ═══════════════════════════════════════════
  //  CARGA DE RUTA
  // ═══════════════════════════════════════════
  private loadRoute(): void {
    this.api.getDriverRoute(this.token).subscribe({
      next: (r: DeliveryRoute) => {
        r.deliveries.sort((a, b) => a.sortOrder - b.sortOrder);
        this.route.set(r);
        this.loading.set(false);

        this.signalr.connect().then(() => {
          this.signalr.joinRoute(this.token);
        });

        setTimeout(() => this.initMap(r), 150);
      },
      error: () => this.loading.set(false)
    });
  }

  // ═══════════════════════════════════════════
  //  CHAT ADMIN (Torre de Control)
  // ═══════════════════════════════════════════
  toggleAdminChat(): void {
    this.showAdminChat.update(v => !v);
    if (this.showAdminChat()) {
      this.unreadAdminCount.set(0);
      this.api.getDriverChat(this.token).subscribe(msgs => {
        this.adminMsgIds.clear();
        msgs.forEach(m => this.adminMsgIds.add(m.id));
        this.adminMessages.set(msgs);
        this.scrollToBottom('admin');
      });
    }
  }

  sendAdminChat(): void {
    const text = this.newAdminMessage.trim();
    if (!text) return;
    this.newAdminMessage = '';

    this.api.sendDriverMessage(this.token, text).subscribe(msg => {
      if (!this.adminMsgIds.has(msg.id)) {
        this.adminMsgIds.add(msg.id);
        this.adminMessages.update(msgs => [...msgs, msg]);
      }
      this.scrollToBottom('admin');
    });
  }

  // ═══════════════════════════════════════════
  //  CHAT CLIENTA
  // ═══════════════════════════════════════════
  openClientChat(delivery: RouteDelivery, event: Event): void {
    event.stopPropagation();
    this.activeChatDelivery.set(delivery);
    this.newClientMessage = '';

    this.api.getDriverClientChat(this.token, delivery.id).subscribe(msgs => {
      this.clientMsgIds.clear();
      msgs.forEach(m => this.clientMsgIds.add(m.id));
      this.clientChatMessages.set(msgs);
      this.scrollToBottom('client');
    });
  }

  closeClientChat(): void {
    this.activeChatDelivery.set(null);
    this.clientChatMessages.set([]);
    this.clientMsgIds.clear();
  }

  sendClientChat(): void {
    const delivery = this.activeChatDelivery();
    const text = this.newClientMessage.trim();
    if (!text || !delivery) return;
    this.newClientMessage = '';

    this.api.sendDriverClientMessage(this.token, delivery.id, text).subscribe(msg => {
      if (!this.clientMsgIds.has(msg.id)) {
        this.clientMsgIds.add(msg.id);
        this.clientChatMessages.update(msgs => [...msgs, msg]);
      }
      this.scrollToBottom('client');
    });
  }

  // ═══════════════════════════════════════════
  //  SCROLL HELPER
  // ═══════════════════════════════════════════
  private scrollToBottom(chat: 'admin' | 'client'): void {
    setTimeout(() => {
      const el = chat === 'admin' ? this.adminChatScroll : this.clientChatScroll;
      if (el?.nativeElement) {
        el.nativeElement.scrollTop = el.nativeElement.scrollHeight;
      }
    }, 60);
  }

  // ═══════════════════════════════════════════
  //  MAPA & GPS
  // ═══════════════════════════════════════════
  private initMap(route: DeliveryRoute): void {
    if (!this.mapEl?.nativeElement || typeof google === 'undefined') return;
    this.map = new google.maps.Map(this.mapEl.nativeElement, {
      center: { lat: 27.48, lng: -99.50 },
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy'
    });

    this.directionsService = new google.maps.DirectionsService();
    this.directionsRenderer = new google.maps.DirectionsRenderer({
      map: this.map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#db2777',
        strokeWeight: 4,
        strokeOpacity: 0.8
      }
    });

    this.plotRoute(route);
  }

  private plotRoute(route: DeliveryRoute): void {
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];

    const pending = route.deliveries.filter(d => d.status !== 'Delivered' && d.status !== 'NotDelivered' && d.latitude);
    const bounds = new google.maps.LatLngBounds();

    if (this.lastLat && pending.length > 0) {
      const origin = new google.maps.LatLng(this.lastLat, this.lastLng);
      const destination = new google.maps.LatLng(pending[pending.length - 1].latitude, pending[pending.length - 1].longitude);

      const waypoints = pending.slice(0, -1).map(d => ({
        location: new google.maps.LatLng(d.latitude, d.longitude),
        stopover: true
      }));

      this.directionsService.route({
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING
      }, (result: any, status: string) => {
        if (status === 'OK') {
          this.directionsRenderer.setDirections(result);
        }
      });
    } else {
      this.directionsRenderer.setDirections({ routes: [] });
    }

    route.deliveries.forEach(d => {
      if (!d.latitude) return;
      const pos = { lat: d.latitude, lng: d.longitude };
      bounds.extend(pos);

      let fillColor = '#ec4899';
      if (d.status === 'InTransit') fillColor = '#3B82F6';
      else if (d.status === 'Delivered') fillColor = '#059669';
      else if (d.status === 'NotDelivered') fillColor = '#dc2626';

      const marker = new google.maps.Marker({
        position: pos,
        map: this.map,
        label: { text: d.sortOrder.toString(), color: 'white', fontWeight: 'bold', fontSize: '11px' },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14, fillColor, fillOpacity: 1,
          strokeColor: 'white', strokeWeight: 2
        },
        zIndex: d.status === 'InTransit' ? 10 : 5
      });
      this.markers.push(marker);
    });

    if (!bounds.isEmpty()) this.map.fitBounds(bounds, 40);
  }

  centerOnMe(): void {
    if (this.lastLat && this.map) {
      this.map.panTo({ lat: this.lastLat, lng: this.lastLng });
      this.map.setZoom(16);
    }
  }

  startGps(): void {
    if (!navigator.geolocation) {
      this.showToast('Tu navegador no soporta GPS');
      return;
    }
    this.gpsActive.set(true);

    this.watchId = navigator.geolocation.watchPosition(
      pos => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;

        this.lastLat = newLat;
        this.lastLng = newLng;
        this.updateDriverMarker(newLat, newLng);

        if (this.map) {
          this.map.panTo({ lat: newLat, lng: newLng });
        }

        const now = Date.now();
        if (now - this.lastGpsSendTime >= 10000) {
          this.lastGpsSendTime = now;
          this.api.updateLocation(this.token, newLat, newLng).subscribe();
        }
      },
      () => this.showToast('Error al obtener GPS 📍'),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }

  private updateDriverMarker(lat: number, lng: number): void {
    const pos = { lat, lng };
    if (!this.driverMarker) {
      this.driverMarker = new google.maps.Marker({
        position: pos, map: this.map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE, scale: 10,
          fillColor: '#3B82F6', fillOpacity: 1,
          strokeColor: 'white', strokeWeight: 3
        },
        zIndex: 1000
      });
    } else {
      this.driverMarker.setPosition(pos);
    }
  }

  // ═══════════════════════════════════════════
  //  ACCIONES DE RUTA
  // ═══════════════════════════════════════════
  startRoute(): void {
    this.api.startRoute(this.token).subscribe(() => {
      this.showToast('🚀 ¡Ruta Iniciada!');
      this.loadRoute();
    });
  }

  markInTransit(id: number): void {
    this.api.markInTransit(this.token, id).subscribe(() => {
      this.showToast('🏃 En camino');
      this.loadRoute();
    });
  }

  markDelivered(id: number): void {
    const notes = this.deliveryNotes[id] || '';
    const photoFiles = (this.photos[id] || []).map(p => p.file);
    const method = this.paymentMethods[id];
    const r = this.route();
    const delivery = r?.deliveries.find(d => d.id === id);
    const amountDue = delivery?.balanceDue ?? delivery?.total ?? 0;

    const payments = method && amountDue > 0
      ? [{ amount: amountDue, method, notes: undefined as string | undefined }]
      : undefined;

    this.api.markDelivered(this.token, id, notes, photoFiles, payments).subscribe(() => {
      this.showToast('💝 ¡Entregado!');
      this.photos[id] = [];
      this.deliveryNotes[id] = '';
      this.loadRoute();
    });
  }

  // ═══════════════════════════════════════════
  //  GASTOS
  // ═══════════════════════════════════════════
  openExpenseModal(): void { this.showExpenseModal.set(true); }
  closeExpenseModal(): void {
    this.showExpenseModal.set(false);
    this.expenseForm = { type: 'Gasolina', amount: null, notes: '', photo: null };
  }
  onExpensePhoto(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.expenseForm.photo = input.files?.[0] || null;
  }
  submitExpense(): void {
    if (!this.expenseForm.amount) return;
    this.submittingExpense.set(true);
    this.api.addDriverExpense(this.token, this.expenseForm).subscribe({
      next: () => {
        this.showToast('💰 Gasto registrado');
        this.closeExpenseModal();
        this.submittingExpense.set(false);
      },
      error: () => {
        this.showToast('Error al registrar gasto');
        this.submittingExpense.set(false);
      }
    });
  }

  // ═══════════════════════════════════════════
  //  FAIL (NO ENTREGADO)
  // ═══════════════════════════════════════════
  showFailModal(id: number): void {
    this.failModalId.set(id);
    this.selectedReason.set('');
    this.customReason = '';
  }
  cancelFail(): void { this.failModalId.set(0); }
  confirmFail(): void {
    const reason = this.selectedReason() || this.customReason.trim();
    if (!reason) return;
    this.api.markFailed(this.token, this.failModalId(), reason, this.customReason, []).subscribe(() => {
      this.showToast('📝 Registrado');
      this.failModalId.set(0);
      this.loadRoute();
    });
  }

  // ═══════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════
  toggleExpand(id: number): void {
    this.expandedId.set(this.expandedId() === id ? 0 : id);
  }

  formatTime(d: string): string {
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  showToast(m: string): void {
    this.toastMsg.set(m);
    setTimeout(() => this.toastMsg.set(''), 3000);
  }

  getPhotos(id: number): { file: File; preview: string }[] {
    return this.photos[id] || [];
  }

  removePhoto(id: number, i: number): void {
    if (this.photos[id]) this.photos[id].splice(i, 1);
  }

  onPhotoCapture(e: Event, id: number): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (re) => {
      img.src = re.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const scaleSize = MAX_WIDTH / img.width;

        let targetWidth = img.width;
        let targetHeight = img.height;

        if (img.width > MAX_WIDTH) {
          targetWidth = MAX_WIDTH;
          targetHeight = img.height * scaleSize;
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, targetWidth, targetHeight);

        canvas.toBlob((blob) => {
          if (!blob) return;
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          if (!this.photos[id]) this.photos[id] = [];
          this.photos[id].push({ file: compressedFile, preview: canvas.toDataURL('image/jpeg', 0.8) });
        }, 'image/jpeg', 0.8);
      };
    };

    reader.readAsDataURL(file);
    input.value = '';
  }

  navigateTo(d: RouteDelivery): void {
    let url = '';
    if (d.latitude && d.longitude) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.address + ', Nuevo Laredo, Tamaulipas, México')}`;
    }
    window.open(url, '_blank');
  }

  // REORDENAMIENTO
  onDropDelivery(event: CdkDragDrop<RouteDelivery[]>) {
    const route = this.route();
    if (!route) return;

    moveItemInArray(route.deliveries, event.previousIndex, event.currentIndex);
    route.deliveries.forEach((del, index) => del.sortOrder = index + 1);

    const deliveryIds = route.deliveries.map(d => d.id);
    this.route.set({ ...route });
    this.plotRoute(route);

    this.api.reorderRouteDeliveries(route.id, deliveryIds).subscribe({
      next: () => this.showToast('✅ Nuevo orden guardado'),
      error: () => {
        this.showToast('Error al guardar el orden 😿');
        this.loadRoute();
      }
    });
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      this.loadRoute();
    }
  }

  openGoogleRoute(r: DeliveryRoute): void {
    const pending = r.deliveries.filter(d => d.status !== 'Delivered' && d.status !== 'NotDelivered' && d.latitude);
    if (pending.length === 0) return;

    if (pending.length === 1) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${pending[0].latitude},${pending[0].longitude}&travelmode=driving`;
      window.open(url, '_blank');
      return;
    }

    const last = pending[pending.length - 1];
    const waypoints = pending.slice(0, -1).map(d => `${d.latitude},${d.longitude}`).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&destination=${last.latitude},${last.longitude}&waypoints=${waypoints}&travelmode=driving`;

    window.open(url, '_blank');
  }
}