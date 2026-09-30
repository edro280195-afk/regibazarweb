import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ClientDto, CLIENT_TAG_LABELS } from '../../../../core/models';
import { AddressEditorV2Component } from '../address-editor-v2/address-editor-v2.component';

@Component({
    selector: 'app-client-profile',
    standalone: true,
    imports: [CommonModule, FormsModule, CurrencyPipe, AddressEditorV2Component],
    template: `
    <div class="rb-client-detail-shell relative min-h-[80vh] overflow-hidden -m-4 px-4 py-5 lg:-m-8 lg:p-8">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-pink-50/70 via-white/40 to-purple-50/70"></div>
      <div class="pointer-events-none absolute right-[8%] top-24 text-3xl opacity-40">✦</div>
      <div class="pointer-events-none absolute left-[7%] top-[38%] text-4xl opacity-30">♡</div>

      <div class="relative z-10 mx-auto max-w-5xl space-y-5">
        <button class="btn-coquette btn-ghost text-sm" (click)="goBack()">← Clientas</button>

        @if (loading()) {
          <div class="space-y-3"><div class="shimmer h-44 rounded-3xl"></div><div class="shimmer h-28 rounded-3xl"></div><div class="shimmer h-56 rounded-3xl"></div></div>
        } @else if (client()) {
          @let c = clientView();
          <header class="relative overflow-hidden rounded-[2rem] border border-white/90 bg-white/75 p-5 shadow-[0_16px_35px_rgba(203,113,157,0.12)] backdrop-blur-xl animate-scale-in">
            <div class="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-pink-100/80"></div>
            <div class="relative flex items-start gap-4">
              <div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.6rem] text-4xl shadow-inner"
                   [class]="c.tag === 'Vip' ? 'bg-amber-100' : c.tag === 'RisingStar' ? 'bg-purple-100' : c.tag === 'Blacklist' ? 'bg-rose-100' : 'bg-pink-100'">
                {{ c.tag === 'Vip' ? '👑' : c.tag === 'RisingStar' ? '🚀' : c.tag === 'Blacklist' ? '🚫' : '🌸' }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-black uppercase tracking-[0.16em] text-pink-500">Perfil de tu clienta</p>
                @if (!editingInfo()) {
                  <h1 class="mt-1 truncate font-display text-2xl font-black leading-tight text-pink-950 sm:text-3xl">{{ c.name }}</h1>
                  <p class="mt-2 truncate text-sm font-bold text-pink-400">{{ c.phone || 'Sin teléfono guardado' }}</p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <span class="rounded-full bg-pink-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-pink-700">{{ getTagLabel(c.tag) }}</span>
                    <span class="rounded-full bg-purple-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-purple-700">{{ c.type || 'Nueva' }}</span>
                  </div>
                } @else {
                  <div class="mt-2 space-y-2.5">
                    <input class="input-coquette w-full text-base" [(ngModel)]="infoForm.name" placeholder="Nombre completo" />
                    <input class="input-coquette w-full text-base" [(ngModel)]="infoForm.phone" placeholder="Teléfono" inputmode="tel" />
                    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <select class="input-coquette text-base" [(ngModel)]="infoForm.tag"><option value="None">Normal</option><option value="RisingStar">🚀 En Ascenso</option><option value="Vip">👑 Consentida</option><option value="Blacklist">🚫 Lista Negra</option></select>
                      <select class="input-coquette text-base" [(ngModel)]="infoForm.type"><option value="Nueva">Nueva</option><option value="Frecuente">Frecuente</option></select>
                    </div>
                    <div class="flex flex-wrap gap-2 pt-1">
                      <button class="btn-coquette btn-pink flex items-center gap-2" [disabled]="isSavingInfo()" (click)="saveInfo()">@if (isSavingInfo()) { <span class="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> } 💖 Guardar</button>
                      <button class="btn-coquette btn-ghost" [disabled]="isSavingInfo()" (click)="editingInfo.set(false)">Cancelar</button>
                    </div>
                  </div>
                }
              </div>
              @if (!editingInfo()) {
                <button class="shrink-0 rounded-full border border-pink-100 bg-white/80 px-3 py-2 text-xs font-black text-pink-600 shadow-sm" (click)="startEditInfo()">✏️ Editar</button>
              }
            </div>
          </header>

          <section class="grid grid-cols-3 gap-2.5" aria-label="Resumen de clienta">
            <div class="rounded-2xl border border-white/85 bg-white/70 p-3 text-center shadow-sm"><strong class="block text-xl leading-none text-pink-700">{{ c.ordersCount }}</strong><span class="mt-1 block text-[9px] font-black uppercase tracking-wider text-pink-400">Pedidos</span></div>
            <div class="rounded-2xl border border-white/85 bg-white/70 p-3 text-center shadow-sm"><strong class="block truncate text-base leading-none text-pink-700">{{ c.totalSpent | currency:'MXN':'symbol-narrow':'1.0-0' }}</strong><span class="mt-1 block text-[9px] font-black uppercase tracking-wider text-pink-400">Invertido</span></div>
            <div class="rounded-2xl border border-white/85 bg-white/70 p-3 text-center shadow-sm"><strong class="block text-xl leading-none text-purple-700">{{ loyalty()?.currentPoints ?? 0 }}</strong><span class="mt-1 block text-[9px] font-black uppercase tracking-wider text-purple-400">RegiPuntos</span></div>
          </section>

          <section class="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <article class="rounded-3xl border border-white/85 bg-white/70 p-5 shadow-[0_12px_28px_rgba(203,113,157,0.09)] backdrop-blur-xl">
              <div class="flex items-center justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-[0.14em] text-pink-500">Datos útiles</p><h2 class="mt-1 font-display text-xl font-black text-pink-950">Para atenderla bonito</h2></div><span class="text-2xl">🎀</span></div>
              <div class="mt-5 space-y-3">
                <div class="flex items-start gap-3 rounded-2xl bg-white/70 p-3"><span class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-pink-100">📱</span><div class="min-w-0"><p class="text-[10px] font-black uppercase tracking-wider text-pink-400">Teléfono</p>@if (c.phone) { <a class="block truncate text-sm font-black text-pink-700" [href]="'tel:' + c.phone">{{ c.phone }}</a> } @else { <p class="text-sm font-semibold italic text-pink-300">Sin teléfono guardado</p> }</div></div>
                <div class="flex items-start gap-3 rounded-2xl bg-white/70 p-3"><span class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-purple-100">📍</span><div class="min-w-0"><p class="text-[10px] font-black uppercase tracking-wider text-purple-400">Dirección</p><p class="line-clamp-3 text-sm font-semibold text-pink-700">{{ c.address || 'Sin dirección guardada' }}</p></div></div>
                <div class="flex items-start gap-3 rounded-2xl bg-white/70 p-3"><span class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-100">💌</span><div class="min-w-0 flex-1"><p class="text-[10px] font-black uppercase tracking-wider text-rose-400">Instrucciones</p>@if (!editingInstructions()) { <p class="text-sm font-semibold text-pink-700">{{ c.deliveryInstructions || 'Sin instrucciones guardadas' }}</p> } @else { <textarea [(ngModel)]="instructionsText" rows="3" class="input-coquette mt-1 w-full resize-none text-base" placeholder="Ej. Casa rosa, portón negro..."></textarea><div class="mt-2 flex gap-2"><button class="btn-coquette btn-pink text-xs" [disabled]="isSavingInstructions()" (click)="saveInstructions(c)">Guardar</button><button class="btn-coquette btn-ghost text-xs" (click)="editingInstructions.set(false)">Cancelar</button></div> } </div>@if (!editingInstructions()) { <button class="text-xs font-black text-pink-500" (click)="startEditInstructions(c)" aria-label="Editar instrucciones">✏️</button>}</div>
              </div>
            </article>

            <article class="overflow-hidden rounded-3xl border border-white/85 bg-white/70 shadow-[0_12px_28px_rgba(203,113,157,0.09)] backdrop-blur-xl">
              <div class="flex items-center justify-between gap-3 border-b border-pink-100/60 p-5"><div><p class="text-[10px] font-black uppercase tracking-[0.14em] text-pink-500">Entrega</p><h2 class="mt-1 font-display text-xl font-black text-pink-950">Su rinconcito</h2><p class="mt-1 text-[11px] font-semibold text-pink-400">{{ locationStatusText(c) }}</p></div><span class="rounded-full px-3 py-1 text-[10px] font-black" [class]="locationStatusClass(c)">{{ locationStatusBadge(c) }}</span></div>
              @if (c.latitude != null && c.longitude != null) {
                <div class="relative"><img [src]="staticMapUrl(c)" alt="Mapa de ubicación de la clienta" class="h-48 w-full object-cover" loading="lazy" /><div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-pink-950/70 to-transparent px-4 py-4"><p class="truncate text-xs font-black text-white">{{ c.address || 'Ubicación guardada' }}</p></div></div>
              } @else {
                <div class="p-8 text-center"><div class="mb-2 text-4xl">🗺️</div><p class="text-sm font-black text-pink-700">Todavía no hay ubicación precisa</p><p class="mt-1 text-xs font-semibold text-pink-300">Fíjala para que la entrega sea más fácil.</p></div>
              }
              <div class="flex items-center justify-between gap-3 border-t border-pink-100/60 bg-white/50 p-4"><p class="text-xs font-bold text-pink-400">{{ c.latitude ? 'Ubicación lista para ruta' : 'Podemos ubicarla ahora' }}</p><button class="rounded-xl bg-pink-100 px-3 py-2 text-xs font-black text-pink-700" (click)="addressEditorOpen.set(true)">{{ c.latitude ? '✏️ Reubicar' : '📍 Fijar ubicación' }}</button></div>
            </article>
          </section>

          <section class="rounded-3xl border border-purple-100/80 bg-gradient-to-br from-purple-50/90 via-white/70 to-pink-50/90 p-5 shadow-[0_12px_28px_rgba(167,139,250,0.1)]">
            <div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-[0.14em] text-purple-500">C.A.M.I.</p><h2 class="mt-1 font-display text-xl font-black text-purple-950">Entiende mejor a tu clienta</h2></div><button class="btn-coquette btn-outline-pink text-xs" (click)="loadInsight()" [disabled]="loadingInsight()">@if (loadingInsight()) { Analizando... } @else { ✦ {{ clientInsight() ? 'Actualizar análisis' : 'Ver análisis' }} }</button></div>
            @if (clientInsight()) { <p class="mt-4 rounded-2xl bg-white/65 p-4 text-sm font-semibold leading-relaxed text-purple-900">{{ clientInsight() }}</p> } @else if (!loadingInsight()) { <p class="mt-3 text-xs font-semibold text-purple-400">Obtén una lectura breve de sus hábitos de compra y atención.</p> }
          </section>

          @if (loyalty()) {
            <section class="rounded-3xl border border-white/85 bg-white/70 p-5 shadow-[0_12px_28px_rgba(203,113,157,0.09)] backdrop-blur-xl">
              <div class="flex items-center justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-[0.14em] text-pink-500">Premios por consentirla</p><h2 class="mt-1 flex items-center gap-2 font-display text-xl font-black text-pink-950">RegiPuntos ✨</h2></div><span class="rounded-full bg-pink-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-pink-700">{{ loyalty().tier }}</span></div>
              <div class="mt-5 grid gap-3 sm:grid-cols-2"><div class="rounded-2xl bg-white/70 p-4"><p class="text-[10px] font-black uppercase tracking-wider text-pink-400">Saldo actual</p><p class="mt-1 font-display text-3xl font-black text-pink-700">{{ loyalty().currentPoints }} <span class="text-sm font-bold text-pink-300">pts</span></p></div><div class="rounded-2xl bg-white/70 p-4"><p class="text-[10px] font-black uppercase tracking-wider text-purple-400">Históricos</p><p class="mt-1 font-display text-3xl font-black text-purple-700">{{ loyalty().lifetimePoints }} <span class="text-sm font-bold text-purple-300">pts</span></p><div class="mt-3 h-2 overflow-hidden rounded-full bg-purple-100"><div class="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400" [style.width]="getTierProgressWidth(loyalty().lifetimePoints)"></div></div><p class="mt-1 text-right text-[9px] font-black uppercase tracking-wider text-purple-400">{{ getNextTierGoal(loyalty().lifetimePoints) }}</p></div></div>
            </section>
          }
        }

        @if (addressEditorOpen() && client()) {
          <app-address-editor-v2 [clientName]="client()!.name" [initialAddress]="client()!.address ?? ''" [initialLat]="client()!.latitude" [initialLng]="client()!.longitude" [initialInstructions]="client()!.deliveryInstructions ?? ''" (confirm)="onAddressConfirmed($event)" (cancel)="addressEditorOpen.set(false)"></app-address-editor-v2>
        }
      </div>
    </div>

    @if (false) {
    <div class="space-y-6">
        <button class="btn-coquette btn-ghost text-sm" (click)="goBack()">← Volver a Clientas</button>

        @if (loading()) {
            <div class="shimmer h-40 rounded-2xl"></div>
        } @else if (client()) {
            @let c = clientView();

            <!-- ── Profile Card ── -->
            <div class="card-coquette p-6 animate-scale-in relative overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-pink-100/50 rounded-full -translate-y-10 translate-x-10 pointer-events-none"></div>
                <div class="relative flex flex-wrap items-start gap-6">
                    <div class="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                         [class]="c.tag === 'Vip' ? 'bg-amber-100' : c.tag === 'RisingStar' ? 'bg-purple-100' : 'bg-pink-100'">
                        {{ c.tag === 'Vip' ? '👑' : c.tag === 'RisingStar' ? '🚀' : '🌸' }}
                    </div>

                    <div class="flex-1 min-w-0">
                        @if (!editingInfo()) {
                            <h2 class="text-2xl font-bold text-pink-900">{{ c.name }}</h2>
                            @if (c.phone) { <p class="text-pink-500 mt-1">📱 {{ c.phone }}</p> }
                            <div class="flex items-center gap-3 mt-3">
                                <span class="badge"
                                      [class]="c.tag === 'Vip' ? 'bg-amber-100 text-amber-700' : c.tag === 'RisingStar' ? 'bg-purple-100 text-purple-700' : 'bg-pink-100 text-pink-700'">
                                    {{ getTagLabel(c.tag) }}
                                </span>
                                @if (c.type) { <span class="badge bg-purple-50 text-purple-600">{{ c.type }}</span> }
                            </div>
                            <button class="btn-coquette btn-outline-pink text-xs mt-3" (click)="startEditInfo()">
                                ✏️ Editar datos
                            </button>
                        } @else {
                            <div class="space-y-3">
                                <input class="input-coquette" [(ngModel)]="infoForm.name" placeholder="Nombre" />
                                <input class="input-coquette" [(ngModel)]="infoForm.phone" placeholder="Teléfono" />
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <select class="input-coquette" [(ngModel)]="infoForm.tag">
                                        <option value="None">Normal</option>
                                        <option value="RisingStar">🚀 En Ascenso</option>
                                        <option value="Vip">👑 Consentida</option>
                                        <option value="Blacklist">🚫 Lista Negra</option>
                                    </select>
                                    <select class="input-coquette" [(ngModel)]="infoForm.type">
                                        <option value="Nueva">Nueva</option>
                                        <option value="Frecuente">Frecuente</option>
                                    </select>
                                </div>
                                <div class="flex gap-2">
                                    <button class="btn-coquette btn-pink flex items-center gap-2"
                                            [disabled]="isSavingInfo()" (click)="saveInfo()">
                                        @if (isSavingInfo()) {
                                            <span class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        }
                                        💖 Guardar
                                    </button>
                                    <button class="btn-coquette btn-ghost" [disabled]="isSavingInfo()" (click)="editingInfo.set(false)">Cancelar</button>
                                </div>
                            </div>
                        }
                    </div>

                    <div class="text-right shrink-0">
                        <p class="text-3xl font-bold text-pink-900">{{ c.totalSpent | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
                        <p class="text-sm text-pink-400">{{ c.ordersCount }} pedidos</p>
                    </div>
                </div>
            </div>

            <!-- ── Location Card ── -->
            <div class="card-coquette overflow-hidden animate-slide-up">
                <div class="p-5 border-b border-pink-50 flex items-center justify-between">
                    <div>
                        <h3 class="text-base font-black text-pink-900 flex items-center gap-2">
                            📍 Ubicación de entrega
                        </h3>
                        <p class="text-[11px] text-pink-400 mt-0.5">
                            {{ locationStatusText(c) }}
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-black"
                              [class]="locationStatusClass(c)">
                            {{ locationStatusBadge(c) }}
                        </span>
                        <button (click)="addressEditorOpen.set(true)"
                                class="px-4 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-600 text-xs font-black transition-all active:scale-95">
                            {{ c.latitude ? '✏️ Reubicar' : '📍 Fijar ubicación' }}
                        </button>
                    </div>
                </div>

                @if (c.latitude != null && c.longitude != null) {
                    <!-- Mini-map via Static Maps API -->
                    <div class="relative">
                        <img [src]="staticMapUrl(c)"
                             alt="Mapa de ubicación"
                             class="w-full h-48 object-cover"
                             loading="lazy" />
                        <!-- Address overlay -->
                        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
                            <p class="text-white text-xs font-bold truncate">{{ c.address || 'Sin dirección guardada' }}</p>
                            @if (c.deliveryInstructions) {
                                <p class="text-white/70 text-[10px] truncate mt-0.5">{{ c.deliveryInstructions }}</p>
                            }
                        </div>
                    </div>
                } @else {
                    <!-- No coords yet -->
                    <div class="p-6 text-center bg-gray-50/50">
                        <p class="text-3xl mb-2">🗺️</p>
                        <p class="text-sm font-bold text-gray-500">Sin ubicación precisa</p>
                        @if (c.address) {
                            <p class="text-xs text-gray-400 mt-1 px-4">{{ c.address }}</p>
                        }
                        <button (click)="addressEditorOpen.set(true)"
                                class="mt-3 px-5 py-2 rounded-xl bg-pink-500 text-white text-xs font-black hover:bg-pink-600 transition-all active:scale-95">
                            📍 Fijar en el mapa
                        </button>
                    </div>
                }

                <!-- Instructions edit (inline, quick) -->
                <div class="p-4 border-t border-pink-50/60 bg-white">
                    @if (!editingInstructions()) {
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-1">Instrucciones de entrega</p>
                                <p class="text-sm text-pink-700">{{ c.deliveryInstructions || 'Sin instrucciones guardadas' }}</p>
                            </div>
                            <button (click)="startEditInstructions(c)" class="text-xs text-pink-400 hover:text-pink-600 font-bold shrink-0 transition-colors">
                                ✏️
                            </button>
                        </div>
                    } @else {
                        <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-2">Instrucciones de entrega</p>
                        <textarea [(ngModel)]="instructionsText" rows="2"
                                  placeholder="Ej: Casa rosa, portón negro, tocar timbre"
                                  class="input-coquette resize-none text-sm mb-2">
                        </textarea>
                        <div class="flex gap-2">
                            <button (click)="saveInstructions(c)"
                                    [disabled]="isSavingInstructions()"
                                    class="btn-coquette btn-pink text-xs flex items-center gap-2">
                                @if (isSavingInstructions()) {
                                    <span class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                }
                                Guardar
                            </button>
                            <button (click)="editingInstructions.set(false)" class="btn-coquette btn-ghost text-xs">Cancelar</button>
                        </div>
                    }
                </div>
            </div>

            <!-- ── AI Client Analysis ── -->
            <div class="card-coquette p-6 animate-slide-up"
                 style="border: 1px solid rgba(139,92,246,0.2); background: linear-gradient(135deg, rgba(245,243,255,0.9), rgba(253,242,248,0.9));">
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
                    <p class="text-xs text-purple-400">Presiona "Ver análisis" para obtener un perfil de comportamiento generado por IA.</p>
                }
            </div>

            <!-- ── Loyalty ── -->
            @if (loyalty()) {
                <div class="card-coquette p-6 animate-slide-up delay-200 relative overflow-hidden isolate" style="opacity:0; animation-fill-mode: forwards;">
                    <div class="absolute inset-0 bg-gradient-to-br from-pink-50 via-white to-purple-50 -z-10"></div>
                    <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-pink-200/40 via-purple-100/20 to-transparent rounded-bl-full -z-10 blur-xl"></div>

                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-bold text-pink-900 font-display flex items-center gap-2">
                            <span class="text-2xl animate-pulse-slow drop-shadow-[0_0_8px_rgba(244,114,182,0.6)]">💎</span> RegiPuntos
                        </h3>
                        <span class="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm"
                              [ngClass]="{
                                'bg-gradient-to-r from-cyan-200 to-violet-300 text-violet-900': loyalty().tierKey === 'diamante',
                                'bg-gradient-to-r from-pink-200 to-rose-300 text-rose-900': loyalty().tierKey === 'rosegold',
                                'bg-gradient-to-r from-pink-100 to-pink-200 text-pink-800': loyalty().tierKey === 'pink'
                              }">
                            {{ loyalty().tier }}
                        </span>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="bg-white/60 p-5 rounded-3xl border border-white shadow-sm flex items-center gap-4">
                            <div class="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center text-3xl shadow-inner border border-white shrink-0">✨</div>
                            <div>
                                <p class="text-[10px] uppercase font-bold text-pink-400 tracking-wider mb-0.5">Saldo Actual</p>
                                <p class="text-3xl font-black text-pink-600 font-display leading-none">{{ loyalty().currentPoints }} <span class="text-base text-pink-300 font-medium">pts</span></p>
                            </div>
                        </div>
                        <div class="bg-white/60 p-5 rounded-3xl border border-white shadow-sm flex items-center gap-4">
                            <div class="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-100 flex items-center justify-center text-3xl shadow-inner border border-white shrink-0">🌟</div>
                            <div class="flex-1 w-full">
                                <p class="text-[10px] uppercase font-bold text-purple-400 tracking-wider mb-0.5">Puntos Históricos</p>
                                <p class="text-3xl font-black text-purple-600 font-display leading-none">{{ loyalty().lifetimePoints }} <span class="text-base text-purple-300 font-medium">pts</span></p>
                                <div class="mt-2.5 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                    <div class="bg-gradient-to-r from-purple-400 to-pink-400 h-full rounded-full"
                                         [style.width]="getTierProgressWidth(loyalty().lifetimePoints)"></div>
                                </div>
                                <p class="text-[9px] text-purple-500/70 mt-1 uppercase font-bold text-right tracking-wider">{{ getNextTierGoal(loyalty().lifetimePoints) }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            }
        }

        <!-- ── Address Editor Modal ── -->
        @if (addressEditorOpen() && client()) {
            <app-address-editor-v2
                [clientName]="client()!.name"
                [initialAddress]="client()!.address ?? ''"
                [initialLat]="client()!.latitude"
                [initialLng]="client()!.longitude"
                [initialInstructions]="client()!.deliveryInstructions ?? ''"
                (confirm)="onAddressConfirmed($event)"
                (cancel)="addressEditorOpen.set(false)">
            </app-address-editor-v2>
        }
    </div>
    }
    `
})
export class ClientProfileComponent implements OnInit {
    private api = inject(ApiService);
    private toast = inject(ToastService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    private readonly MAPS_KEY = 'AIzaSyD0h3ou4iWXQtthgXE-LMewALcWpYdzzJk';

    client = signal<ClientDto | null>(null);
    clientView = computed(() => this.client() as ClientDto);
    loyalty = signal<any>(null);
    loading = signal(true);

    // General info editing
    editingInfo = signal(false);
    isSavingInfo = signal(false);
    infoForm = { name: '', phone: '', tag: 'None', type: 'Nueva' };

    // Address editor
    addressEditorOpen = signal(false);

    // Inline instructions editing
    editingInstructions = signal(false);
    isSavingInstructions = signal(false);
    instructionsText = '';

    // CAMI
    clientInsight = signal<string | null>(null);
    loadingInsight = signal(false);

    ngOnInit(): void {
        const id = Number(this.route.snapshot.paramMap.get('id'));
        if (!id) { this.goBack(); return; }
        this.loadClient(id);
        this.api.getLoyaltySummary(id).subscribe({ next: (l) => this.loyalty.set(l), error: () => {} });
    }

    private loadClient(id: number): void {
        this.api.getClient(id).subscribe({
            next: (c) => { this.client.set(c); this.loading.set(false); },
            error: () => { this.loading.set(false); this.toast.error('Clienta no encontrada'); }
        });
    }

    goBack(): void { this.router.navigate(['/admin/clients']); }

    getTagLabel(tag: string): string { return CLIENT_TAG_LABELS[tag] || tag; }

    // ── Info editing ──

    startEditInfo(): void {
        const c = this.client()!;
        this.infoForm = { name: c.name, phone: c.phone ?? '', tag: c.tag, type: c.type ?? 'Nueva' };
        this.editingInfo.set(true);
    }

    saveInfo(): void {
        if (this.isSavingInfo()) return;
        const c = this.client()!;
        this.isSavingInfo.set(true);
        this.api.updateClient(c.id, {
            name: this.infoForm.name,
            phone: this.infoForm.phone,
            address: c.address ?? '',
            tag: this.infoForm.tag,
            type: this.infoForm.type,
            deliveryInstructions: c.deliveryInstructions
        }).subscribe({
            next: () => {
                this.toast.success('Datos guardados 💖');
                this.editingInfo.set(false);
                this.isSavingInfo.set(false);
                this.loadClient(c.id);
            },
            error: () => { this.isSavingInfo.set(false); this.toast.error('Error al guardar'); }
        });
    }

    // ── Instructions editing ──

    startEditInstructions(c: ClientDto): void {
        this.instructionsText = c.deliveryInstructions ?? '';
        this.editingInstructions.set(true);
    }

    saveInstructions(c: ClientDto): void {
        if (this.isSavingInstructions()) return;
        this.isSavingInstructions.set(true);
        this.api.updateClient(c.id, {
            name: c.name,
            phone: c.phone ?? '',
            address: c.address ?? '',
            tag: c.tag,
            type: c.type ?? 'Nueva',
            deliveryInstructions: this.instructionsText
        }).subscribe({
            next: () => {
                this.toast.success('Instrucciones guardadas 📝');
                this.editingInstructions.set(false);
                this.isSavingInstructions.set(false);
                this.loadClient(c.id);
            },
            error: () => { this.isSavingInstructions.set(false); this.toast.error('Error al guardar'); }
        });
    }

    // ── Address editor confirm ──

    onAddressConfirmed(result: { address: string; lat: number; lng: number; deliveryInstructions: string }): void {
        const c = this.client()!;
        this.api.setClientCoordinates(
            c.id,
            result.lat,
            result.lng,
            result.address,
            result.deliveryInstructions
        ).subscribe({
            next: () => {
                this.toast.success('📍 Ubicación guardada');
                this.addressEditorOpen.set(false);
                this.loadClient(c.id);
            },
            error: () => this.toast.error('Error al guardar la ubicación')
        });
    }

    // ── Location display helpers ──

    staticMapUrl(c: ClientDto): string {
        if (!c.latitude || !c.longitude) return '';
        const lat = c.latitude;
        const lng = c.longitude;
        const marker = `color:0xec4899|${lat},${lng}`;
        return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=800x400&markers=${encodeURIComponent(marker)}&key=${this.MAPS_KEY}&scale=2&style=feature:poi|visibility:off`;
    }

    locationStatusText(c: ClientDto): string {
        if (c.latitude != null && c.longitude != null) return `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`;
        if (c.address) return 'Dirección sin coordenadas — toca "Fijar en el mapa"';
        return 'Sin dirección ni coordenadas';
    }

    locationStatusBadge(c: ClientDto): string {
        if (c.latitude != null) return '🎯 Precisa';
        if (c.address) return '🌀 Sin ubicar';
        return '❓ Vacía';
    }

    locationStatusClass(c: ClientDto): string {
        if (c.latitude != null) return 'bg-emerald-100 text-emerald-700';
        if (c.address) return 'bg-amber-100 text-amber-700';
        return 'bg-gray-100 text-gray-500';
    }

    // ── CAMI ──

    loadInsight(): void {
        if (this.loadingInsight()) return;
        this.loadingInsight.set(true);
        this.api.getClientInsight(this.client()!.id).subscribe({
            next: (res) => { this.clientInsight.set(res.text); this.loadingInsight.set(false); },
            error: () => { this.clientInsight.set('No pude generar el análisis.'); this.loadingInsight.set(false); }
        });
    }

    // ── Loyalty helpers ──

    getTierProgressWidth(lifetime: number): string {
        if (lifetime < 1000) return `${(lifetime / 1000) * 100}%`;
        if (lifetime < 5000) return `${((lifetime - 1000) / 4000) * 100}%`;
        return '100%';
    }

    getNextTierGoal(lifetime: number): string {
        if (lifetime < 1000) return `${1000 - lifetime} pts para 🚀 En Ascenso`;
        if (lifetime < 5000) return `${5000 - lifetime} pts para 👑 VIP`;
        return '¡Máximo Nivel Alcanzado! 👑';
    }
}
