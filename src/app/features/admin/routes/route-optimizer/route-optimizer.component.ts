import { Component, EventEmitter, Input, Output, OnInit, ViewChild, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMapsModule, GoogleMap, MapMarker, MapDirectionsRenderer, MapPolyline } from '@angular/google-maps';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { OrderSummaryDto } from '../../../../core/models';
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

interface GeocodedOrder extends OrderSummaryDto {
    _lat?: number;
    _lng?: number;
    _geocoded: boolean;
    _geocodeError?: string;
    _isGoogleResolved?: boolean;
}

@Component({
    selector: 'app-route-optimizer',
    standalone: true,
    imports: [CommonModule, GoogleMapsModule, DragDropModule],
    templateUrl: './route-optimizer.component.html',
    styles: [`
    .optimizer-modal { position: fixed; inset: 0; z-index: 4000; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 2rem; }
    .fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
    .modal-content { background: white; width: 100%; max-width: 1300px; height: 90vh; border-radius: 32px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.3); }
    .modal-header { padding: 1.25rem 2rem; border-bottom: 1px solid #fdf2f8; display: flex; justify-content: space-between; align-items: center; background: white; z-index: 10; }
    .modal-body { display: flex; flex: 1; overflow: hidden; }
    
    .sidebar { width: 400px; display: flex; flex-direction: column; border-right: 1px solid #fdf2f8; background: #fafafa; z-index: 5; }
    
    .map-wrapper { flex: 1; position: relative; background: #f3f4f6; }
    .map-overlay-controls { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 1000; }
    
    .geo-warning-card { background: #fffbeb; border: 1px solid #fde68a; }
    .geo-warning-card-amber { border-left: 4px solid #f59e0b; }
    
    .cdk-drag-preview {
      box-sizing: border-box;
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(219, 39, 119, 0.3);
      border: 2px solid #f472b6;
      background: white;
    }
    .cdk-drag-animating { transition: transform 250ms cubic-bezier(0, 0, 0.2, 1); }
    .drag-list.cdk-drop-list-dragging .drag-item:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
  `]
})
export class RouteOptimizerComponent implements OnInit {
    @Input() orders: OrderSummaryDto[] = [];
    @Output() cancel = new EventEmitter<void>();
    @Output() confirmRoute = new EventEmitter<number[]>(); // Emits ordered IDs

    @ViewChild(GoogleMap) map!: GoogleMap;

    sortedOrders = signal<GeocodedOrder[]>([]);
    optimizing = signal(false);
    totalDistance = signal(0);
    estimatedTime = signal(0);
    hoveredId = signal<number | null>(null);

    hasGoogleKey = !!GEOCODE_CONFIG.googleApiKey;

