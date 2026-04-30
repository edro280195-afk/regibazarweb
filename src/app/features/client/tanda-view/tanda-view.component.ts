import { Component, inject, signal, OnInit, HostListener, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TandaService } from '../../../core/services/tanda.service';
import { ToastService } from '../../../core/services/toast.service';
import { gsap } from 'gsap';

@Component({
  selector: 'app-tanda-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative min-h-screen overflow-hidden bg-gradient-to-b from-pink-50 via-rose-50 to-purple-50 pb-24 font-sans text-stone-800"
         (scroll)="onScroll($event)">
      
      <!-- Parallax Background Layers -->
      <div class="fixed inset-0 pointer-events-none z-0">
        <div class="absolute inset-0 opacity-40 transition-transform duration-75 ease-out"
             [style.transform]="'translateY(' + scrollY() * 0.1 + 'px)'">
          <div class="absolute top-[10%] left-[5%] text-4xl animate-pulse-slow">✨</div>
          <div class="absolute top-[40%] right-[10%] text-5xl opacity-50">🌸</div>
          <div class="absolute top-[75%] left-[15%] text-4xl animate-float">🎀</div>
        </div>
        <div class="absolute inset-0 opacity-60 transition-transform duration-75 ease-out"
             [style.transform]="'translateY(' + scrollY() * 0.25 + 'px)'">
          <div class="absolute top-[20%] right-[15%] text-3xl animate-float-delayed">💖</div>
          <div class="absolute top-[60%] left-[8%] text-5xl">✨</div>
          <div class="absolute top-[85%] right-[20%] text-3xl animate-bounce-slow">🌷</div>
        </div>
      </div>

      <div class="relative z-10 max-w-md mx-auto p-4 sm:p-6 pt-10 space-y-8">
        
        @if (loading()) {
          <div class="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div class="w-12 h-12 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin mb-4"></div>
            <p class="text-pink-600 font-medium animate-pulse Irish Grover">Cargando tu tanda... 🎀</p>
          </div>
        } @else if (error()) {
          <div class="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
            <span class="text-6xl mb-4 drop-shadow-md">🔍</span>
            <h2 class="text-2xl font-black text-pink-900 mb-2 font-display">Tanda no encontrada</h2>
            <p class="text-pink-600 px-4">Verifica que el enlace sea correcto, hermosa 💖</p>
          </div>
        } @else if (tanda(); as t) {
          
          <!-- Header Hero -->
          <div class="text-center animate-slide-down relative mb-8">
             <div class="text-5xl mb-2 animate-wiggle inline-block drop-shadow-sm">🎀</div>
             <h1 class="text-3xl font-black text-pink-600 tracking-tight font-display mb-1">
               {{ t.name }}
             </h1>
             <p class="text-rose-500 font-medium text-sm">
                ¡Creciendo juntas en grupo! ✨
             </p>
          </div>

          <!-- Sticky Nav Tabs -->
          <div id="nav-tabs" class="flex p-1.5 bg-white/60 backdrop-blur-xl rounded-[2rem] mb-8 border border-white sticky top-4 z-30 shadow-sm">
            <button class="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all duration-300" 
                    [ngClass]="activeTab() === 'summary' ? 'bg-white text-pink-600 shadow-sm scale-105' : 'text-pink-300'" 
                    (click)="activeTab.set('summary')">
              <span class="text-lg">🌸</span>
              <span class="text-[10px] font-black uppercase tracking-widest">Mi Tanda</span>
            </button>
            <button class="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all duration-300" 
                    [ngClass]="activeTab() === 'transparency' ? 'bg-white text-pink-600 shadow-sm scale-105' : 'text-pink-300'" 
                    (click)="activeTab.set('transparency')">
              <span class="text-lg">💎</span>
              <span class="text-[10px] font-black uppercase tracking-widest">Grupo</span>
            </button>
          </div>

          @if (activeTab() === 'summary') {
            <!-- ════════════ TAB: MI TANDA (RESUMEN) ════════════ -->
            <div class="animate-fade-in-up space-y-8">
              
              <!-- Weekly Progress Card -->
              <div class="card-coquette bg-white/90 p-6 shadow-xl border-pink-100 flex flex-col items-center text-center">
                <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-4">Estado de la Tanda</p>
                
                <div class="relative w-32 h-32 flex items-center justify-center mb-4">
                  <svg class="w-full h-full -rotate-90">
                    <circle cx="64" cy="64" r="58" stroke="currentColor" stroke-width="8" fill="transparent" class="text-pink-50" />
                    <circle cx="64" cy="64" r="58" stroke="currentColor" stroke-width="8" fill="transparent" 
                            class="text-pink-500 transition-all duration-1000"
                            [attr.stroke-dasharray]="364.4"
                            [attr.stroke-dashoffset]="364.4 - (364.4 * (t.currentWeek / t.totalWeeks))" />
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-3xl font-black text-pink-950 leading-none">{{ t.currentWeek }}</span>
                    <span class="text-[9px] font-bold text-pink-400 uppercase tracking-tighter">Semana</span>
                  </div>
                </div>

                <div class="space-y-1">
                  <p class="text-sm font-bold text-pink-900">
                    Semana <span class="text-pink-600">{{ t.currentWeek }}</span> de <span class="text-pink-600">{{ t.totalWeeks }}</span>
                  </p>
                  <div class="bg-pink-100/50 px-4 py-2 rounded-2xl flex items-center gap-2">
                    <span class="text-lg">💰</span>
                    <span class="text-xs font-black text-pink-700">Abono Semanal: {{ t.weeklyAmount | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
                  </div>
                </div>
              </div>

              <!-- Delivery Turn Hero -->
              @if (isWinnerThisWeek()) {
                <div class="bg-gradient-to-br from-pink-500 to-rose-500 rounded-[2.5rem] p-8 text-white text-center shadow-xl animate-bounce-in relative overflow-hidden">
                   <div class="absolute -right-6 -top-6 text-7xl opacity-20 rotate-12">🎁</div>
                   <h3 class="text-xl font-bold uppercase tracking-widest mb-2 font-display">¡ES TU TURNO! ✨</h3>
                   <p class="text-xs font-medium opacity-90">Esta semana el producto es para ti. ¡Abre tu regalo de tanda! 💖</p>
                </div>
              }

              <!-- Payment Methods Section -->
              <div id="payment-methods" class="relative z-10">
                <h3 class="text-center text-pink-950 font-black text-lg font-display mb-1 flex items-center justify-center gap-2">
                  <span>💸</span> Formas de Pago
                </h3>
                <p class="text-center text-[10px] text-pink-700/70 font-bold uppercase tracking-widest mb-4">Toca para copiar los datos</p>

                <!-- Payment Tabs -->
                <div class="flex p-1 bg-white/50 backdrop-blur-md rounded-2xl mb-4 border border-white/50">
                  <button class="flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                          [ngClass]="paymentTab() === 'transfer' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-400'"
                          (click)="paymentTab.set('transfer')">🏦 Transfer</button>
                  <button class="flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                          [ngClass]="paymentTab() === 'oxxo' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-400'"
                          (click)="paymentTab.set('oxxo')">🏪 OXXO</button>
                  <button class="flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                          [ngClass]="paymentTab() === 'cash' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-400'"
                          (click)="paymentTab.set('cash')">💵 Cash</button>
                </div>

                <!-- Tab Content -->
                <div class="min-h-[160px]">
                  @switch (paymentTab()) {
                    @case ('transfer') {
                      <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[2rem] p-6 border border-blue-100 shadow-sm animate-fade-in relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 text-6xl opacity-10 rotate-12">🏦</div>
                        <h4 class="font-black text-blue-900 text-xs mb-3 uppercase tracking-widest">Citibanamex</h4>
                        <div class="bg-white/60 rounded-2xl p-4 border border-blue-200/50 mb-3 cursor-pointer active:scale-95 transition-all" (click)="copyText('5256786137583898')">
                          <p class="text-[9px] text-blue-700/70 font-black uppercase mb-1">Tarjeta / CLABE</p>
                          <p class="font-mono font-black text-blue-900 text-sm tracking-widest">5256 7861 3758 3898</p>
                        </div>
                        <p class="text-[9px] text-blue-700/80 font-black uppercase">Beneficiario: Yazmin Vara ✨</p>
                      </div>
                    }
                    @case ('oxxo') {
                      <div class="bg-gradient-to-br from-red-50 to-orange-50 rounded-[2rem] p-6 border border-red-100 shadow-sm animate-fade-in relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 text-6xl opacity-10 rotate-12">🏪</div>
                        <h4 class="font-black text-red-900 text-xs mb-3 uppercase tracking-widest">BBVA (OXXO)</h4>
                        <div class="bg-white/60 rounded-2xl p-4 border border-red-200/50 mb-3 cursor-pointer active:scale-95 transition-all" (click)="copyText('4152314496671333')">
                          <p class="text-[9px] text-red-700/70 font-black uppercase mb-1">Número de Tarjeta</p>
                          <p class="font-mono font-black text-red-900 text-sm tracking-widest">4152 3144 9667 1333</p>
                        </div>
                        <p class="text-[9px] text-red-700/80 font-black uppercase">Envía foto de tu ticket 📸</p>
                      </div>
                    }
                    @case ('cash') {
                      <div class="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[2rem] p-6 border border-emerald-100 shadow-sm animate-fade-in flex flex-col items-center justify-center text-center">
                        <div class="text-4xl mb-2">💵</div>
                        <h4 class="font-black text-emerald-900 text-xs uppercase tracking-widest">Pago en Efectivo</h4>
                        <p class="text-[10px] text-emerald-700 mt-2 font-medium leading-relaxed px-4">Recibimos tus abonos directamente en el bazar los viernes y sábados. 💕</p>
                      </div>
                    }
                  }
                </div>
              </div>

              <!-- Rules Section -->
              <div class="bg-pink-950/5 text-pink-900 border border-pink-200/50 rounded-[2rem] p-6 text-center">
                 <h4 class="text-xs font-black uppercase tracking-widest mb-3">🌸 Políticas de Tanda</h4>
                 <p class="text-[11px] leading-relaxed font-medium">
                   Entregas los <strong class="text-pink-600">Domingos</strong> a la ganadora de la semana. <br>
                   ¡Ahorrar juntas es más divertido! ✨
                 </p>
              </div>

            </div>
          }

          @if (activeTab() === 'transparency') {
            <!-- ════════════ TAB: GRUPO (TRANSPARENCIA) ════════════ -->
            <div class="animate-fade-in-up space-y-4">
              <h3 class="text-center text-pink-950 font-black text-lg font-display flex items-center justify-center gap-2">
                <span>💎</span> Transparencia de Pagos
              </h3>
              
              <div id="transparency-timeline" class="bg-white/90 rounded-[2.5rem] p-8 shadow-sm border border-white relative overflow-hidden">
                 <div class="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
                 
                 <div class="space-y-8 relative z-10">
                   @for (p of t.participants; track p.assignedTurn) {
                     <div class="flex gap-6 group">
                       <!-- Left Indicator Column -->
                       <div class="flex flex-col items-center w-10">
                          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black shadow-sm transition-all duration-500"
                               [ngClass]="{
                                 'bg-pink-600 text-white scale-110 shadow-lg shadow-pink-100': p.assignedTurn === t.currentWeek,
                                 'bg-white text-pink-400 border border-pink-100': p.assignedTurn !== t.currentWeek
                               }">
                             {{ p.assignedTurn }}
                          </div>
                          @if (!$last) {
                            <div class="w-0.5 flex-grow bg-pink-50 my-2 rounded-full"></div>
                          }
                       </div>
  
                       <!-- Content Column -->
                       <div class="flex-1 pt-1">
                          <div class="flex justify-between items-start mb-1">
                             <div>
                               <p class="text-sm font-black text-pink-900 leading-tight">{{ p.name }}</p>
                               <div class="flex items-center gap-1.5 mt-0.5">
                                 @if (p.variant) {
                                    <span class="text-[9px] font-black text-pink-400 uppercase tracking-widest">{{ p.variant }}</span>
                                    <span class="text-pink-200 text-[8px]">•</span>
                                 }
                                 <span class="text-[9px] font-bold text-pink-500 uppercase tracking-tight">
                                    📅 {{ getDeliveryDate(t.startDate, p.assignedTurn) | date:'EEE d MMM' : '' : 'es-MX' | uppercase }}
                                 </span>
                               </div>
                             </div>
                             <div class="flex gap-2 items-center">
                                <!-- Payment Track (Hearts) -->
                                <div class="flex flex-col items-end gap-1">
                                   <div class="flex flex-wrap justify-end gap-0.5 max-w-[120px]">
                                      @for (week of weeksArray(); track week) {
                                        <span class="text-[10px] transition-all duration-300"
                                              [class.grayscale]="!p.paidWeeks.includes(week)"
                                              [class.opacity-30]="!p.paidWeeks.includes(week)"
                                              [title]="'Semana ' + week">
                                          💖
                                        </span>
                                      }
                                   </div>
                                   <span class="text-[8px] font-black text-pink-400 uppercase tracking-tighter">
                                     {{ p.paidWeeks.length }} de {{ t.totalWeeks }} abonos ✨
                                   </span>
                                </div>
  
                                <!-- Delivery Status Badge -->
                                @if (p.assignedTurn <= t.currentWeek) {
                                  <div class="w-10 h-10 rounded-2xl flex flex-col items-center justify-center transition-all bg-gradient-to-br"
                                       [ngClass]="p.isDelivered ? 'from-emerald-400 to-teal-500 shadow-emerald-100 shadow-lg' : 'from-pink-100 to-rose-200 opacity-50'">
                                     <span class="text-lg">{{ p.isDelivered ? '🎁' : '📍' }}</span>
                                     <span class="text-[6px] font-black text-white uppercase tracking-tighter">{{ p.isDelivered ? 'LISTO' : 'RUTA' }}</span>
                                  </div>
                                }
                             </div>
                          </div>
                          <div class="h-1 w-full bg-pink-50 rounded-full mt-2 overflow-hidden">
                             <div class="h-full bg-pink-300 transition-all duration-1000" [style.width]="(p.paidWeeks.length / t.totalWeeks * 100) + '%'"></div>
                          </div>
                       </div>
                     </div>
                   }
                 </div>
              </div>
            </div>
          }
        }
      </div>

       <!-- Assistant Widget -->
       @if (tanda() && !loading()) {
        <div class="fixed bottom-6 right-6 z-40 flex items-end justify-end gap-3 pointer-events-none">
          <div class="bg-white/95 backdrop-blur-2xl rounded-[1.5rem] p-4 shadow-2xl border border-pink-100 max-w-[200px] pointer-events-auto animate-fade-in-up">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[9px] font-black text-pink-500 uppercase">Asistente Virtual</span>
            </div>
            <p class="text-[10px] text-pink-900 font-medium italic">"¡Recuerda que estamos ahorrando juntas! Si tienes dudas sobre tu pago, escríbenos. ✨"</p>
          </div>
          <button class="shrink-0 w-14 h-14 bg-gradient-to-br from-pink-100 to-rose-200 rounded-full flex items-center justify-center text-3xl shadow-xl border-4 border-white pointer-events-auto hover:scale-110 active:scale-95 transition-all animate-bounce-subtle">
            👩🏻‍💻
          </button>
        </div>
       }

       <!-- Toast Notification -->
       @if (toastVisible()) {
        <div class="fixed bottom-24 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4">
          <div class="animate-bounce-up-y-only pointer-events-auto">
            <div class="bg-pink-950/90 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-widest px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-2.5 border border-pink-500/30">
              <span class="text-lg">✨</span>
              <span>{{ toastMessage() }}</span>
            </div>
          </div>
        </div>
       }
    </div>
  `,
  styles: [`
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
    @keyframes float-delayed { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    @keyframes pulse-slow { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }
    @keyframes wiggle { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
    @keyframes fade-in-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes bounce-subtle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
    
    @keyframes bounce-up-y-only { 0% { opacity: 0; transform: translateY(100vh); } 60% { opacity: 1; transform: translateY(-15px); } 80% { transform: translateY(5px); } 100% { transform: translateY(0); } }
    
    .animate-float { animation: float 6s ease-in-out infinite; }
    .animate-float-delayed { animation: float-delayed 5s ease-in-out infinite; animation-delay: 2s; }
    .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
    .animate-wiggle { animation: wiggle 3s ease-in-out infinite; }
    .animate-fade-in-up { animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .animate-fade-in { animation: fade-in 0.4s ease-out both; }
    .animate-bounce-subtle { animation: bounce-subtle 2s infinite; }
    .animate-bounce-up-y-only { animation: bounce-up-y-only 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
  `]
})
export class TandaViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tandaService = inject(TandaService);
  
  tanda = signal<any | null>(null);
  loading = signal(true);
  error = signal(false);
  scrollY = signal(0);

  activeTab = signal<'summary' | 'transparency'>('summary');
  paymentTab = signal<'transfer' | 'cash' | 'oxxo'>('transfer');
  toastVisible = signal(false);
  toastMessage = signal('');
  private toastTimeout: any;
  
  isWinnerThisWeek = computed(() => {
    const t = this.tanda();
    if (!t) return false;
    // En una tanda real, necesitaríamos identificar qué participante es la que abrió el link.
    // Como es un link genérico por ahora, podríamos basarlo en algún parámetro opcional, 
    // pero para demos mostramos si alguna participante tiene su turno esta semana.
    // Pero el usuario pidió "vista de la clienta", así que por ahora lo dejamos genérico o 
    // basado en URL si pasamos el participantId.
    return false; 
  });

  @HostListener('window:scroll', ['$event'])
  onScroll(event?: any) { 
    this.scrollY.set(window.scrollY); 
  }

  copyText(val: string) {
    navigator.clipboard.writeText(val).then(() => {
      this.showToast('Número Copiado 📋✨');
    });
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    this.toastVisible.set(true);
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.toastVisible.set(false), 3000);
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      const token = params['token'];
      if (token) this.loadTanda(token);
    });
  }

  loadTanda(token: string) {
    this.loading.set(true);
    this.tandaService.getPublicTanda(token).subscribe({
      next: (data) => {
        this.tanda.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  weeksArray = computed(() => {
    const t = this.tanda();
    if (!t) return [];
    return Array.from({ length: t.totalWeeks }, (_, i) => i + 1);
  });

  getDeliveryDate(startDate: string, turn: number): Date {
    if (!startDate) return new Date();
    
    // Extraemos las partes de la fecha (YYYY-MM-DD)
    const datePart = startDate.split('T')[0];
    const parts = datePart.split('-');
    
    // Forzamos el parseo local para evitar saltos de día por UTC
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day, 12, 0, 0); // 12:00 PM local para ser súper seguros
    
    // Sumamos las semanas según el turno
    date.setDate(date.getDate() + (turn - 1) * 7);

    // Ajustamos al domingo de esa semana (Las entregas son los domingos)
    // En JS getDay(): 0=Domingo, 1=Lunes, ..., 6=Sábado
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0) {
      // Sumamos los días necesarios para llegar al domingo (7 - dayOfWeek)
      date.setDate(date.getDate() + (7 - dayOfWeek) % 7);
    }

    return date;
  }
}
