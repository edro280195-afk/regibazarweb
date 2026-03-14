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
  private currentToken: string | null = null;

  constructor() {
    // Escuchar cambios de estado de la app para asegurar que el servicio no se duerma
    App.addListener('appStateChange', ({ isActive }) => {
      console.log(`[GpsService] App state changed. IsActive: ${isActive}`);
      if (this.active() && this.currentToken) {
        // "Sacudir" el servicio para asegurar que siga corriendo
        this.pingLocation();
      }
    });

    // Restaurar sesión si es posible
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
    
    // Solicitar permisos de manera explícita antes de iniciar el watcher nativo
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
  }

  private startWebWatch(): void {
    if (!navigator.geolocation) return;

    this.watchId = navigator.geolocation.watchPosition(
      pos => {
        this.updatePosition(pos.coords.latitude, pos.coords.longitude);
      },
      err => console.error('[GpsService] Web Geolocation error', err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }

  private startNativeWatch(): void {
    BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "Tu ubicación se comparte para optimizar la ruta de entrega.",
        backgroundTitle: "Regi Bazar • En Ruta 🚚",
        requestPermissions: true,
        stale: false,
        distanceFilter: 10 // Más sensible (10 metros)
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
    this.lastPosition.set({ lat, lng });
    
    const now = Date.now();
    // Enviar cada 15 seg para no saturar, pero ser constante
    if (this.currentToken && (now - this.lastGpsSendTime >= 15000)) {
      this.lastGpsSendTime = now;
      this.api.updateLocation(this.currentToken, lat, lng).subscribe();
      this.signalr.reportLocation(this.currentToken, lat, lng);
    }
  }

  private pingLocation(): void {
    // Forzar una obtención de posición única para "despertar" el canal
    if (Capacitor.isNativePlatform()) {
      // BackgroundGeolocation comercial no suele tener un 'getCurrentPosition' directo sin watcher,
      // pero el hecho de estar activo ya debería bastar.
    } else {
      navigator.geolocation.getCurrentPosition(pos => {
        this.updatePosition(pos.coords.latitude, pos.coords.longitude);
      });
    }
  }

  stop(): void {
    this.active.set(false);
    this.currentToken = null;
    localStorage.removeItem(GPS_KEY);
    localStorage.removeItem(TOKEN_KEY);

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
