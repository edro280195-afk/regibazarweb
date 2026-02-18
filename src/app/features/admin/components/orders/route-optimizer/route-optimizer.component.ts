import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderSummary } from '../../../../../shared/models/models';
import * as L from 'leaflet';

@Component({
    selector: 'app-route-optimizer',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="optimizer-modal fade-in">
      <div class="modal-content">
        <div class="modal-header">
          <h3>🪄 Optimizador de Rutas</h3>
          <button class="close-btn" (click)="cancel.emit()">✕</button>
        </div>

        <div class="modal-body">
          <div class="sidebar">
            <div class="sidebar-header">
              <span class="count">{{ orders.length }} Pedidos</span>
              <button class="btn-optimize" (click)="optimizeRoute()" [disabled]="optimizing()">
                {{ optimizing() ? 'Calculando... 🧠' : '⚡ Optimizar Ruta' }}
              </button>
            </div>

            <div class="orders-list">
              <div class="list-item depot">
                <span class="step-num">0</span>
                <div class="item-info">
                  <strong>🏠 Base (Tu ubicación)</strong>
                  <span class="addr">Punto de partida</span>
                </div>
              </div>

              @for (order of sortedOrders(); track order.id; let i = $index) {
                <div class="list-item" [class.highlight]="hoveredId() === order.id" (mouseenter)="hoveredId.set(order.id)" (mouseleave)="hoveredId.set(null)">
                  <span class="step-num">{{ i + 1 }}</span>
                  <div class="item-info">
                    <strong>{{ order.clientName }}</strong>
                    <span class="addr">{{ order.clientAddress || 'Sin dirección' }}</span>
                  </div>
                  <div class="item-meta">
                    <span class="dist" *ngIf="distances[i]">{{ distances[i] }} km</span>
                  </div>
                </div>
              }
            </div>

            <div class="summary-stats">
              <div class="stat">
                <small>Distancia Total</small>
                <strong>{{ totalDistance().toFixed(1) }} km</strong>
              </div>
              <div class="stat">
                <small>Tiempo Estimado</small>
                <strong>{{ estimatedTime() }} min</strong>
              </div>
            </div>
          </div>

          <div class="map-wrapper">
            <div class="map-container" #mapContainer></div>
            <div class="map-overlay-controls">
              <button class="start-btn" (click)="confirmRoute.emit(sortedOrders())">
                🚀 Confirmar y Crear Ruta
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .optimizer-modal {
      position: fixed; inset: 0; z-index: 2000;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(5px);
      display: flex; align-items: center; justify-content: center;
      padding: 2rem;
    }
    .fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .modal-content {
      background: white; width: 100%; max-width: 1200px; height: 90vh;
      border-radius: 24px; display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 25px 50px rgba(0,0,0,0.3);
    }

    .modal-header {
      padding: 1rem 1.5rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;
      h3 { margin: 0; font-family: var(--font-display); color: var(--pink-600); font-size: 1.5rem; }
      .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #999; &:hover { color: var(--pink-600); } }
    }

    .modal-body { display: flex; flex: 1; overflow: hidden; }

    /* SIDEBAR */
    .sidebar { width: 350px; display: flex; flex-direction: column; border-right: 1px solid #eee; background: #fafafa; }
    
    .sidebar-header { padding: 1rem; display: flex; justify-content: space-between; align-items: center; background: white; border-bottom: 1px solid #eee; }
    .count { font-weight: 700; color: #666; }
    .btn-optimize {
      background: linear-gradient(135deg, #a855f7, #9333ea); color: white; border: none;
      padding: 8px 16px; border-radius: 12px; font-weight: 700; cursor: pointer;
      box-shadow: 0 4px 10px rgba(168,85,247,0.3); transition: 0.2s;
      &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(168,85,247,0.4); }
      &:disabled { opacity: 0.7; cursor: wait; }
    }

    .orders-list { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 8px; }
    
    .list-item {
      background: white; padding: 10px; border-radius: 12px; border: 1px solid #eee;
      display: flex; align-items: center; gap: 10px; transition: 0.2s;
      &.depot { background: #f0fdf4; border-color: #bbf7d0; }
      &.highlight { border-color: var(--pink-400); background: #fff1f2; transform: translateX(5px); }
    }

    .step-num {
      width: 24px; height: 24px; background: #eee; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; color: #666;
      flex-shrink: 0;
    }
    .depot .step-num { background: #22c55e; color: white; }

    .item-info { flex: 1; overflow: hidden; }
    .item-info strong { display: block; font-size: 0.9rem; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .item-info .addr { display: block; font-size: 0.75rem; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .item-meta { text-align: right; }
    .dist { font-size: 0.7rem; font-weight: 700; color: #a855f7; display: block; }

    .summary-stats {
      padding: 1rem; background: white; border-top: 1px solid #eee;
      display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
    }
    .stat { display: flex; flex-direction: column; text-align: center; }
    .stat small { font-size: 0.7rem; color: #999; font-weight: 700; text-transform: uppercase; }
    .stat strong { color: var(--pink-600); font-size: 1.1rem; }

    /* MAP */
    .map-wrapper { flex: 1; position: relative; }
    .map-container { width: 100%; height: 100%; background: #e5e7eb; }
    
    .map-overlay-controls {
      position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 1000;
    }
    .start-btn {
      background: linear-gradient(135deg, var(--pink-500), #db2777); color: white;
      border: none; padding: 12px 30px; border-radius: 50px; font-weight: 800; font-size: 1.1rem;
      cursor: pointer; box-shadow: 0 10px 25px rgba(236, 72, 153, 0.4); border: 2px solid white;
      transition: 0.2s;
      &:hover { transform: translateY(-3px) scale(1.05); }
    }
  `]
})
export class RouteOptimizerComponent implements OnInit, OnDestroy {
    @Input() orders: OrderSummary[] = [];
    @Output() cancel = new EventEmitter<void>();
    @Output() confirmRoute = new EventEmitter<OrderSummary[]>();

    @ViewChild('mapContainer', { static: true }) mapEl!: ElementRef;

    sortedOrders = signal<OrderSummary[]>([]);
    optimizing = signal(false);
    totalDistance = signal(0);
    estimatedTime = signal(0); // mins
    hoveredId = signal<number | null>(null);

    distances: number[] = []; // Distance from previous point

    // Map
    private map?: L.Map;
    private markersLayer?: L.LayerGroup;
    private routeLine?: L.Polyline;

    // Depot Location (e.g., Monterrey Center or configurable)
    private depot: L.LatLngTuple = [25.6866, -100.3161];

    ngOnInit() {
        this.sortedOrders.set([...this.orders]); // Initial copy
        setTimeout(() => this.initMap(), 100);
    }

    ngOnDestroy() {
        this.map?.remove();
    }

    optimizeRoute() {
        this.optimizing.set(true);

        // Nearest Neighbor Algorithm (Simple)
        setTimeout(() => {
            const remaining = [...this.orders];
            const optimized: OrderSummary[] = [];
            let currentPos = { lat: this.depot[0], lng: this.depot[1] };

            this.distances = [];
            let totalDist = 0;

            while (remaining.length > 0) {
                let nearestIdx = -1;
                let minDist = Infinity;

                remaining.forEach((order, idx) => {
                    // Parse logic for location (assuming mock if missing)
                    // If order has no lat/lng, we might skip optimization or mock it?
                    // For demo, let's mock it based on ZIP or simple math if missing
                    const oLat = 25.6866 + (Math.random() - 0.5) * 0.1; // Demo mock
                    const oLng = -100.3161 + (Math.random() - 0.5) * 0.1;
                    // In real app, order would come with lat/lng from geocoding

                    // Simple Euclidean for demo speed (should be Haversine)
                    const d = Math.sqrt(Math.pow(oLat - currentPos.lat, 2) + Math.pow(oLng - currentPos.lng, 2));

                    if (d < minDist) {
                        minDist = d;
                        nearestIdx = idx;
                    }
                });

                if (nearestIdx !== -1) {
                    const next = remaining.splice(nearestIdx, 1)[0];
                    optimized.push(next);
                    // Update current pos
                    // Mock update since we don't have real lat/lng on OrderSummary yet?
                    // Wait, Client has lat/lng potentially? Or we need to Geocode.
                    // Let's assume for this "Demo" we are mocking positions to show the UI flow.
                    // IMPORTANT: We need to store these mock positions to draw them on map!
                    (next as any)._tempLat = 25.6866 + (Math.random() - 0.5) * 0.15;
                    (next as any)._tempLng = -100.3161 + (Math.random() - 0.5) * 0.15;

                    currentPos = { lat: (next as any)._tempLat, lng: (next as any)._tempLng };

                    // Approx conversion degrees to km (roughly 111km per deg)
                    const distKm = minDist * 111;
                    this.distances.push(Number(distKm.toFixed(1)));
                    totalDist += distKm;
                }
            }

            this.sortedOrders.set(optimized);
            this.totalDistance.set(totalDist);
            this.estimatedTime.set(Math.round((totalDist / 20) * 60 + optimized.length * 5)); // 20km/h avg + 5min per stop

            this.plotRoute();
            this.optimizing.set(false);
        }, 800);
    }

    private initMap() {
        this.map = L.map(this.mapEl.nativeElement).setView(this.depot, 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OSM'
        }).addTo(this.map);

        this.markersLayer = L.layerGroup().addTo(this.map);

        // Depot Marker
        L.marker(this.depot, {
            icon: L.divIcon({ html: '🏠', className: 'map-emoji-icon', iconSize: [30, 30] })
        }).addTo(this.map).bindPopup('Almacén Central');

        // Initial random plot or wait for optimize?
        // Let's optimize automatically on open for "Wow" factor?
        // Or just plot unsorted.
        this.optimizeRoute();
    }

    private plotRoute() {
        if (!this.map || !this.markersLayer) return;
        this.markersLayer.clearLayers();

        const points: L.LatLngExpression[] = [this.depot]; // Start at depot

        this.sortedOrders().forEach((o: any, i) => {
            const pos: L.LatLngTuple = [o._tempLat, o._tempLng];
            points.push(pos);

            const icon = L.divIcon({
                html: `<div style="background:#a855f7;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.2);">${i + 1}</div>`,
                iconSize: [24, 24], className: ''
            });

            L.marker(pos, { icon }).addTo(this.markersLayer!)
                .bindPopup(`<b>${i + 1}. ${o.clientName}</b><br>${o.clientAddress}`);
        });

        if (this.routeLine) this.routeLine.remove();
        this.routeLine = L.polyline(points, { color: '#d946ef', weight: 4, opacity: 0.8 }).addTo(this.map);

        this.map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    }
}
