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

    constructor(private swPush: SwPush, private http: HttpClient) { }

    subscribeToNotifications(clientId?: number) {
        if (!this.swPush.isEnabled) {
            console.warn('🛠️ Service Worker - Push no está habilitado en este navegador.');
            return;
        }

        this.swPush.requestSubscription({
            serverPublicKey: this.VAPID_PUBLIC_KEY
        })
            .then(sub => {
                // Send the subscription to your backend
                const payload = {
                    ...sub.toJSON(), // contains endpoint, keys: {p256dh, auth}
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

                // Also unsubscribe client locally
                sub.unsubscribe().catch(err => console.error('Client unsubscribe failed', err));
            }
        });
    }
}
