import {
  Component, OnInit, signal, OnDestroy, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { WhatsAppService } from '../../../../core/services/whatsapp.service';
import { DeliveryRoute, ChatMessage, RouteDelivery } from '../../../../shared/models/models';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { SignalRService } from '../../../../core/services/signalr.service';
import { GoogleMapsModule, GoogleMap, MapDirectionsRenderer, MapMarker } from '@angular/google-maps';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';
import { PushNotificationService } from '../../../../core/services/push-notification.service';

// ─── CONFIG ────────────────────────────────────────────────────
const GEOCODE_CONFIG = {
  googleApiKey: environment.googleMapsApiKey || '',
  city: 'Nuevo Laredo',
  state: 'Tamaulipas',
  country: 'Mexico',
  defaultLat: 27.4861,
  defaultLng: -99.5069,
};
// ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-route-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, GoogleMapsModule],
  template: `
    <div class="routes-page">

      <!-- ═══ TOAST ═══ -->
      @if (toastMessage()) {
        <div class="toast-notification">{{ toastMessage() }}</div>
      }

      <!-- ═══ HEADER ═══ -->
      <div class="page-header">
        <div class="page-header-text">
          <h2>Mis Rutas 🚗</h2>
          <p class="page-sub">Monitorea tus entregas en tiempo real, bonita</p>
        </div>
        <button class="btn-refresh" (click)="loadRoutes()" [class.spinning]="loading()" title="Actualizar">🔄</button>
      </div>

      <!-- ═══ LOADING SKELETON ═══ -->
      @if (loading() && routes().length === 0) {
        <div class="loading-state">
          <div class="spinner">🎀</div>
          <p>Cargando rutas...</p>
        </div>
      }

      <!-- ═══ EMPTY ═══ -->
      @if (!loading() && routes().length === 0) {
        <div class="empty">
          <span class="empty-icon">🛣️</span>
          <p>No hay rutas activas</p>
          <p class="empty-hint">Ve a Pedidos, selecciona varios y crea una ruta mágica 💕</p>
        </div>
      }

      <!-- ═══ LISTA DE RUTAS ═══ -->
      <div class="routes-container">
        @for (route of routes(); track route.id) {
          <div class="route-card" [attr.data-status]="route.status">

            <!-- Card Header -->
            <div class="route-header">
              <div class="route-title">
                <span class="route-icon">🏎️</span>
                <div class="route-meta">
                  <span class="route-id">Ruta #{{ route.id }}</span>
                  <span class="route-date">{{ route.createdAt | date:'d MMM, h:mm a' }}</span>
                </div>
              </div>
              <span class="status-pill" [attr.data-status]="route.status">
                {{ route.status === 'Pending' ? '⏳ Pendiente' : route.status === 'Active' ? '🚀 En camino' : '✅ Finalizada' }}
              </span>
            </div>

            <!-- Quick Actions Bar -->
            <div class="card-actions">
              <button class="action-chip chat" (click)="openChat(route)">
                💬 <span>Chat</span>
              </button>
              <button class="action-chip map" (click)="openMap(route)">
                🗺️ <span>Mapa</span>
              </button>
              <button class="action-chip wa" (click)="shareRouteWa(route)">
                📱 <span>WhatsApp</span>
              </button>
              <button *ngIf="route.status !== 'Completed'" class="action-chip corte" (click)="openCorteModal(route)">
                💰 <span>Liquidar</span>
              </button>
              <button class="action-chip delete" (click)="askDelete(route)">
                🗑️
              </button>
            </div>

            <!-- Progress -->
            <div class="route-progress">
              <div class="progress-labels">
                <span>Progreso</span>
                <span>{{ getDelivered(route) }}/{{ route.deliveries.length }} entregas 🎁</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" [style.width.%]="getProgress(route)"></div>
              </div>
            </div>

            <!-- Driver Link -->
            <div class="driver-link-section">
              <span class="link-label">🔗 Link chofer</span>
              <div class="link-row">
                <input type="text" [value]="route.driverLink" readonly class="link-input" #linkEl>
                <button class="btn-copy" (click)="copy(linkEl)">📋</button>
              </div>
            </div>

            <!-- Deliveries -->
            <div class="deliveries-list">
              @for (d of route.deliveries; track d.id) {
                <div class="delivery-item" [attr.data-status]="d.status">
                  <div class="order-badge" [attr.data-status]="d.status">{{ d.sortOrder }}</div>
                  <div class="delivery-info">
                    <strong>{{ d.clientName }}</strong>
                    @if (d.address) {
                      <span class="delivery-addr">📍 {{ d.address }}</span>
                    }
                  </div>
                  <div class="delivery-right">
                    <span class="delivery-total">\${{ d.total | number:'1.2-2' }}</span>
                    <span class="delivery-status-icon" [title]="d.status">
                      {{ d.status === 'Pending' ? '⏳' : d.status === 'Delivered' ? '✅' : d.status === 'InTransit' ? '🏃' : '❌' }}
                    </span>
                  </div>
                </div>
              }
            </div>

            <!-- Failed Deliveries -->
            @if (getFailedDeliveries(route).length > 0) {
              <div class="failed-section">
                <h4>😿 No entregados:</h4>
                @for (d of getFailedDeliveries(route); track d.id) {
                  <div class="failed-item">
                    <strong>{{ d.clientName }}:</strong> {{ d.failureReason }}
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- ═══════════════════════════════════════════
           MODAL: MAPA EN VIVO
           ═══════════════════════════════════════════ -->
      @if (showMapModal() && selectedRouteForMap()) {
        <div class="modal-overlay" (click)="closeMap()">
          <div class="modal-fullscreen map-modal" (click)="$event.stopPropagation()">

            <div class="modal-top-bar">
              <div class="modal-top-info">
                <strong>🗺️ Seguimiento en Vivo</strong>
                <span>Ruta #{{ selectedRouteForMap()!.id }}</span>
              </div>
              <button class="btn-close" (click)="closeMap()">✕</button>
            </div>

            <div class="map-area">
              <google-map
                height="100%"
                width="100%"
                [center]="center"
                [zoom]="zoom"
                [options]="mapOptions">

                <map-marker
                  [position]="warehousePos"
                  [options]="warehouseOptions">
                </map-marker>

                @if (driverPos) {
                  <map-marker
                    [position]="driverPos"
                    [options]="driverOptions">
                  </map-marker>
                }

                @for (d of routeDeliveries; track d.id) {
                  @if (d.latitude && d.longitude) {
                    <map-marker
                      [position]="{ lat: d.latitude, lng: d.longitude }"
                      [options]="getDeliveryMarkerOptions(d)">
                    </map-marker>
                  }
                }

                @if (directionsResult(); as result) {
                  <map-directions-renderer
                    [directions]="result"
                    [options]="directionsOptions">
                  </map-directions-renderer>
                }
              </google-map>

              <!-- GPS Loading Overlay -->
              @if (waitingForGps()) {
                <div class="gps-waiting-overlay">
                  <div class="gps-waiting-card">
                    <div class="gps-pulse-ring"></div>
                    <span class="gps-icon">📡</span>
                    <p>Esperando señal GPS del chofer...</p>
                    <span class="gps-hint">Se actualizará automáticamente</span>
                  </div>
                </div>
              }

              <!-- Plotting Loading -->
              @if (plottingRoute()) {
                <div class="plotting-indicator">
                  <div class="mini-spinner"></div>
                  Trazando ruta...
                </div>
              }
            </div>

            <div class="map-footer">
              @if (lastLocationUpdate()) {
                <span class="live-indicator">
                  <span class="pulse-dot"></span>
                  En vivo · {{ lastLocationUpdate() | date:'h:mm:ss a' }}
                </span>
              } @else {
                <span class="offline-indicator">📍 Sin GPS en vivo — Mostrando ruta planificada</span>
              }
            </div>

          </div>
        </div>
      }

      <!-- ═══════════════════════════════════════════
           MODAL: CHAT CON REPARTIDOR
           ═══════════════════════════════════════════ -->
      @if (chatRoute()) {
        <div class="modal-overlay" (click)="closeChat()">
          <div class="modal-fullscreen chat-modal" (click)="$event.stopPropagation()">

            <div class="modal-top-bar chat-top">
              <div class="driver-badge">
                <span class="driver-avatar">🧢</span>
                <div class="modal-top-info">
                  <strong>Chat con Repartidor</strong>
                  <span>Ruta #{{ chatRoute()!.id }}</span>
                </div>
              </div>
              <button class="btn-close" (click)="closeChat()">✕</button>
            </div>

            <div class="chat-messages" #chatScroll>
              @if (loadingChat()) {
                <div class="chat-loading">
                  <div class="mini-spinner pink"></div>
                  <span>Cargando mensajes...</span>
                </div>
              }
              @if (!loadingChat() && activeMessages().length === 0) {
                <div class="chat-empty">
                  <span>💬</span>
                  <p>Inicia la conversación con tu repartidor</p>
                </div>
              }
              @for (msg of activeMessages(); track msg.id) {
                <div class="msg-bubble"
                     [class.me]="msg.sender === 'Admin'"
                     [class.them]="msg.sender !== 'Admin'">
                  <span class="msg-text">{{ msg.text }}</span>
                  <span class="msg-time">{{ msg.timestamp | date:'shortTime' }}</span>
                </div>
              }
            </div>

            <div class="chat-input-area">
              <input type="text"
                     [(ngModel)]="newMessage"
                     (keydown.enter)="sendMessage()"
                     placeholder="Escribe un mensaje..."
                     autocomplete="off">
              <button class="send-btn" (click)="sendMessage()" [disabled]="!newMessage.trim()">➤</button>
            </div>

          </div>
        </div>
      }

      <!-- ═══════════════════════════════════════════
           MODAL: CORTE DE CAJA (LIQUIDACIÓN)
           ═══════════════════════════════════════════ -->
      @if (showCorteModal() && selectedRouteForCorte()) {
        <div class="modal-overlay" (click)="closeCorteModal()">
          <div class="modal-fullscreen ticket-modal" (click)="$event.stopPropagation()">
            <div class="ticket-header">
              <h3>Liquidación de Chofer</h3>
              <p>Ruta #{{ selectedRouteForCorte()!.id }}</p>
              <div class="zig-zag-top"></div>
            </div>

            <div class="ticket-body">
              <div class="ticket-section">
                <div class="ticket-row">
                  <span>Efectivo Cobrado 💵</span>
                  <span class="ticket-val positive">\${{ routeCorte().totalEfectivo | number:'1.2-2' }}</span>
                </div>
                <div class="ticket-row small-text">
                  <span>Transferencias / Otros</span>
                  <span>\${{ routeCorte().totalTransferencias | number:'1.2-2' }}</span>
                </div>
              </div>

              <div class="ticket-divider"></div>

              <div class="ticket-section">
                <h4>Gastos Registrados 📉</h4>
                @if (selectedRouteForCorte()!.expenses?.length) {
                  @for (exp of selectedRouteForCorte()!.expenses; track exp.id) {
                    <div class="ticket-row expense-row">
                      <span>{{ exp.expenseType }} {{ exp.notes ? '(' + exp.notes + ')' : '' }}</span>
                      <span class="ticket-val negative">-\${{ exp.amount | number:'1.2-2' }}</span>
                    </div>
                  }
                } @else {
                  <p class="no-expenses">Sin gastos registrados en esta ruta.</p>
                }
                
                <div class="ticket-row subtotal">
                  <span>Total Gastos</span>
                  <span class="ticket-val negative">-\${{ routeCorte().totalGastos | number:'1.2-2' }}</span>
                </div>
              </div>

              <div class="ticket-divider bold"></div>

              <div class="ticket-section total-section">
                <span>Total a Entregar</span>
                <span class="ticket-total highlight">\${{ routeCorte().totalAEntregar | number:'1.2-2' }}</span>
              </div>
            </div>

            <div class="ticket-footer">
              <button class="btn-cancel" (click)="closeCorteModal()">Cancelar</button>
              <button class="btn-confirm" (click)="confirmLiquidate()" [disabled]="liquidating()">
                {{ liquidating() ? 'Procesando...' : 'Confirmar Liquidación ✅' }}
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
    :host {
      display: block;
      --glass-bg: rgba(255, 255, 255, 0.75);
      --shadow-soft: 0 10px 40px rgba(255, 107, 157, 0.1);
    }

    .routes-page {
      padding: 1rem;
      padding-bottom: 6rem;
      max-width: 900px;
      margin: 0 auto;
      min-height: 100vh;
      min-height: 100dvh;
    }

    /* ═══ TOAST ═══ */
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
      z-index: 6000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      animation: toastIn 0.3s ease-out;
      max-width: calc(100vw - 2rem);
      text-align: center;
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    /* ═══════════════════════════════════════════
       HEADER
       ═══════════════════════════════════════════ */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .page-header-text h2 {
      font-size: 1.8rem;
      color: var(--pink-600, #db2777);
      margin: 0;
    }
    .page-sub {
      color: #9ca3af;
      margin: 4px 0 0;
      font-weight: 600;
      font-size: 0.82rem;
    }
    .btn-refresh {
      background: white;
      border: 1.5px solid #fce7f3;
      width: 44px; height: 44px;
      border-radius: 50%;
      font-size: 1.2rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.4s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      flex-shrink: 0;
    }
    .btn-refresh:active { transform: rotate(180deg) scale(0.9); }
    .btn-refresh.spinning { animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ═══ LOADING & EMPTY ═══ */
    .loading-state {
      text-align: center;
      color: #ec4899;
      margin-top: 4rem;
    }
    .loading-state .spinner {
      font-size: 3rem;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }

    .empty {
      text-align: center;
      padding: 3rem 1.5rem;
      color: #d1d5db;
      background: rgba(255,255,255,0.5);
      border-radius: 24px;
      border: 2px dashed #e5e7eb;
    }
    .empty-icon { font-size: 3rem; opacity: 0.4; display: block; margin-bottom: 0.75rem; }
    .empty p { font-weight: 700; margin: 0; font-size: 1rem; color: #9ca3af; }
    .empty-hint { font-size: 0.85rem !important; color: #f9a8d4 !important; margin-top: 6px !important; }

    /* ═══════════════════════════════════════════
       ROUTE CARDS
       ═══════════════════════════════════════════ */
    .routes-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .route-card {
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 20px;
      padding: 1rem;
      border: 1.5px solid #fce7f3;
      box-shadow: var(--shadow-soft);
      transition: transform 0.2s, box-shadow 0.2s;
      overflow: hidden;
    }

    /* ═══ Card Header ═══ */
    .route-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      gap: 8px;
    }
    .route-title {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .route-icon {
      font-size: 1.5rem;
      background: #fdf2f8;
      width: 42px; height: 42px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .route-meta { display: flex; flex-direction: column; min-width: 0; }
    .route-id {
      font-size: 1rem;
      font-weight: 800;
      color: #1f2937;
      white-space: nowrap;
    }
    .route-date {
      font-size: 0.72rem;
      color: #9ca3af;
      font-weight: 600;
    }

    .status-pill {
      padding: 5px 10px;
      border-radius: 20px;
      font-weight: 800;
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .status-pill[data-status="Pending"]   { background: #fef3c7; color: #d97706; }
    .status-pill[data-status="Active"]    { background: #dbeafe; color: #2563eb; }
    .status-pill[data-status="Completed"] { background: #d1fae5; color: #059669; }

    /* ═══ Action Chips ═══ */
    .card-actions {
      display: flex;
      gap: 6px;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
    }
    .action-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1.5px solid #f3f4f6;
      background: white;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      color: #374151;
      white-space: nowrap;
    }
    .action-chip:active { transform: scale(0.95); }
    .action-chip span { display: inline; }
    .action-chip.chat:active { background: #fdf2f8; }
    .action-chip.map:active  { background: #eff6ff; }
    .action-chip.wa:active   { background: #f0fdf4; }
    .action-chip.corte { border-color: #fef08a; color: #b45309; }
    .action-chip.corte:active { background: #fefce8; }
    .action-chip.delete {
      border-color: #fecaca;
      color: #dc2626;
      margin-left: auto;
    }
    .action-chip.delete:active { background: #fef2f2; }

    /* ═══ Progress ═══ */
    .route-progress { margin-bottom: 0.75rem; }
    .progress-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
      font-weight: 700;
      color: #9ca3af;
      margin-bottom: 5px;
      text-transform: uppercase;
    }
    .progress-track {
      background: #f3f4f6;
      border-radius: 10px;
      height: 8px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #ec4899, #c084fc);
      border-radius: 10px;
      transition: width 0.5s ease;
    }

    /* ═══ Driver Link ═══ */
    .driver-link-section {
      background: #fafafa;
      border: 1.5px solid #f3f4f6;
      border-radius: 12px;
      padding: 10px;
      margin-bottom: 0.75rem;
    }
    .link-label {
      display: block;
      font-weight: 700;
      color: #9ca3af;
      font-size: 0.7rem;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .link-row {
      display: flex;
      gap: 6px;
    }
    .link-input {
      flex: 1;
      min-width: 0;
      border: 1.5px solid #e5e7eb;
      background: white;
      padding: 8px 10px;
      border-radius: 8px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.75rem;
      color: #6b7280;
      outline: none;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .btn-copy {
      background: var(--pink-500, #ec4899);
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 0.1s;
    }
    .btn-copy:active { transform: scale(0.92); }

    /* ═══ Deliveries List ═══ */
    .deliveries-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      position: relative;
    }
    .deliveries-list::before {
      content: '';
      position: absolute;
      left: 19px;
      top: 12px;
      bottom: 12px;
      width: 2px;
      background: #f3f4f6;
      z-index: 0;
    }

    .delivery-item {
      display: flex;
      align-items: center;
      gap: 10px;
      background: white;
      padding: 10px;
      border-radius: 12px;
      border: 1.5px solid #f9fafb;
      position: relative;
      z-index: 1;
      transition: border-color 0.15s;
    }
    .delivery-item[data-status="Delivered"]    { opacity: 0.6; }
    .delivery-item[data-status="NotDelivered"] { opacity: 0.5; border-color: #fecaca; }
    .delivery-item[data-status="InTransit"]    { border-color: #93c5fd; background: #f0f7ff; }

    .order-badge {
      width: 28px; height: 28px;
      background: #fce7f3;
      color: #db2777;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.78rem;
      flex-shrink: 0;
      border: 2px solid white;
    }
    .order-badge[data-status="InTransit"]    { background: #dbeafe; color: #2563eb; }
    .order-badge[data-status="Delivered"]    { background: #d1fae5; color: #059669; }
    .order-badge[data-status="NotDelivered"] { background: #fecaca; color: #dc2626; }

    .delivery-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .delivery-info strong {
      font-size: 0.88rem;
      color: #374151;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .delivery-addr {
      font-size: 0.72rem;
      color: #9ca3af;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 1px;
    }

    .delivery-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      flex-shrink: 0;
    }
    .delivery-total {
      font-weight: 800;
      color: #ec4899;
      font-size: 0.82rem;
    }
    .delivery-status-icon { font-size: 1rem; }

    /* ═══ Failed Section ═══ */
    .failed-section {
      background: #fef2f2;
      border: 1.5px solid #fecaca;
      border-radius: 12px;
      padding: 10px 12px;
      margin-top: 0.75rem;
    }
    .failed-section h4 { margin: 0 0 6px; font-size: 0.85rem; }
    .failed-item {
      font-size: 0.8rem;
      color: #be123c;
      margin-bottom: 3px;
    }

    /* ═══════════════════════════════════════════
       MODAL OVERLAY (Shared)
       ═══════════════════════════════════════════ */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 3000;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* ═══ Modal Base (fullscreen bottom sheet on mobile) ═══ */
    .modal-fullscreen {
      width: 100%;
      max-width: 600px;
      background: white;
      border-radius: 20px 20px 0 0;
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease-out;
      overflow: hidden;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }

    .modal-top-bar {
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
      border-bottom: 1px solid #f3f4f6;
      background: white;
    }
    .chat-top { background: #fdf2f8; }
    .modal-top-info strong {
      display: block;
      font-size: 0.95rem;
      color: #1f2937;
    }
    .modal-top-info span {
      font-size: 0.72rem;
      color: #9ca3af;
    }
    .driver-badge {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .driver-avatar {
      font-size: 1.3rem;
      background: white;
      width: 38px; height: 38px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid #fce7f3;
    }
    .btn-close {
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
    .btn-close:active { background: #e5e7eb; }

    /* ═══════════════════════════════════════════
       MAP MODAL
       ═══════════════════════════════════════════ */
    .map-modal {
      height: 92dvh;
      max-height: 92dvh;
    }

    /* ═══════════════════════════════════════════
       MODAL: TICKET DE CORTE (LIQUIDACIÓN)
       ═══════════════════════════════════════════ */
    .ticket-modal {
      width: 90% !important;
      max-width: 420px !important;
      margin: auto;
      border-radius: 16px;
      overflow: visible;
      background: #fdfbf7;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    }
    
    .ticket-header {
      background: #ec4899;
      color: white;
      text-align: center;
      padding: 1.5rem 1rem 1rem;
      border-radius: 16px 16px 0 0;
      position: relative;
    }
    .ticket-header h3 { margin: 0; font-size: 1.3rem; font-weight: 800; letter-spacing: 0.5px; }
    .ticket-header p { margin: 4px 0 0; opacity: 0.9; font-size: 0.85rem; }
    
    .zig-zag-top {
      position: absolute;
      bottom: -10px;
      left: 0; right: 0;
      height: 10px;
      background: linear-gradient(-45deg, #fdfbf7 5px, transparent 0), linear-gradient(45deg, #fdfbf7 5px, transparent 0);
      background-position: left-bottom;
      background-repeat: repeat-x;
      background-size: 10px 10px;
    }

    .ticket-body {
      padding: 1.5rem 1.25rem;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }
    .ticket-section { margin-bottom: 1rem; }
    .ticket-section h4 { margin: 0 0 10px; color: #9ca3af; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; }
    
    .ticket-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.9rem;
      color: #374151;
    }
    .ticket-row.small-text { font-size: 0.8rem; color: #6b7280; }
    .expense-row { font-size: 0.8rem; }
    .subtotal { margin-top: 10px; font-weight: 700; border-top: 1px dashed #e5e7eb; padding-top: 8px; }
    
    .ticket-val.positive { color: #059669; font-weight: 700; }
    .ticket-val.negative { color: #dc2626; font-weight: 700; }
    
    .ticket-divider {
      height: 1px;
      border-bottom: 1px dashed #d1d5db;
      margin: 1rem 0;
    }
    .ticket-divider.bold {
      border-bottom: 2px dashed #9ca3af;
    }

    .no-expenses { font-size: 0.8rem; color: #9ca3af; font-style: italic; margin: 0; }

    .total-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      margin: 1.5rem 0 0.5rem;
    }
    .total-section span:first-child { text-transform: uppercase; font-size: 0.8rem; color: #6b7280; font-weight: 700; }
    .ticket-total.highlight {
      font-size: 2.5rem;
      font-weight: 900;
      color: #ec4899;
      font-family: 'Outfit', sans-serif;
    }

    .ticket-footer {
      display: flex;
      gap: 10px;
      padding: 0 1.25rem 1.25rem;
    }
    .btn-cancel {
      flex: 1;
      padding: 12px;
      border: none;
      background: #f3f4f6;
      border-radius: 12px;
      font-weight: 700;
      color: #6b7280;
      cursor: pointer;
    }
    .btn-confirm {
      flex: 2;
      padding: 12px;
      border: none;
      background: #ec4899;
      color: white;
      border-radius: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(236, 72, 153, 0.3);
    }
    .btn-confirm:disabled { opacity: 0.5; pointer-events: none; }

    .map-area {
      flex: 1;
      position: relative;
      background: #f3f4f6;
      min-height: 0;
    }

    /* GPS Waiting Overlay */
    .gps-waiting-overlay {
      position: absolute;
      inset: 0;
      background: rgba(255,255,255,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    .gps-waiting-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
      padding: 2rem;
    }
    .gps-icon { font-size: 2.5rem; position: relative; z-index: 1; }
    .gps-pulse-ring {
      width: 80px; height: 80px;
      border: 3px solid #ec4899;
      border-radius: 50%;
      position: absolute;
      animation: gpsPulse 2s ease-out infinite;
      opacity: 0;
    }
    @keyframes gpsPulse {
      0%   { transform: scale(0.5); opacity: 0.6; }
      100% { transform: scale(1.8); opacity: 0; }
    }
    .gps-waiting-card p {
      margin: 0;
      font-weight: 700;
      color: #374151;
      font-size: 0.95rem;
    }
    .gps-hint {
      font-size: 0.75rem;
      color: #9ca3af;
    }

    /* Plotting Indicator */
    .plotting-indicator {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 700;
      color: #6b7280;
      box-shadow: 0 2px 12px rgba(0,0,0,0.12);
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 10;
    }

    .mini-spinner {
      width: 16px; height: 16px;
      border: 2.5px solid #e5e7eb;
      border-top-color: #ec4899;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    .mini-spinner.pink {
      border-color: #fce7f3;
      border-top-color: #ec4899;
    }

    /* Map Footer */
    .map-footer {
      padding: 10px 16px;
      padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
      background: #1f2937;
      color: white;
      font-size: 0.82rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .live-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #34d399;
      font-weight: 700;
    }
    .pulse-dot {
      width: 8px; height: 8px;
      background: #34d399;
      border-radius: 50%;
      animation: pulseDot 1.5s ease-in-out infinite;
    }
    @keyframes pulseDot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.4; transform: scale(1.5); }
    }
    .offline-indicator {
      color: #9ca3af;
      font-weight: 600;
    }

    /* ═══════════════════════════════════════════
       CHAT MODAL
       ═══════════════════════════════════════════ */
    .chat-modal {
      height: 85dvh;
      max-height: 85dvh;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #f9fafb;
      -webkit-overflow-scrolling: touch;
      min-height: 0;
    }

    .chat-loading {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: #9ca3af;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .chat-empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #d1d5db;
      gap: 6px;
    }
    .chat-empty span { font-size: 2.5rem; opacity: 0.5; }
    .chat-empty p { margin: 0; font-size: 0.85rem; }

    /* Bubbles */
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

    /* Input */
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
      background: white;
    }
    .chat-input-area input:focus { border-color: #f9a8d4; }

    .send-btn {
      width: 44px; height: 44px;
      border-radius: 50%;
      border: none;
      background: #ec4899;
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

    /* ═══════════════════════════════════════════
       DESKTOP ENHANCEMENTS
       ═══════════════════════════════════════════ */
    @media (min-width: 640px) {
      .routes-page { padding: 1.5rem 2rem 4rem; }
      .page-header-text h2 { font-size: 2.2rem; }

      .route-card { padding: 1.25rem; border-radius: 24px; }
      .route-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 12px 40px rgba(255,107,157,0.15);
      }

      .action-chip { padding: 8px 14px; }

      /* Desktop modals: centered card instead of bottom sheet */
      .modal-overlay {
        align-items: center;
      }
      .modal-fullscreen {
        border-radius: 24px;
        max-height: 85vh;
      }
      .map-modal { height: 80vh; max-height: 80vh; }
      .chat-modal {
        max-width: 440px;
        height: 600px;
        max-height: 80vh;
      }
    }
  `]
})
export class RouteManagerComponent implements OnInit, OnDestroy {
  @ViewChild(GoogleMap) map!: GoogleMap;
  @ViewChild('chatScroll') chatScroll?: ElementRef;

