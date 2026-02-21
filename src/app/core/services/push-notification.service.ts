import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type PushRole = 'client' | 'driver' | 'admin';

@Injectable({
    providedIn: 'root'
})
export class PushNotificationService {
    private readonly VAPID_PUBLIC_KEY = 'BNR4b92lH7N43gqzFmXlXmNmsw09EvIiNAyhqKj0j1M66oVMXYX3MRFB3fec3iOrupzPnWe1l7k9Un8o_itTJYs';
    private apiUrl = environment.apiUrl;
    private permissionGranted = false;
    private subscribed = false; // Evita suscribir múltiples veces

    constructor(private swPush: SwPush, private http: HttpClient) {
        if ('Notification' in window) {
            this.permissionGranted = Notification.permission === 'granted';
        }
    }

    // ═══════════════════════════════════════════
    //  PERMISO DE NOTIFICACIONES
    // ═══════════════════════════════════════════

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
    //  SUSCRIPCIÓN PUSH (con Role)
    // ═══════════════════════════════════════════

    /**
     * Suscribe al navegador para recibir push del servidor.
     * Ahora soporta roles: 'client', 'driver', 'admin'.
     *
     * Ejemplos:
     *   subscribeToNotifications('client', { clientId: 42 })
     *   subscribeToNotifications('driver', { driverRouteToken: 'abc123' })
     *   subscribeToNotifications('admin')
     */
    subscribeToNotifications(
        role: PushRole = 'client',
        options?: { clientId?: number; driverRouteToken?: string }
    ): void {
        if (this.subscribed) return; // Ya se suscribió en esta sesión

        if (!this.swPush.isEnabled) {
            console.warn('🛠️ Service Worker Push no habilitado.');
            return;
        }

        this.swPush.requestSubscription({
            serverPublicKey: this.VAPID_PUBLIC_KEY
        })
            .then(sub => {
                const payload: any = {
                    ...sub.toJSON(),
                    role,
                    clientId: options?.clientId || null,
                    driverRouteToken: options?.driverRouteToken || null
                };

                this.http.post(`${this.apiUrl}/push/subscribe`, payload).subscribe({
                    next: () => {
                        this.subscribed = true;
                        console.log(`✅ Push subscription registrada (role: ${role})`);
                    },
                    error: err => console.error('❌ Error guardando push subscription', err)
                });
            })
            .catch(err => console.error('No se pudo suscribir a notificaciones', err));
    }

    unsubscribeFromNotifications(): void {
        this.swPush.subscription.subscribe(sub => {
            if (sub) {
                this.http.delete(`${this.apiUrl}/push/unsubscribe?endpoint=${encodeURIComponent(sub.endpoint)}`)
                    .subscribe();
                sub.unsubscribe().catch(err => console.error('Client unsubscribe failed', err));
                this.subscribed = false;
            }
        });
    }

    // ═══════════════════════════════════════════
    //  NOTIFICACIONES LOCALES (Browser API)
    // ═══════════════════════════════════════════

    /**
     * Muestra notificación local del navegador.
     * Solo se muestra si el tab NO tiene foco.
     * Usa ServiceWorker si está disponible, Notification() como fallback.
     */
    showLocalNotification(
        title: string,
        body: string,
        options?: {
            icon?: string;
            tag?: string;
            data?: any;
            requireInteraction?: boolean;
            silent?: boolean;
        }
    ): void {
        if (!this.permissionGranted) return;
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
            if (navigator.serviceWorker?.controller) {
                navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification(title, notifOptions);
                }).catch(() => this.fallbackNotification(title, notifOptions));
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
            setTimeout(() => n.close(), 6000);
        } catch (err) {
            console.warn('Fallback notification failed:', err);
        }
    }

    // ═══════════════════════════════════════════
    //  HELPERS DE NOTIFICACIÓN POR CONTEXTO
    // ═══════════════════════════════════════════

    /** 💬 Mensaje de chat nuevo */
    notifyNewMessage(senderName: string, messagePreview: string, context: 'client' | 'driver' | 'admin'): void {
        const titles: Record<string, string> = {
            client: '💬 Mensaje de tu repartidor',
            driver: `🌸 Mensaje de ${senderName}`,
            admin: '💬 Mensaje del chofer',
        };

        this.showLocalNotification(
            titles[context] || '💬 Nuevo mensaje',
            messagePreview.length > 80 ? messagePreview.substring(0, 80) + '...' : messagePreview,
            { tag: `chat-${context}-${senderName}` }
        );
    }

    /** 🚗 Chofer en camino (InTransit) */
    notifyDriverEnRoute(driverName?: string): void {
        this.showLocalNotification(
            '🚗 ¡Tu pedido va en camino!',
            `${driverName || 'El repartidor'} salió hacia tu domicilio. ¡Prepárate! 💕`,
            { tag: 'driver-en-route', requireInteraction: true }
        );
    }

    /** 📍 Chofer cerca (< 500m) */
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
    //  PROXIMIDAD (Haversine)
    // ═══════════════════════════════════════════

    calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6_371_000;
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    checkProximity(
        driverLat: number, driverLng: number,
        clientLat: number, clientLng: number,
        thresholdMeters = 500
    ): { isNearby: boolean; distance: number } {
        const distance = this.calculateDistance(driverLat, driverLng, clientLat, clientLng);
        return { isNearby: distance <= thresholdMeters, distance };
    }

    private toRad(degrees: number): number {
        return degrees * (Math.PI / 180);
    }
}