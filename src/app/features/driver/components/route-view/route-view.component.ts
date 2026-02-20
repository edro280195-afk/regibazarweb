import {
  Component, OnInit, OnDestroy, signal, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { SignalRService } from '../../../../core/services/signalr.service';
import { DeliveryRoute, RouteDelivery, ChatMessage } from '../../../../shared/models/models';

declare var google: any;

@Component({
  selector: 'app-route-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="driver-page">

      <!-- LOADING -->
      @if (loading()) {
        <div class="loading-screen">
          <div class="spinner-lg"></div>
          <p>Cargando tu ruta... 🚗</p>
        </div>
      }

      <!-- TOAST -->
      @if (toastMsg()) {
        <div class="toast-notification">{{ toastMsg() }}</div>
      }

      @if (route(); as r) {

        <!-- HEADER -->
        <div class="driver-header">
          <div class="header-left">
            <h1>🚗 Ruta #{{ r.id }}</h1>
            <span class="status-pill" [attr.data-status]="r.status">
              {{ r.status === 'Pending' ? '⏳ Lista para iniciar' : r.status === 'Active' ? '💨 En ruta' : '✅ Completada' }}
            </span>
          </div>
          <div class="delivery-counter">
            {{ getDelivered(r) }}/{{ r.deliveries.length }} 💝
          </div>
        </div>

        <!-- MAPA -->
        <div class="map-wrap">
          <div class="map-container" #mapContainer></div>
          @if (gpsActive()) {
            <button class="btn-center-me" (click)="centerOnMe()">📍</button>
          }
        </div>

        <!-- ACCIONES RAPIDAS -->
        <div class="quick-actions">
          <button class="btn-secondary maps" (click)="openGoogleRoute(r)">🗺️ Google Maps</button>
          <button class="btn-secondary expense" (click)="openExpenseModal()">⛽ Gastos</button>
        </div>

        <!-- PROGRESO -->
        <div class="progress-section">
          <div class="progress-bar">
            <div class="progress-fill"
                 [style.width.%]="r.deliveries.length ? (getDelivered(r) / r.deliveries.length) * 100 : 0">
            </div>
          </div>
          <span class="progress-label">{{ getDelivered(r) }} de {{ r.deliveries.length }} entregas</span>
        </div>

        <!-- BOTONES DE ESTADO -->
        @if (r.status === 'Pending') {
          <button class="btn-action start" (click)="startRoute()">🚀 ¡Iniciar ruta, vamos!</button>
        }
        @if (r.status === 'Active' && !gpsActive()) {
          <button class="btn-action gps" (click)="startGps()">📍 Activar mi GPS</button>
        }

        <!-- LISTA DE ENTREGAS -->
        <div class="deliveries">
          @for (d of r.deliveries; track d.id) {
            <div class="delivery-card"
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
                  <span class="total">\${{ d.total | number:'1.2-2' }}</span>
                </div>
                @if (d.status !== 'Delivered' && d.status !== 'NotDelivered') {
                  <button class="btn-card-chat" (click)="openClientChat(d, $event)" title="Chat con clienta">💬</button>
                }
              </div>

              <!-- PANEL EXPANDIDO -->
              @if (expandedId() === d.id && (d.status === 'Pending' || d.status === 'InTransit')) {
                <div class="delivery-actions" (click)="$event.stopPropagation()">
                  <button class="btn-navigate" (click)="navigateTo(d)">🗺️ Navegar a dirección</button>

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

                  <div class="action-btns">
                    <button class="btn-deliver" (click)="markDelivered(d.id)">💝 Entregado</button>
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
      }

      <!-- FAB: CHAT CON ADMIN -->
      <button class="fab-chat-admin" (click)="toggleAdminChat()">
        👩‍💼
        @if (unreadAdminCount() > 0) {
          <span class="unread-dot">{{ unreadAdminCount() }}</span>
        }
      </button>

      <!-- MODAL CHAT ADMIN -->
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
                  <span class="msg-time">{{ msg.timestamp | date:'shortTime' }}</span>
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

      <!-- MODAL CHAT CLIENTA -->
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
                  <span class="msg-time">{{ msg.timestamp | date:'shortTime' }}</span>
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

      <!-- MODAL GASTOS -->
      @if (showExpenseModal()) {
        <div class="modal-overlay" (click)="closeExpenseModal()">
          <div class="bottom-modal" (click)="$event.stopPropagation()">
            <div class="bottom-modal-header">
              <strong>⛽ Registrar Gasto</strong>
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
              <input type="number" [(ngModel)]="expenseForm.amount"
                     placeholder="$0.00" class="form-input" inputmode="decimal">

              <label class="form-label">Notas (opcional)</label>
              <input type="text" [(ngModel)]="expenseForm.notes"
                     placeholder="Descripción breve..." class="form-input">

              <label class="photo-btn compact">
                📸 Foto del ticket
                <input type="file" accept="image/*" capture="environment" (change)="onExpensePhoto($event)" hidden>
              </label>
              @if (expenseForm.photo) {
                <span class="photo-attached">📎 {{ expenseForm.photo.name }}</span>
              }

              <button class="btn-action start"
                      (click)="submitExpense()"
                      [disabled]="submittingExpense() || !expenseForm.amount">
                {{ submittingExpense() ? 'Enviando...' : '💰 Registrar gasto' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL NO ENTREGADO -->
      @if (failModalId()) {
        <div class="modal-overlay" (click)="cancelFail()">
          <div class="bottom-modal" (click)="$event.stopPropagation()">
            <div class="bottom-modal-header">
              <strong>😿 ¿Por qué no pudiste?</strong>
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
              <textarea [(ngModel)]="customReason"
                        placeholder="Otra razón o detalle adicional..."
                        class="notes-input" rows="2">
              </textarea>
              <button class="btn-action fail-confirm"
                      (click)="confirmFail()"
                      [disabled]="!selectedReason() && !customReason.trim()">
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
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      gap: 1rem;
    }
    .loading-screen p { color: #888; font-size: 1rem; }
    .spinner-lg {
      width: 48px; height: 48px;
      border: 4px solid #fce7f3;
      border-top-color: #ec4899;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* TOAST */
    .toast-notification {
      position: fixed;
      top: env(safe-area-inset-top, 12px);
      left: 50%;
      transform: translateX(-50%);
      background: #1f2937;
      color: white;
      padding: 10px 20px;
      border-radius: 25px;
      font-size: 0.85rem;
      font-weight: 600;
      z-index: 5000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      animation: toastIn 0.3s ease-out;
      max-width: calc(100vw - 2rem);
      text-align: center;
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    /* ═══ HEADER ═══ */
    .driver-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }
    .header-left { display: flex; flex-direction: column; gap: 6px; }
    .driver-header h1 { font-size: 1.3rem; margin: 0; color: #1f2937; }

    .status-pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .status-pill[data-status="Pending"]   { background: #fef3c7; color: #d97706; }
    .status-pill[data-status="Active"]    { background: #dbeafe; color: #2563eb; }
    .status-pill[data-status="Completed"] { background: #d1fae5; color: #059669; }

    .delivery-counter {
      font-size: 1.5rem;
      font-weight: 800;
      color: #ec4899;
      white-space: nowrap;
    }

    /* ═══ MAPA ═══ */
    .map-wrap {
      border-radius: 1.25rem;
      overflow: hidden;
      height: 220px;
      margin-bottom: 0.75rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      position: relative;
      border: 2px solid #fce7f3;
    }
    .map-container { width: 100%; height: 100%; }

    .btn-center-me {
      position: absolute;
      bottom: 12px;
      right: 12px;
      width: 44px; height: 44px;
      border-radius: 50%;
      border: none;
      background: white;
      font-size: 1.2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      cursor: pointer;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-center-me:active { transform: scale(0.92); }

    /* ═══ ACCIONES RAPIDAS ═══ */
    .quick-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 0.75rem;
    }
    .btn-secondary {
      flex: 1;
      padding: 10px;
      border-radius: 12px;
      border: 1.5px solid #e5e7eb;
      background: white;
      font-weight: 600;
      font-size: 0.82rem;
      cursor: pointer;
      text-align: center;
      transition: background 0.15s;
    }
    .btn-secondary:active { background: #f9fafb; }

    /* ═══ PROGRESO ═══ */
    .progress-section { margin-bottom: 1rem; }
    .progress-bar {
      height: 8px;
      background: #fce7f3;
      border-radius: 10px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #ec4899, #db2777);
      border-radius: 10px;
      transition: width 0.5s ease;
    }
    .progress-label {
      display: block;
      font-size: 0.72rem;
      color: #9ca3af;
      text-align: right;
      margin-top: 4px;
      font-weight: 500;
    }

    /* ═══ BOTONES ACCION ═══ */
    .btn-action {
      width: 100%;
      padding: 14px;
      border-radius: 14px;
      border: none;
      font-weight: 800;
      font-size: 1rem;
      color: white;
      margin-bottom: 0.75rem;
      cursor: pointer;
      transition: transform 0.1s, opacity 0.15s;
    }
    .btn-action:active { transform: scale(0.97); }
    .btn-action:disabled { opacity: 0.5; pointer-events: none; }
    .btn-action.start {
      background: linear-gradient(135deg, #ec4899, #db2777);
      box-shadow: 0 4px 15px rgba(236,72,153,0.3);
    }
    .btn-action.gps { background: linear-gradient(135deg, #3b82f6, #2563eb); }
    .btn-action.fail-confirm {
      background: linear-gradient(135deg, #f87171, #dc2626);
      margin-top: 0.75rem;
    }

    /* ═══ TARJETAS ENTREGA ═══ */
    .deliveries {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .delivery-card {
      background: white;
      border-radius: 1rem;
      border: 1.5px solid #f3f4f6;
      transition: border-color 0.2s, box-shadow 0.2s;
      overflow: hidden;
    }
    .delivery-card.is-current {
      border-color: #93c5fd;
      background: #f0f7ff;
      box-shadow: 0 2px 12px rgba(59,130,246,0.12);
    }
    .delivery-card.is-delivered {
      opacity: 0.65;
      border-color: #d1fae5;
    }
    .delivery-card.is-failed {
      opacity: 0.55;
      border-color: #fecaca;
    }

    .current-badge {
      background: linear-gradient(90deg, #3b82f6, #60a5fa);
      color: white;
      text-align: center;
      font-size: 0.7rem;
      font-weight: 800;
      padding: 4px;
      letter-spacing: 0.5px;
    }

    .delivery-main {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
    }

    .delivery-num {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.82rem;
      flex-shrink: 0;
      color: #6b7280;
    }
    .delivery-num[data-status="InTransit"] { background: #dbeafe; color: #2563eb; }
    .delivery-num[data-status="Delivered"] { background: #d1fae5; color: #059669; }
    .delivery-num[data-status="NotDelivered"] { background: #fecaca; color: #dc2626; }

    .delivery-info { flex: 1; min-width: 0; }
    .delivery-info strong {
      display: block;
      font-size: 0.92rem;
      color: #1f2937;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .addr {
      font-size: 0.72rem;
      color: #9ca3af;
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 2px 0;
    }
    .total {
      font-size: 0.85rem;
      font-weight: 800;
      color: #ec4899;
    }

    .btn-card-chat {
      background: #fdf2f8;
      border: 1.5px solid #fce7f3;
      color: #db2777;
      width: 40px; height: 40px;
      border-radius: 10px;
      font-size: 1.1rem;
      cursor: pointer;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .btn-card-chat:active { background: #fce7f3; }

    /* PANEL EXPANDIDO */
    .delivery-actions {
      padding: 0 12px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      animation: expandIn 0.2s ease-out;
    }
    @keyframes expandIn {
      from { opacity: 0; max-height: 0; }
      to   { opacity: 1; max-height: 500px; }
    }

    .btn-navigate, .btn-transit {
      width: 100%;
      padding: 10px;
      border-radius: 10px;
      border: none;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      transition: transform 0.1s;
    }
    .btn-navigate:active, .btn-transit:active { transform: scale(0.97); }
    .btn-navigate { background: #f3f4f6; color: #374151; }
    .btn-transit  { background: #dbeafe; color: #2563eb; }

    .photo-section { display: flex; flex-direction: column; gap: 8px; }
    .photo-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px;
      border-radius: 10px;
      border: 1.5px dashed #d1d5db;
      background: #fafafa;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      color: #6b7280;
      text-align: center;
    }
    .photo-btn:active { background: #f3f4f6; }
    .photo-btn.compact { margin-top: 0.5rem; }

    .photo-previews { display: flex; gap: 8px; flex-wrap: wrap; }
    .photo-thumb {
      position: relative;
      width: 56px; height: 56px;
      border-radius: 8px;
      overflow: hidden;
    }
    .photo-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .remove-photo {
      position: absolute; top: 2px; right: 2px;
      width: 20px; height: 20px;
      border-radius: 50%;
      background: rgba(0,0,0,0.6);
      color: white;
      border: none;
      font-size: 0.75rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .notes-input {
      width: 100%;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1.5px solid #e5e7eb;
      font-size: 0.85rem;
      font-family: inherit;
      resize: none;
      outline: none;
      box-sizing: border-box;
    }
    .notes-input:focus { border-color: #ec4899; }

    .action-btns { display: flex; gap: 8px; }
    .btn-deliver, .btn-fail {
      flex: 1;
      padding: 12px;
      border-radius: 12px;
      border: none;
      font-weight: 800;
      font-size: 0.9rem;
      cursor: pointer;
      transition: transform 0.1s;
    }
    .btn-deliver:active, .btn-fail:active { transform: scale(0.96); }
    .btn-deliver {
      background: linear-gradient(135deg, #ec4899, #db2777);
      color: white;
    }
    .btn-fail { background: #f3f4f6; color: #6b7280; }

    .done-summary, .fail-summary {
      padding: 6px 12px 10px;
      font-size: 0.78rem;
      font-weight: 600;
    }
    .done-summary { color: #059669; }
    .fail-summary { color: #dc2626; }

    /* ═══ FAB ADMIN CHAT ═══ */
    .fab-chat-admin {
      position: fixed;
      bottom: calc(20px + env(safe-area-inset-bottom, 0px));
      right: 16px;
      width: 60px; height: 60px;
      border-radius: 50%;
      background: #1f2937;
      color: white;
      border: none;
      font-size: 1.6rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      z-index: 999;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s;
    }
    .fab-chat-admin:active { transform: scale(0.9); }

    .unread-dot {
      position: absolute;
      top: -2px; right: -2px;
      background: #ef4444;
      border: 2px solid white;
      border-radius: 50%;
      min-width: 22px; height: 22px;
      font-size: 0.68rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    /* ═══ MODAL OVERLAY ═══ */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
      z-index: 2000;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    /* ═══ CHAT MODALS (Admin & Cliente) ═══ */
    .chat-modal {
      width: 100%;
      max-width: 500px;
      background: white;
      border-radius: 20px 20px 0 0;
      height: 85vh;
      height: 85dvh;
      max-height: 85dvh;
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease-out;
      overflow: hidden;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }

    .chat-header {
      padding: 14px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .admin-header  { background: #f8fafc; }
    .client-header { background: #fdf2f8; }

    .chat-header-info strong { display: block; font-size: 0.95rem; color: #1f2937; }
    .chat-header-info span   { font-size: 0.72rem; color: #9ca3af; }

    .close-btn {
      width: 36px; height: 36px;
      border-radius: 50%;
      border: none;
      background: #f3f4f6;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      flex-shrink: 0;
    }
    .close-btn:active { background: #e5e7eb; }

    .chat-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #f9fafb;
      -webkit-overflow-scrolling: touch;
    }

    .chat-empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #d1d5db;
      gap: 8px;
    }
    .chat-empty span { font-size: 2.5rem; }
    .chat-empty p { font-size: 0.85rem; margin: 0; }

    /* BURBUJAS */
    .msg-bubble {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 18px;
      font-size: 0.88rem;
      line-height: 1.4;
      display: flex;
      flex-direction: column;
      word-break: break-word;
    }
    .msg-bubble.me {
      align-self: flex-end;
      background: #ec4899;
      color: white;
      border-bottom-right-radius: 6px;
    }
    .msg-bubble.them {
      align-self: flex-start;
      background: white;
      border: 1px solid #e5e7eb;
      color: #374151;
      border-bottom-left-radius: 6px;
    }
    .msg-text { display: block; }
    .msg-time {
      display: block;
      font-size: 0.6rem;
      margin-top: 4px;
      opacity: 0.65;
      text-align: right;
    }

    /* INPUT CHAT */
    .chat-input-area {
      padding: 12px 14px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 8px));
      border-top: 1px solid #f3f4f6;
      display: flex;
      gap: 8px;
      background: white;
      flex-shrink: 0;
    }
    .chat-input-area input {
      flex: 1;
      padding: 11px 16px;
      border-radius: 25px;
      border: 1.5px solid #e5e7eb;
      font-size: 0.88rem;
      font-family: inherit;
      outline: none;
      min-width: 0;
    }
    .chat-input-area input:focus { border-color: #d1d5db; }

    .send-btn {
      width: 44px; height: 44px;
      border-radius: 50%;
      border: none;
      background: #1f2937;
      color: white;
      font-size: 1.1rem;
      cursor: pointer;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.1s, opacity 0.15s;
    }
    .send-btn:disabled { opacity: 0.35; }
    .send-btn:active:not(:disabled) { transform: scale(0.9); }
    .send-btn.client { background: #ec4899; }

    /* ═══ BOTTOM MODALS (Gastos & Fail) ═══ */
    .bottom-modal {
      width: 100%;
      max-width: 500px;
      background: white;
      border-radius: 20px 20px 0 0;
      animation: slideUp 0.25s ease-out;
      overflow: hidden;
    }
    .bottom-modal-header {
      padding: 14px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #f3f4f6;
    }
    .bottom-modal-header strong { font-size: 1rem; }
    .bottom-modal-body {
      padding: 16px;
      padding-bottom: calc(16px + env(safe-area-inset-bottom, 8px));
    }

    /* FORM ELEMENTS */
    .form-label {
      display: block;
      font-size: 0.78rem;
      font-weight: 600;
      color: #6b7280;
      margin-bottom: 4px;
      margin-top: 10px;
    }
    .form-label:first-child { margin-top: 0; }
    .form-input, .form-select {
      width: 100%;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1.5px solid #e5e7eb;
      font-size: 0.88rem;
      font-family: inherit;
      outline: none;
      box-sizing: border-box;
      background: white;
    }
    .form-input:focus, .form-select:focus { border-color: #ec4899; }
    .photo-attached {
      display: block;
      font-size: 0.78rem;
      color: #059669;
      margin-top: 4px;
    }

    /* FAIL REASONS */
    .reason-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 10px;
    }
    .reason-option {
      padding: 10px 14px;
      border-radius: 10px;
      border: 1.5px solid #e5e7eb;
      background: white;
      text-align: left;
      font-size: 0.88rem;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .reason-option.selected {
      border-color: #ec4899;
      background: #fdf2f8;
    }
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
  private driverMarker: any;
  private markers: any[] = [];
  private watchId?: number;
  private updateInterval?: ReturnType<typeof setInterval>;
  private lastLat = 0;
  private lastLng = 0;

  /** Set de IDs de mensajes ya agregados - evita duplicados SignalR + API */
  private adminMsgIds = new Set<number | string>();
  private clientMsgIds = new Set<number | string>();

  constructor(
    private routeParam: ActivatedRoute,
    private api: ApiService,
    private signalr: SignalRService
  ) { }

  ngOnInit(): void {
    this.token = this.routeParam.snapshot.paramMap.get('token') || '';
    this.loadRoute();

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
      }
    });

    // SignalR: Client Chat - con proteccion anti-duplicado
    this.signalr.clientChatUpdate$.subscribe(msg => {
      if (this.clientMsgIds.has(msg.id)) return;
      this.clientMsgIds.add(msg.id);

      if (this.activeChatDelivery()?.id === msg.deliveryId) {
        this.clientChatMessages.update(msgs => [...msgs, msg]);
        this.scrollToBottom('client');
      } else {
        this.showToast('🌸 Mensaje de clienta');
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
    if (!this.mapEl?.nativeElement) return;
    this.map = new google.maps.Map(this.mapEl.nativeElement, {
      center: { lat: 27.48, lng: -99.50 },
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy'
    });
    this.plotRoute(route);
  }

  private plotRoute(route: DeliveryRoute): void {
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];

    const bounds = new google.maps.LatLngBounds();
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
        }
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
        this.lastLat = pos.coords.latitude;
        this.lastLng = pos.coords.longitude;
        this.updateDriverMarker(this.lastLat, this.lastLng);
      },
      () => this.showToast('Error al obtener GPS 📍'),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    this.updateInterval = setInterval(() => {
      if (this.lastLat) {
        this.api.updateLocation(this.token, this.lastLat, this.lastLng).subscribe();
      }
    }, 10000);
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
    this.api.markDelivered(this.token, id, notes, photoFiles).subscribe(() => {
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

  getDelivered(r: DeliveryRoute): number {
    return r.deliveries.filter(d => d.status === 'Delivered').length;
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
    const reader = new FileReader();
    reader.onload = () => {
      if (!this.photos[id]) this.photos[id] = [];
      this.photos[id].push({ file, preview: reader.result as string });
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  navigateTo(d: RouteDelivery): void {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}&travelmode=driving`,
      '_blank'
    );
  }

  openGoogleRoute(r: DeliveryRoute): void {
    const pending = r.deliveries.filter(d => d.status !== 'Delivered' && d.status !== 'NotDelivered' && d.latitude);
    if (pending.length === 0) return;
    const last = pending[pending.length - 1];
    const waypoints = pending.slice(0, -1).map(d => `${d.latitude},${d.longitude}`).join('|');
    let url = `https://www.google.com/maps/dir/?api=1&destination=${last.latitude},${last.longitude}&travelmode=driving`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    window.open(url, '_blank');
  }
}