import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class PushNotificationService {
    private http = inject(HttpClient);
    private readonly VAPID_PUBLIC_KEY = environment.vapidPublicKey;

    async requestPermission(): Promise<boolean> {
        if (!('Notification' in window)) return false;
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    async subscribeToNotifications(role: 'admin' | 'driver' | 'client', identifiers: { clientId?: number, routeToken?: string } = {}): Promise<void> {
        if (!('serviceWorker' in navigator)) return;

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(this.VAPID_PUBLIC_KEY)
            });
        }

        const subData = subscription.toJSON();
        await firstValueFrom(this.http.post(`${environment.apiUrl}/push/subscribe`, {
            endpoint: subData.endpoint,
            keys: {
                p256dh: subData.keys?.['p256dh'],
                auth: subData.keys?.['auth']
            },
            role: role,
            clientId: identifiers.clientId,
            driverRouteToken: identifiers.routeToken
        }));

        console.log('Push Subscription synced with backend ✨');
    }

    private urlBase64ToUint8Array(base64String: string) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}