    // Google Maps Variables
    center: google.maps.LatLngLiteral = { lat: GEOCODE_CONFIG.defaultLat, lng: GEOCODE_CONFIG.defaultLng };
    zoom = 13;
    directionsResult = signal<google.maps.DirectionsResult | undefined>(undefined);
    mapOptions: google.maps.MapOptions = {
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] }
        ]
    };

    markerPositions: google.maps.LatLngLiteral[] = [];
    geocodedList: GeocodedOrder[] = [];
    distances: number[] = [];

    // Coquette Aesthetics
    directionsOptions: google.maps.DirectionsRendererOptions = {
        suppressMarkers: true, // Hide default ugly Google markers
        polylineOptions: {
            strokeColor: '#d946ef', // Fuchsia-500
            strokeWeight: 6,
            strokeOpacity: 0.8,
        }
    };

    depotOptions: google.maps.MarkerOptions = {
        label: { text: '🏠', fontSize: '20px' },
        title: 'Base - Tu ubicación',
        zIndex: 999
    };

    private geocodeCache = new Map<string, { lat: number; lng: number } | null>();

    ngOnInit() {
        this.startOptimization();
    }

    geocodedStopCount(): number {
        return this.sortedOrders().filter(o => o._isGoogleResolved).length;
    }

    async startOptimization() {
        this.optimizing.set(true);

        try {
            const pos = await this.getCurrentLocation();
            if (pos) this.center = pos;
        } catch {
            console.warn('GPS no disponible, usando centro base');
        }

        // 1. Geocode all addresses
        const geocoded: GeocodedOrder[] = await Promise.all(
            this.orders.map(async (o) => {
                const address = o.clientAddress?.trim();
                if (!address || address.length < 5) {
                    return { ...o, _geocoded: false, _geocodeError: 'Sin dirección' } as GeocodedOrder;
                }

                try {
                    const coords = await this.geocodeAddress(address);
                    if (coords) {
                        return { ...o, _lat: coords.lat, _lng: coords.lng, _geocoded: true, _isGoogleResolved: true } as GeocodedOrder;
                    }
                    return { ...o, _geocoded: false, _geocodeError: 'No encontrada por Google' } as GeocodedOrder;
                } catch {
                    return { ...o, _geocoded: false, _geocodeError: 'Error de red' } as GeocodedOrder;
                }
            })
        );

        // 2. Nearest Neighbor Algorithm (TSP)
        const withCoords = geocoded.filter((o) => o._geocoded);
        const withoutCoords = geocoded.filter((o) => !o._geocoded);

        const remaining = [...withCoords];
        let optimized: GeocodedOrder[] = [];
        let currentPos = { lat: this.center.lat, lng: this.center.lng };

        this.distances = [];

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
            }
        }

        // Add un-geocoded orders at the end
        withoutCoords.forEach((o) => {
            optimized.push(o);
            this.distances.push(0);
        });

        this.sortedOrders.set(optimized);

        // 3. Plot them on the Map using DirectionsService (which recalculates the real street distances)
        this.plotRoute(optimized);
    }

    // --- Map Plotting & Calculation ---
    private plotRoute(currentOrder: GeocodedOrder[]) {
        this.optimizing.set(true);
        const path: google.maps.LatLngLiteral[] = [this.center];
        const positions: google.maps.LatLngLiteral[] = [];
        this.geocodedList = [];

        if (typeof google === 'undefined' || !google.maps) {
            this.optimizing.set(false);
            return;
        }

        const bounds = new google.maps.LatLngBounds();
        bounds.extend(this.center);

        currentOrder.forEach((o) => {
            if (!o._isGoogleResolved || !o._lat || !o._lng) return;
            const pos = { lat: o._lat, lng: o._lng };
            positions.push(pos);
            path.push(pos);
            this.geocodedList.push(o);
            bounds.extend(pos);
        });

        this.markerPositions = positions;

        if (path.length > 1) {
            this.calculateDirections(path);
            setTimeout(() => { if (this.map) this.map.fitBounds(bounds, 80); }, 300);
        } else {
            this.directionsResult.set(undefined);
            this.totalDistance.set(0);
            this.estimatedTime.set(0);
            this.distances = new Array(currentOrder.length).fill(0);
            this.optimizing.set(false);
        }
    }

    private calculateDirections(path: google.maps.LatLngLiteral[]) {
        const directionsService = new google.maps.DirectionsService();

        const origin = path[0];
        const destination = path[path.length - 1];

        const MAX_WAYPOINTS = 25;
        const allWaypoints = path.slice(1, -1);
        const waypoints = allWaypoints.slice(0, MAX_WAYPOINTS).map(p => ({
            location: p,
            stopover: true
        }));

        directionsService.route({
            origin: origin,
            destination: destination,
            waypoints: waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
        }, (response, status) => {
            if (status === google.maps.DirectionsStatus.OK && response && response.routes[0]) {
                this.directionsResult.set(response);

                // Extract real distances and times from Google Directions legs
                const legs = response.routes[0].legs;
                let distMeters = 0;
                let durationSeconds = 0;

                // Match lengths to sortedOrders array to show per-leg distance in UI
                let legIndex = 0;
                this.distances = this.sortedOrders().map(o => {
                    if (o._isGoogleResolved && legIndex < legs.length) {
                        const leg = legs[legIndex++];
                        distMeters += leg.distance?.value || 0;
                        durationSeconds += leg.duration?.value || 0;
                        return Number(((leg.distance?.value || 0) / 1000).toFixed(1));
                    }
                    return 0; // Ungocoded or out of waypoints limit
                });

                this.totalDistance.set(distMeters / 1000);
                this.estimatedTime.set(Math.round(durationSeconds / 60));
            }
            this.optimizing.set(false);
        });
    }

    getMarkerOptions(index: number, order: GeocodedOrder): google.maps.MarkerOptions {
        const isHovered = this.hoveredId() === order.id;
        return {
            label: {
                text: (index + 1).toString(),
                color: 'white',
                fontWeight: '900',
                fontSize: '14px'
            },
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: isHovered ? '#f472b6' : '#c026d3', // Pink-400 / Fuchsia-600
                fillOpacity: 1,
                strokeColor: 'white',
                strokeWeight: 3,
                scale: isHovered ? 16 : 14
            },
            title: `${index + 1}. ${order.clientName}`,
            zIndex: isHovered ? 100 : index
        };
    }

    // --- User Interactions ---
    drop(event: CdkDragDrop<GeocodedOrder[]>) {
        if (event.previousIndex === event.currentIndex) return;

        const list = [...this.sortedOrders()];
        moveItemInArray(list, event.previousIndex, event.currentIndex);
        this.sortedOrders.set(list);

        // Recalculate route with the manually forced order
        this.plotRoute(list);
    }

    submitRoute() {
        // Return JUST the IDs in the perfect final visual order
        const ids = this.sortedOrders().map(o => o.id);
        this.confirmRoute.emit(ids);
    }

    // --- Math/Geo Helpers ---
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
            geocoder.geocode({ address: fullAddress, region: 'mx' }, (results, status) => {
                if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
                    resolve({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
                } else {
                    resolve(null);
                }
            });
        });
    }

    private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private getCurrentLocation(): Promise<google.maps.LatLngLiteral | null> {
        return new Promise((resolve) => {
            if (!navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 5000 }
            );
        });
    }
}
