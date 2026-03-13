import { Component, inject, signal, OnInit, HostListener, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ClientDto, CLIENT_TAG_LABELS } from '../../../core/models';
import { gsap } from 'gsap';

@Component({
  selector: 'app-clients',
  imports: [FormsModule, CurrencyPipe],
  template: `
    <div class="relative min-h-[80vh] overflow-hidden -m-4 lg:-m-8 p-4 lg:p-8 isolate">
      <!-- Parallax Background Elements -->
      <div class="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-br from-pink-50/50 via-purple-50/50 to-rose-50/50 backdrop-blur-[2px]"></div>
        
        <!-- Slowest Layer -->
        <div class="absolute inset-0 opacity-40 transition-transform duration-75 ease-out"
             [style.transform]="'translateY(' + scrollY() * 0.1 + 'px)'">
          <div class="absolute top-[10%] left-[5%] text-6xl animate-pulse-slow blur-[1px]">🌸</div>
          <div class="absolute top-[60%] right-[10%] text-5xl opacity-50">✨</div>
        </div>
        
        <!-- Medium Layer -->
        <div class="absolute inset-0 opacity-60 transition-transform duration-75 ease-out"
             [style.transform]="'translateY(' + scrollY() * 0.25 + 'px)'">
          <div class="absolute top-[20%] right-[20%] text-4xl animate-float-delayed">💖</div>
          <div class="absolute top-[75%] left-[15%] text-5xl animate-bounce-slow blur-[1px]">🎀</div>
        </div>
        
        <!-- Fast Layer -->
        <div class="absolute inset-0 opacity-80 transition-transform duration-75 ease-out"
             [style.transform]="'translateY(' + scrollY() * 0.4 + 'px)'">
          <div class="absolute top-[40%] left-[8%] text-3xl animate-float">🌷</div>
          <div class="absolute top-[85%] right-[25%] text-2xl blur-[1px]">💎</div>
        </div>
      </div>

      <div class="space-y-6 relative z-10 max-w-7xl mx-auto">
        <div class="flex flex-wrap items-center justify-between gap-4 animate-slide-down">
          <div>
            <h1 class="text-3xl font-black text-pink-900 font-display flex items-center gap-3">
              <span class="animate-wiggle inline-block drop-shadow-md">💎</span> 
              Directorio de Clientas
            </h1>
            <p class="text-sm text-pink-500 font-medium ml-1 mt-1">El corazón de Regi Bazar 💕</p>
          </div>
          <div class="bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-pink-100 shadow-sm flex items-center gap-2">
            <span class="text-2xl animate-pulse">🌸</span>
            <div class="flex flex-col">
              <span class="text-xl font-black text-pink-700 leading-none">{{ filteredClients().length }}</span>
              <span class="text-[10px] uppercase font-bold text-pink-400 tracking-wider">Clientas</span>
            </div>
          </div>
        </div>

        <!-- Filters (Glassmorphic) -->
        <div class="bg-white/70 backdrop-blur-xl p-5 rounded-3xl border border-white shadow-[0_8px_30px_rgb(244,114,182,0.1)] animate-slide-up delay-100" style="opacity:0; animation-fill-mode: forwards;">
          <div class="flex flex-wrap gap-3 items-center">
            <div class="flex-1 min-w-[250px] relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400">🔍</span>
              <input class="w-full bg-white/60 border border-pink-200/50 rounded-2xl py-3 pl-10 pr-4 text-pink-900 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all shadow-inner" 
                     placeholder="Buscar por nombre, teléfono o dirección..." 
                     [ngModel]="search()" (ngModelChange)="search.set($event)" />
            </div>
            <select class="bg-white/60 border border-pink-200/50 rounded-2xl py-3 px-4 text-pink-700 font-medium focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all w-48 shadow-inner" 
                    [ngModel]="tagFilter()" (ngModelChange)="tagFilter.set($event)">
              <option value="">🏷️ Todas las etiquetas</option>
              <option value="None">🌸 Normal</option>
              <option value="RisingStar">🚀 En Ascenso</option>
              <option value="Vip">👑 Consentida VIP</option>
              <option value="Blacklist">🚫 Lista Negra</option>
            </select>
            <select class="bg-white/60 border border-pink-200/50 rounded-2xl py-3 px-4 text-pink-700 font-medium focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all w-44 shadow-inner" 
                    [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event)">
              <option value="">👥 Todos los tipos</option>
              <option value="Nueva">🌱 Nueva</option>
              <option value="Frecuente">💫 Frecuente</option>
            </select>
          </div>
        </div>

        @if (loading()) {
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            @for (i of [1,2,3,4,5,6]; track i) { 
              <div class="shimmer h-40 rounded-3xl border border-white/50 shadow-sm"></div> 
            }
          </div>
        } @else {
          <!-- Client Cards -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            @for (client of filteredClients(); track client.id; let i = $index) {
              <div class="client-card-anim group relative bg-white/80 backdrop-blur-xl p-5 rounded-3xl border border-white shadow-[0_8px_25px_rgb(0,0,0,0.04)] cursor-pointer opacity-0 translate-y-8 transition-all duration-300" 
                   (click)="viewProfile(client.id)">
                
                <!-- VIP Shimmer Overlay -->
                @if (client.tag === 'Vip') {
                  <div class="absolute inset-0 -translate-x-full group-hover:animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-12 z-0 rounded-3xl pointer-events-none transition-all duration-1000"></div>
                }

                <div class="relative z-10 flex flex-col h-full">
                  <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center gap-3">
                      <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-inner border border-white transition-transform group-hover:scale-110 group-hover:-rotate-3"
                           [class]="getAvatarClass(client.tag)">
                        {{ getAvatarEmoji(client.tag) }}
                      </div>
                      <div class="min-w-0">
                        <p class="font-black text-pink-900 text-lg leading-tight truncate font-display">{{ client.name }}</p>
                        <div class="flex items-center gap-1.5 mt-1">
                          <span class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest shadow-sm" [class]="getTagBadgeClass(client.tag)">
                            {{ getTagLabel(client.tag) }}
                          </span>
                          @if (client.type) {
                            <span class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-purple-50 text-purple-600 shadow-sm border border-purple-100">
                              {{ client.type }}
                            </span>
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Contact Details (Phone & Address) -->
                  <div class="bg-gray-50/50 rounded-2xl p-3 space-y-2.5 mb-4 border border-gray-100 flex-1">
                    <!-- Phone -->
                    <div class="flex items-center gap-2 text-xs">
                      <div class="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center shrink-0 text-[10px]">📱</div>
                      @if (client.phone) {
                        <span class="font-mono font-bold text-pink-700">{{ client.phone }}</span>
                      } @else {
                        <span class="text-gray-400 font-medium italic">Sin teléfono...</span>
                      }
                    </div>
                    <!-- Address -->
                    <div class="flex gap-2 text-xs">
                      <div class="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-[10px]">📍</div>
                      @if (client.address) {
                        <span class="text-blue-800/80 font-medium leading-tight line-clamp-2 mt-0.5" [title]="client.address">{{ client.address }}</span>
                      } @else {
                        <span class="text-gray-400 font-medium italic mt-0.5">Sin dirección guardada...</span>
                      }
                    </div>
                  </div>

                  <!-- Stats Footer -->
                  <div class="flex items-end justify-between pt-3 border-t border-pink-50">
                    <div>
                      <p class="text-[9px] uppercase font-bold text-pink-400 tracking-wider mb-0.5">Pedidos</p>
                      <p class="font-bold text-pink-700 flex items-center gap-1">
                        <span class="text-base leading-none">{{ client.ordersCount }}</span>
                        <span class="text-[10px] bg-pink-100 text-pink-600 px-1 rounded">📦</span>
                      </p>
                    </div>
                    <div class="text-right">
                      <p class="text-[9px] uppercase font-bold text-pink-400 tracking-wider mb-0.5">Inversión (Total)</p>
                      <p class="text-xl font-black text-pink-900 leading-none drop-shadow-sm font-display">{{ client.totalSpent | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>

          @if (filteredClients().length === 0) {
            <div class="bg-white/50 backdrop-blur-md rounded-3xl p-16 text-center shadow-inner border border-white mt-10">
              <div class="text-6xl mb-4 animate-bounce-slow drop-shadow-md">🦋</div>
              <h3 class="text-2xl font-black text-pink-900 font-display mb-2">No se encontraron clientas</h3>
              <p class="text-pink-500 font-medium">Intenta ajustando los filtros mágicos de búsqueda ✨</p>
            </div>
          }
        }
      </div>
    </div>
  `
})
export class ClientsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  clients = signal<ClientDto[]>([]);
  loading = signal(true);
  
  // Use signals for filters to make them reactive
  search = signal('');
  tagFilter = signal('');
  typeFilter = signal('');
  scrollY = signal(0);

  // Computed signal for filtered clients
  filteredClients = computed(() => {
    const clients = this.clients();
    const searchTerm = this.search().toLowerCase().trim();
    const tag = this.tagFilter().trim();
    const type = this.typeFilter().trim();

    return clients.filter(c => {
      // 1. Search filter
      const matchSearch = !searchTerm ||
        c.name.toLowerCase().includes(searchTerm) ||
        (c.phone && c.phone.includes(searchTerm)) ||
        (c.address && c.address.toLowerCase().includes(searchTerm));
      
      // 2. Tag filter (Case-insensitive)
      const matchTag = !tag || (c.tag && c.tag.toLowerCase() === tag.toLowerCase());
      
      // 3. Type filter (Case-insensitive + handle 'Nueva' as default)
      // If the filter is 'Nueva' and the client has no type, we consider it 'Nueva'
      const clientType = (c.type || (c as any).clientType || '').trim();
      const matchType = !type || 
        (clientType.toLowerCase() === type.toLowerCase()) ||
        (type.toLowerCase() === 'nueva' && !clientType);

      return matchSearch && matchTag && matchType;
    });
  });

  constructor() {
    // Automatically trigger animation when filtered list changes
    effect(() => {
      const list = this.filteredClients();
      if (!this.loading() && list.length > 0) {
        // Increase timeout slightly to ensure Angular's @for has finished rendering
        setTimeout(() => this.animateList(), 50);
      }
    });
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(event: Event) {
    this.scrollY.set(window.scrollY);
  }

  ngOnInit(): void {
    this.api.getClients().subscribe({
      next: (c) => {
        this.clients.set(c);
        this.loading.set(false);
      },
      error: () => { 
        this.loading.set(false); 
        this.toast.error('Error al cargar clientas'); 
      }
    });
  }

  private animateList(): void {
    // Reset state before animating
    gsap.set('.client-card-anim', { opacity: 0, y: 30 });
    
    gsap.to('.client-card-anim', {
      opacity: 1,
      y: 0,
      duration: 0.35, // Accelerated from 0.6
      stagger: 0.02, // Accelerated from 0.05
      ease: 'back.out(1.2)', 
      overwrite: true
    });
  }

  viewProfile(id: number): void {
    this.router.navigate(['/admin/clients', id]);
  }

  getTagLabel(tag: string): string { return CLIENT_TAG_LABELS[tag] || tag; }

  getAvatarEmoji(tag: string): string {
    const map: Record<string, string> = { 'Vip': '👑', 'RisingStar': '🚀', 'Blacklist': '🚫', 'None': '🌸' };
    return map[tag] || '🌸';
  }

  getAvatarClass(tag: string): string {
    const map: Record<string, string> = {
      'Vip': 'bg-amber-100', 'RisingStar': 'bg-blue-100', 'Blacklist': 'bg-red-100', 'None': 'bg-pink-100'
    };
    return map[tag] || 'bg-pink-100';
  }

  getTagBadgeClass(tag: string): string {
    const map: Record<string, string> = {
      'Vip': 'bg-amber-100 text-amber-700', 'RisingStar': 'bg-blue-100 text-blue-700',
      'Blacklist': 'bg-red-100 text-red-700', 'None': 'bg-pink-100 text-pink-700'
    };
    return map[tag] || 'bg-pink-100 text-pink-700';
  }
}
