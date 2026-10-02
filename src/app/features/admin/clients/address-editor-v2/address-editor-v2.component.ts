import {
    Component, Input, Output, EventEmitter,
    OnInit, OnDestroy, AfterViewInit,
    ViewChild, ElementRef, signal, CUSTOM_ELEMENTS_SCHEMA
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleMap, MapMarker } from '@angular/google-maps';

declare const google: any;

interface Suggestion {
    placeId: string;
    mainText: string;
    secondaryText: string;
    description: string;
}

@Component({
    selector: 'app-address-editor-v2',
    standalone: true,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    imports: [CommonModule, FormsModule, GoogleMap, MapMarker],
    template: `
    <div class="fixed inset-0 z-[6000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
         (click)="cancel.emit()">
        <div class="w-full h-[100dvh] max-h-[100dvh] sm:h-[96dvh] sm:max-h-[96dvh] sm:max-w-5xl sm:mx-4 bg-white sm:rounded-[2rem] flex flex-col overflow-hidden shadow-2xl"
             (click)="$event.stopPropagation()">

            <!-- ── HEADER ── -->
            <div class="px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 sm:px-6 sm:pt-5 shrink-0 border-b border-gray-100 flex items-center justify-between">
                <div>
                    <h2 class="text-xl font-black text-pink-900 leading-tight">Editar ubicación</h2>
                    @if (clientName) {
                        <p class="text-xs text-pink-400 font-bold mt-0.5">{{ clientName }}</p>
                    }
                </div>
                <button (click)="cancel.emit()"
                        class="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-lg font-bold transition-all">
                    ✕
                </button>
            </div>

            <!-- ── BODY ── -->
            <div class="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]">

                <!-- LEFT PANEL: search + details -->
                <div class="lg:w-[360px] shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-100 overflow-visible lg:overflow-y-auto">

                    <!-- Search section -->
                    <div class="p-5 border-b border-gray-50">
                        <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-3">Buscar dirección</p>

                        <div class="relative">
                            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-base pointer-events-none">🔍</span>
                            <input #searchInput type="text" [(ngModel)]="searchText"
                                   (input)="onSearchInput()"
                                   (keydown.escape)="suggestions.set([])"
                                   placeholder="Calle, colonia, lugar..."
                                   autocomplete="off"
                                   class="w-full pl-10 pr-4 py-3 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-pink-300 focus:bg-white text-sm font-medium text-pink-900 placeholder-pink-300 outline-none transition-all" />
                            @if (searching()) {
                                <span class="absolute right-3.5 top-1/2 -translate-y-1/2">
                                    <span class="w-4 h-4 border-2 border-pink-100 border-t-pink-500 rounded-full animate-spin block"></span>
                                </span>
                            }
                        </div>

                        <!-- Suggestions dropdown -->
                        @if (suggestions().length > 0) {
                            <div class="mt-2 bg-white rounded-2xl border border-pink-100 shadow-lg overflow-hidden">
                                @for (s of suggestions(); track s.placeId) {
                                    <button (click)="selectSuggestion(s)"
                                            class="w-full text-left px-4 py-3 hover:bg-pink-50 flex items-start gap-2.5 transition-all border-b border-pink-50/60 last:border-b-0">
                                        <span class="text-pink-400 shrink-0 mt-0.5 text-sm">📍</span>
                                        <div class="min-w-0">
                                            <p class="text-xs font-bold text-pink-900 truncate">{{ s.mainText }}</p>
                                            <p class="text-[10px] text-pink-400 truncate">{{ s.secondaryText }}</p>
                                        </div>
                                    </button>
                                }
                            </div>
                        }

                        <!-- My location -->
                        <button (click)="useMyLocation()" [disabled]="gettingLocation()"
                                class="mt-3 w-full py-2.5 rounded-xl border-2 border-pink-200 text-pink-600 text-xs font-black hover:bg-pink-50 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">
                            @if (gettingLocation()) {
                                <span class="w-3.5 h-3.5 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
                                Obteniendo ubicación...
                            } @else {
                                🎯 Usar mi ubicación actual
                            }
                        </button>
                    </div>

                    <!-- Address details -->
                    <div class="p-5 flex-1 flex flex-col gap-4">
                        <div>
                            <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-2">Dirección de entrega</p>
                            <textarea [(ngModel)]="addressText" rows="2"
                                      placeholder="Ej: Av Reforma 123, Col Centro, Nuevo Laredo"
                                      class="w-full px-4 py-3 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-pink-300 focus:bg-white text-sm font-medium text-pink-900 placeholder-pink-300 outline-none resize-none transition-all">
                            </textarea>
                            <button (click)="fillFromPin()" [disabled]="!markerPosition() || reverseGeocoding()"
                                    class="mt-1.5 text-[11px] font-bold text-pink-500 hover:text-pink-700 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                @if (reverseGeocoding()) {
                                    <span class="w-3 h-3 border border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
                                    Obteniendo dirección del pin...
                                } @else {
                                    📝 Rellenar desde la posición del pin
                                }
                            </button>
                        </div>

                        <div>
                            <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-2">Instrucciones de entrega</p>
                            <textarea [(ngModel)]="instructions" rows="2"
                                      placeholder="Ej: Casa rosa, portón negro, tocar timbre"
                                      class="w-full px-4 py-3 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-pink-300 focus:bg-white text-sm font-medium text-pink-900 placeholder-pink-300 outline-none resize-none transition-all">
                            </textarea>
                        </div>

                        <!-- Location status -->
                        <div class="mt-auto">
                            @if (markerPosition()) {
                                @if (outsideNLD()) {
                                    <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                                        <span class="text-base">⚠️</span>
                                        <p class="text-[11px] font-bold text-amber-700">
                                            El pin está fuera de Nuevo Laredo. Verifica que la ubicación sea correcta.
                                        </p>
                                    </div>
                                } @else {
                                    <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                                        <span class="text-base">🎯</span>
                                        <p class="text-[11px] font-bold text-emerald-700">Ubicación precisa en Nuevo Laredo</p>
                                    </div>
                                }
                            } @else {
                                <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
                                    <span class="text-base">❓</span>
                                    <p class="text-[11px] font-bold text-gray-500">Toca el mapa o busca para fijar el pin</p>
                                </div>
                            }
                        </div>
                    </div>
                </div>

                <!-- RIGHT: Map -->
                <div class="relative h-[38dvh] min-h-[260px] max-h-[380px] w-full flex-none lg:h-auto lg:max-h-none lg:flex-1 lg:min-h-0">

                    <!-- Hint overlay when no marker -->
                    @if (!markerPosition()) {
                        <div class="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                            <div class="bg-white/90 backdrop-blur-md px-5 py-4 rounded-2xl shadow-xl text-center">
                                <p class="text-sm font-black text-pink-900">🗺️ Toca el mapa para fijar el pin</p>
                                <p class="text-[11px] text-pink-400 mt-1">o arrastra el pin una vez colocado</p>
                            </div>
                        </div>
                    }

                    <!-- Map controls -->
                    <div class="absolute top-3 right-3 z-20 flex flex-col gap-2">
                        <button (click)="toggleMapType()"
                                class="w-9 h-9 bg-white rounded-xl shadow-md border border-gray-100 flex items-center justify-center text-base hover:bg-gray-50 transition-all active:scale-95"
                                [title]="isSatellite() ? 'Vista mapa' : 'Vista satélite'">
                            {{ isSatellite() ? '🗺️' : '🛰️' }}
                        </button>
                        @if (markerPosition()) {
                            <button (click)="centerOnMarker()"
                                    class="w-9 h-9 bg-white rounded-xl shadow-md border border-gray-100 flex items-center justify-center text-base hover:bg-gray-50 transition-all active:scale-95"
                                    title="Centrar en el pin">
                                📍
                            </button>
                        }
                    </div>

                    @if (mapsReady()) {
                        <google-map
                            height="100%"
                            width="100%"
                            [center]="mapCenter()"
                            [zoom]="mapZoom()"
                            [options]="mapOptions"
                            (mapClick)="onMapClick($event)"
                            (mapInitialized)="onMapInit($event)">

                            @if (markerPosition(); as pos) {
                                <map-marker
                                    [position]="pos"
                                    [options]="draggableMarkerOpts"
                                    (mapDragend)="onMarkerDragEnd($event)">
                                </map-marker>
                            }
                        </google-map>
                    } @else {
                        <div class="w-full h-full flex items-center justify-center bg-gray-50">
                            <p class="text-pink-300 italic text-sm">Cargando mapa...</p>
                        </div>
                    }
                </div>
            </div>

            <!-- ── FOOTER ── -->
            <div class="px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-4 border-t border-gray-100 shrink-0 flex flex-col-reverse sm:flex-row gap-3 justify-end bg-white">
                <button (click)="cancel.emit()"
                        class="w-full sm:w-auto px-5 py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-all active:scale-95">
                    Cancelar
                </button>
                <button (click)="onConfirm()" [disabled]="!canConfirm()"
                        class="w-full sm:w-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-sm shadow-lg shadow-pink-200 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:transform-none disabled:shadow-none">
                    💾 Guardar ubicación
                </button>
            </div>
        </div>
    </div>
    `
})
export class AddressEditorV2Component implements OnInit, AfterViewInit, OnDestroy {
    @Input() initialAddress: string = '';
    @Input() initialLat?: number | null;
    @Input() initialLng?: number | null;
    @Input() initialInstructions?: string;
    @Input() clientName?: string;

