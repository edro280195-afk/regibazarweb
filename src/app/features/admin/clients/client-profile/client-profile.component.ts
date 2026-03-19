import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ClientDto, CLIENT_TAG_LABELS } from '../../../../core/models';
import { GoogleAutocompleteDirective } from '../../../../shared/directives/google-autocomplete.directive';

@Component({
  selector: 'app-client-profile',
  imports: [CommonModule, FormsModule, CurrencyPipe, GoogleAutocompleteDirective],
  template: `
    <div class="space-y-6">
      <button class="btn-coquette btn-ghost text-sm" (click)="goBack()">← Volver a Clientas</button>

      @if (loading()) {
        <div class="shimmer h-40 rounded-2xl"></div>
      } @else if (client()) {
        <!-- Profile Card -->
        <div class="card-coquette p-6 animate-scale-in relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-pink-100/50 rounded-full -translate-y-10 translate-x-10"></div>
          <div class="relative flex flex-wrap items-start gap-6">
            <div class="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                 [class]="client()!.tag === 'Vip' ? 'bg-amber-100' : client()!.tag === 'RisingStar' ? 'bg-blue-100' : 'bg-pink-100'">
              {{ client()!.tag === 'Vip' ? '👑' : client()!.tag === 'RisingStar' ? '🚀' : '🌸' }}
            </div>
            <div class="flex-1 min-w-0">
              @if (!editing()) {
                <h2 class="text-2xl font-bold text-pink-900">{{ client()!.name }}</h2>
                @if (client()!.phone) { <p class="text-pink-500 mt-1">📱 {{ client()!.phone }}</p> }
                @if (client()!.address) { <p class="text-pink-400 text-sm mt-1">📍 {{ client()!.address }}</p> }
                <div class="flex items-center gap-3 mt-3">
                  <span class="badge" [class]="client()!.tag === 'Vip' ? 'bg-amber-100 text-amber-700' : client()!.tag === 'RisingStar' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'">
                    {{ getTagLabel(client()!.tag) }}
                  </span>
                  @if (client()!.type) { <span class="badge bg-purple-50 text-purple-600">{{ client()!.type }}</span> }
                </div>
                <button class="btn-coquette btn-outline-pink text-xs mt-3" (click)="startEdit()">✏️ Editar</button>
              } @else {
                <div class="space-y-3">
                  <input class="input-coquette" [(ngModel)]="editData.name" placeholder="Nombre" />
                  <input class="input-coquette" [(ngModel)]="editData.phone" placeholder="Teléfono" />
                  <textarea class="input-coquette" [(ngModel)]="editData.address" placeholder="Dirección" rows="2"
                            appGoogleAutocomplete (placeChanged)="onAddressSelected($event)"></textarea>
                  <textarea class="input-coquette" [(ngModel)]="editData.deliveryInstructions" placeholder="Instrucciones de entrega predeterminadas" rows="2"></textarea>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select class="input-coquette" [(ngModel)]="editData.tag">
                      <option value="None">Normal</option>
                      <option value="RisingStar">🚀 En Ascenso</option>
                      <option value="Vip">👑 Consentida</option>
                      <option value="Blacklist">🚫 Lista Negra</option>
                    </select>
                    <select class="input-coquette" [(ngModel)]="editData.type">
                      <option value="Nueva">Nueva</option>
                      <option value="Frecuente">Frecuente</option>
                    </select>
                  </div>
                  <div class="flex gap-2">
                    <button class="btn-coquette btn-pink flex items-center gap-2" [disabled]="isSaving()" (click)="saveEdit()">
                      @if (isSaving()) {
                        <span class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      }
                      <span>💖 Guardar</span>
                    </button>
                    <button class="btn-coquette btn-ghost" [disabled]="isSaving()" (click)="editing.set(false)">Cancelar</button>
                  </div>
                </div>
              }
            </div>
            <div class="text-right">
              <p class="text-3xl font-bold text-pink-900">{{ client()!.totalSpent | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
              <p class="text-sm text-pink-400">{{ client()!.ordersCount }} pedidos</p>
            </div>
          </div>
        </div>

        <!-- AI Client Analysis -->
        @if (client()) {
          <div class="card-coquette p-6 animate-slide-up" style="border: 1px solid rgba(139,92,246,0.2); background: linear-gradient(135deg, rgba(245,243,255,0.9), rgba(253,242,248,0.9));">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-bold text-purple-900 flex items-center gap-2">
                <span class="text-lg">✦</span> Análisis C.A.M.I.
              </h3>
              <button class="btn-coquette btn-outline-pink text-xs flex items-center gap-2"
                      (click)="loadInsight()" [disabled]="loadingInsight()">
                @if (loadingInsight()) {
                  <span class="w-3 h-3 border-2 border-pink-400/30 border-t-pink-500 rounded-full animate-spin"></span>
                  Analizando...
                } @else {
                  <span>✦</span> {{ clientInsight() ? 'Actualizar' : 'Ver análisis' }}
                }
              </button>
            </div>
            @if (clientInsight()) {
              <p class="text-sm text-purple-800 leading-relaxed italic">{{ clientInsight() }}</p>
            } @else if (!loadingInsight()) {
              <p class="text-xs text-purple-400">Presiona "Ver análisis" para obtener un perfil de comportamiento de esta clienta generado por IA.</p>
            }
          </div>
        }

        <!-- Loyalty Section -->
        @if (loyalty()) {
          <div class="card-coquette p-6 animate-slide-up delay-200 relative overflow-hidden isolate" style="opacity:0; animation-fill-mode: forwards;">
            <!-- Subtle shimmer / background layer -->
            <div class="absolute inset-0 bg-gradient-to-br from-pink-50 via-white to-purple-50 -z-10"></div>
            <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-pink-200/40 via-purple-100/20 to-transparent rounded-bl-full -z-10 blur-xl"></div>
            
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-xl font-bold text-pink-900 font-display flex items-center gap-2">
                <span class="text-2xl animate-pulse-slow drop-shadow-[0_0_8px_rgba(244,114,182,0.6)]">💎</span> RegiPuntos
              </h3>
              <!-- Level Badge -->
              <span class="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm"
                    [ngClass]="{
                      'bg-gradient-to-r from-amber-200 to-yellow-400 text-amber-900 shadow-yellow-200/50': loyalty().tier === 'VIP',
                      'bg-gradient-to-r from-blue-200 to-cyan-300 text-blue-900 shadow-blue-200/50': loyalty().tier === 'RisingStar',
                      'bg-gradient-to-r from-pink-200 to-rose-300 text-pink-900 shadow-pink-200/50': loyalty().tier === 'Nueva'
                    }">
                {{ loyalty().tier === 'VIP' ? '👑 Nivel VIP' : loyalty().tier === 'RisingStar' ? '🚀 En Ascenso' : '🌸 Nivel Base' }}
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Current Points -->
              <div class="bg-white/60 p-5 rounded-3xl border border-white shadow-sm flex items-center gap-4 hover:scale-[1.02] transition-transform">
                <div class="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center text-3xl shadow-inner border border-white shrink-0">✨</div>
                <div>
                  <p class="text-[10px] uppercase font-bold text-pink-400 tracking-wider mb-0.5">Saldo Actual</p>
                  <p class="text-3xl font-black text-pink-600 font-display leading-none">{{ loyalty().currentPoints }} <span class="text-base text-pink-300 font-medium">pts</span></p>
                  <p class="text-xs text-pink-500/70 mt-1 font-medium">Listos para canjear 🛍️</p>
                </div>
              </div>

              <!-- Lifetime Points -->
              <div class="bg-white/60 p-5 rounded-3xl border border-white shadow-sm flex items-center gap-4 hover:scale-[1.02] transition-transform">
                <div class="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-100 flex items-center justify-center text-3xl shadow-inner border border-white shrink-0">🌟</div>
                <div class="flex-1 w-full">
                  <p class="text-[10px] uppercase font-bold text-purple-400 tracking-wider mb-0.5">Puntos Históricos</p>
                  <p class="text-3xl font-black text-purple-600 font-display leading-none">{{ loyalty().lifetimePoints }} <span class="text-base text-purple-300 font-medium">pts</span></p>
                  
                  <!-- Progression Bar to Next Tier (Visual mockup) -->
                  <div class="mt-2.5 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div class="bg-gradient-to-r from-purple-400 to-pink-400 h-full rounded-full" 
                         [style.width]="getTierProgressWidth(loyalty().lifetimePoints)"></div>
                  </div>
                  <p class="text-[9px] text-purple-500/70 mt-1 uppercase font-bold text-right tracking-wider">{{ getNextTierGoal(loyalty().lifetimePoints) }}</p>
                </div>
              </div>
            </div>
            
            <div class="mt-6 flex justify-end gap-2 text-xs">
              <span class="text-pink-400/60 font-medium">✨ Cada compra suma más RegiPuntos</span>
            </div>
          </div>
        }
      }
    </div>
  `
})
export class ClientProfileComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  client = signal<ClientDto | null>(null);
  loyalty = signal<any>(null);
  loading = signal(true);
  editing = signal(false);
  isSaving = signal(false);
  editData = { name: '', phone: '', address: '', tag: 'None', type: 'Nueva', deliveryInstructions: '' };
  clientInsight = signal<string | null>(null);
  loadingInsight = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { this.goBack(); return; }
    this.api.getClient(id).subscribe({
      next: (c) => { this.client.set(c); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Clienta no encontrada'); }
    });
    this.api.getLoyaltySummary(id).subscribe({
      next: (l) => this.loyalty.set(l),
      error: () => { }
    });
  }

  goBack(): void { this.router.navigate(['/admin/clients']); }

  getTagLabel(tag: string): string { return CLIENT_TAG_LABELS[tag] || tag; }

  startEdit(): void {
    const c = this.client()!;
    this.editData = { name: c.name, phone: c.phone || '', address: c.address || '', tag: c.tag, type: c.type || 'Nueva', deliveryInstructions: c.deliveryInstructions || '' };
    this.editing.set(true);
  }

  saveEdit(): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);
    this.api.updateClient(this.client()!.id, this.editData).subscribe({
      next: () => {
        this.toast.success('Clienta actualizada 💖');
        this.editing.set(false);
        this.isSaving.set(false);
        this.api.getClient(this.client()!.id).subscribe(c => this.client.set(c));
      },
      error: () => {
        this.isSaving.set(false);
        this.toast.error('Error al actualizar');
      }
    });
  }

  onAddressSelected(address: string) {
    this.editData.address = address;
  }

  loadInsight(): void {
    if (this.loadingInsight()) return;
    this.loadingInsight.set(true);
    this.api.getClientInsight(this.client()!.id).subscribe({
      next: (res) => { this.clientInsight.set(res.text); this.loadingInsight.set(false); },
      error: () => { this.clientInsight.set('No pude generar el análisis en este momento.'); this.loadingInsight.set(false); }
    });
  }

  // --- Loyalty Visual Helpers ---
  getTierProgressWidth(lifetime: number): string {
    // Basic logic for visual progress bar. 
    // Let's assume:
    // 0 - 999 = Nueva (Base)
    // 1000 - 4999 = RisingStar
    // 5000+ = VIP
    if (lifetime < 1000) return `${(lifetime / 1000) * 100}%`;
    if (lifetime < 5000) return `${((lifetime - 1000) / 4000) * 100}%`;
    return '100%';
  }

  getNextTierGoal(lifetime: number): string {
    if (lifetime < 1000) return `${1000 - lifetime} pts para🚀En Ascenso`;
    if (lifetime < 5000) return `${5000 - lifetime} pts para👑VIP`;
    return '¡Máximo Nivel Alcanzado! 👑';
  }
}
