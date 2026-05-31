import { Component, OnInit, inject, signal, computed, effect, ViewChild, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { GoogleMap, MapMarker, MapPolyline } from '@angular/google-maps';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { OrderSummaryDto, AvailableTandaDto, PreviewRouteResponse, PreviewStopDto, RouteDto, RouteDeliveryDto } from '../../../../core/models';
import { AddressPickerComponent } from '../address-picker/address-picker.component';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

type StopKey = string; // "order:42" | "tanda:guid"
type MobileView = 'list' | 'map' | 'route';

interface CandidateRow {
    key: StopKey;
    kind: 'Order' | 'Tanda';
    rawId: number | string;
    clientId?: number;
    clientName: string;
    address?: string;
    hasCoords: boolean;
    isTandaPending: boolean;
    tandaName?: string;
    tandaWeek?: number;
}

declare const google: any;

@Component({
    selector: 'app-route-builder',
    standalone: true,
    imports: [CommonModule, FormsModule, GoogleMap, MapMarker, MapPolyline, AddressPickerComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    template: `
    <div class="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 p-4 sm:p-6">

        <!-- HEADER + KPIS -->
        <div class="max-w-[1600px] mx-auto mb-4">
            <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                    <button (click)="goBack()" class="text-pink-400 text-xs font-bold uppercase tracking-widest hover:text-pink-600 transition-colors">
                        ← Volver a Rutas
                    </button>
                    <h1 class="text-2xl sm:text-3xl font-black text-pink-900 font-display">
                        {{ isEditMode() ? '🔄 Re-armar Ruta' : 'Armado de Ruta ✨' }}
                    </h1>
                    <p class="text-pink-400 text-xs sm:text-sm">
                        {{ isEditMode()
                            ? 'Modifica las paradas pendientes. Las ya entregadas quedan fijas.'
                            : 'Selecciona y la ruta se calcula sola con Google Routes.' }}
                    </p>
                </div>
                <button (click)="save()"
                        [disabled]="!canSave()"
                        class="px-6 sm:px-8 py-3 sm:py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-sm shadow-lg shadow-pink-200 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none">
                    {{ saving() ? 'Guardando...' : (isEditMode() ? '🔄 Actualizar Ruta' : '✓ Guardar Ruta') }}
                </button>
            </div>

            <!-- KPIs -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div class="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-pink-100/60">
                    <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest">Paradas</p>
                    <p class="text-xl sm:text-2xl font-black text-pink-900">
                        {{ (lockedStops().length + (preview()?.stops?.length ?? 0)) }}
                        @if (lockedStops().length > 0) {
                            <span class="text-xs font-medium text-slate-400"> ({{ lockedStops().length }} 🔒)</span>
                        }
                    </p>
                </div>
                <div class="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-pink-100/60">
                    <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest">Distancia</p>
                    <p class="text-xl sm:text-2xl font-black text-pink-900">{{ formatDistance(preview()?.totalDistanceMeters ?? 0) }}</p>
                </div>
                <div class="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-pink-100/60">
                    <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest">Duración</p>
                    <p class="text-xl sm:text-2xl font-black text-pink-900">{{ formatDuration(preview()?.totalDurationSeconds ?? 0) }}</p>
                </div>
                <div class="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-pink-100/60">
                    <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest">Motor</p>
                    <p class="text-xs sm:text-sm font-bold text-pink-700 truncate">{{ optimizerLabel() }}</p>
                </div>
            </div>
        </div>

        <!-- ALERT: clientas sin coords -->
        @if (selectedWithoutCoords().length > 0) {
            <div class="max-w-[1600px] mx-auto mb-4">
                <div class="bg-amber-50 border-2 border-amber-200 rounded-3xl p-4 sm:p-5 shadow-sm">
                    <div class="flex items-start gap-3 sm:gap-4">
                        <span class="text-2xl sm:text-3xl">⚠️</span>
                        <div class="flex-1 min-w-0">
                            <h3 class="font-black text-amber-900 mb-1 text-sm sm:text-base">
                                {{ selectedWithoutCoords().length }} {{ selectedWithoutCoords().length === 1 ? 'clienta sin coordenadas' : 'clientas sin coordenadas' }}
                            </h3>
                            <p class="text-xs sm:text-sm text-amber-700 mb-2">No se puede optimizar bien sin ubicación. Geocodifica automático:</p>
                            <div class="flex flex-wrap gap-1.5 mb-3">
                                @for (row of selectedWithoutCoords(); track row.key) {
                                    <span class="px-2 py-1 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full">{{ row.clientName }}</span>
                                }
                            </div>
                            <button (click)="autoGeocodeSelected()"
                                    [disabled]="geocodingNow()"
                                    class="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-sm hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-60">
                                {{ geocodingNow() ? 'Geocodificando...' : '🪄 Geocodificar automático' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        }

        <!-- MOBILE TABS -->
        <div class="max-w-[1600px] mx-auto mb-3 lg:hidden">
            <div class="bg-white rounded-2xl p-1 border border-pink-100/60 shadow-sm grid grid-cols-3 gap-1">
                <button (click)="mobileView.set('list')"
                        [class.bg-pink-500]="mobileView() === 'list'" [class.text-white]="mobileView() === 'list'"
                        [class.text-pink-500]="mobileView() !== 'list'"
                        class="py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all">
                    📋 Lista ({{ selected().size }})
                </button>
                <button (click)="mobileView.set('map')"
                        [class.bg-pink-500]="mobileView() === 'map'" [class.text-white]="mobileView() === 'map'"
                        [class.text-pink-500]="mobileView() !== 'map'"
                        class="py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all">
                    🗺️ Mapa
                </button>
                <button (click)="mobileView.set('route')"
                        [class.bg-pink-500]="mobileView() === 'route'" [class.text-white]="mobileView() === 'route'"
                        [class.text-pink-500]="mobileView() !== 'route'"
                        class="py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all">
                    ✨ Ruta ({{ lockedStops().length + (preview()?.stops?.length ?? 0) }})
                </button>
            </div>
        </div>

        <!-- MAIN GRID -->
        <div class="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">

            <!-- LEFT: SIDEBAR CANDIDATOS -->
            <div class="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-pink-100/60 overflow-hidden flex flex-col"
                 [class.hidden]="mobileView() !== 'list'" [class.lg:flex]="true">
                <div class="p-4 border-b border-pink-50">
                    <h2 class="text-base font-black text-pink-900 mb-3">Pendientes</h2>
                    <input type="text" [(ngModel)]="searchTerm" (ngModelChange)="onSearchChange()"
                           placeholder="🔍 Buscar..."
                           class="w-full px-3 py-2.5 rounded-2xl border-2 border-pink-100 bg-pink-50/30 text-sm font-medium text-pink-900 placeholder-pink-300 focus:outline-none focus:border-pink-300 focus:bg-white transition-all">
                    <div class="flex gap-1.5 mt-3">
                        <button (click)="filterMode.set('all')"
                                [class.bg-pink-500]="filterMode() === 'all'" [class.text-white]="filterMode() === 'all'"
                                [class.bg-pink-50]="filterMode() !== 'all'" [class.text-pink-600]="filterMode() !== 'all'"
                                class="flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all">
                            Todas ({{ candidates().length }})
                        </button>
                        <button (click)="filterMode.set('no-coords')"
                                [class.bg-amber-500]="filterMode() === 'no-coords'" [class.text-white]="filterMode() === 'no-coords'"
                                [class.bg-amber-50]="filterMode() !== 'no-coords'" [class.text-amber-600]="filterMode() !== 'no-coords'"
                                class="flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all">
                            Sin dir ({{ noCoordsCount() }})
                        </button>
                        <button (click)="filterMode.set('tandas')"
                                [class.bg-fuchsia-500]="filterMode() === 'tandas'" [class.text-white]="filterMode() === 'tandas'"
                                [class.bg-fuchsia-50]="filterMode() !== 'tandas'" [class.text-fuchsia-600]="filterMode() !== 'tandas'"
                                class="flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all">
                            Tandas ({{ tandasCount() }})
                        </button>
                    </div>
                    <div class="flex items-center justify-between mt-2 text-[11px] font-bold">
                        <button (click)="selectAllVisible()" class="text-pink-500 hover:underline">Seleccionar visibles</button>
                        <button (click)="clearSelection()" class="text-pink-400 hover:underline">Limpiar</button>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto p-2 max-h-[65vh]">
                    @if (loading()) {
                        <p class="text-center text-pink-300 italic text-sm py-8">Cargando pendientes...</p>
                    } @else if (visibleCandidates().length === 0) {
                        <p class="text-center text-pink-300 italic text-sm py-8">Nada por aquí 🌸</p>
                    }
                    @for (row of visibleCandidates(); track row.key) {
                        <label class="flex items-center gap-2 p-2.5 rounded-2xl cursor-pointer mb-1 transition-all"
                               [class.bg-pink-50]="selected().has(row.key)"
                               [class.border]="selected().has(row.key)"
                               [class.border-pink-200]="selected().has(row.key)"
                               [class.hover:bg-pink-50/40]="!selected().has(row.key)"
                               (mouseenter)="hoveredKey.set(row.key)"
                               (mouseleave)="hoveredKey.set(null)">
                            <input type="checkbox" [checked]="selected().has(row.key)"
                                   (change)="toggle(row.key)"
                                   class="w-4 h-4 rounded-md text-pink-500 focus:ring-pink-300 cursor-pointer">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <p class="text-sm font-bold text-pink-900 truncate">{{ row.clientName }}</p>
                                    @if (row.kind === 'Tanda') {
                                        <span class="px-1 py-0.5 bg-fuchsia-100 text-fuchsia-700 text-[9px] font-black rounded uppercase">Tanda</span>
                                    }
                                    @if (!row.hasCoords) {
                                        <span class="px-1 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded uppercase">Sin dir</span>
                                    }
                                </div>
                                @if (row.address) {
                                    <p class="text-[10px] text-pink-400 truncate">📍 {{ row.address }}</p>
                                }
                            </div>
                            @if (row.kind === 'Order' && row.clientId) {
                                <button (click)="openAddressPicker(row, $event)"
                                        class="w-7 h-7 rounded-xl bg-pink-50 text-pink-400 hover:bg-pink-100 hover:text-pink-600 flex items-center justify-center text-sm transition-all shrink-0"
                                        title="Editar dirección">
                                    📍
                                </button>
                            }
                        </label>
                    }
                </div>
            </div>

            <!-- CENTER: MAPA -->
            <div class="lg:col-span-6 bg-white rounded-3xl shadow-sm border border-pink-100/60 overflow-hidden flex flex-col"
                 [class.hidden]="mobileView() !== 'map'" [class.lg:flex]="true">
                @if (mapsReady()) {
                    <google-map
                        height="70vh"
                        width="100%"
                        [center]="mapCenter()"
                        [zoom]="mapZoom()"
                        [options]="mapOptions">

                        <!-- Depot marker -->
                        @if (depotPosition(); as dp) {
                            <map-marker [position]="dp" [options]="depotMarkerOptions"></map-marker>
                        }

                        <!-- Locked stops (grayed pins) -->
                        @for (d of lockedStops(); track d.deliveryId) {
                            @if (d.latitude != null && d.longitude != null) {
                                <map-marker
                                    [position]="{ lat: d.latitude, lng: d.longitude }"
                                    [options]="lockedMarkerOptionsFor(d)">
                                </map-marker>
                            }
                        }

                        <!-- Preview stops (numbered pins) -->
                        @for (stop of preview()?.stops ?? []; track stop.kind + (stop.orderId ?? stop.tandaParticipantId)) {
                            @if (stop.latitude != null && stop.longitude != null) {
                                <map-marker
                                    [position]="{ lat: stop.latitude, lng: stop.longitude }"
                                    [options]="markerOptionsFor(stop)"
                                    (mapClick)="onMarkerClick(stop)"
                                    (mapMouseover)="hoveredKey.set(keyOf(stop))"
                                    (mapMouseout)="hoveredKey.set(null)">
                                </map-marker>
                            }
                        }

                        <!-- Polyline -->
                        @if (polylinePath().length > 0) {
                            <map-polyline [path]="polylinePath()" [options]="polylineOptions"></map-polyline>
                        }
                    </google-map>
                } @else {
                    <div class="flex-1 flex items-center justify-center min-h-[70vh]">
                        <p class="text-pink-400 italic">Cargando mapa...</p>
                    </div>
                }
            </div>

            <!-- RIGHT: RUTA OPTIMIZADA EN VIVO -->
            <div class="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-pink-100/60 overflow-hidden flex flex-col"
                 [class.hidden]="mobileView() !== 'route'" [class.lg:flex]="true">
                <div class="p-4 border-b border-pink-50 flex items-center justify-between">
                    <div class="min-w-0">
                        <h2 class="text-base font-black text-pink-900">Ruta óptima</h2>
                        <p class="text-[10px] text-pink-400">
                            @if (loadingPreview()) { Calculando... }
                            @else if ((preview()?.stops?.length ?? 0) === 0 && lockedStops().length === 0) { Selecciona para previsualizar }
                            @else { Orden calculado automático }
                        </p>
                    </div>
                    @if (loadingPreview()) {
                        <div class="w-5 h-5 border-4 border-pink-100 border-t-pink-500 rounded-full animate-spin shrink-0"></div>
                    }
                </div>

                <div class="flex-1 overflow-y-auto p-2 max-h-[65vh]">

                    <!-- Locked stops (already delivered/failed) -->
                    @for (d of lockedStops(); track d.deliveryId) {
                        <div class="flex items-center gap-2 p-2 rounded-2xl mb-1 opacity-50">
                            <div class="w-8 h-8 rounded-xl bg-slate-300 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                                {{ d.sortOrder }}
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <p class="text-xs font-bold text-slate-600 truncate">{{ d.clientName }}</p>
                                    <span class="px-1 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black rounded uppercase">🔒 {{ d.status }}</span>
                                </div>
                                @if (d.clientAddress) {
                                    <p class="text-[10px] text-slate-400 truncate">📍 {{ d.clientAddress }}</p>
                                }
                            </div>
                        </div>
                    }

                    <!-- Divider if there are locked stops -->
                    @if (lockedStops().length > 0 && (preview()?.stops?.length ?? 0) > 0) {
                        <div class="flex items-center gap-2 my-2 px-2">
                            <div class="flex-1 h-px bg-pink-100"></div>
                            <span class="text-[9px] font-black text-pink-300 uppercase tracking-widest">Pendientes</span>
                            <div class="flex-1 h-px bg-pink-100"></div>
                        </div>
                    }

                    <!-- Preview stops -->
                    @if ((preview()?.stops?.length ?? 0) === 0 && !loadingPreview() && lockedStops().length === 0) {
                        <p class="text-center text-pink-300 italic text-xs py-8 px-4">
                            La ruta aparecerá aquí en vivo. ✨
                        </p>
                    }
                    @for (stop of preview()?.stops ?? []; track stop.kind + (stop.orderId ?? stop.tandaParticipantId)) {
                        <div class="flex items-center gap-2 p-2 rounded-2xl mb-1 hover:bg-pink-50/40 transition-all cursor-pointer"
                             [class.bg-pink-50]="hoveredKey() === keyOf(stop)"
                             (mouseenter)="hoveredKey.set(keyOf(stop))"
                             (mouseleave)="hoveredKey.set(null)"
                             (click)="focusOnStop(stop)">
                            <div class="w-8 h-8 rounded-xl bg-pink-500 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm"
                                 [class.bg-rose-600]="hoveredKey() === keyOf(stop)"
                                 [class.scale-110]="hoveredKey() === keyOf(stop)">
                                {{ lockedStops().length + stop.sortOrder }}
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <p class="text-xs font-bold text-pink-900 truncate">{{ stop.clientName }}</p>
                                    @if (stop.kind === 'Tanda') {
                                        <span class="px-1 py-0.5 bg-fuchsia-100 text-fuchsia-700 text-[9px] font-black rounded uppercase">Tanda</span>
                                    }
                                    @if (!stop.hasCoords) {
                                        <span class="px-1 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded uppercase">Sin coords</span>
                                    }
                                </div>
                                @if (stop.clientAddress) {
                                    <p class="text-[10px] text-pink-400 truncate">📍 {{ stop.clientAddress }}</p>
                                }
                            </div>
                            @if (stop.kind !== 'Tanda' && stop.total > 0) {
                                <span class="text-[10px] font-black text-emerald-500 shrink-0">{{ stop.total | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
                            }
                        </div>
                    }
                </div>

                @if ((preview()?.skipped?.length ?? 0) > 0) {
                    <div class="border-t border-amber-100 p-3 bg-amber-50/50">
                        <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">
                            {{ preview()?.skipped?.length }} {{ preview()?.skipped?.length === 1 ? 'rechazada' : 'rechazadas' }}
                        </p>
                        @for (s of preview()?.skipped ?? []; track s.id) {
                            <p class="text-[10px] text-amber-600">· {{ s.name }} ({{ s.reason }})</p>
                        }
                    </div>
                }
            </div>
        </div>
    </div>

    @if (pickingAddressFor(); as row) {
        <app-address-picker
            [initialAddress]="row.address ?? ''"
            (confirm)="onAddressConfirmed($event)"
            (cancel)="pickingAddressFor.set(null)">
        </app-address-picker>
    }
    `,
    styles: []
})
export class RouteBuilderComponent implements OnInit {
    private api = inject(ApiService);
    private toast = inject(ToastService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    @ViewChild(GoogleMap) googleMap?: GoogleMap;

    // ── Edit mode state ──
    editRouteId = signal<number | null>(null);
    isEditMode = computed(() => this.editRouteId() !== null);
    lockedStops = signal<RouteDeliveryDto[]>([]);  // Delivered/Failed deliveries
    loadingRoute = signal(false);

    pendingOrders = signal<OrderSummaryDto[]>([]);
    availableTandas = signal<AvailableTandaDto[]>([]);
    loading = signal(true);

    selected = signal<Set<StopKey>>(new Set());
    hoveredKey = signal<string | null>(null);
    searchTerm = '';
    searchSignal = signal('');
    filterMode = signal<'all' | 'no-coords' | 'tandas'>('all');
    mobileView = signal<MobileView>('list');

    preview = signal<PreviewRouteResponse | null>(null);
    loadingPreview = signal(false);
    saving = signal(false);
    geocodingNow = signal(false);
    pickingAddressFor = signal<CandidateRow | null>(null);

    mapsReady = signal(typeof google !== 'undefined' && !!google?.maps);
    mapCenter = signal<google.maps.LatLngLiteral>({ lat: 27.4861, lng: -99.5069 });
    mapZoom = signal(12);

    mapOptions: google.maps.MapOptions = {
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        clickableIcons: false
    };

    depotMarkerOptions: google.maps.MarkerOptions = {
        icon: {
            path: 'M 0,-8 L 6,0 L 0,8 L -6,0 z',
            scale: 1.6,
            fillColor: '#8b5cf6',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#fff'
        } as any,
        label: { text: '🏠', fontSize: '14px' } as any,
        zIndex: 9999
    };

    polylineOptions: google.maps.PolylineOptions = {
        strokeColor: '#ec4899',
        strokeOpacity: 0.85,
        strokeWeight: 4,
        clickable: false
    };

    polylinePath = signal<google.maps.LatLngLiteral[]>([]);
    depotPosition = signal<google.maps.LatLngLiteral | null>({ lat: 27.4861, lng: -99.5069 });

    private previewTrigger$ = new Subject<void>();
    private mapsPollTimer?: any;

    candidates = computed<CandidateRow[]>(() => {
        const orderRows: CandidateRow[] = this.pendingOrders().map(o => ({
            key: `order:${o.id}`,
            kind: 'Order' as const,
            rawId: o.id,
            clientId: o.clientId,
            clientName: o.clientName,
            address: o.alternativeAddress ?? o.clientAddress,
            hasCoords: this.orderHasCoords(o),
            isTandaPending: false
        }));
        const tandaRows: CandidateRow[] = this.availableTandas().map(t => ({
            key: `tanda:${t.tandaParticipantId}`,
            kind: 'Tanda' as const,
            rawId: t.tandaParticipantId,
            clientId: t.clientId,
            clientName: t.clientName,
            address: t.clientAddress,
            hasCoords: t.clientLatitude != null && t.clientLongitude != null,
            isTandaPending: true,
            tandaName: t.tandaName,
            tandaWeek: t.week
        }));
        return [...orderRows, ...tandaRows];
    });

    visibleCandidates = computed(() => {
        const term = this.searchSignal().trim().toLowerCase();
        const mode = this.filterMode();
        return this.candidates().filter(c => {
            if (mode === 'no-coords' && c.hasCoords) return false;
            if (mode === 'tandas' && c.kind !== 'Tanda') return false;
            if (term && !(c.clientName.toLowerCase().includes(term) || (c.address ?? '').toLowerCase().includes(term))) return false;
            return true;
        });
    });

    noCoordsCount = computed(() => this.candidates().filter(c => !c.hasCoords).length);
    tandasCount = computed(() => this.candidates().filter(c => c.kind === 'Tanda').length);

    selectedRows = computed(() => {
        const sel = this.selected();
        return this.candidates().filter(c => sel.has(c.key));
    });

    selectedWithoutCoords = computed(() => this.selectedRows().filter(r => !r.hasCoords));

    canSave = computed(() =>
        this.selected().size > 0
        && this.selectedWithoutCoords().length === 0
        && !this.saving()
        && !this.loadingPreview()
        && (this.preview()?.stops?.length ?? 0) > 0
    );

    optimizerLabel = computed(() => {
        const src = this.preview()?.optimizerSource;
        if (!src) return '—';
        if (src === 'google-routes-v2') return '🎯 Google Routes';
        if (src === 'haversine-fallback') return '↪️ Haversine';
        if (src === 'no-coords') return '⚠️ Sin coords';
        return src;
    });

    constructor() {
        effect(() => {
            const _ = this.selected().size;
            this.previewTrigger$.next();
        }, { allowSignalWrites: true });

        this.previewTrigger$.pipe(debounceTime(500)).subscribe(() => this.refreshPreview());

        effect(() => {
            const p = this.preview();
            if (!p) {
                this.polylinePath.set([]);
                return;
            }
            if (p.polylineEncoded) {
                this.polylinePath.set(this.decodePolyline(p.polylineEncoded));
            } else {
                // Backend no devolvió polyline (ej. fallback Haversine).
                // Usamos DirectionsService del navegador para dibujar calles reales.
                this.polylinePath.set([]);
                this.drawDirectionsPolyline(p.stops);
            }
            this.fitMapBounds();
        }, { allowSignalWrites: true });
    }

    ngOnInit(): void {
        // Detect edit mode from :id route param
        const idParam = this.route.snapshot.paramMap.get('id');
        if (idParam) {
            const routeId = parseInt(idParam, 10);
            if (!isNaN(routeId)) {
                this.editRouteId.set(routeId);
                this.loadExistingRoute(routeId);
            }
        }
        this.loadCandidates();
        this.waitForMaps();
        this.requestDeviceLocation();
    }

    private requestDeviceLocation(): void {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                this.depotPosition.set(loc);
                this.mapCenter.set(loc);
                if (this.selected().size > 0) this.previewTrigger$.next();
            },
            () => { /* denied or unavailable — keep NLD default */ },
            { timeout: 8000, maximumAge: 300000 }
        );
    }

    private loadExistingRoute(routeId: number): void {
        this.loadingRoute.set(true);
        this.api.getRoute(routeId).subscribe({
            next: (route: RouteDto) => {
                this.loadingRoute.set(false);
                const locked = route.deliveries.filter(d =>
                    d.status === 'Delivered' || d.status === 'NotDelivered'
                ).sort((a, b) => a.sortOrder - b.sortOrder);
                this.lockedStops.set(locked);

                // Pre-select the pending deliveries from the existing route
                const preSelected = new Set<StopKey>();
                for (const d of route.deliveries) {
                    if (d.status === 'Delivered' || d.status === 'NotDelivered') continue;
                    if (d.kind === 'Tanda' && d.tandaParticipantId) {
                        preSelected.add(`tanda:${d.tandaParticipantId}`);
                    } else if (d.orderId != null) {
                        preSelected.add(`order:${d.orderId}`);
                    }
                }
                this.selected.set(preSelected);
            },
            error: () => {
                this.loadingRoute.set(false);
                this.toast.error('No se pudo cargar la ruta para editar');
                this.router.navigate(['/admin/routes']);
            }
        });
    }

    private waitForMaps(): void {
        if (typeof google !== 'undefined' && google?.maps) {
            this.mapsReady.set(true);
            return;
        }
        this.mapsPollTimer = setInterval(() => {
            if (typeof google !== 'undefined' && google?.maps) {
                this.mapsReady.set(true);
                clearInterval(this.mapsPollTimer);
            }
        }, 200);
    }

    private fitMapBounds(): void {
        if (!this.mapsReady() || !this.googleMap?.googleMap) return;
        const stops = this.preview()?.stops ?? [];
        const points: google.maps.LatLngLiteral[] = [];
        const depot = this.depotPosition();
        if (depot) points.push(depot);
        for (const s of stops) {
            if (s.latitude != null && s.longitude != null) points.push({ lat: s.latitude, lng: s.longitude });
        }
        for (const d of this.lockedStops()) {
            if (d.latitude != null && d.longitude != null) points.push({ lat: d.latitude, lng: d.longitude });
        }
        if (points.length === 0) return;
        try {
            const bounds = new google.maps.LatLngBounds();
            for (const p of points) bounds.extend(p);
            this.googleMap.googleMap.fitBounds(bounds, 60);
        } catch { /* ignore */ }
    }

    keyOf(stop: PreviewStopDto): string {
        return stop.kind === 'Tanda' ? `tanda:${stop.tandaParticipantId}` : `order:${stop.orderId}`;
    }

    markerOptionsFor(stop: PreviewStopDto): google.maps.MarkerOptions {
        const isHovered = this.hoveredKey() === this.keyOf(stop);
        return {
            label: {
                text: String(this.lockedStops().length + stop.sortOrder),
                color: 'white',
                fontWeight: '900',
                fontSize: '13px'
            } as any,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: isHovered ? 18 : 14,
                fillColor: stop.kind === 'Tanda' ? '#d946ef' : '#ec4899',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#fff'
            } as any,
            animation: isHovered ? google.maps.Animation.BOUNCE : null,
            zIndex: isHovered ? 9000 : 100 + stop.sortOrder
        };
    }

    lockedMarkerOptionsFor(d: RouteDeliveryDto): google.maps.MarkerOptions {
        return {
            label: {
                text: String(d.sortOrder),
                color: 'white',
                fontWeight: '900',
                fontSize: '12px'
            } as any,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: '#94a3b8',
                fillOpacity: 0.8,
                strokeWeight: 2,
                strokeColor: '#fff'
            } as any,
            zIndex: 50
        };
    }

    onMarkerClick(stop: PreviewStopDto): void {
        this.hoveredKey.set(this.keyOf(stop));
    }

    focusOnStop(stop: PreviewStopDto): void {
        if (stop.latitude == null || stop.longitude == null) return;
        this.mapCenter.set({ lat: stop.latitude, lng: stop.longitude });
        this.mapZoom.set(15);
        if (window.innerWidth < 1024) this.mobileView.set('map');
    }

    loadCandidates(): void {
        this.loading.set(true);
        let ordersLoaded = false, tandasLoaded = false;
        const done = () => { if (ordersLoaded && tandasLoaded) this.loading.set(false); };
        const editId = this.route.snapshot.paramMap.get('id');
        const currentRouteId = editId ? parseInt(editId, 10) : null;

        this.api.getOrders().subscribe({
            next: (items: OrderSummaryDto[]) => {
                const eligible = (items ?? []).filter(o =>
                    o.status !== 'Canceled' && o.status !== 'Delivered'
                    && o.orderType !== 'PickUp'
                    // In edit mode, allow orders that belong to this route (they have deliveryRouteId = currentRouteId)
                    && (currentRouteId != null
                        ? (!o.deliveryRouteId || o.deliveryRouteId === currentRouteId)
                        : !o.deliveryRouteId)
                );
                this.pendingOrders.set(eligible);
                ordersLoaded = true;
                done();
            },
            error: () => { ordersLoaded = true; done(); }
        });

        this.api.getAvailableTandas().subscribe({
            next: (list) => {
                this.availableTandas.set(list);
                tandasLoaded = true;
                done();
            },
            error: () => { tandasLoaded = true; done(); }
        });
    }

    orderHasCoords(o: any): boolean {
        return !!(o.clientAddress && o.clientAddress.trim().length > 5);
    }

    toggle(key: StopKey): void {
        const next = new Set(this.selected());
        if (next.has(key)) next.delete(key); else next.add(key);
        this.selected.set(next);
    }

    selectAllVisible(): void {
        const next = new Set(this.selected());
        for (const c of this.visibleCandidates()) next.add(c.key);
        this.selected.set(next);
    }

    clearSelection(): void {
        this.selected.set(new Set());
        this.preview.set(null);
    }

    onSearchChange(): void {
        this.searchSignal.set(this.searchTerm);
    }

    refreshPreview(): void {
        const orderIds: number[] = [];
        const tandaIds: string[] = [];
        for (const key of this.selected()) {
            if (key.startsWith('order:')) orderIds.push(Number(key.substring(6)));
            else if (key.startsWith('tanda:')) tandaIds.push(key.substring(6));
        }

        if (orderIds.length === 0 && tandaIds.length === 0) {
            this.preview.set(null);
            return;
        }

        this.loadingPreview.set(true);
        const depot = this.depotPosition() ?? { lat: 27.4861, lng: -99.5069 };
        this.api.previewRoute(orderIds, tandaIds, depot.lat, depot.lng).subscribe({
            next: (res) => {
                this.preview.set(res);
                this.loadingPreview.set(false);
            },
            error: () => {
                this.loadingPreview.set(false);
                this.toast.error('No se pudo calcular el preview');
            }
        });
    }

    autoGeocodeSelected(): void {
        const clientIds = this.selectedWithoutCoords()
            .map(r => r.clientId)
            .filter((id): id is number => id != null);
        if (clientIds.length === 0) return;

        this.geocodingNow.set(true);
        this.api.bulkGeocodeClients(clientIds).subscribe({
            next: (results) => {
                this.geocodingNow.set(false);
                const ok = results.filter(r => r.success).length;
                const fail = results.length - ok;
                if (ok > 0) this.toast.success(`✨ ${ok} ${ok === 1 ? 'dirección resuelta' : 'direcciones resueltas'}`);
                if (fail > 0) this.toast.error(`${fail} no se pudieron geocodificar. Captúralas manualmente.`);
                this.loadCandidates();
                setTimeout(() => this.refreshPreview(), 300);
            },
            error: () => {
                this.geocodingNow.set(false);
                this.toast.error('Error al geocodificar');
            }
        });
    }

    save(): void {
        if (!this.canSave()) return;
        const stops = this.preview()?.stops ?? [];
        const orderIds: number[] = [];
        const tandaIds: string[] = [];
        for (const s of stops) {
            if (s.kind === 'Order' && s.orderId != null) orderIds.push(s.orderId);
            else if (s.kind === 'Tanda' && s.tandaParticipantId) tandaIds.push(s.tandaParticipantId);
        }

        this.saving.set(true);
        const routeId = this.editRouteId();

        if (routeId != null) {
            // Edit mode: recompose existing route
            this.api.recomposeRoute(routeId, orderIds, tandaIds).subscribe({
                next: (res) => {
                    this.saving.set(false);
                    if (res.skipped && res.skipped.length > 0) {
                        this.toast.error(`Ruta actualizada: ${res.skipped.length} no entraron`);
                    } else {
                        this.toast.success('🔄 Ruta recompuesta exitosamente');
                    }
                    this.router.navigate(['/admin/routes']);
                },
                error: (err) => {
                    this.saving.set(false);
                    this.toast.error(err.error?.message || 'Error al actualizar la ruta');
                }
            });
        } else {
            // New route
            this.api.createRoute(orderIds, false, tandaIds, true).subscribe({
                next: (res) => {
                    this.saving.set(false);
                    if (res.skipped && res.skipped.length > 0) {
                        this.toast.error(`Ruta creada: ${res.skipped.length} no entraron`);
                    } else {
                        this.toast.success('✨ Ruta creada y optimizada');
                    }
                    this.router.navigate(['/admin/routes']);
                },
                error: (err) => {
                    this.saving.set(false);
                    this.toast.error(err.error?.message || 'Error al guardar la ruta');
                }
            });
        }
    }

    private decodePolyline(encoded: string): google.maps.LatLngLiteral[] {
        const path: google.maps.LatLngLiteral[] = [];
        let index = 0, lat = 0, lng = 0;
        while (index < encoded.length) {
            let b: number, shift = 0, result = 0;
            do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            lat += (result & 1) ? ~(result >> 1) : (result >> 1);
            shift = 0; result = 0;
            do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            lng += (result & 1) ? ~(result >> 1) : (result >> 1);
            path.push({ lat: lat / 1e5, lng: lng / 1e5 });
        }
        return path;
    }

    // Dibuja la ruta real por calles usando DirectionsService del navegador.
    // Se llama cuando el backend no devuelve polylineEncoded (ej. fallback Haversine).
    private drawDirectionsPolyline(stops: PreviewStopDto[]): void {
        if (!this.mapsReady() || typeof google === 'undefined' || !google?.maps) return;
        const depot = this.depotPosition() ?? { lat: 27.4861, lng: -99.5069 };
        const geocoded = stops.filter(s => s.latitude != null && s.longitude != null);
        if (geocoded.length === 0) return;

        const destination: google.maps.LatLngLiteral = {
            lat: geocoded[geocoded.length - 1].latitude!,
            lng: geocoded[geocoded.length - 1].longitude!
        };
        const waypoints = geocoded.slice(0, -1).slice(0, 25).map(s => ({
            location: { lat: s.latitude!, lng: s.longitude! } as google.maps.LatLngLiteral,
            stopover: true
        }));

        new google.maps.DirectionsService().route(
            { origin: depot, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING },
            (result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
                if (status === google.maps.DirectionsStatus.OK && result?.routes[0]) {
                    this.polylinePath.set(
                        result.routes[0].overview_path.map(
                            (pt: google.maps.LatLng) => ({ lat: pt.lat(), lng: pt.lng() })
                        )
                    );
                }
            }
        );
    }

    openAddressPicker(row: CandidateRow, event: Event): void {
        event.stopPropagation();
        this.pickingAddressFor.set(row);
    }

    onAddressConfirmed(result: { address: string; lat: number; lng: number }): void {
        const row = this.pickingAddressFor();
        if (!row || !row.clientId) { this.pickingAddressFor.set(null); return; }
        this.api.setClientCoordinates(row.clientId, result.lat, result.lng, result.address).subscribe({
            next: () => {
                this.toast.success(`📍 Dirección guardada para ${row.clientName}`);
                this.pickingAddressFor.set(null);
                this.loadCandidates();
                setTimeout(() => this.refreshPreview(), 400);
            },
            error: () => {
                this.toast.error('No se pudo guardar la dirección');
                this.pickingAddressFor.set(null);
            }
        });
    }

    goBack(): void {
        this.router.navigate(['/admin/routes']);
    }

    formatDistance(meters: number): string {
        if (!meters) return '—';
        const km = meters / 1000;
        return km < 1 ? `${meters} m` : `${km.toFixed(1)} km`;
    }

    formatDuration(seconds: number): string {
        if (!seconds) return '—';
        const m = Math.round(seconds / 60);
        if (m < 60) return `${m} min`;
        const h = Math.floor(m / 60);
        const rem = m % 60;
        return `${h}h ${rem}m`;
    }
}