    @Output() confirm = new EventEmitter<{ address: string; lat: number; lng: number; deliveryInstructions: string }>();
    @Output() cancel = new EventEmitter<void>();

    @ViewChild(GoogleMap) mapRef?: GoogleMap;

    // ── State ──
    markerPosition = signal<google.maps.LatLngLiteral | null>(null);
    mapCenter = signal<google.maps.LatLngLiteral>({ lat: 27.4861, lng: -99.5069 });
    mapZoom = signal(13);
    suggestions = signal<Suggestion[]>([]);
    searching = signal(false);
    reverseGeocoding = signal(false);
    gettingLocation = signal(false);
    outsideNLD = signal(false);
    isSatellite = signal(false);
    mapsReady = signal(typeof google !== 'undefined' && !!google?.maps);

    searchText = '';
    addressText = '';
    instructions = '';

    // ── Map options ──
    mapOptions: google.maps.MapOptions = {
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
    };

    draggableMarkerOpts: google.maps.MarkerOptions = {
        draggable: true,
        icon: {
            path: 'M 0,-16 C -8,-16 -14,-10 -14,-3 C -14,8 0,18 0,18 C 0,18 14,8 14,-3 C 14,-10 8,-16 0,-16 Z M 0,-6 C -1.7,-6 -3,-4.7 -3,-3 C -3,-1.3 -1.7,0 0,0 C 1.7,0 3,-1.3 3,-3 C 3,-4.7 1.7,-6 0,-6 Z',
            fillColor: '#ec4899',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2.5,
            scale: 1.3,
            anchor: { x: 0, y: 18 } as any
        } as any,
        cursor: 'grab',
        zIndex: 9999,
    };

