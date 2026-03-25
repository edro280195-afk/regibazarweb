import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PosStateService } from '../../../../core/services/pos-state.service';

@Component({
  selector: 'app-cart-tabs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tabs-scroll flex gap-3 pb-2 overflow-x-auto scrollbar-hide snap-x pointer-events-auto">
      @for (order of state.activeOrders(); track order.id) {
        <button class="snap-start transition-all duration-300 transform active:scale-95 outline-none"
             [class.tab-pill-active]="state.selectedOrderId() === order.id"
             [class.tab-pill-inactive]="state.selectedOrderId() !== order.id"
             (click)="state.selectedOrderId.set(order.id)">
          <div class="flex items-center gap-3">
            <span class="text-xl">🛒</span>
            <div class="text-left">
              <p class="text-[10px] uppercase font-black tracking-widest opacity-70">Pedido #{{ order.id }}</p>
              <p class="font-black leading-tight">{{ order.clientName || 'Cliente Genérico' }}</p>
            </div>
            <span class="ml-2 w-6 h-6 rounded-full bg-white/30 flex items-center justify-center text-[10px] font-black">
              {{ order.items.length }}
            </span>
          </div>
        </button>
      } @empty {
        <div class="no-orders flex items-center gap-3 p-4 bg-white/50 rounded-2xl text-pink-300 font-black italic animate-pulse">
          <span>📶</span> Esperando escaneos de satélites...
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .tabs-scroll {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .tabs-scroll::-webkit-scrollbar { display: none; }
  `]
})
export class CartTabsComponent {
  state = inject(PosStateService);
}
