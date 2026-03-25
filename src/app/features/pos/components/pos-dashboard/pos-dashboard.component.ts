import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartTabsComponent } from '../cart-tabs/cart-tabs.component';
import { TicketViewComponent } from '../ticket-view/ticket-view.component';
import { PaymentPanelComponent } from '../payment-panel/payment-panel.component';
import { PosCamiVoiceComponent } from '../pos-cami-voice/pos-cami-voice.component';
import { PosStateService } from '../../../../core/services/pos-state.service';

@Component({
  selector: 'app-pos-dashboard',
  standalone: true,
  imports: [CommonModule, CartTabsComponent, TicketViewComponent, PaymentPanelComponent, PosCamiVoiceComponent],
  template: `
    <div class="dashboard-layout h-full w-full flex flex-col p-6 gap-6 animate-fade-in overflow-hidden">
      <!-- Top: Navigation among active carts -->
      <div class="relative z-20">
        <app-cart-tabs />
      </div>

      <div class="main-content flex-1 flex gap-6 overflow-hidden relative z-10">
        <!-- Left: The Ticket -->
        <div class="ticket-section flex-[3] flex flex-col overflow-hidden bg-white/40 backdrop-blur-md rounded-[32px] border border-white/40 shadow-sm transition-all hover:bg-white/50">
          <app-ticket-view />
        </div>

        <!-- Right: Control & Payment -->
        <div class="control-section flex-[2] flex flex-col overflow-hidden">
          <app-pos-cami-voice />
          <app-payment-panel class="flex-1" />
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; width: 100%; overflow: hidden; }
  `]
})
export class PosDashboardComponent {
  state = inject(PosStateService);
}
