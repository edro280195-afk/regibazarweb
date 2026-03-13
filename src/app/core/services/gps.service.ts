import { Injectable, signal, inject } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { ApiService } from './api.service';
import { SignalRService } from './signalr.service';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
const GPS_KEY = 'regi_gps_granted';

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
    // If it was active before, try to resume
    if (localStorage.getItem(GPS_KEY) === 'true') {
      console.log('[GpsService] Resuming GPS based on stored preference');
    }
  }

  start(token: string): void {
    this.currentToken = token;
    const isNative = Capacitor.isNativePlatform();
    
    if (this.active()) return;
    
    this.active.set(true);
    localStorage.setItem(GPS_KEY, 'true');

    if (!isNative) {
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
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }

  private startNativeWatch(): void {
    BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "Manteniendo la ruta activa para las entregas de Regi Bazar.",
        backgroundTitle: "Regi Bazar - Ruta en curso",
        requestPermissions: true,
        stale: false,
        distanceFilter: 15
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
    if (this.currentToken && (now - this.lastGpsSendTime >= 10000)) {
      this.lastGpsSendTime = now;
      this.api.updateLocation(this.currentToken, lat, lng).subscribe();
      this.signalr.reportLocation(this.currentToken, lat, lng);
    }
  }

  stop(): void {
    this.active.set(false);
    this.currentToken = null;
    localStorage.removeItem(GPS_KEY);

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
