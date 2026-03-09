import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
export class App {
  private pwaUpdate = inject(PwaUpdateService);
  private emojis = ['💖', '🌸', '✨', '💕', '🎀'];

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
