import { Component, OnInit, signal, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { WhatsAppService } from '../../../../core/services/whatsapp.service';
import { DeliveryRoute, ChatMessage, RouteDelivery } from '../../../../shared/models/models';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { SignalRService } from '../../../../core/services/signalr.service';
import { GoogleMapsModule, GoogleMap, MapDirectionsRenderer, MapMarker } from '@angular/google-maps';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';

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
      
      @if (toastMessage()) {
        <div class="toast-notification">{{ toastMessage() }}</div>
      }

      <div class="page-header">
        <div>
          <h2>Mis Rutas 🚗</h2>
          <p class="page-sub">Monitorea tus entregas en tiempo real, bonita</p>
        </div>
        <button class="btn-refresh" (click)="loadRoutes()" title="Actualizar">🔄</button>
      </div>

      @if (loading() && routes().length === 0) {
        <div class="loading-state">
          <div class="spinner">🎀</div>
          <p>Cargando rutas...</p>
        </div>
      }

      @if (!loading() && routes().length === 0) {
        <div class="empty">
          <span class="empty-icon">🛣️</span>
          <p>No hay rutas activas</p>
          <p class="empty-hint">Ve a Pedidos, selecciona varios y crea una ruta mágica 💕</p>
        </div>
      }

      <div class="routes-container">
        @for (route of routes(); track route.id) {
          <div class="route-card" [attr.data-status]="route.status">
            
            <div class="route-header">
              <div class="route-title">
                <span class="route-icon">🏎️</span>
                <div class="route-meta">
                  <span class="route-id">Ruta #{{ route.id }}</span>
                  <span class="route-date">{{ route.createdAt | date:'d MMM, h:mm a' }}</span>
                </div>
              </div>
              <div class="header-actions">
                <span class="status-pill" [attr.data-status]="route.status">
                  {{ route.status === 'Pending' ? '⏳ Pendiente' : route.status === 'Active' ? '🚀 En camino' : '✅ Finalizada' }}
                </span>
                <button class="btn-icon" (click)="openMap(route)" title="Ver Mapa en Vivo">🗺️</button>
                <button class="btn-delete" (click)="askDelete(route)" title="Cancelar ruta">🗑️</button>
              </div>
            </div>

            <div class="route-progress">
              <div class="progress-labels">
                <span>Progreso</span>
                <span>{{ getDelivered(route) }}/{{ route.deliveries.length }} entregas 🎁</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" [style.width.%]="getProgress(route)"></div>
              </div>
            </div>

            <div class="driver-link-section">
              <span class="label">🔗 Link para el chofer:</span>
              <div class="link-row">
                <input type="text" [value]="route.driverLink" readonly #linkEl>
                <button class="btn-copy" (click)="copy(linkEl)">📋 Copiar</button>
                <button class="btn-copy btn-wa" (click)="shareRouteWa(route)">📱 Enviar</button>
              </div>
            </div>

            <div class="deliveries-list">
              @for (d of route.deliveries; track d.id) {
                <div class="delivery-item" [attr.data-status]="d.status">
                  <div class="order-badge">{{ d.sortOrder }}</div>
                  <div class="delivery-info">
                    <strong>{{ d.clientName }}</strong>
                    @if (d.address) { <span class="delivery-addr">📍 {{ d.address }}</span> }
                  </div>
                  <div class="delivery-right">
                    <span class="delivery-total">$ {{ d.total | number:'1.2-2' }}</span>
                    <span class="delivery-status-icon" [title]="d.status">
                      {{ d.status === 'Pending' ? '⏳' : d.status === 'Delivered' ? '✅' : d.status === 'InTransit' ? '🏃' : '❌' }}
                    </span>
                  </div>
                </div>
              }
            </div>

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

      <!-- ═══════════════ MAP MODAL ═══════════════ -->
      @if (showMapModal() && selectedRouteForMap()) {
        <div class="modal-overlay" (click)="closeMap()">
          <div class="modal-card map-card" (click)="$event.stopPropagation()">
            <div class="map-header">
              <h3>🗺️ Seguimiento en Vivo</h3>
              <p>Ruta #{{ selectedRouteForMap()!.id }}</p>
              <button class="btn-close-map" (click)="closeMap()">✗</button>
            </div>
            
            <div class="map-container">
               <google-map 
                height="100%" 
                width="100%" 
                [center]="center" 
                [zoom]="zoom"
                [options]="mapOptions">
                
                <!-- Base / Warehouse Marker -->
                <map-marker 
                  [position]="warehousePos" 
                  [options]="warehouseOptions">
                </map-marker>

                <!-- Driver Marker -->
                @if (driverPos) {
                  <map-marker 
                    [position]="driverPos" 
                    [options]="driverOptions">
                  </map-marker>
                }

                <!-- Delivery Markers -->
                @for (d of routeDeliveries; track d.id) {
                  @if (d.latitude && d.longitude) {
                    <map-marker 
                      [position]="{ lat: d.latitude, lng: d.longitude }" 
                      [options]="getDeliveryMarkerOptions(d)">
                    </map-marker>
                  }
                }

                <!-- Route Polyline (Directions) -->
                 @if (directionsResult(); as result) {
                  <map-directions-renderer 
                    [directions]="result" 
                    [options]="directionsOptions">
                  </map-directions-renderer>
                }
              </google-map>
            </div>

            <div class="map-footer">
              @if (lastLocationUpdate()) {
                <span class="live-indicator">
                  <span class="dot"></span> En vivo ({{ lastLocationUpdate() | date:'h:mm:ss a' }})
                </span>
              } @else {
                <span class="offline-indicator">Sin GPS en vivo. Mostrando ruta planificada 🗺️</span>
              }
            </div>
          </div>
        </div>
      }

      <!-- ═══════════════ CHAT MODAL ═══════════════ -->
      @if (chatRoute()) {
        <div class="modal-overlay" (click)="closeChat()">
          <div class="modal-card chat-card" (click)="$event.stopPropagation()">
            <div class="chat-header">
              <div class="driver-info">
                <span class="driver-avatar">🧢</span>
                <div>
                  <h3>Chat con Repartidor</h3>
                  <span class="status">Ruta #{{ chatRoute()!.id }}</span>
                </div>
              </div>
              <button class="btn-close-map" (click)="closeChat()">✕</button>
            </div>

            <div class="chat-messages" #chatScroll>
              @if (activeMessages().length === 0) {
                <div class="empty-chat">
                  <span>💬</span>
                  <p>Inicia la conversación con tu repartidor</p>
                </div>
              }
              @for (msg of activeMessages(); track msg.id) {
                <div class="message-bubble" [class.me]="msg.sender === 'Admin'" [class.them]="msg.sender === 'Driver'">
                  <div class="bubble-content">
                    {{ msg.text }}
                  </div>
                  <span class="msg-time">{{ msg.timestamp | date:'shortTime' }}</span>
                </div>
              }
            </div>

            <div class="chat-input-area">
              <input type="text" [(ngModel)]="newMessage" (keydown.enter)="sendMessage()" placeholder="Escribe un mensaje...">
              <button class="btn-send" (click)="sendMessage()" [disabled]="!newMessage.trim()">➤</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    /* ═══════════════════════════════════════════
       DESIGN TOKENS
           ═══════════════════════════════════════════ */
    :host {
      --glass-bg: rgba(255, 255, 255, 0.75);
      --shadow-soft: 0 10px 40px rgba(255, 107, 157, 0.1);
      --gradient-card: linear-gradient(145deg, #ffffff, #fff0f6);
    }

    .routes-page {
      padding: 1rem 1.25rem 6rem;
      max-width: 900px;
      margin: 0 auto;
      min-height: 100vh;
    }

    /* HEADER */
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-bottom: 2.5rem;
    }
    h2 {
      font-family: var(--font-display); font-size: 2.5rem;
      color: var(--pink-600); margin: 0;
      text-shadow: 2px 2px 0 white;
    }
    .page-sub {
      font-family: var(--font-body); color: var(--text-medium);
      margin: 5px 0 0; font-weight: 600;
    }
    .btn-refresh {
      background: white; border: 1px solid var(--pink-200); width: 45px; height: 45px;
      border-radius: 50%; font-size: 1.2rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0 4px 10px rgba(255,107,157,0.1);
    }
    .btn-refresh:hover { transform: rotate(180deg) scale(1.1); background: var(--pink-50); }

    /* LOADING & EMPTY */
    .loading-state {
      text-align: center; color: var(--pink-400); font-family: var(--font-display);
      margin-top: 4rem;
    }
    .spinner { font-size: 3rem; animation: spin 1s infinite linear; margin-bottom: 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty {
      text-align: center; padding: 4rem 1rem; color: #ccc;
      background: rgba(255,255,255,0.5); border-radius: 30px; border: 2px dashed #eee;
    }
    .empty-icon { font-size: 4rem; opacity: 0.4; margin-bottom: 1rem; display: block; }
    .empty p { font-weight: 700; margin: 0; font-size: 1.1rem; color: #aaa; }
    .empty-hint { font-size: 0.9rem !important; color: var(--pink-300) !important; margin-top: 5px !important; }

    /* CARD LIST */
    .routes-container { display: flex; flex-direction: column; gap: 1.5rem; }

    .route-card {
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      border-radius: 28px;
      padding: 1.5rem;
      border: 1px solid white;
      box-shadow: var(--shadow-soft);
      transition: transform 0.3s;
      position: relative; overflow: hidden;
    }
    .route-card:hover { transform: translateY(-5px); box-shadow: 0 15px 50px rgba(255, 107, 157, 0.2); }
    
    .route-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 1.5rem;
    }
    .route-title { display: flex; align-items: center; gap: 12px; }
    .route-icon {
      font-size: 2rem; background: var(--pink-50); width: 50px; height: 50px;
      border-radius: 18px; display: flex; align-items: center; justify-content: center;
      box-shadow: inset 0 0 10px rgba(236,72,153,0.1);
    }
    .route-meta { display: flex; flex-direction: column; }
    .route-id { font-size: 1.1rem; font-weight: 800; color: var(--text-dark); }
    .route-date { font-size: 0.8rem; color: #999; font-weight: 600; text-transform: uppercase; }

    .header-actions { display: flex; align-items: center; gap: 8px; }
    .btn-icon {
      background: #f0f9ff; border: none; width: 38px; height: 38px; border-radius: 12px;
      font-size: 1.1rem; cursor: pointer; transition: 0.2s;
    }
    .btn-icon:hover { background: #e0f2fe; transform: translateY(-2px); }
    .btn-delete {
      background: #fff1f2; border: none; width: 38px; height: 38px; border-radius: 12px;
      font-size: 1.1rem; cursor: pointer; transition: 0.2s; color: #e11d48;
    }
    .btn-delete:hover { background: #ffe4e6; transform: translateY(-2px); }

    .status-pill {
      padding: 6px 12px; border-radius: 20px; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;
    }
    [data-status="Pending"] { background: #fffbeb; color: #d97706; }
    [data-status="Active"]  { background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; }
    [data-status="Completed"] { background: #f0fdf4; color: #16a34a; }

    /* PROGRESS */
    .route-progress { margin-bottom: 1.5rem; }
    .progress-labels { display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 700; color: #888; margin-bottom: 6px; text-transform: uppercase; }
    .progress-track {
      background: #f0f0f0; border-radius: 10px; height: 10px; overflow: hidden;
    }
    .progress-fill {
      height: 100%; background: linear-gradient(90deg, #ff6b9d, #c084fc);
      border-radius: 10px; transition: width 0.5s ease-out;
    }

    /* LINK SECTION */
    .driver-link-section {
      background: rgba(255,255,255,0.6); border: 1px solid #f0f0f0;
      border-radius: 16px; padding: 12px; display: flex; align-items: center;
      gap: 12px; margin-bottom: 2rem;
    }
    .label { font-weight: 800; color: #aaa; font-size: 0.75rem; text-transform: uppercase; white-space: nowrap; }
    .link-row { flex: 1; display: flex; gap: 8px; }
    input {
      flex: 1; border: none; background: transparent; font-family: monospace; font-size: 0.9rem; color: #555;
      background: white; padding: 6px 10px; border-radius: 8px; outline: none;
    }
    .btn-copy {
      background: var(--pink-500); color: white; border: none; padding: 6px 14px;
      border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 0.8rem;
      transition: 0.2s;
    }
    .btn-copy:hover { box-shadow: 0 4px 12px rgba(236,72,153,0.3); transform: translateY(-1px); }
    .btn-wa { background: #25D366; margin-left: 5px; }
    .btn-wa:hover { box-shadow: 0 4px 12px rgba(37, 211, 102, 0.4); }

    /* DELIVERIES LIST */
    .deliveries-list {
      display: flex; flex-direction: column; gap: 10px; position: relative;
    }
    .deliveries-list::before {
      content: ''; position: absolute; left: 14px; top: 15px; bottom: 15px;
      width: 2px; background: #eee; z-index: 0;
    }
    
    .delivery-item {
      display: flex; align-items: center; gap: 12px;
      background: white; padding: 12px; border-radius: 16px;
      border: 1.5px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.03);
      position: relative; z-index: 1; transition: 0.2s;
    }
    .delivery-item:hover { transform: translateX(5px); border-color: var(--pink-100); }
    
    .order-badge {
      width: 30px; height: 30px; background: var(--pink-100); color: var(--pink-600);
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 0.9rem; flex-shrink: 0;
      border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }
    
    .delivery-info { flex: 1; display: flex; flex-direction: column; }
    .delivery-info strong { color: #444; font-size: 0.95rem; }
    .delivery-addr { font-size: 0.8rem; color: #888; margin-top: 2px; }
    
    .delivery-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .delivery-total { font-weight: 800; color: var(--pink-500); font-size: 0.9rem; }
    .delivery-status-icon { font-size: 1.1rem; }

    /* FAILED */
    .failed-section {
      background: #fff1f2; border: 1px solid #fecdd3; border-radius: 16px;
      padding: 1rem; margin-top: 1rem;
    }
    .failed-item { font-size: 0.85rem; color: #be123c; margin-bottom: 4px; }

    /* ═══ MAP MODAL ═══ */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
      z-index: 2000; display: flex; align-items: center; justify-content: center;
      padding: 1rem; animation: fadeIn 0.3s;
    }
    .map-card {
      background: white; width: 100%; max-width: 800px; height: 80vh;
      border-radius: 30px; overflow: hidden; display: flex; flex-direction: column;
      box-shadow: 0 25px 60px rgba(0,0,0,0.3); border: 4px solid white;
      animation: popIn 0.4s var(--ease-spring);
    }
    .map-header {
      padding: 1rem 1.5rem; background: white; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee;
    }
    .map-header h3 { margin: 0; font-family: var(--font-display); font-size: 1.5rem; color: #333; }
    .map-header p { margin: 0; font-size: 0.9rem; color: #bbb; font-weight: 700; margin-left: auto; margin-right: 15px; }
    .btn-close-map {
      background: #f5f5f5; border: none; width: 36px; height: 36px; border-radius: 50%;
      font-size: 1.2rem; cursor: pointer; color: #888;
    }
    
    .map-container { flex: 1; background: #eee; position: relative; }
    
    .map-footer {
      padding: 10px 15px; background: #222; color: white; font-size: 0.85rem;
      display: flex; align-items: center; justify-content: center;
    }
    .live-indicator { display: flex; align-items: center; gap: 6px; color: #34d399; font-weight: 700; }
    .dot { width: 10px; height: 10px; background: #34d399; border-radius: 50%; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(2); } }

    /* ═══ CHAT MODAL ═══ */
    .chat-card {
      max-width: 400px; height: 600px;
      display: flex; flex-direction: column;
    }
    .chat-header {
      padding: 1rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;
      background: #fdf2f8;
    }
    .driver-info { display: flex; align-items: center; gap: 10px; }
    .driver-avatar { font-size: 1.5rem; background: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .chat-header h3 { margin: 0; font-size: 1rem; color: var(--pink-600); }
    .chat-header .status { font-size: 0.75rem; color: #666; font-weight: 700; }

    .chat-messages {
      flex: 1; overflow-y: auto; padding: 1rem; background: #fffbff;
      display: flex; flex-direction: column; gap: 10px;
    }
    .message-bubble {
      max-width: 80%; padding: 10px 14px; border-radius: 16px; font-size: 0.9rem; position: relative;
    }
    .message-bubble.me {
      align-self: flex-end; background: var(--pink-500); color: white; border-bottom-right-radius: 4px;
    }
    .message-bubble.them {
      align-self: flex-start; background: white; border: 1px solid #eee; color: #444; border-bottom-left-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.03);
    }
    .msg-time { display: block; font-size: 0.65rem; margin-top: 4px; opacity: 0.7; text-align: right; }
    
    .chat-input-area {
      padding: 10px; border-top: 1px solid #eee; display: flex; gap: 8px; background: white;
    }
    .chat-input-area input {
      flex: 1; border: 1px solid #eee; padding: 10px 14px; border-radius: 24px; outline: none; transition: 0.2s;
    }
    .chat-input-area input:focus { border-color: var(--pink-400); }
    
    .empty-chat {
      text-align: center; color: #ccc; margin-top: 2rem;
      display: flex; flex-direction: column; align-items: center;
    }
    .empty-chat span { font-size: 3rem; opacity: 0.5; margin-bottom: 5px; }

    /* ═══ RESPONSIVE ═══ */
    @media (max-width: 600px) {
      .routes-page { padding: 1rem 1rem 5rem; }
      h2 { font-size: 2rem; }
      .route-card { padding: 1.2rem; }
      
      .page-header { flex-direction: column; gap: 1rem; align-items: flex-start; }
      .btn-refresh { align-self: flex-end; }
      
      .route-header { flex-direction: column; gap: 1rem; }
      .header-actions { width: 100%; justify-content: space-between; }
      
      .driver-link-section { flex-direction: column; }
      .link-row { width: 100%; }
      input { width: 100%; }
    }    
  `]
})
export class RouteManagerComponent implements OnInit, OnDestroy {
  @ViewChild(GoogleMap) map!: GoogleMap;

  routes = signal<DeliveryRoute[]>([]);
  loading = signal(false);
  toastMessage = signal('');

  // Map State
  showMapModal = signal(false);
  selectedRouteForMap = signal<DeliveryRoute | null>(null);
  lastLocationUpdate = signal<string | null>(null);

  // Chat State
  chatRoute = signal<DeliveryRoute | null>(null);
  activeMessages = signal<ChatMessage[]>([]);
  newMessage = '';
  @ViewChild('chatScroll') chatScroll?: ElementRef;

  // Google Maps Config
  center: google.maps.LatLngLiteral = { lat: GEOCODE_CONFIG.defaultLat, lng: GEOCODE_CONFIG.defaultLng };
  zoom = 13;
  mapOptions: google.maps.MapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false
  };

  // Markers
  warehousePos: google.maps.LatLngLiteral = { lat: 27.5146982, lng: -99.571329 }; //Bodega, osea la casa
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

  // Helper for geocoding
  private geocodeCache = new Map<string, { lat: number; lng: number } | null>();

  constructor(
    private api: ApiService,
    private confirm: ConfirmationService,
    private signalr: SignalRService,
    private whatsapp: WhatsAppService
  ) { }

  ngOnInit(): void {
    this.loadRoutes();
    this.signalr.connect().then(() => {
      this.signalr.joinAdmin();
    });

    this.signalr.locationUpdate$.subscribe(loc => {
      this.handleLocationUpdate(loc);
    });

    this.signalr.adminChatUpdate$.subscribe(msg => {
      if (this.chatRoute()?.id === msg.deliveryRouteId) {
        this.activeMessages.update(msgs => [...msgs, msg]);
        this.scrollToBottom();
      } else {
        this.showToast(`💬 Mensaje del chofer (Ruta #${msg.deliveryRouteId})`);
      }
    });
  }



  ngOnDestroy(): void {
    this.signalr.disconnect();
  }

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

  async askDelete(route: DeliveryRoute) {
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
    if (r.deliveries.length === 0) return 0;
    return (this.getDelivered(r) / r.deliveries.length) * 100;
  }

  getDelivered(r: DeliveryRoute): number {
    return r.deliveries.filter(d => d.status === 'Delivered').length;
  }

  getFailedDeliveries(r: DeliveryRoute): any[] {
    return r.deliveries.filter(d => d.status === 'NotDelivered');
  }

  copy(el: HTMLInputElement): void {
    navigator.clipboard.writeText(el.value);
    this.showToast('¡Link copiado! 📋✅');
  }

  shareRouteWa(route: DeliveryRoute): void {
    const phone = '8671794003'; // Example
    this.whatsapp.shareRouteWithDriver(phone, route);
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }

  // ═══ MAP LOGIC ═══
  openMap(route: DeliveryRoute) {
    this.selectedRouteForMap.set(route);
    this.showMapModal.set(true);
    this.routeDeliveries = route.deliveries;
    this.directionsResult.set(undefined);
    this.driverPos = undefined;

    if (route.driverToken) {
      this.signalr.joinRoute(route.driverToken);
    }

    // Initial driver location
    if (route.driverLocation && route.driverLocation.latitude) {
      this.driverPos = { lat: route.driverLocation.latitude, lng: route.driverLocation.longitude };
      this.lastLocationUpdate.set(route.driverLocation.lastUpdate);
    }

    // Center map logic
    if (this.driverPos) {
      this.center = this.driverPos;
    } else {
      this.center = this.warehousePos;
    }

    // Trigger plotting with slight delay for modal to open
    setTimeout(() => {
      this.plotRoute(route);
    }, 200);
  }

  closeMap() {
    this.showMapModal.set(false);
    this.selectedRouteForMap.set(null);
  }

  getDeliveryMarkerOptions(d: RouteDelivery): google.maps.MarkerOptions {
    let color = '#f472b6'; // Default
    if (d.status === 'InTransit') color = '#3b82f6';
    else if (d.status === 'Delivered') color = '#22c55e';
    else if (d.status === 'NotDelivered') color = '#ef4444';

    return {
      label: {
        text: d.sortOrder.toString(),
        color: 'white',
        fontWeight: 'bold'
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 2,
        scale: 10
      },
      title: `${d.sortOrder}. ${d.clientName} (${d.status})`
    };
  }

  private async plotRoute(route: DeliveryRoute) {
    // 1. Prepare Waypoints
    // Needs Coordinates. If missing, we warn? Or just skip?
    // We assume route optimizer did its job, but lets be safe.

    // Sort logic from API should be correct (sortOrder), but lets verify
    const sortedDeliveries = [...route.deliveries].sort((a, b) => a.sortOrder - b.sortOrder);

    const waypoints: google.maps.DirectionsWaypoint[] = [];
    const path: google.maps.LatLngLiteral[] = [this.warehousePos];

    // Filter valid ones
    for (const d of sortedDeliveries) {
      let lat = d.latitude;
      let lng = d.longitude;

      // Fallback geocoding if needed (optional)
      if (!lat || !lng) {
        const coords = await this.geocodeAddress(d.address || d.clientAddress || '');
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        }
      }

      if (lat && lng) {
        waypoints.push({ location: { lat, lng }, stopover: true });
        path.push({ lat, lng });
        // Update internal model for marker rendering
        d.latitude = lat;
        d.longitude = lng;
      }
    }

    if (path.length > 1) {
      this.calculateDirections(this.warehousePos, path[path.length - 1], waypoints.slice(0, -1)); // last is destination
    }

    // Auto fit bounds
    setTimeout(() => {
      if (this.map) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(this.warehousePos);
        path.forEach(p => bounds.extend(p));
        if (this.driverPos) bounds.extend(this.driverPos);
        this.map.fitBounds(bounds, 50);
      }
    }, 500);
  }

  private calculateDirections(start: google.maps.LatLngLiteral, end: google.maps.LatLngLiteral, waypoints: google.maps.DirectionsWaypoint[]) {
    const directionsService = new google.maps.DirectionsService();
    directionsService.route({
      origin: start,
      destination: end,
      waypoints: waypoints,
      optimizeWaypoints: false, // Maintain order strictly
      travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK && result) {
        this.directionsResult.set(result);
      } else {
        console.warn('Google Maps Directions failed', status);
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
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          const res = {
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          };
          this.geocodeCache.set(cacheKey, res);
          resolve(res);
        } else {
          resolve(null);
        }
      });
    });
  }

  private handleLocationUpdate(loc: any) {
    const currentRoute = this.selectedRouteForMap();
    if (!currentRoute || !this.showMapModal()) return;

    if (loc.latitude && loc.longitude) {
      this.driverPos = { lat: loc.latitude, lng: loc.longitude };
      this.lastLocationUpdate.set(new Date().toISOString());

      this.map.panTo(this.driverPos);
    }
  }

  // ═══ CHAT LOGIC ═══
  openChat(route: DeliveryRoute) {
    this.chatRoute.set(route);
    this.activeMessages.set([]);
    this.api.getRouteChat(route.id).subscribe(msgs => {
      this.activeMessages.set(msgs);
      setTimeout(() => this.scrollToBottom(), 100);
    });
  }

  closeChat() {
    this.chatRoute.set(null);
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.chatRoute()) return;

    const text = this.newMessage.trim();
    this.newMessage = '';

    this.api.sendAdminMessage(this.chatRoute()!.id, text).subscribe(msg => {
      this.activeMessages.update(msgs => [...msgs, msg]);
      setTimeout(() => this.scrollToBottom(), 50);
    });
  }

  scrollToBottom() {
    if (this.chatScroll) {
      this.chatScroll.nativeElement.scrollTop = this.chatScroll.nativeElement.scrollHeight;
    }
  }
}
