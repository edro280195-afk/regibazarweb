import { Component, HostListener, inject, NgZone, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';
import { ToastComponent } from './shared/components/toast/toast.component';

import { PwaUpdateService } from './core/services/pwa-update.service';

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
