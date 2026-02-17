import { Component, OnInit, signal, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { DeliveryRoute } from '../../../../shared/models/models';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { SignalRService } from '../../../../core/services/signalr.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-route-manager',
  standalone: true,
  imports: [CommonModule],
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

          ═══════════════════════════════════════════
      @if (showMapModal() && selectedRouteForMap()) {
        <div class="modal-overlay" (click)="closeMap()">
          <div class="modal-card map-card" (click)="$event.stopPropagation()">
            <div class="map-header">
              <h3>🗺️ Seguimiento en Vivo</h3>
              <p>Ruta #{{ selectedRouteForMap()!.id }}</p>
              <button class="btn-close-map" (click)="closeMap()">✗</button>
            </div>
            <div class="map-container" #adminMap></div>
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
    
    .map-container { flex: 1; background: #eee; }
    
    .map-footer {
      padding: 10px 15px; background: #222; color: white; font-size: 0.85rem;
      display: flex; align-items: center; justify-content: center;
    }
    .live-indicator { display: flex; align-items: center; gap: 6px; color: #34d399; font-weight: 700; }
    .dot { width: 10px; height: 10px; background: #34d399; border-radius: 50%; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(2); } }

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
  @ViewChild('adminMap') mapEl?: ElementRef;

  routes = signal<DeliveryRoute[]>([]);
  loading = signal(false);
  toastMessage = signal('');

  // Map State
  showMapModal = signal(false);
  selectedRouteForMap = signal<DeliveryRoute | null>(null);
  lastLocationUpdate = signal<string | null>(null);

  private map?: L.Map;
  private driverMarker?: L.Marker;
  private markersLayer?: L.LayerGroup;
  private routeLine?: L.Polyline;

  constructor(
    private api: ApiService,
    private confirm: ConfirmationService,
    private signalr: SignalRService
  ) { }

  ngOnInit(): void {
    this.loadRoutes();
    this.signalr.connect().then(() => {
      this.signalr.joinAdmin();
    });
    this.signalr.locationUpdate$.subscribe(loc => {
      this.handleLocationUpdate(loc);
    });
  }

  ngOnDestroy(): void {
    this.signalr.disconnect();
  }

  loadRoutes(): void {
    this.loading.set(true);
    this.api.getRoutes().subscribe({
      next: (r) => {
        // Ordenar: Más recientes primero
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
    return r.deliveries.filter(d => d.status === 'NotDelivered'); // Ajustado a tu Enum del API (NotDelivered)
  }

  copy(el: HTMLInputElement): void {
    navigator.clipboard.writeText(el.value);
    this.showToast('¡Link copiado! 📋✅');
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }

  // ═══ MAP LOGIC ═══
  openMap(route: DeliveryRoute) {
    this.selectedRouteForMap.set(route);
    this.showMapModal.set(true);

    // Check if we have initial location
    if (route.driverLocation) {
      this.lastLocationUpdate.set(route.driverLocation.lastUpdate);
    }

    setTimeout(() => {
      this.initMap(route);
    }, 100);
  }

  closeMap() {
    this.showMapModal.set(false);
    this.selectedRouteForMap.set(null);
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
  }

  private initMap(route: DeliveryRoute): void {
    if (!this.mapEl) return;

    this.map = L.map(this.mapEl.nativeElement).setView([25.75, -100.3], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OSM'
    }).addTo(this.map);

    // Fix map render issues in modal
    setTimeout(() => this.map?.invalidateSize(), 50);

    this.markersLayer = L.layerGroup().addTo(this.map);
    this.plotRoute(route);

    // Initial driver marker if available
    if (route.driverLocation) {
      this.updateDriverMarker(route.driverLocation.latitude, route.driverLocation.longitude);
    }
  }

  private plotRoute(route: DeliveryRoute): void {
    if (!this.map || !this.markersLayer) return;

    const points: L.LatLngExpression[] = [];
    const bounds: L.LatLngExpression[] = [];

    route.deliveries.forEach(d => {
      if (!d.latitude || !d.longitude) return;
      const pos: L.LatLngExpression = [d.latitude, d.longitude];
      bounds.push(pos);
      if (d.status !== 'Delivered' && d.status !== 'NotDelivered') points.push(pos);

      // Marker logic — Coquette Colors 🌸
      let bgColor = '#f472b6'; // Default Pink-400
      if (d.status === 'InTransit') bgColor = '#3b82f6'; // Keep Blue
      else if (d.status === 'Delivered') bgColor = '#22c55e'; // Green-500
      else if (d.status === 'NotDelivered') bgColor = '#ef4444'; // Red-500

      const icon = L.divIcon({
        html: `<div style="background:${bgColor};width:28px;height:28px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;color:white;box-shadow:0 4px 10px rgba(0,0,0,0.2); transition: transform 0.2s;">${d.sortOrder}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14]
      });

      L.marker(pos, { icon }).addTo(this.markersLayer!).bindPopup(
        `<div style="font-family:'Quicksand',sans-serif; text-align:center;">
           <b style="color:#db2777; font-size:1.1em;">${d.clientName}</b><br>
           <span style="color:#666; font-size:0.9em;">${d.address || 'Sin dirección'}</span>
         </div>`
      );
    });

    if (points.length >= 2) {
      this.routeLine = L.polyline(points, { color: '#ec4899', weight: 5, opacity: 0.7, dashArray: '12, 12', lineCap: 'round' }).addTo(this.map);
    }

    if (bounds.length > 0) {
      this.map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50] });
    }
  }

  private handleLocationUpdate(loc: any) {
    const currentRoute = this.selectedRouteForMap();
    if (!currentRoute || !this.showMapModal()) return;

    // Assuming backend sends routeId or we match by active driver?
    // User said "Update map marker position".
    // For now we assume if a location comes in, it's for the currently viewed map if relevant.
    // Ideally check loc.routeId === currentRoute.id

    if (loc.latitude && loc.longitude) {
      this.updateDriverMarker(loc.latitude, loc.longitude);
      this.lastLocationUpdate.set(new Date().toISOString());
    }
  }

  private updateDriverMarker(lat: number, lng: number) {
    if (!this.map) return;

    const icon = L.divIcon({
      html: `<div style="font-size:24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">🚚</div>`, // Truck icon
      iconSize: [30, 30], iconAnchor: [15, 15], className: ''
    });

    if (!this.driverMarker) {
      this.driverMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(this.map);
    } else {
      this.driverMarker.setLatLng([lat, lng]);
    }
    this.map.panTo([lat, lng]);
  }
}
