import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PosStateService } from '../../../../core/services/pos-state.service';
import { PosApiService } from '../../../../core/services/pos-api.service';

@Component({
  selector: 'app-payment-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="payment-card card-coquette !bg-white/80 h-full flex flex-col p-8 animate-fade-in relative overflow-hidden">
      <!-- Background Decorations -->
      <div class="absolute -top-12 -left-12 w-40 h-40 bg-pink-50 rounded-full blur-3xl opacity-50"></div>
      
      <div class="relative z-10 flex flex-col h-full">
        <div class="total-display text-center mb-8 bg-gradient-to-br from-pink-50 to-white p-6 rounded-[32px] border border-pink-100/50 shadow-sm transition-transform hover:scale-[1.02]">
          <label class="text-[10px] font-black text-pink-400 uppercase tracking-[2px] mb-2 block">Total a Cobrar 🧾</label>
          <div class="amount text-5xl font-black gradient-text leading-none py-2">{{ state.totalDue() | currency:'USD':'symbol-narrow':'1.2-2' }}</div>
        </div>

        <div class="payment-controls flex-1 flex flex-col gap-6">
          <div class="space-y-2">
            <label class="label-coquette ml-2">Monto Recibido</label>
            <div class="flex items-center gap-4 bg-white/50 focus-within:bg-white rounded-2xl p-4 border-2 border-pink-100 transition-all shadow-sm">
              <span class="text-pink-300 font-black text-3xl ml-2">$</span>
              <input type="number" [(ngModel)]="amountReceived" placeholder="0.00" 
                     class="flex-1 bg-transparent border-none outline-none text-3xl font-black text-pink-900" 
                     (focus)="$any($event.target).select()"/>
            </div>
          </div>

          <div class="change-box flex items-center justify-between p-5 rounded-[24px] bg-pink-50/50 border border-pink-100/30 transition-all" 
               [class.negative]="change() < 0">
            <div class="text-left">
              <label class="text-[10px] font-black text-pink-400 uppercase tracking-widest block mb-1">Cambio</label>
              <div class="change-amount text-3xl font-black" [class.text-pink-600]="change() >= 0" [class.text-pink-200]="change() < 0">
                {{ (change() > 0 ? change() : 0) | currency:'USD':'symbol-narrow':'1.2-2' }}
              </div>
            </div>
            <div class="text-4xl">
              {{ change() >= 0 ? '🍬' : '⏳' }}
            </div>
          </div>

          <div class="methods grid grid-cols-3 gap-3">
            <button class="flex flex-col items-center gap-1 p-3 rounded-2xl transition-all duration-300 transform active:scale-90 border-2" 
                    [class.bg-pink-600]="method() === 'Efectivo'" [class.text-white]="method() === 'Efectivo'" [class.border-pink-600]="method() === 'Efectivo'"
                    [class.bg-white]="method() !== 'Efectivo'" [class.text-pink-400]="method() !== 'Efectivo'" [class.border-pink-50]="method() !== 'Efectivo'"
                    (click)="method.set('Efectivo')">
              <span class="text-xl">💵</span>
              <span class="text-[10px] font-black uppercase">Efectivo</span>
            </button>
            <button class="flex flex-col items-center gap-1 p-3 rounded-2xl transition-all duration-300 transform active:scale-90 border-2" 
                    [class.bg-pink-600]="method() === 'Tarjeta'" [class.text-white]="method() === 'Tarjeta'" [class.border-pink-600]="method() === 'Tarjeta'"
                    [class.bg-white]="method() !== 'Tarjeta'" [class.text-pink-400]="method() !== 'Tarjeta'" [class.border-pink-50]="method() !== 'Tarjeta'"
                    (click)="method.set('Tarjeta')">
              <span class="text-xl">💳</span>
              <span class="text-[10px] font-black uppercase">Tarjeta</span>
            </button>
            <button class="flex flex-col items-center gap-1 p-3 rounded-2xl transition-all duration-300 transform active:scale-90 border-2" 
                    [class.bg-pink-600]="method() === 'Transferencia'" [class.text-white]="method() === 'Transferencia'" [class.border-pink-600]="method() === 'Transferencia'"
                    [class.bg-white]="method() !== 'Transferencia'" [class.text-pink-400]="method() !== 'Transferencia'" [class.border-pink-50]="method() !== 'Transferencia'"
                    (click)="method.set('Transferencia')">
              <span class="text-xl">🏦</span>
              <span class="text-[10px] font-black uppercase">Transf.</span>
            </button>
          </div>

          <button class="btn-coquette btn-pink w-full h-20 text-xl font-black shadow-lg shadow-pink-200/50 mt-auto flex justify-center items-center gap-3 active:translate-y-1" 
                  [disabled]="!canPay() || loading()" (click)="finalizePayment()">
            @if (loading()) { <span class="animate-spin text-2xl">⏳</span> }
            {{ loading() ? 'Procesando...' : 'FINALIZAR COBRO 💖' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; width: 100%; }
  `]
})
export class PaymentPanelComponent {
  state = inject(PosStateService);
  private api = inject(PosApiService);

  amountReceived = signal(0);
  method = signal('Efectivo');
  loading = signal(false);

  change = computed(() => this.amountReceived() - this.state.totalDue());
  canPay = computed(() => this.state.totalDue() > 0 && this.amountReceived() >= this.state.totalDue());

  finalizePayment() {
    const order = this.state.selectedOrder();
    const session = this.state.currentSession();

    if (!order || !session) return;

    this.loading.set(true);
    this.api.processPayment(order.id, session.id, this.state.totalDue(), this.method()).subscribe({
      next: () => {
        this.loading.set(false);
        this.amountReceived.set(0);
        // El estado se actualizará vía SignalR o retorno de API
      },
      error: () => this.loading.set(false)
    });
  }
}
