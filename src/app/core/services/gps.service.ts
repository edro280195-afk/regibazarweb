import { Injectable, signal, inject } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { App } from '@capacitor/app';
import { ApiService } from './api.service';
import { SignalRService } from './signalr.service';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
const GPS_KEY = 'regi_gps_granted';
const TOKEN_KEY = 'regi_driver_token';

@Injectable({
  providedIn: 'root'
})
export class GpsService {
  private api = inject(ApiService);
  private signalr = inject(SignalRService);

  active = signal(false);
  lastPosition = signal<{ lat: number, lng: number } | null>(null);

  private watchId?: number;
  private bgWatchId?: string;
  private lastGpsSendTime = 0;
  private lastLat = 0;
  private lastLng = 0;
  private currentToken: string | null = null;
  private keepAliveTimer?: ReturnType<typeof setInterval>;
  private isReconnecting = false;

  constructor() {
    // App vuelve del background → reconectar SignalR + enviar posición inmediatamente
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive || !this.active() || !this.currentToken) return;
      this.reconnectSignalR();
      if (this.lastLat && this.lastLng) {
        this.sendLocationToServer(this.lastLat, this.lastLng);
      }
    });

    // Restaurar sesión automáticamente si el proceso sobrevivió
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const wasActive = localStorage.getItem(GPS_KEY) === 'true';
    if (savedToken && wasActive) {
      console.log('[GpsService] Reiniciando GPS automáticamente...');
      setTimeout(() => this.start(savedToken), 1000);
    }
  }

  async start(token: string): Promise<void> {
    this.currentToken = token;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(GPS_KEY, 'true');

    if (this.active()) return;

    // Solicitar permisos antes de iniciar el watcher nativo
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await BackgroundGeolocation.addWatcher(
          { requestPermissions: true, stale: true },
          () => {}
        );
        BackgroundGeolocation.removeWatcher({ id: perm });
      } catch (e) {
        console.error('[GpsService] Error solicitando permisos:', e);
      }
    }

    this.active.set(true);

    if (!Capacitor.isNativePlatform()) {
      this.startWebWatch();
    } else {
      this.startNativeWatch();
    }

    // Conectar SignalR y unirse al grupo de ruta
    this.reconnectSignalR();

    // Heartbeat cada 30s: envía la última posición conocida por HTTP
    // Garantiza que el backend siempre tenga datos frescos aunque el repartidor esté parado
    this.startKeepAlive();
  }

  // Reconecta SignalR y re-une el grupo de ruta. Idempotente y segura para llamar múltiples veces.
  private async reconnectSignalR(): Promise<void> {
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    try {
      await this.signalr.connect();
      if (this.currentToken) {
        await this.signalr.joinRoute(this.currentToken);
      }
    } catch (e) {
      console.warn('[GpsService] SignalR reconnect failed:', e);
    } finally {
      this.isReconnecting = false;
    }
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.currentToken && this.lastLat && this.lastLng) {
        this.api.updateLocation(this.currentToken, this.lastLat, this.lastLng).subscribe();
      }
    }, 30_000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer !== undefined) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
  }

  private startWebWatch(): void {
    if (!navigator.geolocation) return;
    this.watchId = navigator.geolocation.watchPosition(
      pos => this.updatePosition(pos.coords.latitude, pos.coords.longitude),
      err => console.error('[GpsService] Web Geolocation error', err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }

  private startNativeWatch(): void {
    BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: 'Tu ubicación se comparte para optimizar la ruta de entrega.',
        backgroundTitle: 'Regi Bazar • En Ruta 🚚',
        requestPermissions: true,
        stale: false,
        distanceFilter: 10
      },
      (location, error) => {
        if (error) {
          console.error('[GpsService] Native Geolocation error', error);
          return;
        }
        if (location) {
          this.updatePosition(location.latitude, location.longitude);
        }
      }
    ).then(id => {
      this.bgWatchId = id;
    });
  }

  private updatePosition(lat: number, lng: number): void {
    this.lastLat = lat;
    this.lastLng = lng;
    this.lastPosition.set({ lat, lng });

    const now = Date.now();
    if (this.currentToken && now - this.lastGpsSendTime >= 15_000) {
      this.lastGpsSendTime = now;
      this.sendLocationToServer(lat, lng);
    }
  }

  private sendLocationToServer(lat: number, lng: number): void {
    const token = this.currentToken;
    if (!token) return;

    // HTTP es el canal confiable — siempre envía
    this.api.updateLocation(token, lat, lng).subscribe();

    // SignalR es best-effort — si falla, intenta reconectar silenciosamente
    this.signalr.reportLocation(token, lat, lng).catch(() => {
      this.reconnectSignalR();
    });
  }

  stop(): void {
    this.active.set(false);
    this.currentToken = null;
    localStorage.removeItem(GPS_KEY);
    localStorage.removeItem(TOKEN_KEY);
    this.stopKeepAlive();

    if (this.watchId !== undefined) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = undefined;
    }

    if (Capacitor.isNativePlatform() && this.bgWatchId) {
      BackgroundGeolocation.removeWatcher({ id: this.bgWatchId });
      this.bgWatchId = undefined;
    }
  }
}