    // ── Google services ──
    private autocompleteService?: any;
    private placesService?: any;
    private geocoder?: any;
    private debounceTimer?: ReturnType<typeof setTimeout>;
    private nativeMap?: any;

    ngOnInit(): void {
        this.addressText = this.initialAddress;
        this.instructions = this.initialInstructions ?? '';

        if (this.initialLat != null && this.initialLng != null) {
            const pos = { lat: this.initialLat, lng: this.initialLng };
            this.markerPosition.set(pos);
            this.mapCenter.set(pos);
            this.mapZoom.set(16);
            this.checkOutsideNLD(pos.lat, pos.lng);
        }

        if (typeof google !== 'undefined' && google.maps?.places) {
            this.autocompleteService = new google.maps.places.AutocompleteService();
            this.geocoder = new google.maps.Geocoder();
            this.mapsReady.set(true);
        }
    }

    ngAfterViewInit(): void {
        // PlacesService needs a map DOM element
        if (this.mapRef?.googleMap) {
            this.placesService = new google.maps.places.PlacesService(this.mapRef.googleMap);
        }
    }

    onMapInit(map: any): void {
        this.nativeMap = map;
        if (!this.placesService && typeof google !== 'undefined') {
            this.placesService = new google.maps.places.PlacesService(map);
        }
    }

    // ── Map interactions ──

    onMapClick(event: any): void {
        if (!event.latLng) return;
        const pos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        this.markerPosition.set(pos);
        this.checkOutsideNLD(pos.lat, pos.lng);
    }

