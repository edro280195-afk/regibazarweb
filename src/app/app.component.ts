import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmModalComponent } from './shared/components/confirm-modal/confirm-modal.component';
import { EasterEggComponent } from './shared/components/easter-egg/easter-egg.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmModalComponent, EasterEggComponent],
  template: `
    <app-confirm-modal></app-confirm-modal>
    <app-easter-egg></app-easter-egg>
    <router-outlet></router-outlet>
  `
})
export class AppComponent { }
