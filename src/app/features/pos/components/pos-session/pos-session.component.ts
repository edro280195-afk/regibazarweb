import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PosApiService } from '../../../../core/services/pos-api.service';
import { PosStateService } from '../../../../core/services/pos-state.service';

@Component({
  selector: 'app-pos-session',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="session-gate h-full w-full flex items-center justify-center p-6 animate-fade-in">
      <div class="card-coquette w-full max-w-md p-10 flex flex-col items-center bg-white/90 relative overflow-hidden group">
        <!-- Decoraciones internas del card -->
        <div class="absolute -top-10 -right-10 w-32 h-32 bg-pink-50 rounded-full blur-2xl group-hover:bg-pink-100 transition-colors"></div>
        <div class="absolute -bottom-10 -left-10 w-32 h-32 bg-pink-50 rounded-full blur-2xl group-hover:bg-pink-100 transition-colors"></div>

        <div class="relative z-10 w-full flex flex-col items-center">
          <div class="w-16 h-16 bg-pink-100 rounded-[24px] flex items-center justify-center text-3xl mb-4 animate-float">
            🎀
          </div>
          
          <h1 class="text-3xl font-black text-pink-900 tracking-tight mb-2">POS RegiBazar</h1>
          <p class="text-pink-400 font-medium mb-8">Abre la caja para comenzar el turno ✨</p>

          <div class="w-full space-y-2 mb-8 text-left">
            <label class="label-coquette ml-2">Monto Inicial (Fondo)</label>
            <div class="flex items-center gap-4 bg-white/50 focus-within:bg-white rounded-2xl p-4 border-2 border-pink-100 transition-all shadow-sm">
              <span class="text-pink-300 font-black text-3xl ml-2">$</span>
              <input type="number" [(ngModel)]="initialCash" placeholder="0.00" 
                     class="flex-1 bg-transparent border-none outline-none text-3xl font-black text-pink-900" 
                     (focus)="$any($event.target).select()"/>
            </div>
          </div>

          <button (click)="openSession()" [disabled]="loading()" 
                  class="btn-coquette btn-pink w-full h-14 text-lg font-black shadow-lg shadow-pink-200/50 flex justify-center items-center gap-2">
            @if (loading()) { <span class="animate-spin text-xl">⏳</span> }
            {{ loading() ? 'Abriendo...' : 'Abrir Caja 💖' }}
          </button>

          @if (error()) {
            <div class="mt-6 p-3 bg-red-50 rounded-2xl border border-red-100 text-red-500 text-sm font-medium animate-bounce-in">
              ⚠️ {{ error() }}
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; width: 100%; }
  `]
})
export class PosSessionComponent {
  private api = inject(PosApiService);
  private state = inject(PosStateService);

  initialCash = 0;
  loading = signal(false);
  error = signal<string | null>(null);

  openSession() {
    this.loading.set(true);
    this.error.set(null);

    // Using Dummy UserId 1 for now, in real app it would come from Auth
    this.api.openSession(1, this.initialCash).subscribe({
      next: (session) => {
        this.state.setSession(session);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('POS: Error opening session', err);
        this.error.set('No se pudo abrir la caja. Verifica tu conexión.');
        this.loading.set(false);
      }
    });
  }
}