  // ═══ SIGNALS ═══
  routes = signal<DeliveryRoute[]>([]);
  loading = signal(false);
  toastMessage = signal('');

  // Map State
  showMapModal = signal(false);
  selectedRouteForMap = signal<DeliveryRoute | null>(null);
  lastLocationUpdate = signal<string | null>(null);
  waitingForGps = signal(false);
  plottingRoute = signal(false);

  // Chat State
  chatRoute = signal<DeliveryRoute | null>(null);
  activeMessages = signal<ChatMessage[]>([]);
  loadingChat = signal(false);
  newMessage = '';

  /** Anti-duplicado de mensajes */
  private chatMsgIds = new Set<number | string>();

  // Google Maps Config
  center: google.maps.LatLngLiteral = { lat: GEOCODE_CONFIG.defaultLat, lng: GEOCODE_CONFIG.defaultLng };
  zoom = 13;
  mapOptions: google.maps.MapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    gestureHandling: 'greedy'
  };

  // Markers
  warehousePos: google.maps.LatLngLiteral = { lat: 27.5146982, lng: -99.571329 };
  driverPos?: google.maps.LatLngLiteral;
  routeDeliveries: RouteDelivery[] = [];
  directionsResult = signal<google.maps.DirectionsResult | undefined>(undefined);

  warehouseOptions: google.maps.MarkerOptions = {
    label: { text: '🏠', fontSize: '24px' },
    title: 'Cueva',
    icon: {
      url: 'https://cdn-icons-png.flaticon.com/512/2555/2555572.png',
      scaledSize: new google.maps.Size(40, 40)
    }
  };

  driverOptions: google.maps.MarkerOptions = {
    label: { text: '🚚', fontSize: '30px' },
    title: 'Repartidor',
    zIndex: 1000,
    icon: {
      url: 'https://cdn-icons-png.flaticon.com/512/2555/2555572.png',
      scaledSize: new google.maps.Size(40, 40)
    }
  };

  directionsOptions: google.maps.DirectionsRendererOptions = {
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#ec4899',
      strokeWeight: 6,
      strokeOpacity: 0.7
    }
  };

  private geocodeCache = new Map<string, { lat: number; lng: number } | null>();
  private gpsTimeoutId?: ReturnType<typeof setTimeout>;

  constructor(
    private api: ApiService,
    private confirm: ConfirmationService,
    private signalr: SignalRService,
    private whatsapp: WhatsAppService,
    private pushService: PushNotificationService
  ) { }

  ngOnInit(): void {
    this.loadRoutes();
    this.signalr.connect().then(() => {
      this.signalr.joinAdminGroup();
    });

    // 🔔 Solicitar permiso de notificaciones
    this.pushService.requestPermission().then(granted => {
      if (granted) console.log('✅ Notificaciones habilitadas para admin');
    });

    // GPS del chofer
    this.signalr.locationUpdate$.subscribe(loc => {
      this.handleLocationUpdate(loc);
    });

    // Chat de chofer → admin (con anti-duplicado)
    this.signalr.adminChatUpdate$.subscribe(msg => {
      if (this.chatRoute()?.id === msg.deliveryRouteId) {
        if (!this.chatMsgIds.has(msg.id)) {
          this.chatMsgIds.add(msg.id);
          this.activeMessages.update(msgs => [...msgs, msg]);
          this.scrollToBottom();
        }
      } else {
        this.showToast(`💬 Mensaje del chofer (Ruta #${msg.deliveryRouteId})`);
        // 🔔 PUSH: Notificar mensaje del chofer
        this.pushService.notifyNewMessage(
          msg.senderName || 'Chofer',
          msg.text || msg.message || 'Nuevo mensaje',
          'admin'
        );
      }
    });
  }

  ngOnDestroy(): void {
    this.signalr.disconnect();
    if (this.gpsTimeoutId) clearTimeout(this.gpsTimeoutId);
  }

  showCorteModal = signal(false);
  selectedRouteForCorte = signal<DeliveryRoute | null>(null);
  liquidating = signal(false);

  // ═══════════════════════════════════════════
  //  RUTAS
  // ═══════════════════════════════════════════
  loadRoutes(): void {
    this.loading.set(true);
    this.api.getRoutes().subscribe({
      next: (r) => {
        r.sort((a, b) => b.id - a.id);
        this.routes.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  async askDelete(route: DeliveryRoute): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: '¿Cancelar esta ruta? 🚫',
      message: `La ruta #${route.id} se eliminará y los pedidos volverán a estar pendientes. ✍`,
      confirmText: 'Sí, cancelar',
      type: 'danger',
      icon: '🗑️'
    });

    if (confirmed) {
      this.api.deleteRoute(route.id).subscribe({
        next: () => {
          this.showToast('Ruta cancelada 🗑️');
          this.loadRoutes();
        },
        error: () => this.showToast('Error al cancelar ruta 😔')
      });
    }
  }

  getProgress(r: DeliveryRoute): number {
    return r.deliveries.length ? (this.getDelivered(r) / r.deliveries.length) * 100 : 0;
  }

  getDelivered(r: DeliveryRoute): number {
    return r.deliveries.filter(d => d.status === 'Delivered').length;
  }

  getFailedDeliveries(r: DeliveryRoute): RouteDelivery[] {
    return r.deliveries.filter(d => d.status === 'NotDelivered');
  }

  copy(el: HTMLInputElement): void {
    navigator.clipboard.writeText(el.value);
    this.showToast('¡Link copiado! 📋✅');
  }

  shareRouteWa(route: DeliveryRoute): void {
    const phone = '8671794003';
    this.whatsapp.shareRouteWithDriver(phone, route);
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }

  // ═══════════════════════════════════════════
  //  CORTE DE CAJA (LIQUIDACIÓN)
  // ═══════════════════════════════════════════
  openCorteModal(route: DeliveryRoute): void {
    this.selectedRouteForCorte.set(route);
    this.showCorteModal.set(true);
  }

  closeCorteModal(): void {
    this.selectedRouteForCorte.set(null);
    this.showCorteModal.set(false);
  }

  routeCorte(): { totalEfectivo: number, totalTransferencias: number, totalGastos: number, totalAEntregar: number } {
    const route = this.selectedRouteForCorte();
    if (!route) return { totalEfectivo: 0, totalTransferencias: 0, totalGastos: 0, totalAEntregar: 0 };

    let totalEfectivo = 0;
    let totalTransferencias = 0;

    // Solo sumar pagos de órdenes que han sido marcadas como entregadas o están en ruta cobradas
    route.deliveries.forEach(d => {
      if (d.payments && d.payments.length > 0) {
        d.payments.forEach(p => {
          if (p.method === 'Efectivo') {
            totalEfectivo += p.amount;
          } else {
            totalTransferencias += p.amount;
          }
        });
      }
    });

    let totalGastos = 0;
    if (route.expenses && route.expenses.length > 0) {
      totalGastos = route.expenses.reduce((sum, e) => sum + e.amount, 0);
    }

    return {
      totalEfectivo,
      totalTransferencias,
      totalGastos,
      totalAEntregar: totalEfectivo - totalGastos
    };
  }

  confirmLiquidate(): void {
    const route = this.selectedRouteForCorte();
    if (!route) return;

    this.liquidating.set(true);
    this.api.liquidateRoute(route.id).subscribe({
      next: () => {
        this.liquidating.set(false);
        this.showToast('✅ Ruta liquidada correctamente.');
        this.closeCorteModal();
        this.loadRoutes(); // Refrescar para ver estado completado
      },
      error: () => {
        this.liquidating.set(false);
        this.showToast('❌ Error al liquidar la ruta.');
      }
    });
  }

  // ═══════════════════════════════════════════
  //  MAPA EN VIVO
  // ═══════════════════════════════════════════
  openMap(route: DeliveryRoute): void {
    this.selectedRouteForMap.set(route);
    this.showMapModal.set(true);
    this.routeDeliveries = route.deliveries;
    this.directionsResult.set(undefined);
    this.driverPos = undefined;
    this.lastLocationUpdate.set(null);

    if (route.driverToken) {
      this.signalr.joinRoute(route.driverToken);
    }

    // Check initial driver location
    if (route.driverLocation?.latitude) {
      this.driverPos = {
        lat: route.driverLocation.latitude,
        lng: route.driverLocation.longitude
      };
      this.lastLocationUpdate.set(route.driverLocation.lastUpdate);
      this.waitingForGps.set(false);
    } else {
      // Show GPS waiting state with auto-timeout
      this.waitingForGps.set(true);
      if (this.gpsTimeoutId) clearTimeout(this.gpsTimeoutId);
      this.gpsTimeoutId = setTimeout(() => {
        if (this.waitingForGps()) {
          this.waitingForGps.set(false);
        }
      }, 15000); // 15s timeout
    }

    this.center = this.driverPos || this.warehousePos;

    setTimeout(() => this.plotRoute(route), 250);
  }

  closeMap(): void {
    this.showMapModal.set(false);
    this.selectedRouteForMap.set(null);
    this.waitingForGps.set(false);
  }

  getDeliveryMarkerOptions(d: RouteDelivery): google.maps.MarkerOptions {
    let color = '#f472b6';
    if (d.status === 'InTransit') color = '#3b82f6';
    else if (d.status === 'Delivered') color = '#22c55e';
    else if (d.status === 'NotDelivered') color = '#ef4444';

    return {
      label: { text: d.sortOrder.toString(), color: 'white', fontWeight: 'bold' },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 2,
        scale: 12
      },
      title: `${d.sortOrder}. ${d.clientName} (${d.status})`
    };
  }

  private async plotRoute(route: DeliveryRoute): Promise<void> {
    this.plottingRoute.set(true);

    const sortedDeliveries = [...route.deliveries].sort((a, b) => a.sortOrder - b.sortOrder);
    const waypoints: google.maps.DirectionsWaypoint[] = [];
    const path: google.maps.LatLngLiteral[] = [this.warehousePos];

    for (const d of sortedDeliveries) {
      let lat = d.latitude;
      let lng = d.longitude;

      if (!lat || !lng) {
        const coords = await this.geocodeAddress(d.address || d.clientAddress || '');
        if (coords) { lat = coords.lat; lng = coords.lng; }
      }

      if (lat && lng) {
        waypoints.push({ location: { lat, lng }, stopover: true });
        path.push({ lat, lng });
        d.latitude = lat;
        d.longitude = lng;
      }
    }

    if (path.length > 1) {
      this.calculateDirections(this.warehousePos, path[path.length - 1], waypoints.slice(0, -1));
    }

    this.plottingRoute.set(false);

    setTimeout(() => {
      if (this.map) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(this.warehousePos);
        path.forEach(p => bounds.extend(p));
        if (this.driverPos) bounds.extend(this.driverPos);
        this.map.fitBounds(bounds, 50);
      }
    }, 400);
  }

  private calculateDirections(
    start: google.maps.LatLngLiteral,
    end: google.maps.LatLngLiteral,
    waypoints: google.maps.DirectionsWaypoint[]
  ): void {
    const directionsService = new google.maps.DirectionsService();
    directionsService.route({
      origin: start,
      destination: end,
      waypoints,
      optimizeWaypoints: false,
      travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK && result) {
        this.directionsResult.set(result);
      } else {
        console.warn('Directions failed:', status);
      }
    });
  }

  private async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    if (!address) return null;
    const cacheKey = address.toLowerCase().trim();
    if (this.geocodeCache.has(cacheKey)) return this.geocodeCache.get(cacheKey) ?? null;

    return new Promise((resolve) => {
      const geocoder = new google.maps.Geocoder();
      const fullAddress = `${address}, ${GEOCODE_CONFIG.city}, ${GEOCODE_CONFIG.state}, México`;

      geocoder.geocode({ address: fullAddress }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
          const res = {
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          };
          this.geocodeCache.set(cacheKey, res);
          resolve(res);
        } else {
          this.geocodeCache.set(cacheKey, null);
          resolve(null);
        }
      });
    });
  }

  private handleLocationUpdate(loc: any): void {
    if (!this.selectedRouteForMap() || !this.showMapModal()) return;

    if (loc.latitude && loc.longitude) {
      this.driverPos = { lat: loc.latitude, lng: loc.longitude };
      this.lastLocationUpdate.set(new Date().toISOString());

      // Si estábamos esperando GPS, ocultar overlay
      if (this.waitingForGps()) {
        this.waitingForGps.set(false);
        this.showToast('📡 GPS del chofer conectado');
      }

      if (this.map) {
        this.map.panTo(this.driverPos);
      }
    }
  }

  // ═══════════════════════════════════════════
  //  CHAT
  // ═══════════════════════════════════════════
  openChat(route: DeliveryRoute): void {
    if (this.chatRoute()?.id === route.id) {
      this.scrollToBottom();
      return;
    }
    this.closeChat();

    setTimeout(() => {
      this.chatRoute.set(route);
      this.loadingChat.set(true);

      this.api.getRouteChat(route.id).subscribe({
        next: (msgs) => {
          msgs.forEach(m => this.chatMsgIds.add(m.id));
          this.activeMessages.set(msgs);
          this.loadingChat.set(false);
          this.scrollToBottom();
        },
        error: () => {
          this.loadingChat.set(false);
          this.showToast('Error cargando chat 😔');
        }
      });
    }, 50);
  }

  closeChat(): void {
    this.chatRoute.set(null);
    this.activeMessages.set([]);
    this.chatMsgIds.clear();
  }

  sendMessage(): void {
    const text = this.newMessage.trim();
    if (!text || !this.chatRoute()) return;
    this.newMessage = '';

    this.api.sendAdminMessage(this.chatRoute()!.id, text).subscribe(msg => {
      if (!this.chatMsgIds.has(msg.id)) {
        this.chatMsgIds.add(msg.id);
        this.activeMessages.update(msgs => [...msgs, msg]);
      }
      this.scrollToBottom();
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatScroll?.nativeElement) {
        this.chatScroll.nativeElement.scrollTop = this.chatScroll.nativeElement.scrollHeight;
      }
    }, 60);
  }
}