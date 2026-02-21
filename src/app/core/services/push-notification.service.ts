import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class PushNotificationService {
    private readonly VAPID_PUBLIC_KEY = 'BNR4b92lH7N43gqzFmXlXmNmsw09EvIiNAyhqKj0j1M66oVMXYX3MRFB3fec3iOrupzPnWe1l7k9Un8o_itTJYs';
    private apiUrl = environment.apiUrl;
    private permissionGranted = false;

    constructor(private swPush: SwPush, private http: HttpClient) {
        if ('Notification' in window) {
            this.permissionGranted = Notification.permission === 'granted';
        }
    }

    // ═══════════════════════════════════════════
    //  SUSCRIPCIÓN PUSH (Backend)
    // ═══════════════════════════════════════════

    subscribeToNotifications(clientId?: number) {
        if (!this.swPush.isEnabled) {
            console.warn('🛠️ Service Worker - Push no está habilitado en este navegador.');
            return;
        }

        this.swPush.requestSubscription({
            serverPublicKey: this.VAPID_PUBLIC_KEY
        })
            .then(sub => {
                const payload = {
                    ...sub.toJSON(),
                    clientId: clientId
                };

                this.http.post(`${this.apiUrl}/push/subscribe`, payload).subscribe({
                    next: () => console.log('✅ Push subscription registrada en servidor.'),
                    error: err => console.error('❌ Error guardando push subscription', err)
                });
            })
            .catch(err => console.error('No se pudo suscribir a notificaciones', err));
    }

    unsubscribeFromNotifications() {
        this.swPush.subscription.subscribe(sub => {
            if (sub) {
                this.http.delete(`${this.apiUrl}/push/unsubscribe?endpoint=${encodeURIComponent(sub.endpoint)}`)
                    .subscribe();
                sub.unsubscribe().catch(err => console.error('Client unsubscribe failed', err));
            }
        });
    }

    // ═══════════════════════════════════════════
    //  PERMISO DE NOTIFICACIONES (Browser API)
    // ═══════════════════════════════════════════

    /**
     * Solicita permiso de notificaciones al navegador.
     * Retorna true si fue concedido.
     */
    async requestPermission(): Promise<boolean> {
        if (!('Notification' in window)) {
            console.warn('Este navegador no soporta notificaciones');
            return false;
        }

        if (Notification.permission === 'granted') {
            this.permissionGranted = true;
            return true;
        }

        if (Notification.permission === 'denied') {
            console.warn('🚫 Notificaciones bloqueadas por el usuario');
            return false;
        }

        const result = await Notification.requestPermission();
        this.permissionGranted = result === 'granted';
        return this.permissionGranted;
    }

    get hasPermission(): boolean {
        return this.permissionGranted;
    }

    // ═══════════════════════════════════════════
    //  NOTIFICACIONES LOCALES
    // ═══════════════════════════════════════════

    /**
     * Muestra una notificación local del navegador.
     * Solo se muestra si:
     *   - El usuario ya dio permiso
     *   - El tab NO tiene foco (para no molestar si ya está viendo la app)
     *
     * Si hay Service Worker activo, usa ServiceWorkerRegistration.showNotification()
     * (funciona mejor en móvil y cuando el tab está en background).
     * Si no, usa el constructor Notification() como fallback.
     */
    showLocalNotification(
        title: string,
        body: string,
        options?: {
            icon?: string;
            tag?: string;       // Agrupa notificaciones del mismo tipo (reemplaza en vez de apilar)
            data?: any;         // Data extra para el click handler del SW
            requireInteraction?: boolean;
            silent?: boolean;
        }
    ): void {
        if (!this.permissionGranted) return;

        // Si el tab tiene foco, no molestamos con notificación del sistema
        if (document.hasFocus()) return;

        const notifOptions: NotificationOptions = {
            body,
            icon: options?.icon || '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/icon-72x72.png',
            tag: options?.tag,
            data: options?.data,
            requireInteraction: options?.requireInteraction ?? false,
            silent: options?.silent ?? false,
        };

        try {
            // Preferimos Service Worker (funciona en background y móvil)
            if (navigator.serviceWorker?.controller) {
                navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification(title, notifOptions);
                }).catch(() => {
                    // Fallback al constructor directo
                    this.fallbackNotification(title, notifOptions);
                });
            } else {
                this.fallbackNotification(title, notifOptions);
            }
        } catch (err) {
            console.warn('Error mostrando notificación:', err);
        }
    }

    private fallbackNotification(title: string, options: NotificationOptions): void {
        try {
            const n = new Notification(title, options);
            // Auto-cerrar después de 6 segundos
            setTimeout(() => n.close(), 6000);
        } catch (err) {
            console.warn('Fallback notification failed:', err);
        }
    }

    // ═══════════════════════════════════════════
    //  NOTIFICACIONES ESPECÍFICAS (Helpers)
    // ═══════════════════════════════════════════

    /** 💬 Mensaje de chat nuevo */
    notifyNewMessage(senderName: string, messagePreview: string, context: 'client' | 'driver' | 'admin'): void {
        const titles: Record<string, string> = {
            client: '💬 Mensaje de tu repartidor',
            driver: `🌸 Mensaje de ${senderName}`,
            admin: `💬 Mensaje del chofer`,
        };

        this.showLocalNotification(
            titles[context] || '💬 Nuevo mensaje',
            messagePreview.length > 80 ? messagePreview.substring(0, 80) + '...' : messagePreview,
            { tag: `chat-${context}-${senderName}` }
        );
    }

    /** 🚗 Chofer en camino hacia la clienta (InTransit) */
    notifyDriverEnRoute(): void {
        this.showLocalNotification(
            '🚗 ¡Tu pedido va en camino!',
            `El repartidor salió hacia tu domicilio. ¡Prepárate! 💕`,
            { tag: 'driver-en-route', requireInteraction: true }
        );
    }

    /** 📍 Chofer cerca del domicilio (< 500m) */
    notifyDriverNearby(distanceMeters: number): void {
        const distText = distanceMeters < 100
            ? 'a menos de 100 metros'
            : `a ${Math.round(distanceMeters)} metros`;

        this.showLocalNotification(
            '📍 ¡El repartidor está muy cerca!',
            `Tu repartidor se encuentra ${distText} de tu domicilio. ¡Ya casi llega! 🎉`,
            { tag: 'driver-nearby', requireInteraction: true }
        );
    }

    /** 💝 Pedido entregado */
    notifyDelivered(): void {
        this.showLocalNotification(
            '💝 ¡Pedido entregado!',
            '¡Tu pedido ha sido entregado! Gracias por tu compra 🌸',
            { tag: 'delivered' }
        );
    }

    // ═══════════════════════════════════════════
    //  CÁLCULO DE PROXIMIDAD (Haversine)
    // ═══════════════════════════════════════════

    /**
     * Calcula la distancia en metros entre dos coordenadas
     * usando la fórmula de Haversine (precisión suficiente para distancias cortas).
     */
    calculateDistance(
        lat1: number, lng1: number,
        lat2: number, lng2: number
    ): number {
        const R = 6_371_000; // Radio de la Tierra en metros
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);

        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Verifica si el chofer está dentro del rango de proximidad de la clienta.
     * @param thresholdMeters - Distancia en metros (default: 500)
     * @returns { isNearby: boolean, distance: number }
     */
    checkProximity(
        driverLat: number, driverLng: number,
        clientLat: number, clientLng: number,
        thresholdMeters = 500
    ): { isNearby: boolean; distance: number } {
        const distance = this.calculateDistance(driverLat, driverLng, clientLat, clientLng);
        return {
            isNearby: distance <= thresholdMeters,
            distance
        };
    }

    private toRad(degrees: number): number {
        return degrees * (Math.PI / 180);
    }
}