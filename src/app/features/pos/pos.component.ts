import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PosStateService } from '../../core/services/pos-state.service';
import { PosSignalRService } from '../../core/services/pos-signalr.service';
import { PosSessionComponent } from './components/pos-session/pos-session.component';
import { PosDashboardComponent } from './components/pos-dashboard/pos-dashboard.component';
import { PosApiService } from '../../core/services/pos-api.service';
import { CashRegisterSession, Order } from '../../core/models/pos.models';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    PosSessionComponent, 
    PosDashboardComponent
  ],
  template: `
    <div class="pos-container bg-coquette-pattern relative overflow-hidden h-screen w-screen flex justify-center items-center font-body">
      <!-- Decoraciones de fondo -->
      <div class="sparkle-1">✨</div>
      <div class="sparkle-2">🌸</div>
      <div class="sparkle-3">✨</div>
      <div class="absolute -top-20 -right-20 w-80 h-80 bg-pink-200/30 rounded-full blur-3xl animate-float"></div>
      <div class="absolute -bottom-20 -left-20 w-80 h-80 bg-pink-100/40 rounded-full blur-3xl animate-float" style="animation-delay: 1s"></div>

      <div class="glass-coquette w-[96%] h-[94%] rounded-[40px] flex flex-col relative z-10 overflow-hidden border-white/40 shadow-glow">
        @if (!posState.currentSession()) {
          <app-pos-session />
        } @else {
          <app-pos-dashboard />
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
    }
  `]
})
export class PosComponent implements OnInit {
  posState = inject(PosStateService);
  private signalr = inject(PosSignalRService);
  private api = inject(PosApiService);

  constructor() {
    effect(() => {
      if (this.posState.currentSession()) {
        this.loadPendingOrders();
      }
    });
  }

  ngOnInit() {
    this.checkActiveSession();
    
    this.signalr.startConnection().then(() => {
      this.signalr.joinNodrizaGroup();
    }).catch((err: any) => {
      console.error('POS: Could not join group due to connection error', err);
    });
  }

  private checkActiveSession() {
    this.api.getActiveSession().subscribe({
      next: (session: CashRegisterSession) => {
        this.posState.setSession(session);
      },
      error: () => this.posState.setSession(null)
    });
  }

  private loadPendingOrders() {
    this.api.getPendingOrders().subscribe({
      next: (orders: Order[]) => this.posState.updateActiveOrders(orders),
      error: (err: any) => console.error('POS: Error loading pending orders', err)
    });
  }
}