    onMarkerDragEnd(event: any): void {
        if (!event.latLng) return;
        const pos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        this.markerPosition.set(pos);
        this.checkOutsideNLD(pos.lat, pos.lng);
        // Note: deliberately NOT reverse-geocoding here — user controls the address field
    }

    centerOnMarker(): void {
        const pos = this.markerPosition();
        if (!pos) return;
        this.mapCenter.set({ ...pos });
        this.mapZoom.set(Math.max(this.mapZoom(), 17));
    }

    toggleMapType(): void {
        if (!this.nativeMap) return;
        const next = !this.isSatellite();
        this.nativeMap.setMapTypeId(next ? 'satellite' : 'roadmap');
        this.isSatellite.set(next);
    }

    // ── Search (AutocompleteService — no race condition) ──

    onSearchInput(): void {
        clearTimeout(this.debounceTimer);
        if (this.searchText.trim().length < 3) { this.suggestions.set([]); return; }
        this.debounceTimer = setTimeout(() => this.fetchSuggestions(), 380);
    }

    private fetchSuggestions(): void {
        if (!this.autocompleteService) return;
        this.autocompleteService.getPlacePredictions(
            {
                input: this.searchText,
                componentRestrictions: { country: 'mx' },
                locationRestriction: {
                    north: 27.78, south: 27.20, east: -99.10, west: -99.85
                }
            },
            (predictions: any[] | null, status: string) => {
                if (status === 'OK' && predictions) {
                    this.suggestions.set(predictions.slice(0, 5).map(p => ({
                        placeId: p.place_id,
                        mainText: p.structured_formatting?.main_text ?? p.description,
                        secondaryText: p.structured_formatting?.secondary_text ?? '',
                        description: p.description
                    })));
                } else {
                    this.suggestions.set([]);
                }
            }
        );
    }

    selectSuggestion(s: Suggestion): void {
        this.searchText = s.description;
        this.suggestions.set([]);
        if (!this.placesService) return;
        this.searching.set(true);
        this.placesService.getDetails(
            { placeId: s.placeId, fields: ['geometry', 'formatted_address'] },
            (result: any, status: string) => {
                this.searching.set(false);
                if (status !== 'OK' || !result?.geometry?.location) return;
                const lat = result.geometry.location.lat();
                const lng = result.geometry.location.lng();
                this.markerPosition.set({ lat, lng });
                this.mapCenter.set({ lat, lng });
                this.mapZoom.set(17);
                this.addressText = result.formatted_address ?? s.description;
                this.checkOutsideNLD(lat, lng);
            }
        );
    }

    // ── Reverse geocode (explicit, user-triggered only) ──

    fillFromPin(): void {
        const pos = this.markerPosition();
        if (!pos || !this.geocoder) return;
        this.reverseGeocoding.set(true);
        this.geocoder.geocode(
            { location: pos },
            (results: any[], status: string) => {
                this.reverseGeocoding.set(false);
                if (status === 'OK' && results?.[0]) {
                    this.addressText = results[0].formatted_address;
                }
            }
        );
    }

    // ── My location ──

    useMyLocation(): void {
        if (!navigator.geolocation) return;
        this.gettingLocation.set(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const latLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                this.markerPosition.set(latLng);
                this.mapCenter.set(latLng);
                this.mapZoom.set(17);
                this.gettingLocation.set(false);
                this.checkOutsideNLD(latLng.lat, latLng.lng);
                this.fillFromPin();
            },
            () => this.gettingLocation.set(false),
            { timeout: 8000 }
        );
    }

    // ── Helpers ──

    private checkOutsideNLD(lat: number, lng: number): void {
        this.outsideNLD.set(lat < 27.1 || lat > 27.9 || lng < -100.1 || lng > -99.0);
    }

    canConfirm(): boolean {
        const pos = this.markerPosition();
        return pos !== null;
    }

    onConfirm(): void {
        const pos = this.markerPosition();
        if (!pos) return;
        this.confirm.emit({
            address: this.addressText.trim() || this.searchText.trim(),
            lat: pos.lat,
            lng: pos.lng,
            deliveryInstructions: this.instructions.trim()
        });
    }

    ngOnDestroy(): void {
        clearTimeout(this.debounceTimer);
    }
}
