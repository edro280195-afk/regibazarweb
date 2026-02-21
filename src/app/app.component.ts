import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmModalComponent } from './shared/components/confirm-modal/confirm-modal.component';
import { EasterEggComponent } from './shared/components/easter-egg/easter-egg.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmModalComponent, EasterEggComponent, ToastContainerComponent],
  template: `
    <app-confirm-modal></app-confirm-modal>
    <app-easter-egg></app-easter-egg>
    <app-toast-container></app-toast-container>
    <router-outlet></router-outlet>
  `
})
export class AppComponent {
  constructor(private title: Title) {
    this.title.setTitle('RegiBazar - Todo Para Tu Hogar✨');
  }
}
