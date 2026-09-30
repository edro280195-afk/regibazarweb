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
    <div class="rb-clients-page relative min-h-[80vh] overflow-hidden -m-4 lg:-m-8 px-4 py-5 lg:p-8">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-pink-50/70 via-white/40 to-purple-50/70"></div>
      <div class="pointer-events-none absolute right-[8%] top-24 text-3xl opacity-40">✦</div>
      <div class="pointer-events-none absolute left-[7%] top-[40%] text-4xl opacity-30">♡</div>

      <div class="relative z-10 mx-auto max-w-6xl space-y-5">
        <header class="flex items-end justify-between gap-3 animate-slide-down">
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.16em] text-pink-500">Tu comunidad bonita</p>
            <h1 class="mt-1 flex items-center gap-2 font-display text-3xl font-black leading-none text-pink-950">Mis clientas <span aria-hidden="true">💕</span></h1>
            <p class="mt-2 text-sm font-semibold text-pink-400">Encuentra a cualquiera en un parpadeo.</p>
          </div>
          <div class="grid min-w-[74px] justify-items-center rounded-2xl border border-white/80 bg-white/80 px-3 py-2 shadow-[6px_7px_14px_rgba(200,105,153,0.12)] backdrop-blur-md">
            <span class="text-lg leading-none">🌸</span>
            <strong class="text-xl leading-none text-pink-700">{{ clients().length }}</strong>
            <small class="text-[9px] font-black uppercase tracking-wider text-pink-400">Clientas</small>
          </div>
        </header>

        <div class="grid grid-cols-3 gap-2.5" aria-label="Resumen de clientas">
          <div class="rounded-2xl border border-white/80 bg-white/65 p-3 text-center shadow-sm"><strong class="block text-xl leading-none text-pink-700">{{ clients().length }}</strong><span class="mt-1 block text-[9px] font-black uppercase tracking-wider text-pink-400">Todas</span></div>
          <div class="rounded-2xl border border-white/80 bg-white/65 p-3 text-center shadow-sm"><strong class="block text-xl leading-none text-pink-700">{{ frequentClientsCount() }}</strong><span class="mt-1 block text-[9px] font-black uppercase tracking-wider text-pink-400">Frecuentes</span></div>
          <div class="rounded-2xl border border-white/80 bg-white/65 p-3 text-center shadow-sm"><strong class="block text-xl leading-none text-purple-700">{{ newClientsCount() }}</strong><span class="mt-1 block text-[9px] font-black uppercase tracking-wider text-purple-400">Nuevas</span></div>
        </div>

        <section class="rounded-3xl border border-white/80 bg-white/65 p-3.5 shadow-[0_14px_30px_rgba(244,114,182,0.1)] backdrop-blur-xl animate-slide-up" aria-label="Buscar y filtrar clientas">
          <div class="relative">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-pink-400">🔍</span>
            <input class="w-full rounded-2xl border border-white/90 bg-white/80 py-3 pl-10 pr-4 text-base font-semibold text-pink-950 shadow-inner outline-none placeholder:text-pink-300 focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                   placeholder="Busca nombre, teléfono o dirección..." aria-label="Buscar clienta"
                   [ngModel]="search()" (ngModelChange)="search.set($event)" />
          </div>
          <div class="mt-3 flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide" role="tablist" aria-label="Tipo de clienta">
            <button type="button" class="rounded-full border px-4 py-2 text-xs font-black transition-all"
                    [class]="typeFilter() === '' ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-500 shadow-md' : 'bg-white/70 text-pink-400 border-pink-100'"
                    [attr.aria-selected]="typeFilter() === ''" (click)="typeFilter.set('')">Todas</button>
            <button type="button" class="rounded-full border px-4 py-2 text-xs font-black transition-all"
                    [class]="typeFilter() === 'Frecuente' ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-500 shadow-md' : 'bg-white/70 text-pink-400 border-pink-100'"
                    [attr.aria-selected]="typeFilter() === 'Frecuente'" (click)="typeFilter.set('Frecuente')">Frecuentes</button>
            <button type="button" class="rounded-full border px-4 py-2 text-xs font-black transition-all"
                    [class]="typeFilter() === 'Nueva' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white border-purple-500 shadow-md' : 'bg-white/70 text-purple-400 border-purple-100'"
                    [attr.aria-selected]="typeFilter() === 'Nueva'" (click)="typeFilter.set('Nueva')">Nuevas</button>
            <select class="ml-auto min-w-[145px] rounded-full border border-pink-100 bg-white/75 px-3 py-2 text-xs font-black text-pink-600 outline-none focus:ring-2 focus:ring-pink-100"
                    aria-label="Filtrar por etiqueta" [ngModel]="tagFilter()" (ngModelChange)="tagFilter.set($event)">
              <option value="">🏷️ Etiqueta</option>
              <option value="None">🌸 Normal</option>
              <option value="RisingStar">🚀 En Ascenso</option>
              <option value="Vip">👑 Consentida VIP</option>
              <option value="Blacklist">🚫 Lista Negra</option>
            </select>
          </div>
        </section>

        @if (loading()) {
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            @for (i of [1,2,3,4,5,6]; track i) { <div class="shimmer h-20 rounded-2xl border border-white/60"></div> }
          </div>
        } @else {
          <section class="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3" aria-label="Lista de clientas">
            @for (client of filteredClients(); track client.id) {
              <button type="button" class="client-card-anim group flex w-full min-w-0 items-center gap-3 rounded-2xl border border-white/85 bg-white/75 p-3 text-left shadow-[5px_7px_14px_rgba(203,113,157,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]"
                      (click)="viewProfile(client.id)" [attr.aria-label]="'Abrir perfil de ' + client.name">
                <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl shadow-inner" [class]="getAvatarClass(client.tag)">{{ getAvatarEmoji(client.tag) }}</div>
                <div class="min-w-0 flex-1">
                  <strong class="block truncate text-sm font-black text-pink-950">{{ client.name }}</strong>
                  <span class="mt-1 block truncate text-[10px] font-bold text-pink-400"><span class="font-black text-pink-600">{{ getClientTypeLabel(client) }}</span> · {{ client.ordersCount }} pedidos</span>
                </div>
                <div class="shrink-0 text-right"><strong class="block text-xs font-black text-pink-700">{{ client.totalSpent | currency:'MXN':'symbol-narrow':'1.0-0' }}</strong><span class="block text-[9px] font-bold text-pink-300">invertido</span></div>
                <span class="text-pink-300" aria-hidden="true">›</span>
              </button>
            }
          </section>

          @if (filteredClients().length === 0) {
            <div class="rounded-3xl border border-white/80 bg-white/60 p-12 text-center shadow-inner">
              <div class="mb-3 text-5xl">🦋</div>
              <h2 class="font-display text-xl font-black text-pink-950">No encontramos a esa clienta</h2>
              <p class="mt-2 text-sm font-semibold text-pink-400">Prueba con otro nombre, teléfono o dirección ✨</p>
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
      const clientType = (c.type || '').trim();
      const matchType = !type || 
        (clientType.toLowerCase() === type.toLowerCase()) ||
        (type.toLowerCase() === 'nueva' && !clientType);

      return matchSearch && matchTag && matchType;
    });
  });

  frequentClientsCount = computed(() => this.clients().filter(client => this.isFrequentClient(client)).length);
  newClientsCount = computed(() => this.clients().filter(client => !this.isFrequentClient(client)).length);

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

  isFrequentClient(client: ClientDto): boolean {
    return (client.type ?? '').trim().toLowerCase() === 'frecuente' || (client.type ?? '').trim() === '' && client.ordersCount > 0;
  }

  getClientTypeLabel(client: ClientDto): string {
    return this.isFrequentClient(client) ? 'Frecuente' : 'Nueva';
  }

  getAvatarEmoji(tag: string): string {
    const map: Record<string, string> = { 'Vip': '👑', 'RisingStar': '🚀', 'Blacklist': '🚫', 'None': '🌸' };
    return map[tag] || '🌸';
  }

  getAvatarClass(tag: string): string {
    const map: Record<string, string> = {
      'Vip': 'bg-amber-100', 'RisingStar': 'bg-purple-100', 'Blacklist': 'bg-rose-100', 'None': 'bg-pink-100'
    };
    return map[tag] || 'bg-pink-100';
  }

  getTagBadgeClass(tag: string): string {
    const map: Record<string, string> = {
      'Vip': 'bg-amber-100 text-amber-700', 'RisingStar': 'bg-purple-100 text-purple-700',
      'Blacklist': 'bg-rose-100 text-rose-700', 'None': 'bg-pink-100 text-pink-700'
    };
    return map[tag] || 'bg-pink-100 text-pink-700';
  }
}
