import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { OrderSummaryDto, AvailableTandaDto, PreviewRouteResponse, PreviewStopDto, SkippedStopDto } from '../../../../core/models';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

type StopKey = string; // "order:42" | "tanda:guid"

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

@Component({
    selector: 'app-route-builder',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 p-4 sm:p-6">

        <!-- HEADER + KPIS -->
        <div class="max-w-7xl mx-auto mb-6">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <button (click)="goBack()" class="text-pink-400 text-xs font-bold uppercase tracking-widest hover:text-pink-600 transition-colors">
                        ← Volver a Rutas
                    </button>
                    <h1 class="text-3xl font-black text-pink-900 font-display">Armado de Ruta ✨</h1>
                    <p class="text-pink-400 text-sm">Selecciona clientas y tandas. El orden se calcula con Google Routes API.</p>
                </div>
                <button (click)="save()"
                        [disabled]="!canSave()"
                        class="px-8 py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-sm shadow-lg shadow-pink-200 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none">
                    {{ saving() ? 'Guardando...' : '✓ Guardar Ruta' }}
                </button>
            </div>

            <!-- KPIs -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-pink-100/60">
                    <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest">Paradas</p>
                    <p class="text-2xl font-black text-pink-900">{{ preview()?.stops?.length ?? 0 }}</p>
                </div>
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-pink-100/60">
                    <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest">Distancia</p>
                    <p class="text-2xl font-black text-pink-900">{{ formatDistance(preview()?.totalDistanceMeters ?? 0) }}</p>
                </div>
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-pink-100/60">
                    <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest">Duración</p>
                    <p class="text-2xl font-black text-pink-900">{{ formatDuration(preview()?.totalDurationSeconds ?? 0) }}</p>
                </div>
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-pink-100/60">
                    <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest">Motor</p>
                    <p class="text-sm font-bold text-pink-700 truncate">{{ optimizerLabel() }}</p>
                </div>
            </div>
        </div>

        <!-- ALERT: clientas sin coords -->
        @if (selectedWithoutCoords().length > 0) {
            <div class="max-w-7xl mx-auto mb-6">
                <div class="bg-amber-50 border-2 border-amber-200 rounded-3xl p-5 shadow-sm">
                    <div class="flex items-start gap-4">
                        <span class="text-3xl">⚠️</span>
                        <div class="flex-1">
                            <h3 class="font-black text-amber-900 mb-1">
                                {{ selectedWithoutCoords().length }} {{ selectedWithoutCoords().length === 1 ? 'clienta sin coordenadas' : 'clientas sin coordenadas' }}
                            </h3>
                            <p class="text-sm text-amber-700 mb-3">
                                No se puede optimizar bien hasta que todas tengan ubicación. Intenta geocodificar automáticamente:
                            </p>
                            <div class="flex flex-wrap gap-2 mb-3">
                                @for (row of selectedWithoutCoords(); track row.key) {
                                    <span class="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">{{ row.clientName }}</span>
                                }
                            </div>
                            <button (click)="autoGeocodeSelected()"
                                    [disabled]="geocodingNow()"
                                    class="px-5 py-2.5 rounded-xl bg-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-sm hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-60">
                                {{ geocodingNow() ? 'Geocodificando...' : '🪄 Geocodificar automático' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        }

        <!-- MAIN GRID -->
        <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">

            <!-- LEFT: SIDEBAR CANDIDATOS -->
            <div class="bg-white rounded-3xl shadow-sm border border-pink-100/60 overflow-hidden flex flex-col">
                <div class="p-5 border-b border-pink-50">
                    <h2 class="text-lg font-black text-pink-900 mb-3">Pendientes</h2>
                    <input type="text" [(ngModel)]="searchTerm" (ngModelChange)="onSearchChange()"
                           placeholder="🔍 Buscar clienta o tanda..."
                           class="w-full px-4 py-3 rounded-2xl border-2 border-pink-100 bg-pink-50/30 text-sm font-medium text-pink-900 placeholder-pink-300 focus:outline-none focus:border-pink-300 focus:bg-white transition-all">
                    <div class="flex gap-2 mt-3">
                        <button (click)="filterMode.set('all')"
                                [class.bg-pink-500]="filterMode() === 'all'" [class.text-white]="filterMode() === 'all'"
                                [class.bg-pink-50]="filterMode() !== 'all'" [class.text-pink-600]="filterMode() !== 'all'"
                                class="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all">
                            Todas ({{ candidates().length }})
                        </button>
                        <button (click)="filterMode.set('no-coords')"
                                [class.bg-amber-500]="filterMode() === 'no-coords'" [class.text-white]="filterMode() === 'no-coords'"
                                [class.bg-amber-50]="filterMode() !== 'no-coords'" [class.text-amber-600]="filterMode() !== 'no-coords'"
                                class="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all">
                            Sin dir ({{ noCoordsCount() }})
                        </button>
                        <button (click)="filterMode.set('tandas')"
                                [class.bg-fuchsia-500]="filterMode() === 'tandas'" [class.text-white]="filterMode() === 'tandas'"
                                [class.bg-fuchsia-50]="filterMode() !== 'tandas'" [class.text-fuchsia-600]="filterMode() !== 'tandas'"
                                class="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all">
                            Tandas ({{ tandasCount() }})
                        </button>
                    </div>
                    <div class="flex items-center justify-between mt-3 text-[11px] font-bold">
                        <button (click)="selectAllVisible()" class="text-pink-500 hover:underline">Seleccionar visibles</button>
                        <button (click)="clearSelection()" class="text-pink-400 hover:underline">Limpiar selección</button>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto p-3 max-h-[60vh]">
                    @if (loading()) {
                        <p class="text-center text-pink-300 italic text-sm py-8">Cargando pendientes...</p>
                    } @else if (visibleCandidates().length === 0) {
                        <p class="text-center text-pink-300 italic text-sm py-8">Nada por aquí 🌸</p>
                    }
                    @for (row of visibleCandidates(); track row.key) {
                        <label class="flex items-center gap-3 p-3 rounded-2xl cursor-pointer mb-1 transition-all"
                               [class.bg-pink-50]="selected().has(row.key)"
                               [class.border]="selected().has(row.key)"
                               [class.border-pink-200]="selected().has(row.key)"
                               [class.hover:bg-pink-50/40]="!selected().has(row.key)">
                            <input type="checkbox" [checked]="selected().has(row.key)"
                                   (change)="toggle(row.key)"
                                   class="w-5 h-5 rounded-md text-pink-500 focus:ring-pink-300 cursor-pointer">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <p class="text-sm font-bold text-pink-900 truncate">{{ row.clientName }}</p>
                                    @if (row.kind === 'Tanda') {
                                        <span class="px-1.5 py-0.5 bg-fuchsia-100 text-fuchsia-700 text-[9px] font-black rounded uppercase">Tanda</span>
                                    }
                                    @if (!row.hasCoords) {
                                        <span class="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded uppercase">Sin dir</span>
                                    }
                                </div>
                                @if (row.address) {
                                    <p class="text-[11px] text-pink-400 truncate">📍 {{ row.address }}</p>
                                }
                                @if (row.kind === 'Tanda' && row.tandaName) {
                                    <p class="text-[10px] text-fuchsia-500 truncate">{{ row.tandaName }}@if (row.tandaWeek) { · Semana {{ row.tandaWeek }} }</p>
                                }
                            </div>
                        </label>
                    }
                </div>
            </div>

            <!-- RIGHT: RUTA OPTIMIZADA EN VIVO -->
            <div class="bg-white rounded-3xl shadow-sm border border-pink-100/60 overflow-hidden flex flex-col">
                <div class="p-5 border-b border-pink-50 flex items-center justify-between">
                    <div>
                        <h2 class="text-lg font-black text-pink-900">Ruta óptima</h2>
                        <p class="text-[11px] text-pink-400">
                            @if (loadingPreview()) { Calculando con Google Routes... }
                            @else if ((preview()?.stops?.length ?? 0) === 0) { Selecciona pendientes para previsualizar }
                            @else { Orden calculado automáticamente }
                        </p>
                    </div>
                    @if (loadingPreview()) {
                        <div class="w-6 h-6 border-4 border-pink-100 border-t-pink-500 rounded-full animate-spin"></div>
                    }
                </div>

                <div class="flex-1 overflow-y-auto p-3 max-h-[60vh]">
                    @if ((preview()?.stops?.length ?? 0) === 0 && !loadingPreview()) {
                        <p class="text-center text-pink-300 italic text-sm py-8">
                            La ruta aparecerá aquí en vivo conforme selecciones clientas. ✨
                        </p>
                    }
                    @for (stop of preview()?.stops ?? []; track stop.kind + (stop.orderId ?? stop.tandaParticipantId)) {
                        <div class="flex items-center gap-3 p-3 rounded-2xl mb-1 hover:bg-pink-50/40 transition-all">
                            <div class="w-9 h-9 rounded-xl bg-pink-500 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                                {{ stop.sortOrder }}
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <p class="text-sm font-bold text-pink-900 truncate">{{ stop.clientName }}</p>
                                    @if (stop.kind === 'Tanda') {
                                        <span class="px-1.5 py-0.5 bg-fuchsia-100 text-fuchsia-700 text-[9px] font-black rounded uppercase">Tanda</span>
                                    }
                                    @if (!stop.hasCoords) {
                                        <span class="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded uppercase">Sin coords</span>
                                    }
                                </div>
                                @if (stop.clientAddress) {
                                    <p class="text-[11px] text-pink-400 truncate">📍 {{ stop.clientAddress }}</p>
                                }
                                @if (stop.kind === 'Tanda' && stop.tandaName) {
                                    <p class="text-[10px] text-fuchsia-500 truncate">{{ stop.tandaName }}@if (stop.tandaWeek) { · Semana {{ stop.tandaWeek }} }</p>
                                }
                            </div>
                            @if (stop.kind !== 'Tanda' && stop.total > 0) {
                                <span class="text-xs font-black text-emerald-500 shrink-0">{{ stop.total | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
                            }
                        </div>
                    }
                </div>

                @if ((preview()?.skipped?.length ?? 0) > 0) {
                    <div class="border-t border-amber-100 p-4 bg-amber-50/50">
                        <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">
                            {{ preview()?.skipped?.length }} {{ preview()?.skipped?.length === 1 ? 'rechazada' : 'rechazadas' }}
                        </p>
                        @for (s of preview()?.skipped ?? []; track s.id) {
                            <p class="text-[11px] text-amber-600">· {{ s.name }} ({{ s.reason }})</p>
                        }
                    </div>
                }
            </div>
        </div>
    </div>
    `,
    styles: []
})
export class RouteBuilderComponent implements OnInit {
    private api = inject(ApiService);
    private toast = inject(ToastService);
    private router = inject(Router);

    pendingOrders = signal<OrderSummaryDto[]>([]);
    availableTandas = signal<AvailableTandaDto[]>([]);
    loading = signal(true);

    selected = signal<Set<StopKey>>(new Set());
    searchTerm = '';
    searchSignal = signal('');
    filterMode = signal<'all' | 'no-coords' | 'tandas'>('all');

    preview = signal<PreviewRouteResponse | null>(null);
    loadingPreview = signal(false);
    saving = signal(false);
    geocodingNow = signal(false);

    private previewTrigger$ = new Subject<void>();

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
        if (src === 'haversine-fallback') return '↪️ Haversine (fallback)';
        if (src === 'no-coords') return '⚠️ Sin coords';
        return src;
    });

    constructor() {
        // Cuando cambian las selecciones, dispara preview con debounce.
        effect(() => {
            // Suscribirse a cambios reactivos. Necesitamos leer aquí para que effect se dispare.
            const _ = this.selected().size;
            this.previewTrigger$.next();
        }, { allowSignalWrites: true });

        this.previewTrigger$.pipe(debounceTime(500)).subscribe(() => this.refreshPreview());
    }

    ngOnInit(): void {
        this.loadCandidates();
    }

    loadCandidates(): void {
        this.loading.set(true);
        // Cargamos en paralelo: orders pendientes + tandas disponibles esta semana
        let ordersLoaded = false, tandasLoaded = false;
        const done = () => { if (ordersLoaded && tandasLoaded) this.loading.set(false); };

        this.api.getOrders().subscribe({
            next: (items: OrderSummaryDto[]) => {
                const eligible = (items ?? []).filter(o =>
                    o.status !== 'Canceled' && o.status !== 'Delivered'
                    && o.orderType !== 'PickUp' && !o.deliveryRouteId
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
        // OrderSummaryDto no incluye lat/lng directo; usamos clientAddress como heurística:
        // si tiene dirección asumimos que el backend la geocodeará. La validación dura
        // viene de la respuesta del preview (stopsWithoutCoords).
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
        this.api.previewRoute(orderIds, tandaIds).subscribe({
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
        // PreOptimized=true porque ya nos vino el orden óptimo del preview.
        this.api.createRoute(orderIds, false, tandaIds, true).subscribe({
            next: (res) => {
                this.saving.set(false);
                if (res.skipped && res.skipped.length > 0) {
                    this.toast.error(`Ruta creada con avisos: ${res.skipped.length} no entraron`);
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
