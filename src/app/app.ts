import { Component, HostListener, inject, NgZone, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { ToastComponent } from './shared/components/toast/toast.component';

import { PwaUpdateService } from './core/services/pwa-update.service';
import { GpsService } from './core/services/gps.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { BluetoothPrinterService } from './core/services/bluetooth/bluetooth-printer.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent],
  template: `
    <router-outlet />
    <app-toast />
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
    }
  `]
})
export class App implements OnInit {
  private pwaUpdate = inject(PwaUpdateService);
  private router = inject(Router);
  private zone = inject(NgZone);
  private gps = inject(GpsService);
  private push = inject(PushNotificationService);
  private bluetoothPrinter = inject(BluetoothPrinterService);
  private emojis = ['💖', '🌸', '✨', '💕', '🎀'];

  ngOnInit() {
    CapacitorApp.addListener('appUrlOpen', data => {
      if (data.url.includes('regibazar.com')) {
        const urlObj = new URL(data.url);
        const path = urlObj.pathname;
        if (path.startsWith('/repartidor/')) {
          this.zone.run(() => {
            this.router.navigateByUrl(path);
          });
        }
      }
    });

    if (Capacitor.isNativePlatform()) {
      this.requestStartupPermissions();
    }
  }

  /**
   * Pide de una vez, al abrir la app empaquetada, todos los permisos nativos
   * que la app usa en algún momento (Bluetooth para imprimir, ubicación para
   * la ruta del conductor, notificaciones push y micrófono para Live Mode /
   * C.A.M.I.), para no tener que dispararlos manualmente entrando a cada
   * pantalla. Cada uno es independiente: si la usuaria niega uno, los demás
   * se piden igual, y la pantalla que de verdad lo necesita lo vuelve a
   * pedir con su propio mensaje si hace falta.
   */
  private async requestStartupPermissions(): Promise<void> {
    await Promise.allSettled([
      this.bluetoothPrinter.requestPermissions(),
      this.gps.requestPermissions(),
      this.push.requestPermission(),
      this.requestMicrophonePermission()
    ]);
  }

  private async requestMicrophonePermission(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch {
      // La niega y listo: Live Mode / C.A.M.I. la vuelven a pedir cuando de verdad se use el micrófono.
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    this.createMagicHeart(event.clientX, event.clientY);
  }

  @HostListener('document:touchstart', ['$event'])
  onDocumentTouch(event: TouchEvent) {
    if (event.touches.length > 0) {
      this.createMagicHeart(event.touches[0].clientX, event.touches[0].clientY);
    }
  }

  private createMagicHeart(x: number, y: number) {
    const heart = document.createElement('div');
    heart.className = 'magic-heart';
    heart.innerText = this.emojis[Math.floor(Math.random() * this.emojis.length)];

    heart.style.left = `${x}px`;
    heart.style.top = `${y}px`;

    document.body.appendChild(heart);

    setTimeout(() => {
      heart.remove();
    }, 1000);
  }
}
