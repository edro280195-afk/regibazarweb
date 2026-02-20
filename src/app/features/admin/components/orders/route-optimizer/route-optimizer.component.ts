import { Component, EventEmitter, Input, Output, OnInit, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMapsModule, GoogleMap } from '@angular/google-maps'; // <--- Importante
import { OrderSummary } from '../../../../../shared/models/models';
import { environment } from '../../../../../../environments/environment';

// ─── CONFIG ────────────────────────────────────────────────────
const GEOCODE_CONFIG = {
  googleApiKey: environment.googleMapsApiKey || '',
  city: 'Nuevo Laredo',
  state: 'Tamaulipas',
  country: 'Mexico',
  googleBounds: '27.40,-99.62|27.58,-99.42',
  defaultLat: 27.4861,
  defaultLng: -99.5069,
};
// ────────────────────────────────────────────────────────────────

interface GeocodedOrder extends OrderSummary {
  _lat?: number;
  _lng?: number;
  _geocoded: boolean;
  _geocodeError?: string;
}

@Component({
  selector: 'app-route-optimizer',
  standalone: true,
  imports: [CommonModule, GoogleMapsModule],
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

            @if (!hasGoogleKey) {
              <div class="api-warning">⚠️ Sin API Key de Google</div>
            }

            @if (geocodeWarnings().length > 0) {
              <div class="geo-warnings">
                <div class="warn-header" (click)="showWarnings.set(!showWarnings())">
                  ⚠️ {{ geocodeWarnings().length }} dirección(es) no encontrada(s)
                  <span class="toggle">{{ showWarnings() ? '▲' : '▼' }}</span>
                </div>
                @if (showWarnings()) {
                  <div class="warn-list">
                    @for (w of geocodeWarnings(); track w.id) {
                      <div class="warn-item">
                        <strong>{{ w.clientName }}</strong>
                        <span>{{ w.address }}</span>
                        <small>{{ w.error }}</small>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <div class="orders-list">
              <div class="list-item depot">
                <span class="step-num">0</span>
                <div class="item-info">
                  <strong>🏠 Base (Tu ubicación)</strong>
                  <span class="addr">Punto de partida</span>
                </div>
              </div>

              @for (order of sortedOrders(); track order.id; let i = $index) {
                <div class="list-item"
                     [class.highlight]="hoveredId() === order.id"
                     [class.no-geo]="!isGeocoded(order)"
                     (mouseenter)="hoveredId.set(order.id)"
                     (mouseleave)="hoveredId.set(null)">
                  <span class="step-num" [class.step-warning]="!isGeocoded(order)">
                    {{ isGeocoded(order) ? (i + 1) : '?' }}
                  </span>
                  <div class="item-info">
                    <strong>{{ order.clientName }}</strong>
                    <span class="addr">{{ order.clientAddress || 'Sin dirección' }}</span>
                    @if (!isGeocoded(order)) {
                      <span class="geo-badge">📍 Ubicación no encontrada</span>
                    }
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
            <div class="map-container">
              <google-map 
                height="100%" 
                width="100%" 
                [center]="center" 
                [zoom]="zoom"
                [options]="mapOptions">
                
                <map-marker [position]="center" [options]="depotOptions"></map-marker>

                @for (pos of markerPositions; track $index) {
                  <map-marker 
                    [position]="pos" 
                    [options]="getMarkerOptions($index, geocodedList[$index])">
                  </map-marker>
                }

                @if (directionsResult(); as result) {
                  <map-directions-renderer 
                    [directions]="result" 
                    [options]="directionsOptions">
                  </map-directions-renderer>
                }
              </google-map>
            </div>
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
    .optimizer-modal { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; padding: 2rem; }
    .fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .modal-content { background: white; width: 100%; max-width: 1200px; height: 90vh; border-radius: 24px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.3); }
    .modal-header { padding: 1rem 1.5rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
    .modal-header h3 { margin: 0; color: var(--pink-600); font-size: 1.5rem; }
    .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #999; }
    .modal-body { display: flex; flex: 1; overflow: hidden; }
    .sidebar { width: 350px; display: flex; flex-direction: column; border-right: 1px solid #eee; background: #fafafa; }
    .sidebar-header { padding: 1rem; display: flex; justify-content: space-between; align-items: center; background: white; border-bottom: 1px solid #eee; }
    .count { font-weight: 700; color: #666; }
    .btn-optimize { background: linear-gradient(135deg, #a855f7, #9333ea); color: white; border: none; padding: 8px 16px; border-radius: 12px; font-weight: 700; cursor: pointer; }
    .orders-list { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 8px; }
    .list-item { background: white; padding: 10px; border-radius: 12px; border: 1px solid #eee; display: flex; align-items: center; gap: 10px; }
    .step-num { width: 24px; height: 24px; background: #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; color: #666; }
    .item-info { flex: 1; overflow: hidden; }
    .item-info strong { display: block; font-size: 0.9rem; color: #333; }
    .item-info .addr { display: block; font-size: 0.75rem; color: #999; }
    .summary-stats { padding: 1rem; background: white; border-top: 1px solid #eee; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .map-wrapper { flex: 1; position: relative; }
    .map-container { width: 100%; height: 100%; background: #e5e7eb; }
    .map-overlay-controls { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 1000; }
    .start-btn { background: linear-gradient(135deg, var(--pink-500), #db2777); color: white; border: none; padding: 12px 30px; border-radius: 50px; font-weight: 800; font-size: 1.1rem; cursor: pointer; }
    
    /* Pequeños ajustes para visualización correcta */
    .depot { background: #f0fdf4; border-color: #bbf7d0; }
    .highlight { border-color: var(--pink-400); background: #fff1f2; transform: translateX(5px); }
    .no-geo { border-color: #fde68a; background: #fffbeb; opacity: 0.75; }
    .api-warning { padding: 6px 12px; background: #fef3c7; color: #92400e; font-size: 0.75rem; font-weight: 600; border-bottom: 1px solid #fde68a; }
    .geo-warnings { background: #fffbeb; border-bottom: 1px solid #fde68a; }
    .warn-header { padding: 8px 12px; font-size: 0.8rem; font-weight: 700; color: #b45309; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
    .warn-list { padding: 0 12px 8px; }
    .warn-item { padding: 6px 0; border-bottom: 1px solid #fef3c7; font-size: 0.75rem; }
  `]
})
export class RouteOptimizerComponent implements OnInit {
  @Input() orders: OrderSummary[] = [];
  @Output() cancel = new EventEmitter<void>();
  @Output() confirmRoute = new EventEmitter<OrderSummary[]>();

  @ViewChild(GoogleMap) map!: GoogleMap;

  sortedOrders = signal<GeocodedOrder[]>([]);
  optimizing = signal(false);
  totalDistance = signal(0);
  estimatedTime = signal(0);
  hoveredId = signal<number | null>(null);
  showWarnings = signal(false);
  geocodedCount = signal(0);
  geocodeWarnings = signal<{ id: number; clientName: string; address: string; error: string }[]>([]);

  distances: number[] = [];
  hasGoogleKey = !!GEOCODE_CONFIG.googleApiKey;

  // Variables de Google Maps
  center: google.maps.LatLngLiteral = { lat: GEOCODE_CONFIG.defaultLat, lng: GEOCODE_CONFIG.defaultLng };
  zoom = 13;
  directionsResult = signal<google.maps.DirectionsResult | undefined>(undefined);
  mapOptions: google.maps.MapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false
  };

  markerPositions: google.maps.LatLngLiteral[] = [];
  polylinePath: google.maps.LatLngLiteral[] = [];
  geocodedList: GeocodedOrder[] = [];

  directionsOptions: google.maps.DirectionsRendererOptions = {
    suppressMarkers: true, // ¡Clave! Oculta los pines rojos de Google para que luzcan tus círculos morados con números
    polylineOptions: {
      strokeColor: '#d946ef', // El mismo rosa/morado que ya usabas
      strokeWeight: 5,
      strokeOpacity: 0.8
    }
  };
  depotOptions: google.maps.MarkerOptions = {
    label: { text: '🏠', fontSize: '18px' },
    title: 'Base - Tu ubicación'
  };

  polylineOptions: google.maps.PolylineOptions = {
    strokeColor: '#d946ef',
    strokeOpacity: 0.8,
    strokeWeight: 4,
  };

  private geocodeCache = new Map<string, { lat: number; lng: number } | null>();

  ngOnInit() {
    this.sortedOrders.set([...this.orders] as GeocodedOrder[]);
    this.optimizeRoute();
  }

  isGeocoded(order: any): boolean {
    return order._geocoded === true;
  }

  async optimizeRoute() {
    this.optimizing.set(true);

    try {
      const pos = await this.getCurrentLocation();
      if (pos) this.center = pos;
    } catch {
      console.warn('GPS no disponible, usando centro base');
    }

    const warnings: { id: number; clientName: string; address: string; error: string }[] = [];
    let successCount = 0;

    const geocoded: GeocodedOrder[] = await Promise.all(
      this.orders.map(async (o) => {
        const address = o.clientAddress?.trim();
        if (!address || address.length < 5) {
          warnings.push({ id: o.id, clientName: o.clientName, address: address || '(vacía)', error: 'Dirección inválida' });
          return { ...o, _geocoded: false } as GeocodedOrder;
        }

        try {
          const coords = await this.geocodeAddress(address);
          if (coords) {
            successCount++;
            return { ...o, _lat: coords.lat, _lng: coords.lng, _geocoded: true } as GeocodedOrder;
          }
          warnings.push({ id: o.id, clientName: o.clientName, address, error: 'No se encontró' });
          return { ...o, _geocoded: false } as GeocodedOrder;
        } catch {
          warnings.push({ id: o.id, clientName: o.clientName, address, error: 'Error de red' });
          return { ...o, _geocoded: false } as GeocodedOrder;
        }
      })
    );

    this.geocodeWarnings.set(warnings);
    this.geocodedCount.set(successCount);

    const withCoords = geocoded.filter((o) => o._geocoded);
    const withoutCoords = geocoded.filter((o) => !o._geocoded);

    const remaining = [...withCoords];
    const optimized: GeocodedOrder[] = [];
    let currentPos = { lat: this.center.lat, lng: this.center.lng };

    this.distances = [];
    let totalDist = 0;

    while (remaining.length > 0) {
      let nearestIdx = -1;
      let minDist = Infinity;

      remaining.forEach((order, idx) => {
        const d = this.haversineKm(currentPos.lat, currentPos.lng, order._lat!, order._lng!);
        if (d < minDist) {
          minDist = d;
          nearestIdx = idx;
        }
      });

      if (nearestIdx !== -1) {
        const next = remaining.splice(nearestIdx, 1)[0];
        optimized.push(next);
        currentPos = { lat: next._lat!, lng: next._lng! };
        this.distances.push(Number(minDist.toFixed(1)));
        totalDist += minDist;
      }
    }

    withoutCoords.forEach((o) => {
      optimized.push(o);
      this.distances.push(0);
    });

    this.sortedOrders.set(optimized);
    this.totalDistance.set(totalDist);
    this.estimatedTime.set(Math.round((totalDist / 30) * 60 + withCoords.length * 3));

    this.plotRoute(optimized);
    this.optimizing.set(false);
  }

  getMarkerOptions(index: number, order: GeocodedOrder): google.maps.MarkerOptions {
    return {
      label: {
        text: (index + 1).toString(),
        color: 'white',
        fontWeight: 'bold'
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#a855f7',
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 2,
        scale: 12
      },
      title: `${index + 1}. ${order.clientName}`
    };
  }

  private plotRoute(optimizedOrders: GeocodedOrder[]) {
    const path: google.maps.LatLngLiteral[] = [this.center];
    const positions: google.maps.LatLngLiteral[] = [];
    this.geocodedList = [];

    if (typeof google === 'undefined' || !google.maps) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(this.center);

    optimizedOrders.forEach((o) => {
      if (!o._geocoded || !o._lat || !o._lng) return;
      const pos = { lat: o._lat, lng: o._lng };

      positions.push(pos);
      path.push(pos);
      this.geocodedList.push(o);
      bounds.extend(pos);
    });

    this.markerPositions = positions;
    // this.polylinePath = path;

    this.calculateRouteOnStreets(path);

    setTimeout(() => {
      if (this.map && path.length > 1) {
        this.map.fitBounds(bounds, 50);
      }
    }, 100);
  }

  private async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    const cacheKey = address.toLowerCase().trim();
    if (this.geocodeCache.has(cacheKey)) return this.geocodeCache.get(cacheKey) ?? null;

    let result = await this.geocodeWithGoogle(address);
    this.geocodeCache.set(cacheKey, result);
    return result;
  }

  private geocodeWithGoogle(address: string): Promise<{ lat: number; lng: number } | null> {
    const { state, country, city } = GEOCODE_CONFIG;
    const lowerAddr = address.toLowerCase();
    const hasCity = lowerAddr.includes('nuevo laredo') || lowerAddr.includes('nvo laredo');
    const fullAddress = hasCity ? `${address}, ${state}, ${country}` : `${address}, ${city}, ${state}, ${country}`;

    return new Promise((resolve) => {
      const geocoder = new google.maps.Geocoder();

      geocoder.geocode({
        address: fullAddress,
        region: 'mx' // Le damos el contexto de México
      }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          resolve({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          });
        } else {
          // Si algo falla, ahora sí nos va a "gritar" en la consola
          console.warn(`📍 No se encontró la ubicación para: "${fullAddress}". Estatus de Google: ${status}`);
          resolve(null);
        }
      });
    });
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private getCurrentLocation(): Promise<google.maps.LatLngLiteral | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  private calculateRouteOnStreets(path: google.maps.LatLngLiteral[]) {
    if (typeof google === 'undefined' || !google.maps || path.length < 2) return;

    const directionsService = new google.maps.DirectionsService();

    const origin = path[0]; // Tu base
    const destination = path[path.length - 1]; // Última entrega

    // Todas las entregas de en medio
    const waypoints = path.slice(1, -1).map(p => ({
      location: p,
      stopover: true
    }));

    directionsService.route({
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      travelMode: google.maps.TravelMode.DRIVING, // Manejando en auto/moto
    }, (response, status) => {
      if (status === google.maps.DirectionsStatus.OK && response && response.routes[0]) {
        // Guardamos el resultado y Angular lo dibuja mágicamente en las calles
        this.directionsResult.set(response);

        // [NEW] Calculate totals from actual route legs
        const legs = response.routes[0].legs;
        let distMeters = 0;
        let durationSeconds = 0;

        legs.forEach((leg, i) => {
          if (leg.distance) {
            distMeters += leg.distance.value;
            // Update individual leg distance for the list view
            // Since geocoded orders are first in sortedOrders, index i matches perfectly
            if (i < this.distances.length) {
              this.distances[i] = Number((leg.distance.value / 1000).toFixed(1));
            }
          }
          if (leg.duration) durationSeconds += leg.duration.value;
        });

        // Update signals (convert to km and min)
        this.totalDistance.set(distMeters / 1000);
        this.estimatedTime.set(Math.round(durationSeconds / 60)); // + stop time if needed?

      } else {
        console.warn('Ruta por calles no encontrada. Estatus:', status);
      }
    });
  }
}