import { Component, OnInit, OnDestroy, signal, computed, ElementRef, ViewChild, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
import { ApiService } from '../../../core/services/api.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { GpsService } from '../../../core/services/gps.service';
import { OrderStatus, ORDER_STATUS_LABELS } from '../../../core/models';
import { effect } from '@angular/core';

declare const google: any;

/** GPS key for localStorage persistence */
const GPS_KEY = 'regi_gps_granted';

@Component({
    selector: 'app-route-view',
    standalone: true,
    imports: [CommonModule, FormsModule, DragDropModule],
    templateUrl: './route-view.component.html',
    styleUrl: './route-view.component.css'
})
export class RouteViewComponent implements OnInit, OnDestroy {
    @ViewChild('mapContainer') mapEl?: ElementRef;
    @ViewChild('clientChatScroll') clientChatScroll?: ElementRef;

    private routeParam = inject(ActivatedRoute);
    private api = inject(ApiService);
    private signalr = inject(SignalRService);
    private push = inject(PushNotificationService);
    public gps = inject(GpsService);

    route = signal<any>(null);
    loading = signal(true);
    gpsActive = this.gps.active;
    expandedId = signal(0);
    toastMsg = signal('');

    deliveredCount = computed(() => this.route()?.deliveries?.filter((d: any) => d.status === 'Delivered').length || 0);
    progressPercent = computed(() => {
        const r = this.route();
        if (!r || !r.deliveries?.length) return 0;
        return (this.deliveredCount() / r.deliveries.length) * 100;
    });
    totalCobrado = computed(() => {
        const r = this.route();
        if (!r) return 0;
        return r.deliveries?.filter((d: any) => d.status === 'Delivered').reduce((s: number, d: any) => s + (d.total || 0), 0) || 0;
    });
    totalGastos = computed(() => this.route()?.expenses?.reduce((s: number, e: any) => s + e.amount, 0) || 0);

    activeChatDelivery = signal<any>(null);
    clientChatMessages = signal<any[]>([]);
    newClientMessage = '';

    isCamiListening = signal(false);
    private listeningTimer: any;
    private isLongPress = false;

    isCardExpanded = signal(true);
    swipeProgress = signal(0); // 0 to 100
    private isSwiping = false;
    private startX = 0;

    nextDelivery = computed(() => {
        const r = this.route();
        if (!r || !r.deliveries) return null;
        return r.deliveries.find((d: any) => d.status === 'Pending' || d.status === 'InTransit');
    });

    showExpenseModal = signal(false);
    showReorderModal = signal(false);
    submittingExpense = signal(false);
    failModalId = signal(0);
    selectedReason = signal('');
    customReason = '';
    failReasons = ['No estaba 🏠', 'Dirección incorrecta 📍', 'No contestó 📱', 'Rechazó pedido ❌'];

    deliveryNotes: Record<number, string> = {};
    paymentMethods: Record<number, string> = {};
    photos: Record<number, { file: File; preview: string }[]> = {};
    expenseForm = { type: 'Gasolina', amount: null as number | null, notes: '', photo: null as File | null };

    private token = '';
    mapInitialized = false;
    map: any;
    directionsService: any;
    directionsRenderer: any;
    fullRouteRenderer: any;
    markers: any[] = [];

    // Navigation Overlay Signals
    navEta = signal<string>('');
    navDistance = signal<string>('');
    navNextAddress = signal<string>('');
    navNextClient = signal<string>('');
    private lastRouteCalcLat = 0;
    private lastRouteCalcLng = 0;
    private lastRouteCalcDestId = 0;
    private driverMarker: any;
    private clientMsgIds = new Set<number | string>();

    constructor() {
        // React to GPS position changes globally from the service
        effect(() => {
            const pos = this.gps.lastPosition();
            if (pos && this.map) {
                this.updateDriverMarker(pos.lat, pos.lng);
                this.updateRouteDirection();
            }
        });
    }

    ngOnInit(): void {
        this.token = this.routeParam.snapshot.paramMap.get('token') || '';
        this.loadRoute();

        this.signalr.clientChatUpdate$.subscribe(msg => {
            if (this.clientMsgIds.has(msg.id)) return;
            this.clientMsgIds.add(msg.id);
            if (this.activeChatDelivery()?.id === msg.deliveryId) {
                this.clientChatMessages.update(msgs => [...msgs, msg]);
                this.scrollTo('client');
            } else {
                this.showToast('🌸 Mensaje de clienta');
            }
        });

        this.signalr.routeUpdated$.subscribe(() => {
            this.showToast('🔄 ¡Ruta actualizada por la base!');
            this.loadRoute();
        });

        this.initPush();
    }

    private initPush(): void {
        this.push.requestPermission().then(granted => {
            if (granted) this.push.subscribeToNotifications('driver', { routeToken: this.token });
        });
    }

    ngOnDestroy(): void {
        this.signalr.disconnect();
    }

    // ═══ WALKIE-TALKIE ═══
    startCamiListening(event: MouseEvent | TouchEvent): void {
        // Ignorar si el click es en un botón o elemento interactivo
        const target = event.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('select') || target.closest('label')) {
            return;
        }

        if (this.isCamiListening()) return;

        this.isLongPress = false;
        this.listeningTimer = setTimeout(() => {
            this.isLongPress = true;
            this.isCamiListening.set(true);
            // Vibración táctil si es posible
            if ('vibrate' in navigator) navigator.vibrate(50);
        }, 500); // 500ms para considerar long press
    }

    stopCamiListening(): void {
        if (this.listeningTimer) {
            clearTimeout(this.listeningTimer);
            this.listeningTimer = null;
        }

        if (this.isCamiListening()) {
            this.isCamiListening.set(false);
            // Aquí iría la lógica para enviar el comando a CAMI
        }
        this.isLongPress = false;
    }
    
    onContextMenu(event: MouseEvent): void {
        // Solo prevenir si estamos en medio de un long press o escuchando
        if (this.isLongPress || this.isCamiListening()) {
            event.preventDefault();
        }
    }

    // ═══ SWIPE TO DELIVER ═══
    onSwipeStart(event: MouseEvent | TouchEvent): void {
        event.stopPropagation(); // Evitar que C.A.M.I. se active al deslizar
        this.isSwiping = true;
        this.startX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    }

    onSwipeMove(event: MouseEvent | TouchEvent): void {
        if (!this.isSwiping) return;
        const currentX = 'touches' in event ? event.touches[0].clientX : event.clientX;
        const deltaX = currentX - this.startX;
        const buttonWidth = (event.currentTarget as HTMLElement).offsetWidth;
        
        let progress = (deltaX / (buttonWidth * 0.8)) * 100;
        progress = Math.max(0, Math.min(100, progress));
        this.swipeProgress.set(progress);
    }

    onSwipeEnd(deliveryId: number): void {
        if (!this.isSwiping) return;
        this.isSwiping = false;
        
        if (this.swipeProgress() >= 90) {
            this.markDelivered(deliveryId);
        }
        
        this.swipeProgress.set(0);
    }

    toggleCard(): void {
        this.isCardExpanded.update(v => !v);
    }

    private loadRoute(): void {
        this.api.getDriverRoute(this.token).subscribe({
            next: (r: any) => {
                r.deliveries.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
                this.route.set(r);
                this.loading.set(false);
                this.signalr.connect().then(() => this.signalr.joinRoute(this.token));
                setTimeout(() => this.initMap(r), 150);
                this.startGps();
            },
            error: () => this.loading.set(false)
        });
    }

    // ═══ GPS ═══
    startGps(): void {
        this.gps.start(this.token);
    }

    centerOnMe(): void {
        const pos = this.gps.lastPosition();
        if (pos && this.map) { 
            this.map.panTo({ lat: pos.lat, lng: pos.lng }); 
            this.map.setZoom(16); 
        }
    }

    private updateDriverMarker(lat: number, lng: number): void {
        const pos = { lat, lng };
        if (!this.driverMarker) {
            this.driverMarker = new google.maps.Marker({
                position: pos, map: this.map,
                icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#3B82F6', fillOpacity: 1, strokeColor: 'white', strokeWeight: 3 },
                zIndex: 1000
            });
        } else { this.driverMarker.setPosition(pos); }
    }

    // Haversine distance in meters
    private getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371e3;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Calls DirectionsService to draw the route line to the next pending stop.
    // Kept separate from plotRoute so GPS updates don't redraw markers or change viewport.
    private updateRouteDirection(forceCalc = false): void {
        const r = this.route();
        const pos = this.gps.lastPosition();
        if (!pos || !this.map || !r || !this.directionsService) return;
        const pending = r.deliveries.filter((d: any) => d.status !== 'Delivered' && d.status !== 'NotDelivered' && d.latitude);
        if (!pending.length) {
            if (this.directionsRenderer) this.directionsRenderer.setDirections({ routes: [] });
            if (this.fullRouteRenderer) this.fullRouteRenderer.setDirections({ routes: [] });
            return;
        }

        const origin = new google.maps.LatLng(pos.lat, pos.lng);
        const dest = new google.maps.LatLng(pending[0].latitude, pending[0].longitude);

        // Update Overlay UI
        this.navNextAddress.set(pending[0].address || pending[0].clientAddress || 'Sin dirección');
        this.navNextClient.set(pending[0].clientName);

        // SMART AUTO-CENTERING
        // We removed the aggressive fitBounds to ensure the driver stays centered in the view, 
        // as watchPosition already calls map.panTo(driverLocation) every second.

        // Throttle API usage
        const distMoved = this.getDistance(pos.lat, pos.lng, this.lastRouteCalcLat, this.lastRouteCalcLng);
        if (!forceCalc && pending[0].id === this.lastRouteCalcDestId && distMoved < 50) return;

        this.lastRouteCalcLat = pos.lat;
        this.lastRouteCalcLng = pos.lng;
        this.lastRouteCalcDestId = pending[0].id;

        // 1. NEON ROUTE (Next Leg)
        this.directionsService.route(
            { origin, destination: dest, travelMode: google.maps.TravelMode.DRIVING },
            (result: any, status: string) => {
                if (status === 'OK') {
                    this.directionsRenderer.setOptions({
                        polylineOptions: { strokeColor: '#f472b6', strokeWeight: 6, strokeOpacity: 0.9 }
                    });
                    this.directionsRenderer.setDirections(result);
                    const leg = result.routes[0].legs[0];
                    if (leg && leg.duration && leg.distance) {
                        this.navEta.set(leg.duration.text);
                        this.navDistance.set(leg.distance.text);
                    }
                } else {
                    console.warn('[RouteView] DirectionsService status:', status);
                    this.navEta.set('');
                    this.navDistance.set('');
                }
            }
        );

        // 2. PREDICTIVE MULTI-ROUTING (Faded full day route for context)
        if (pending.length > 1) {
            const waypoints = pending.slice(0, Math.min(pending.length - 1, 20)).map((d: any) => ({
                location: new google.maps.LatLng(d.latitude, d.longitude),
                stopover: true
            }));
            const finalDest = pending[Math.min(pending.length - 1, 20)];
            const fullDest = new google.maps.LatLng(finalDest.latitude, finalDest.longitude);

            this.directionsService.route(
                { origin, destination: fullDest, waypoints, travelMode: google.maps.TravelMode.DRIVING },
                (result: any, status: string) => {
                    if (status === 'OK') {
                        this.fullRouteRenderer.setDirections(result);
                    }
                }
            );
        } else {
            if (this.fullRouteRenderer) this.fullRouteRenderer.setDirections({ routes: [] });
        }
    }

    // ═══ MAP ═══
    private async initMap(route: any): Promise<void> {
        if (!this.mapEl?.nativeElement || typeof google === 'undefined') return;
        // Create the map only once — subsequent loadRoute() calls must not recreate it
        if (!this.map) {
            this.map = new google.maps.Map(this.mapEl.nativeElement, {
                center: { lat: 27.48, lng: -99.50 }, zoom: 13, disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy'
            });
            this.directionsService = new google.maps.DirectionsService();
            this.directionsRenderer = new google.maps.DirectionsRenderer({
                map: this.map, suppressMarkers: true,
                polylineOptions: { strokeColor: '#db2777', strokeWeight: 4, strokeOpacity: 0.8 }
            });
            this.fullRouteRenderer = new google.maps.DirectionsRenderer({
                map: this.map, suppressMarkers: true,
                polylineOptions: { strokeColor: '#a1a1aa', strokeWeight: 3, strokeOpacity: 0.4 }
            });
        }
        // Geocode any deliveries that lack coordinates (they are not persisted by the backend)
        await this.geocodeDeliveries(route);
        this.plotRoute(route);
        this.updateRouteDirection(true);
    }

    // Geocodes delivery addresses that are missing lat/lng using the Google Geocoder API.
    // Results are stored directly on the delivery objects (in-memory only).
    private geocodeDeliveries(route: any): Promise<void> {
        if (typeof google === 'undefined') return Promise.resolve();
        const geocoder = new google.maps.Geocoder();
        const needsGeocode = route.deliveries.filter(
            (d: any) => !d.latitude && (d.address || d.clientAddress)
        );
        if (!needsGeocode.length) return Promise.resolve();

        const tasks = needsGeocode.map((d: any) => {
            const raw = (d.address || d.clientAddress || '').trim();
            if (!raw) return Promise.resolve();
            const full = raw.toLowerCase().includes('nuevo laredo')
                ? `${raw}, Tamaulipas, México`
                : `${raw}, Nuevo Laredo, Tamaulipas, México`;
            return new Promise<void>(resolve => {
                geocoder.geocode({ address: full, region: 'mx' }, (results: any, status: string) => {
                    if (status === 'OK' && results?.[0]) {
                        d.latitude = results[0].geometry.location.lat();
                        d.longitude = results[0].geometry.location.lng();
                    } else {
                        console.warn(`[RouteView] Geocode failed for "${raw}":`, status);
                    }
                    resolve();
                });
            });
        });
        return Promise.all(tasks).then(() => { });
    }

    private plotRoute(route: any): void {
        if (!this.map) return;
        this.markers.forEach((m: any) => m.setMap(null));
        this.markers = [];
        const bounds = new google.maps.LatLngBounds();

        route.deliveries.forEach((d: any) => {
            if (!d.latitude) return;
            const pos = { lat: d.latitude, lng: d.longitude };
            bounds.extend(pos);
            let fillColor = '#ec4899';
            if (d.status === 'InTransit') fillColor = '#3B82F6';
            else if (d.status === 'Delivered') fillColor = '#059669';
            else if (d.status === 'NotDelivered') fillColor = '#dc2626';
            const marker = new google.maps.Marker({
                position: pos, map: this.map,
                label: { text: d.sortOrder.toString(), color: 'white', fontWeight: 'bold', fontSize: '11px' },
                icon: { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor, fillOpacity: 1, strokeColor: 'white', strokeWeight: 2 },
                zIndex: d.status === 'InTransit' ? 10 : 5
            });
            this.markers.push(marker);
        });
        if (!bounds.isEmpty()) this.map.fitBounds(bounds, 40);
    }

    // ═══ ROUTE ACTIONS ═══
    startRoute(): void {
        this.api.startRoute(this.token).subscribe(() => { this.showToast('🚀 ¡Ruta Iniciada!'); this.loadRoute(); });
    }
    markInTransit(id: number): void {
        this.api.markInTransit(this.token, id).subscribe(() => { this.showToast('🏃 En camino'); this.loadRoute(); });
    }
    markDelivered(id: number): void {
        const notes = this.deliveryNotes[id] || '';
        const photoFiles = (this.photos[id] || []).map(p => p.file);
        const method = this.paymentMethods[id];
        const delivery = this.route()?.deliveries?.find((d: any) => d.id === id);
        const due = delivery?.balanceDue ?? delivery?.total ?? 0;
        const payments = method && due > 0 ? [{ amount: due, method }] : undefined;
        this.api.markDelivered(this.token, id, notes, photoFiles, payments).subscribe(() => {
            this.showToast(`¡${ORDER_STATUS_LABELS[2]}! ✨`);
            this.photos[id] = []; this.deliveryNotes[id] = ''; this.loadRoute();
        });
    }

    // ═══ FAIL ═══
    showFailModalFn(id: number): void { this.failModalId.set(id); this.selectedReason.set(''); this.customReason = ''; }
    cancelFail(): void { this.failModalId.set(0); }
    confirmFail(): void {
        const reason = this.selectedReason() || this.customReason.trim();
        if (!reason) return;
        this.api.markFailed(this.token, this.failModalId(), reason, this.customReason, []).subscribe(() => {
            this.showToast('📝 Registrado'); this.failModalId.set(0); this.loadRoute();
        });
    }

    // ═══ EXPENSES ═══
    openExpenseModal(): void { this.showExpenseModal.set(true); }
    closeExpenseModal(): void { this.showExpenseModal.set(false); this.expenseForm = { type: 'Gasolina', amount: null, notes: '', photo: null }; }
    
    openReorderModal(): void { this.showReorderModal.set(true); }
    closeReorderModal(): void { this.showReorderModal.set(false); }

    onExpensePhoto(e: Event): void { this.expenseForm.photo = (e.target as HTMLInputElement).files?.[0] || null; }
    submitExpense(): void {
        if (!this.expenseForm.amount) return;
        this.submittingExpense.set(true);
        this.api.addDriverExpense(this.token, this.expenseForm).subscribe({
            next: () => { this.showToast('💰 Gasto registrado'); this.closeExpenseModal(); this.submittingExpense.set(false); },
            error: () => { this.showToast('Error al registrar gasto'); this.submittingExpense.set(false); }
        });
    }

    // ═══ CLIENT CHAT ═══
    openClientChat(delivery: any, event: Event): void {
        event.stopPropagation(); this.activeChatDelivery.set(delivery); this.newClientMessage = '';
        this.api.getDriverClientChat(this.token, delivery.id).subscribe(msgs => {
            this.clientMsgIds.clear(); msgs.forEach((m: any) => this.clientMsgIds.add(m.id));
            this.clientChatMessages.set(msgs); this.scrollTo('client');
        });
    }
    closeClientChat(): void { this.activeChatDelivery.set(null); this.clientChatMessages.set([]); this.clientMsgIds.clear(); }
    sendClientChat(): void {
        const delivery = this.activeChatDelivery(); const text = this.newClientMessage.trim();
        if (!text || !delivery) return; this.newClientMessage = '';
        this.api.sendDriverClientMessage(this.token, delivery.id, text).subscribe(msg => {
            if (!this.clientMsgIds.has(msg.id)) { this.clientMsgIds.add(msg.id); this.clientChatMessages.update(m => [...m, msg]); }
            this.scrollTo('client');
        });
    }

    // ═══ HELPERS ═══
    toggleExpand(id: number): void { this.expandedId.set(this.expandedId() === id ? 0 : id); }
    formatTime(d: string): string { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    showToast(m: string): void { this.toastMsg.set(m); setTimeout(() => this.toastMsg.set(''), 3000); }
    getPhotos(id: number): { file: File; preview: string }[] { return this.photos[id] || []; }
    removePhoto(id: number, i: number): void { if (this.photos[id]) this.photos[id].splice(i, 1); }

    onPhotoCapture(e: Event, id: number): void {
        const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
            const img = new Image(); img.src = re.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 1000; let w = img.width, h = img.height;
                if (w > MAX) { h = h * (MAX / w); w = MAX; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
                canvas.toBlob(blob => {
                    if (!blob) return;
                    const cf = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), { type: 'image/jpeg' });
                    if (!this.photos[id]) this.photos[id] = [];
                    this.photos[id].push({ file: cf, preview: canvas.toDataURL('image/jpeg', 0.8) });
                }, 'image/jpeg', 0.8);
            };
        };
        reader.readAsDataURL(file);
        (e.target as HTMLInputElement).value = '';
    }

    navigateTo(d: any): void {
        const url = d.latitude && d.longitude
            ? `https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}`
            : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((d.address || d.clientAddress || '') + ', Nuevo Laredo, Tamaulipas, México')}`;
        window.open(url, '_blank');
    }

    openGoogleRoute(r: any): void {
        const pending = r.deliveries.filter((d: any) => d.status !== 'Delivered' && d.status !== 'NotDelivered');
        if (pending.length === 0) {
            this.showToast('No hay entregas pendientes');
            return;
        }

        // Trazar ruta turn-by-turn EXCLUSIVAMENTE a la siguiente parada (Posición 1 en la cola actual)
        const nextDelivery = pending[0];
        if (nextDelivery.latitude && nextDelivery.longitude) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${nextDelivery.latitude},${nextDelivery.longitude}&travelmode=driving`, '_blank');
        } else {
            // Fallback por texto si no hay coords precisas
            const addr = nextDelivery.address || nextDelivery.clientAddress;
            if (addr) window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`, '_blank');
            else this.showToast('La siguiente entrega no tiene dirección válida');
        }
    }

    onDropDelivery(event: CdkDragDrop<any[]>): void {
        const route = this.route(); if (!route) return;
        moveItemInArray(route.deliveries, event.previousIndex, event.currentIndex);
        route.deliveries.forEach((del: any, i: number) => del.sortOrder = i + 1);
        const ids = route.deliveries.map((d: any) => d.id);
        this.route.set({ ...route });
        this.plotRoute(route);
        this.updateRouteDirection(); // Re-draw route line to new next stop
        this.api.driverReorderRouteDeliveries(this.token, ids).subscribe({
            next: () => {
                this.showToast('✅ Nuevo orden guardado. Recalculando...');
                this.loadRoute(); // Auto-Transition & Trigger Backend SignalR events globally
            },
            error: () => { this.showToast('Error al guardar 😿'); this.loadRoute(); }
        });
    }

    private scrollTo(chat: 'client'): void {
        setTimeout(() => {
            const el = this.clientChatScroll;
            if (el?.nativeElement) el.nativeElement.scrollTop = el.nativeElement.scrollHeight;
        }, 60);
    }

    @HostListener('document:visibilitychange')
    onVisibilityChange(): void { if (document.visibilityState === 'visible') this.loadRoute(); }
}
