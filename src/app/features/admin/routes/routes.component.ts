import { Component, OnInit, OnDestroy, signal, computed, HostListener, CUSTOM_ELEMENTS_SCHEMA, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, KeyValuePipe } from '@angular/common';
import { GoogleMap, MapMarker, MapDirectionsRenderer } from '@angular/google-maps';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ApiService } from '../../../core/services/api.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { ToastService } from '../../../core/services/toast.service';
import { RouteDto, RouteDeliveryDto, OrderSummaryDto, DriverExpenseDto, OrderPaymentDto, AiRouteSelectionResponse } from '../../../core/models';
import { environment } from '../../../../environments/environment';
import { RouteOptimizerComponent } from './route-optimizer/route-optimizer.component';

// ─── CONFIG ────────────────────────────────────────────────────
const GEO_CONFIG = {
  googleApiKey: environment.googleMapsApiKey || '',
  city: 'Nuevo Laredo',
  state: 'Tamaulipas',
  country: 'Mexico',
  defaultLat: 27.4861,
  defaultLng: -99.5069,
};

interface GeocodedOrder extends OrderSummaryDto {
  _lat?: number;
  _lng?: number;
  _geocoded: boolean;
}

@Component({
  selector: 'app-routes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GoogleMap,
    MapMarker,
    MapDirectionsRenderer,
    DragDropModule,
    RouteOptimizerComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="relative min-h-screen pb-20">

      <!-- ═══ PARALLAX FLOATING ELEMENTS ═══ -->
      <div class="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div class="absolute text-6xl opacity-[0.04] animate-float" [style.top.px]="80" [style.left.%]="5"
             [style.transform]="'translateY(' + (scrollY() * 0.15) + 'px)'">🚗</div>
        <div class="absolute text-5xl opacity-[0.05] animate-float" style="animation-delay:1s" [style.top.px]="200" [style.right.%]="8"
             [style.transform]="'translateY(' + (scrollY() * 0.1) + 'px)'">📦</div>
        <div class="absolute text-4xl opacity-[0.04] animate-float" style="animation-delay:2s" [style.top.px]="400" [style.left.%]="70"
             [style.transform]="'translateY(' + (scrollY() * 0.2) + 'px)'">🗺️</div>
        <div class="absolute text-5xl opacity-[0.03] animate-float" style="animation-delay:3s" [style.top.px]="600" [style.left.%]="20"
             [style.transform]="'translateY(' + (scrollY() * 0.12) + 'px)'">💎</div>
        <div class="absolute text-3xl opacity-[0.05] animate-sparkle" style="animation-delay:0.5s" [style.top.px]="150" [style.left.%]="45"
             [style.transform]="'translateY(' + (scrollY() * 0.18) + 'px)'">✨</div>
        <div class="absolute text-4xl opacity-[0.04] animate-float" style="animation-delay:4s" [style.top.px]="700" [style.right.%]="15"
             [style.transform]="'translateY(' + (scrollY() * 0.08) + 'px)'">🌸</div>
      </div>

      <!-- ═══════════════════════════════════════════════════
           MODO COMANDO: ORQUESTACIÓN AI (Command Center)
           ═══════════════════════════════════════════════════ -->
      @if (isOrchestrating()) {
        <div class="fixed inset-0 z-[6000] bg-slate-950/90 backdrop-blur-3xl flex items-center justify-center p-6 animate-fade-in">
          
          <!-- Background Cyber-Grid -->
          <div class="absolute inset-0 opacity-10 pointer-events-none" 
               style="background-image: radial-gradient(circle at 2px 2px, #ec4899 1px, transparent 0); background-size: 40px 40px;"></div>

          <div class="relative w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            
            <!-- Left: AI Core & Radar -->
            <div class="flex flex-col items-center">
              <div class="relative w-64 h-64 mb-10">
                <!-- Outer Rings -->
                <div class="absolute inset-0 border-2 border-pink-500/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
                <div class="absolute inset-4 border border-indigo-500/30 rounded-full animate-[spin_6s_linear_infinite_reverse]"></div>
                
                <!-- Pulsing Core -->
                <div class="absolute inset-16 bg-gradient-to-tr from-fuchsia-600 to-indigo-600 rounded-full blur-2xl animate-pulse opacity-60"></div>
                <div class="absolute inset-[72px] bg-white/10 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center z-10 overflow-hidden shadow-[0_0_50px_rgba(236,72,153,0.5)]">
                  <div class="text-5xl animate-bounce">🛰️</div>
                </div>

                <!-- Orbiting Particles -->
                <div class="absolute inset-0 animate-[spin_4s_linear_infinite]">
                  <div class="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-pink-400 rounded-full shadow-[0_0_15px_#f472b6]"></div>
                </div>
              </div>

              <h2 class="text-2xl font-black text-white tracking-widest uppercase mb-2">Command Center</h2>
              <p class="text-indigo-300 font-mono text-xs tracking-[0.3em] uppercase opacity-80">Orquestando Ruta Mágica</p>
            </div>

            <!-- Right: Activity Feed -->
            <div class="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md min-h-[300px] flex flex-col">
              <div class="flex items-center gap-2 mb-6 pb-4 border-b border-white/10">
                <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span class="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-mono">Live AI Stream</span>
              </div>

              <div class="flex-1 space-y-4">
                @for (entry of orchestrationFeed(); track entry; let i = $index) {
                  <div class="animate-fade-in-down flex gap-3" [style.animation-delay]="(i * 100) + 'ms'">
                    <span class="text-pink-500/50 font-mono text-[10px]">{{ i + 1 }}</span>
                    <p class="text-sm font-medium" [class]="i === 0 ? 'text-white' : 'text-white/40'">{{ entry }}</p>
                  </div>
                }
              </div>

              <!-- Progress Indicator -->
              <div class="mt-8 pt-4 border-t border-white/10">
                 <div class="flex justify-between text-[10px] font-mono text-indigo-300 mb-2 uppercase tracking-tighter">
                   <span>Enlazando Clientas</span>
                   <span>{{ selectedOrderIds().size }}/{{ orchestrationFeed().length }}</span>
                 </div>
                 <div class="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-pink-500 to-indigo-500 animate-[shimmer_2s_infinite_linear]" style="width: 100%"></div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- ═══════════════════════════════════════════════════
           LOADING OVERLAY INMERSIVO (Gemini Pensando)
           ═══════════════════════════════════════════════════ -->
      @if (isListeningVoice() || isProcessingVoice()) {
        <div class="fixed inset-0 z-[5000] bg-slate-900/90 backdrop-blur-2xl flex flex-col items-center justify-center animate-fade-in">
           
           @if (isListeningVoice()) {
             <!-- Microfono Escuchando -->
             <div class="relative w-32 h-32 mb-12 flex items-center justify-center">
                 <div class="absolute inset-0 bg-pink-500 rounded-full blur-[40px] animate-[pulse_1.5s_ease-in-out_infinite] opacity-60"></div>
                 <div class="absolute w-24 h-24 bg-white/10 border border-white/30 rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                 <div class="absolute flex items-center justify-center text-6xl drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-bounce">🎙️</div>
             </div>
             
             <h3 class="text-sm font-semibold text-white tracking-[0.4em] uppercase mb-4 font-sans animate-pulse">
                Te estoy escuchando...
             </h3>
             <p class="text-pink-200/80 font-light tracking-wide text-xs">Habla ahora (Ej: "Susana, Mary y Ana")</p>
           } @else {
             <!-- Glowing AI Core Procesando -->
             <div class="relative w-32 h-32 mb-12 flex items-center justify-center">
                 <div class="absolute inset-0 bg-gradient-to-tr from-fuchsia-600 to-indigo-600 rounded-full blur-[30px] animate-[pulse_3s_ease-in-out_infinite] opacity-60"></div>
                 <div class="absolute w-24 h-24 bg-white/10 border border-white/30 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                 <div class="absolute w-12 h-12 bg-gradient-to-br from-white to-pink-100 rounded-full shadow-[0_0_20px_white] z-10 overflow-hidden">
                     <div class="w-full h-full bg-gradient-to-tr from-purple-500/30 to-pink-500/30 animate-[spin_2s_linear_infinite]"></div>
                 </div>
             </div>
             
             <h3 class="text-sm font-semibold text-white/80 tracking-[0.4em] uppercase mb-8 font-sans">
                Analizando Voz
             </h3>
             <div class="h-6 relative w-full max-w-md text-center flex justify-center mt-2">
                <span class="absolute w-full text-pink-200/90 font-light tracking-wide text-sm animate-pulse">Traduciendo nombres a pedidos...</span>
             </div>
           }
        </div>
      }

      <!-- ═══ HEADER ═══ -->
      <div class="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 animate-slide-down">
        <div>
          <h1 class="text-2xl sm:text-3xl font-black text-pink-900 tracking-tight">🚗 Centro de Entregas</h1>
          <p class="text-xs sm:text-sm text-pink-400 font-semibold mt-1">Monitorea y gestiona tus rutas en tiempo real</p>
        </div>
        <div class="flex gap-2 w-full sm:w-auto">
          <button class="flex-1 sm:flex-none group flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white/80 backdrop-blur-lg border border-pink-100 text-pink-600 font-bold text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                  (click)="loadRoutes()">
            <span class="transition-transform group-active:rotate-180" [class.animate-spin]="loading()">🔄</span> Actualizar
          </button>
          <button class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm shadow-lg shadow-pink-200 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
                  (click)="openCreateModal()">
            ✨ Nueva Ruta
          </button>
        </div>
      </div>

      <!-- ═══ KPI STRIP ═══ -->
      <div class="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div class="bg-white/70 backdrop-blur-xl rounded-2xl p-4 border border-white shadow-sm animate-slide-up">
          <p class="text-[10px] font-black uppercase tracking-widest text-pink-400 mb-1">Total Rutas</p>
          <p class="text-2xl font-black text-pink-900">{{ routes().length }}</p>
        </div>
        <div class="bg-white/70 backdrop-blur-xl rounded-2xl p-4 border border-white shadow-sm animate-slide-up" style="animation-delay:60ms">
          <p class="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">Pendientes</p>
          <p class="text-2xl font-black text-amber-600">{{ routesByStatus('Pending') }}</p>
        </div>
        <div class="bg-white/70 backdrop-blur-xl rounded-2xl p-4 border border-white shadow-sm animate-slide-up" style="animation-delay:120ms">
          <p class="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">En Camino</p>
          <p class="text-2xl font-black text-blue-600">{{ routesByStatus('Active') }}</p>
        </div>
        <div class="bg-white/70 backdrop-blur-xl rounded-2xl p-4 border border-white shadow-sm animate-slide-up" style="animation-delay:180ms">
          <p class="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Completadas</p>
          <p class="text-2xl font-black text-emerald-600">{{ routesByStatus('Completed') }}</p>
        </div>
      </div>

      <!-- ═══ LOADING ═══ -->
      @if (loading()) {
        <div class="relative z-10 space-y-4">
          @for (i of [1,2,3]; track i) { <div class="shimmer h-44 rounded-3xl"></div> }
        </div>
      } @else {

        <!-- ═══ EMPTY STATE ═══ -->
        @if (routes().length === 0) {
          <div class="relative z-10 bg-white/60 backdrop-blur-xl rounded-3xl border-2 border-dashed border-pink-200 p-16 text-center animate-bounce-in">
            <p class="text-5xl mb-4">🛣️</p>
            <p class="text-pink-500 font-bold text-lg">No hay rutas activas</p>
            <p class="text-pink-300 text-sm mt-1">Ve a Pedidos, selecciona varios y crea una ruta mágica 💕</p>
          </div>
        }

        <!-- ═══ GOD MODE: LIVE RADAR (Phase 38) ═══ -->
        @if (routes().length > 0) {
          <div class="relative z-10 mb-8 bg-white/80 backdrop-blur-xl rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden animate-slide-down">
             <div class="p-4 border-b border-pink-50 flex justify-between items-center bg-gradient-to-r from-pink-50 to-purple-50 cursor-pointer select-none"
                  (click)="collapsedRadar.set(!collapsedRadar())">
               <div class="flex items-center gap-3">
                 <span class="text-2xl animate-pulse">📡</span>
                 <div>
                   <h3 class="text-lg font-black text-pink-900 leading-none">Radar Global en Vivo</h3>
                   <div class="flex items-center gap-2 mt-1">
                     <p class="text-[10px] text-pink-500 font-bold uppercase tracking-tight">God Mode</p>
                     <span class="text-[10px] text-pink-300 font-bold">{{ collapsedRadar() ? '➕ Mostrar' : '➖ Ocultar' }}</span>
                   </div>
                 </div>
               </div>
               <span class="px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-blue-100/80 text-blue-700 text-[10px] sm:text-xs font-bold font-mono border border-blue-200 flex items-center gap-1.5 shadow-sm">
                 <span class="w-1.5 h-1.5 sm:w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                 {{ activeDriversCount() }} <span class="hidden sm:inline">Choferes</span> Activos
               </span>
             </div>
             
             <div class="transition-all duration-500 ease-in-out overflow-hidden" 
                  [style.max-height]="collapsedRadar() ? '0' : '500px'">
               <div class="h-[250px] sm:h-[400px] w-full relative bg-gray-100">
                 <div id="god-mode-map" class="absolute inset-0 z-0"></div>
               </div>
               <!-- Live Event Feed Preview -->
               <div class="h-10 bg-gray-900 border-t border-gray-800 flex items-center px-4 overflow-hidden">
                  <span class="text-gray-400 text-[10px] font-mono font-bold shrink-0 mr-3">📟 EVENT LOG:</span>
                  <div class="flex-1 overflow-hidden" style="white-space: nowrap; text-overflow: ellipsis;">
                     @if (latestEvent()) {
                       <span class="text-emerald-400 text-[10px] font-mono animate-fade-in-down">{{ latestEvent() }}</span>
                     } @else {
                       <span class="text-gray-600 text-[10px] font-mono italic">Escuchando la red (SignalR)...</span>
                     }
                  </div>
               </div>
             </div>
          </div>
        }

        <!-- ═══ ROUTE CARDS ═══ -->
        <div class="relative z-10 space-y-5">
          @for (route of routes(); track route.id; let i = $index) {
            <div class="group bg-white/80 backdrop-blur-xl rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden hover:shadow-[0_15px_40px_rgb(244,114,182,0.12)] transition-all duration-300 animate-slide-up"
                 [style.animation-delay]="(i * 70) + 'ms'">

              <!-- Card Header -->
              <div class="p-4 sm:p-5 pb-3 cursor-pointer select-none" (click)="toggleRouteExpand(route.id)">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div class="flex items-center gap-3 w-full sm:w-auto">
                    <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-lg sm:text-xl shadow-inner border border-pink-100 transition-transform duration-500"
                         [class.rotate-12]="expandedRouteIds().has(route.id)"
                         [class]="route.status === 'Active' ? 'bg-blue-50' : route.status === 'Completed' ? 'bg-emerald-50' : 'bg-pink-50'">
                      {{ route.status === 'Active' ? '🚀' : route.status === 'Completed' ? '✅' : '🏎️' }}
                    </div>
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <h3 class="text-base sm:text-lg font-black text-pink-900">Ruta #{{ route.id }}</h3>
                        <span class="text-pink-300 text-xs transition-transform duration-300" 
                              [class.rotate-180]="expandedRouteIds().has(route.id)">▼</span>
                      </div>
                      <p class="text-[10px] sm:text-xs text-pink-400 font-semibold">{{ route.createdAt | date:'d MMM yyyy, h:mm a' }}</p>
                    </div>
                  </div>
                  <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-pink-50">
                    <span class="px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest"
                          [class]="getStatusClasses(route.status)">
                      {{ getStatusLabel(route.status) }}
                    </span>
                    <div class="text-right">
                      <p class="text-[10px] sm:text-xs text-pink-400 font-semibold">{{ route.deliveries.length }} entregas</p>
                      <p class="text-base sm:text-lg font-black text-pink-900">{{ getRouteTotal(route) | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="px-5 mb-3">
                <div class="flex justify-between items-center mb-1.5">
                  <span class="text-[10px] font-black uppercase tracking-widest text-gray-400">Progreso</span>
                  <span class="text-xs font-bold text-pink-600">{{ getDelivered(route) }}/{{ route.deliveries.length }} 🎁</span>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-pink-400 via-fuchsia-500 to-violet-500 rounded-full transition-all duration-700 ease-out"
                       [style.width.%]="getProgress(route)"></div>
                </div>
              </div>

              <!-- Action Chips -->
              <div class="px-4 sm:px-5 pb-3 flex flex-wrap gap-2">
                <button class="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-xl bg-pink-50 text-pink-600 text-xs font-bold border border-pink-100 hover:bg-pink-100 active:scale-95 transition-all"
                        (click)="openMap(route)">
                  🗺️ <span class="hidden sm:inline">Mapa</span>
                </button>
                <button class="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100 hover:bg-blue-100 active:scale-95 transition-all"
                        (click)="copyDriverLink(route)">
                  📋 <span class="hidden sm:inline">Link</span>
                </button>
                <button class="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-xl bg-green-50 text-green-600 text-xs font-bold border border-green-100 hover:bg-green-100 active:scale-95 transition-all"
                        (click)="shareWhatsApp(route)">
                  📱 <span class="hidden sm:inline">WhatsApp</span>
                </button>
                @if (route.status !== 'Completed') {
                  <button class="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all"
                          (click)="openCorteModal(route)">
                    💰 <span class="hidden sm:inline">Liquidar</span>
                  </button>
                }
                <button class="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold border border-indigo-100 hover:bg-indigo-100 active:scale-95 transition-all"
                        (click)="loadRouteBriefing(route.id)"
                        [disabled]="loadingBriefing() === route.id">
                  @if (loadingBriefing() === route.id) {
                    <span class="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></span>
                  } @else {
                    ✦
                  }
                  <span class="hidden sm:inline">Briefing</span>
                </button>
                <button class="sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-xl bg-red-50 text-red-500 text-xs font-bold border border-red-100 hover:bg-red-100 active:scale-95 transition-all sm:ml-auto"
                        (click)="deleteRoute(route.id)">
                  🗑️
                </button>
              </div>

              <!-- Briefing Panel -->
              @if (routeBriefing() && loadingBriefing() !== route.id) {
                <div class="mx-4 mb-3 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 animate-fade-in-down">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-sm font-black text-indigo-700">✦ Briefing C.A.M.I.</span>
                    <button class="ml-auto text-indigo-300 hover:text-indigo-500 text-xs" (click)="routeBriefing.set(null)">✕</button>
                  </div>
                  <p class="text-xs text-indigo-800 leading-relaxed italic">{{ routeBriefing()!.text }}</p>
                </div>
              }

              <!-- Deliveries List (Collapsible) -->
              @if (expandedRouteIds().has(route.id)) {
                <div class="border-t border-pink-50 animate-fade-in-down overflow-hidden">
                  <div class="divide-y divide-pink-50/80">
                    @for (d of route.deliveries; track d.deliveryId; let di = $index) {
                      <div class="flex items-center gap-3 px-4 py-3 hover:bg-pink-50/30 transition-colors stagger-item"
                           [style.animation-delay]="(di * 30) + 'ms'">
                        <div class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 border-2 border-white shadow-sm"
                             [class]="d.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : d.status === 'NotDelivered' ? 'bg-red-100 text-red-600' : d.status === 'InTransit' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-700'">
                          {{ d.sortOrder }}
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-bold text-gray-800 truncate">{{ d.clientName }}</p>
                          @if (d.clientAddress) {
                            <p class="text-[11px] text-gray-400 truncate">📍 {{ d.clientAddress }}</p>
                          }
                        </div>
                        <div class="text-right shrink-0 flex items-center gap-2">
                          <div class="flex flex-col items-end">
                            <p class="text-sm font-black text-pink-600">{{ d.total | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
                            <span class="text-xs">{{ d.status === 'Delivered' ? '✅' : d.status === 'NotDelivered' ? '❌' : d.status === 'InTransit' ? '🏃' : '⏳' }}</span>
                          </div>
                          @if (route.status !== 'Completed') {
                            <!-- ↑/↓ buttons -->
                            <div class="flex flex-col gap-0.5">
                              <button (click)="moveDelivery(route, di, -1)" [disabled]="di === 0"
                                      class="w-7 h-7 rounded-lg bg-pink-50 text-pink-400 hover:bg-pink-100 flex items-center justify-center text-xs font-bold active:scale-90 transition-all disabled:opacity-20"
                                      title="Mover arriba">↑</button>
                              <button (click)="moveDelivery(route, di, 1)" [disabled]="di === route.deliveries.length - 1"
                                      class="w-7 h-7 rounded-lg bg-pink-50 text-pink-400 hover:bg-pink-100 flex items-center justify-center text-xs font-bold active:scale-90 transition-all disabled:opacity-20"
                                      title="Mover abajo">↓</button>
                            </div>
                            <button class="w-7 h-7 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                                    (click)="$event.stopPropagation(); removeOrderFromRoute(route, d.orderId)"
                                    title="Quitar de ruta">
                              🗑️
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Quick Add Order to Route -->
                  @if (route.status !== 'Completed' && pendingOrders().length > 0) {
                    <div class="p-4 bg-pink-50/50 border-t border-pink-50">
                      <p class="text-[10px] font-black uppercase tracking-widest text-pink-400 mb-2">➕ Agregar Pedido a esta Ruta</p>
                      <div class="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                        @for (po of pendingOrders(); track po.id) {
                          <button class="px-3 py-1.5 rounded-xl bg-white border border-pink-100 text-[10px] font-bold text-pink-900 shadow-sm hover:border-pink-300 transition-all flex items-center gap-1"
                                  (click)="addOrderToRoute(route, po.id)">
                            <span>#{{ po.id }} · {{ po.clientName }}</span>
                            <span class="text-pink-400">➕</span>
                          </button>
                        }
                      </div>
                    </div>
                  }

                  <!-- Failed Deliveries -->
                  @if (getFailedDeliveries(route).length > 0) {
                    <div class="mx-5 mb-4 mt-2 rounded-2xl bg-red-50 border border-red-100 p-3 animate-pulse-subtle">
                      <p class="text-xs font-black text-red-500 mb-2">😿 No entregados:</p>
                      @for (d of getFailedDeliveries(route); track d.deliveryId) {
                        <p class="text-xs text-red-600"><strong>{{ d.clientName }}:</strong> {{ d.failureReason }}</p>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- ═══════════════════════════════════════════════════
           MODAL: NUEVA RUTA (Enhanced)
           ═══════════════════════════════════════════════════ -->
      @if (showCreateModal()) {
        <div class="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" (click)="showCreateModal.set(false)">
          <div class="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in shadow-2xl" (click)="$event.stopPropagation()">

            <div class="px-6 pt-6 pb-4 border-b border-pink-50">
              <div class="flex items-center justify-between">
                <h2 class="text-xl font-black text-pink-900">🗺️ Nueva Ruta</h2>
                
                <div class="flex items-center gap-3">
                  <!-- AI Voice Button -->
                  <button class="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold text-sm shadow-md shadow-purple-200 hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
                          (click)="startVoiceSelection()">
                    🎙️ <span class="hidden sm:inline">Armar por Voz</span>
                  </button>

                  <button class="w-8 h-8 rounded-full bg-pink-50 flex items-center justify-center text-pink-400 hover:bg-pink-100 text-lg" (click)="showCreateModal.set(false)">×</button>
                </div>
              </div>
              <p class="text-xs text-pink-400 font-semibold mt-1">Selecciona los pedidos para esta ruta</p>

              <!-- Search and Filters Bar -->
              <div class="mt-4 flex gap-2">
                <div class="relative flex-1">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-pink-300">🔍</span>
                  <input type="text" 
                         [ngModel]="searchQuery()" 
                         (ngModelChange)="searchQuery.set($event)"
                         placeholder="Buscar por nombre o teléfono..." 
                         class="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-pink-50/50 border border-pink-100 text-sm focus:ring-2 focus:ring-pink-500 outline-none transition-all" />
                </div>
                <button class="px-4 py-2.5 rounded-2xl bg-white border border-pink-100 text-pink-600 font-bold text-xs hover:bg-pink-50 transition-all"
                        (click)="selectAllFiltered()">
                  Todo
                </button>
                <button class="px-3 py-2.5 rounded-2xl bg-white border border-pink-100 text-gray-400 font-bold text-xs hover:bg-gray-50 transition-all"
                        (click)="deselectAll()" title="Deseleccionar todos">
                  ✕
                </button>
              </div>

              <!-- Address Coverage Stats -->
              @if (pendingOrders().length > 0) {
                <div class="flex gap-2 mt-3">
                  <div class="flex-1 bg-emerald-50 rounded-xl p-2.5 text-center border border-emerald-100">
                    <p class="text-lg font-black text-emerald-600">{{ ordersWithAddress() }}</p>
                    <p class="text-[9px] font-bold uppercase tracking-wide text-emerald-400">Con dirección</p>
                  </div>
                  <div class="flex-1 bg-amber-50 rounded-xl p-2.5 text-center border border-amber-100">
                    <p class="text-lg font-black text-amber-600">{{ ordersWithoutAddress() }}</p>
                    <p class="text-[9px] font-bold uppercase tracking-wide text-amber-400">Sin dirección</p>
                  </div>
                  <div class="flex-1 bg-pink-50 rounded-xl p-2.5 text-center border border-pink-100">
                    <p class="text-lg font-black text-pink-600">{{ selectedOrderIds().size }}</p>
                    <p class="text-[9px] font-bold uppercase tracking-wide text-pink-400">Seleccionados</p>
                  </div>
                </div>
              }
            </div>

            <div class="flex-1 overflow-y-auto px-6 py-4">
              @if (pendingOrders().length === 0) {
                <div class="text-center py-12">
                  <p class="text-4xl mb-3">📦</p>
                  <p class="text-pink-400 font-semibold">No hay pedidos pendientes para asignar</p>
                </div>
              } @else {
                <div class="space-y-2">
                  @for (order of filteredPendingOrders(); track order.id) {
                    <div class="group/order relative flex flex-col p-3 rounded-2xl border transition-all"
                           [class]="selectedOrderIds().has(order.id)
                              ? 'border-pink-300 bg-pink-50/80 shadow-md translate-x-1'
                              : order.clientAddress ? 'border-gray-100 bg-white/50 hover:bg-white hover:shadow-sm' : 'border-amber-200 bg-amber-50/30 hover:bg-amber-50/60'">
                      
                      <div class="flex items-center gap-3">
                        <input type="checkbox" class="w-5 h-5 accent-pink-500 shrink-0 rounded-lg cursor-pointer" [checked]="selectedOrderIds().has(order.id)"
                               (change)="toggleOrder(order.id)" />
                        
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-1.5 flex-wrap">
                            <p class="text-sm font-bold text-pink-900 truncate">#{{ order.id }} · {{ order.clientName }}</p>
                            @if (!order.clientAddress) {
                              <span class="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700 uppercase animate-pulse">⚠️ Sin dir.</span>
                            }
                          </div>

                          @if (editingOrderId() === order.id) {
                            <div class="mt-2 flex gap-2 animate-fade-in" (click)="$event.stopPropagation()">
                              <input [id]="'addr-input-' + order.id" type="text" [(ngModel)]="tempAddress" 
                                     placeholder="Busca la dirección..."
                                     class="flex-1 px-3 py-1.5 text-xs rounded-xl border border-pink-200 focus:ring-2 focus:ring-pink-500 outline-none shadow-inner" />
                              <button class="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-[10px] font-bold shadow-sm"
                                      [disabled]="isSavingAddress()" (click)="saveAddress(order)">
                                {{ isSavingAddress() ? '⏳' : '✅' }}
                              </button>
                              <button class="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-400 text-[10px] font-bold" (click)="cancelEditAddress()">✕</button>
                            </div>
                          } @else {
                            @if (order.clientAddress) {
                              <p class="text-xs text-gray-400 truncate mt-0.5 flex justify-between group/addr">
                                <span>📍 {{ order.clientAddress }}</span>
                                <button (click)="startEditAddress(order)" class="text-[10px] text-pink-400 opacity-0 group-hover/addr:opacity-100 font-bold hover:underline transition-opacity">Editar</button>
                              </p>
                            } @else {
                              <div class="flex items-center justify-between mt-0.5">
                                <p class="text-[10px] text-amber-500 italic">Requiere dirección para optimizar</p>
                                <button (click)="startEditAddress(order)" class="text-[10px] bg-amber-100 px-2 py-0.5 rounded-lg text-amber-700 font-bold hover:bg-amber-200 transition-colors">📍 Agregar</button>
                              </div>
                            }
                          }
                        </div>
                        <span class="text-sm font-black text-pink-700 shrink-0">{{ order.total | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            @if (pendingOrders().length > 0) {
              <div class="px-6 py-4 border-t border-pink-50 flex gap-3">
                <button class="flex-1 py-3 rounded-2xl border border-pink-200 text-pink-600 font-bold text-sm hover:bg-pink-50 transition-colors"
                        (click)="showCreateModal.set(false)">Cancelar</button>
                <button class="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm shadow-lg shadow-pink-200 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
                        [disabled]="selectedOrderIds().size === 0" (click)="openOptimizer()">
                  Siguiente: Optimizar ({{ selectedOrderIds().size }}) → 
                </button>
              </div>
            }
          </div>
        </div>
      }

      <!-- ═══════════════════════════════════════════════════
           MODAL: ROUTE OPTIMIZER (V2 Steroids)
           ═══════════════════════════════════════════════════ -->
      @if (showOptimizerModal()) {
        <app-route-optimizer
          [orders]="getSelectedOrdersForOptimization()"
          (cancel)="showOptimizerModal.set(false)"
          (confirmRoute)="createOptimizedRoute($event)">
        </app-route-optimizer>
      }

      <!-- ═══════════════════════════════════════════════════
           MODAL: MAPA (Google Maps)
           ═══════════════════════════════════════════════════ -->
      @if (showMapModal()) {
        <div class="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" (click)="closeMap()">
          <div class="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col animate-scale-in shadow-2xl"
               style="height: 85vh; max-height: 85vh;" (click)="$event.stopPropagation()">

            <div class="px-5 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <p class="font-black text-pink-900">🗺️ Seguimiento</p>
                <p class="text-xs text-gray-400">Ruta #{{ mapRoute()?.id }}</p>
              </div>
              <button class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500" (click)="closeMap()">✕</button>
            </div>

            <div class="flex-1 relative bg-gray-100 min-h-0">
              <google-map height="100%" width="100%" [center]="mapCenter" [zoom]="mapZoom" [options]="mapOptions">
                <!-- Base marker -->
                <map-marker [position]="mapCenter" [options]="baseMarkerOpts"></map-marker>
                <!-- Delivery markers -->
                @for (d of mapDeliveries; track d.deliveryId) {
                  @if (d.latitude && d.longitude) {
                    <map-marker [position]="{ lat: d.latitude, lng: d.longitude }" [options]="getDeliveryMarkerOpts(d)"></map-marker>
                  }
                }
                
                <!-- Live Driver markers -->
                @for (entry of driverMarkers() | keyvalue; track entry.key) {
                  <map-marker [position]="entry.value" [options]="driverMarkerOptions"></map-marker>
                }

                @if (mapDirections(); as dirs) {
                  <map-directions-renderer [directions]="dirs" [options]="directionsRenderOpts"></map-directions-renderer>
                }
              </google-map>

              @if (plottingMap()) {
                <div class="absolute top-3 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg text-xs font-bold text-gray-500 flex items-center gap-2 z-10">
                  <div class="w-4 h-4 border-2 border-gray-200 border-t-pink-500 rounded-full animate-spin"></div> Trazando ruta...
                </div>
              }
            </div>

            <div class="px-5 py-3 bg-gray-900 text-white text-xs font-semibold flex items-center justify-center gap-2 shrink-0">
              📍 Ruta planificada · {{ mapDeliveries.length }} paradas
            </div>
          </div>
        </div>
      }

      <!-- ═══════════════════════════════════════════════════
           MODAL: CORTE / LIQUIDACIÓN (Ticket Style)
           ═══════════════════════════════════════════════════ -->
      @if (showCorteModal() && corteRoute()) {
        <div class="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-in" (click)="closeCorte()">
          <div class="w-[90%] max-w-[420px] rounded-2xl overflow-visible shadow-2xl animate-scale-in" (click)="$event.stopPropagation()"
               style="background:#fdfbf7;">

            <!-- Ticket Header -->
            <div class="bg-gradient-to-r from-pink-500 to-rose-500 text-white text-center px-6 pt-6 pb-5 rounded-t-2xl relative border-b border-dashed border-pink-200">
              <h3 class="text-xl font-black tracking-wide">💰 Liquidación de Chofer</h3>
              <p class="text-sm opacity-90 mt-1">Ruta #{{ corteRoute()!.id }}</p>
              
              <!-- Zigzag bottom -->
              <div class="absolute -bottom-[10px] left-0 right-0 h-[10px]"
                   style="background: linear-gradient(-45deg, #fdfbf7 5px, transparent 0), linear-gradient(45deg, #fdfbf7 5px, transparent 0); background-size: 10px 10px; background-repeat: repeat-x;"></div>
            </div>

            <!-- Ticket Body -->
            <div class="px-5 pt-8 pb-4 font-mono text-sm space-y-4">
              <!-- Cash -->
              <div class="flex justify-between">
                <span>Efectivo Cobrado 💵</span>
                <span class="font-bold text-emerald-600">{{ corteData().totalCash | currency:'MXN':'symbol-narrow':'1.2-2' }}</span>
              </div>
              <div class="flex justify-between text-xs text-gray-400">
                <span>Transferencias / Otros</span>
                <span>{{ corteData().totalTransfer | currency:'MXN':'symbol-narrow':'1.2-2' }}</span>
              </div>

              <div class="border-b border-dashed border-gray-300"></div>

              <!-- Expenses -->
              <div>
                <p class="text-xs text-gray-400 font-black uppercase tracking-widest mb-2">Gastos 📉</p>
                @if (corteRoute()!.expenses?.length) {
                  @for (exp of corteRoute()!.expenses!; track exp.id) {
                    <div class="flex justify-between mb-1 text-xs">
                      <span>{{ exp.expenseType }} {{ exp.notes ? '(' + exp.notes + ')' : '' }}</span>
                      <span class="font-bold text-red-500">-{{ exp.amount | currency:'MXN':'symbol-narrow':'1.2-2' }}</span>
                    </div>
                  }
                } @else {
                  <p class="text-xs text-gray-300 italic">Sin gastos registrados.</p>
                }
                <div class="flex justify-between mt-2 pt-2 border-t border-dashed border-gray-200 font-bold text-xs">
                  <span>Total Gastos</span>
                  <span class="text-red-500">-{{ corteData().totalExpenses | currency:'MXN':'symbol-narrow':'1.2-2' }}</span>
                </div>
              </div>

              <div class="border-b-2 border-dashed border-gray-400"></div>

              <!-- Total -->
              <div class="text-center pt-2">
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total a Entregar</p>
                <p class="text-4xl font-black text-pink-500 mt-1" style="font-family:'Outfit',sans-serif">
                  {{ corteData().totalToDeliver | currency:'MXN':'symbol-narrow':'1.2-2' }}
                </p>
              </div>
            </div>

            <!-- Ticket Footer -->
            <div class="flex gap-3 px-5 pb-5">
              <button class="flex-1 py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-sm" (click)="closeCorte()">Cancelar</button>
              <button class="flex-[2] py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm shadow-lg shadow-pink-200 disabled:opacity-40 transition-all"
                      [disabled]="liquidating()" (click)="confirmLiquidate()">
                {{ liquidating() ? '⏳ Procesando...' : '✅ Confirmar' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .animate-float { animation: float 6s ease-in-out infinite; }
    .animate-sparkle { animation: sparkle 4s ease-in-out infinite; }
    .animate-slide-down { animation: slideDown 0.5s ease-out forwards; }
    .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-bounce-in { animation: bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
    .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
    .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
    .animate-fade-in-down { animation: fadeInDown 0.4s ease-out both; }
    .animate-pulse-subtle { animation: pulseSubtle 2s ease-in-out infinite; }

    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .stagger-item {
      opacity: 0;
      animation: slideInRight 0.4s ease-out forwards;
    }

    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @keyframes pulseSubtle {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.85; transform: scale(0.99); }
    }

    @keyframes float {
      0%, 100% { transform: translateY(0) rotate(0); }
      50% { transform: translateY(-20px) rotate(5deg); }
    }

    @keyframes sparkle {
      0%, 100% { opacity: 0.3; transform: scale(1) rotate(0); }
      50% { opacity: 0.8; transform: scale(1.2) rotate(180deg); }
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(40px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes bounceIn {
      0% { opacity: 0; transform: scale(0.3); }
      50% { opacity: 0.9; transform: scale(1.1); }
      80% { opacity: 1; transform: scale(0.89); }
      100% { opacity: 1; transform: scale(1); }
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.9) translateY(20px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .shimmer {
      background: linear-gradient(90deg, #fce7f3 25%, #fbcfe8 50%, #fce7f3 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite linear;
    }
    @keyframes shimmer {
      from { background-position: 200% 0; }
      to { background-position: -200% 0; }
    }

    .orchestration-highlight {
      border-color: #ec4899 !important;
      background-color: rgba(236, 72, 153, 0.1) !important;
      box-shadow: 0 0 20px rgba(236, 72, 153, 0.3);
      transform: scale(1.02) translateX(10px);
    }
  `]
})
export class RoutesComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private signalr = inject(SignalRService);
  private push = inject(PushNotificationService);

  routes = signal<RouteDto[]>([]);
  loading = signal(true);
  scrollY = signal(0);
  latestEvent = signal<string>('');
  collapsedRadar = signal(true);

  // ─── GOD MODE MAP STATE ───
  private godModeMapInitialized = false;
  private godModeMap: any = null;
  private godModeMarkers = new Map<string, any>(); // driverToken -> google.maps.Marker

  activeDriversCount = computed(() => {
    return this.routes().filter((r: RouteDto) => r.status === 'Active').length;
  });

  driverMarkerOptions: google.maps.MarkerOptions = {
    icon: {
      path: 'M29.395,0H17.636c-3.117,0-5.643,2.527-5.643,5.643v23.752c0,3.116,2.526,5.644,5.643,5.644h11.759' +
        'c3.116,0,5.644-2.527,5.644-5.644V5.643C35.039,2.527,32.511,0,29.395,0z M34.039,29.395c0,2.56-2.084,4.644-4.644,4.644' +
        'H17.636c-2.56,0-4.643-2.084-4.643-4.644V5.643c0-2.56,2.083-4.643,4.643-4.643h11.759c2.56,0,4.644,2.083,4.644,4.643V29.395z',
      fillColor: '#3b82f6', fillOpacity: 1, strokeColor: 'white', strokeWeight: 2, scale: 0.8, anchor: new google.maps.Point(25, 25)
    }
  };

  // Live Tracking
  driverMarkers = signal<Map<string, { lat: number, lng: number }>>(new Map());

  // Create Route
  showCreateModal = signal(false);
  pendingOrders = signal<OrderSummaryDto[]>([]);
  selectedOrderIds = signal<Set<number>>(new Set());
  creating = signal(false);
  expandedRouteIds = signal<Set<number>>(new Set());

  // Inline Address Editing
  editingOrderId = signal<number | null>(null);
  tempAddress = '';
  isSavingAddress = signal(false);

  // AI Voice Selection
  isListeningVoice = signal(false);
  isProcessingVoice = signal(false);
  isOrchestrating = signal(false);
  orchestrationFeed = signal<string[]>([]);
  activeOrchestrationId = signal<number | null>(null);

  // Optimizer V2
  showOptimizerModal = signal(false);

  // Search & Filtering
  searchQuery = signal('');
  filteredPendingOrders = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.pendingOrders();
    return this.pendingOrders().filter(o => 
      o.clientName.toLowerCase().includes(query) || 
      (o.id.toString() === query) ||
      (o.clientPhone && o.clientPhone.includes(query))
    );
  });

  // Map Modal
  showMapModal = signal(false);
  mapRoute = signal<RouteDto | null>(null);
  mapDeliveries: RouteDeliveryDto[] = [];
  mapDirections = signal<google.maps.DirectionsResult | undefined>(undefined);
  plottingMap = signal(false);
  @ViewChild(GoogleMap) googleMap!: GoogleMap;

  mapCenter: google.maps.LatLngLiteral = { lat: GEO_CONFIG.defaultLat, lng: GEO_CONFIG.defaultLng };
  mapZoom = 13;
  mapOptions: google.maps.MapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    gestureHandling: 'greedy',
    styles: [
      { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
      { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
      { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
      { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
      { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
      { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
      { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
      { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
      { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
      { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
      { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
      { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
      { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
      { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
      { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
      { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
      { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
      { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
    ]
  };
  baseMarkerOpts: google.maps.MarkerOptions = { title: 'Base' };
  directionsRenderOpts: google.maps.DirectionsRendererOptions = {
    suppressMarkers: true,
    polylineOptions: { strokeColor: '#ec4899', strokeWeight: 5, strokeOpacity: 0.8 }
  };

  // Corte Modal
  showCorteModal = signal(false);
  corteRoute = signal<RouteDto | null>(null);
  liquidating = signal(false);

  // Route Briefing (C.A.M.I.)
  routeBriefing = signal<{text: string, audioBase64?: string} | null>(null);
  loadingBriefing = signal<number | null>(null);
  private briefingAudio = new Audio();

  // Geocode Cache
  private geocodeCache = new Map<string, { lat: number; lng: number } | null>();

  @HostListener('window:scroll')
  onScroll() { this.scrollY.set(window.scrollY); }

  ngOnInit(): void {
    this.loadRoutes();
    this.initSignalR();
    this.initPush();
  }

  loadRouteBriefing(routeId: number): void {
    if (this.loadingBriefing() === routeId) return;
    this.loadingBriefing.set(routeId);
    this.routeBriefing.set(null);
    this.api.getRouteBriefing(routeId).subscribe({
      next: (res) => {
        this.routeBriefing.set(res);
        this.loadingBriefing.set(null);
        if (res.audioBase64) {
          this.briefingAudio.src = `data:audio/mp3;base64,${res.audioBase64}`;
          this.briefingAudio.play().catch(() => {});
        }
      },
      error: () => { this.loadingBriefing.set(null); }
    });
  }

  private initPush(): void {
    this.push.requestPermission().then(granted => {
      if (granted) this.push.subscribeToNotifications('admin');
    });
  }

  private initSignalR(): void {
    this.signalr.connect().then(() => {
      this.signalr.joinAdminGroup();
    });

    this.signalr.locationUpdate$.subscribe((upd: { driverToken?: string, latitude: number, longitude: number }) => {
      if (upd.driverToken) {
        // Legacy (Per Route Map)
        this.driverMarkers.update(map => {
          const next = new Map(map);
          next.set(upd.driverToken!, { lat: upd.latitude, lng: upd.longitude });
          return next;
        });

        // God Mode (Global Radar)
        this.updateGodModeDriver(upd.driverToken, upd.latitude, upd.longitude);
      }
    });

    this.signalr.deliveryUpdate$.subscribe((data: any) => {
      // Acoustic Alerts
      const time = new Date().toLocaleTimeString('es-MX', { hour12: false });
      if (data && data.status === 'Delivered') {
        this.playSuccessChime();
        this.latestEvent.set(`[${time}] Entrega exitosa. Chofer marcó pedido como Entregado ✅`);
      } else if (data && data.status === 'NotDelivered') {
        this.latestEvent.set(`[${time}] ALERTA: Entrega fallida reportada por el chofer ❌`);
      } else if (data && data.amountReceived !== undefined) {
        this.playCashSound();
        this.latestEvent.set(`[${time}] PAGO RECIBIDO: $${data.amountReceived} ingresado 💵`);
      } else {
        this.latestEvent.set(`[${time}] Actualización de ruta detectada 🔄`);
      }

      // Refresh routes if something changed (status updated by driver)
      this.loadRoutes();
    });

    this.signalr.expenseAdded$.subscribe((data: any) => {
      const time = new Date().toLocaleTimeString('es-MX', { hour12: false });
      this.latestEvent.set(`[${time}] GASTO REGISTRADO: $${data.amount} (${data.type}) 💸`);
      this.loadRoutes();
    });
  }

  toggleRouteExpand(id: number): void {
    this.expandedRouteIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ─── INLINE ADDRESS EDITING ───
  startEditAddress(order: any): void {
    this.editingOrderId.set(order.id);
    this.tempAddress = order.clientAddress || '';

    // Initialize Autocomplete after a short delay to ensure the input is in DOM
    setTimeout(() => {
      const input = document.getElementById(`addr-input-${order.id}`) as HTMLInputElement;
      if (input) {
        const autocomplete = new google.maps.places.Autocomplete(input, {
          componentRestrictions: { country: 'mx' },
          fields: ['formatted_address', 'geometry'],
          types: ['address']
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.formatted_address) {
            this.tempAddress = place.formatted_address;
          }
        });
      }
    }, 100);
  }

  cancelEditAddress(): void {
    this.editingOrderId.set(null);
    this.tempAddress = '';
  }

  saveAddress(order: any): void {
    if (!this.tempAddress.trim() || !order.clientId) return;

    this.isSavingAddress.set(true);
    // Update client address via API
    this.api.updateClient(order.clientId, {
      name: order.clientName,
      address: this.tempAddress,
      tag: order.tags?.[0] || 'None',
      type: order.type || 'Nueva'
    }).subscribe({
      next: () => {
        this.toast.success('Dirección actualizada ✨');
        order.clientAddress = this.tempAddress;
        this.editingOrderId.set(null);
        this.isSavingAddress.set(false);
        // Also update in pendingOrders list if present
        this.pendingOrders.update(list => {
          return list.map(o => o.id === order.id ? { ...o, clientAddress: this.tempAddress } : o);
        });
      },
      error: () => {
        this.toast.error('Error al actualizar dirección');
        this.isSavingAddress.set(false);
      }
    });
  }

  // ═══ COMPUTED HELPERS ═══
  ordersWithAddress = computed(() => this.pendingOrders().filter(o => !!o.clientAddress && o.clientAddress.length > 5).length);
  ordersWithoutAddress = computed(() => this.pendingOrders().length - this.ordersWithAddress());

  routesByStatus(status: string): number {
    return this.routes().filter(r => r.status === status).length;
  }

  getRouteTotal(route: RouteDto): number {
    return route.deliveries?.reduce((sum, d) => sum + d.total, 0) || 0;
  }

  getDelivered(r: RouteDto): number {
    return r.deliveries.filter(d => d.status === 'Delivered').length;
  }

  getProgress(r: RouteDto): number {
    return r.deliveries.length ? (this.getDelivered(r) / r.deliveries.length) * 100 : 0;
  }

  getFailedDeliveries(r: RouteDto): RouteDeliveryDto[] {
    return r.deliveries.filter(d => d.status === 'NotDelivered');
  }

  getStatusLabel(s: string): string {
    const m: Record<string, string> = { 'Pending': '⏳ Pendiente', 'Active': '🚀 En camino', 'Completed': '✅ Finalizada', 'Canceled': '🚫 Cancelada' };
    return m[s] || s;
  }

  getStatusClasses(s: string): string {
    const m: Record<string, string> = {
      'Pending': 'bg-amber-50 text-amber-700 border border-amber-200',
      'Active': 'bg-blue-50 text-blue-700 border border-blue-200',
      'Completed': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      'Canceled': 'bg-red-50 text-red-700 border border-red-200'
    };
    return m[s] || 'bg-gray-50 text-gray-700';
  }

  // ─── DATA LOADING ───
  loadRoutes(): void {
    this.loading.set(true);
    this.api.getRoutes().subscribe({
      next: (r) => {
        r.sort((a, b) => b.id - a.id);
        this.routes.set(r);
        this.loading.set(false);
        // Phase 38: Initialize God Mode Map after DOM is rendered
        if (r.length > 0) {
          setTimeout(() => this.initGodModeMap(), 300);
        }
      },
      error: () => { this.loading.set(false); this.toast.error('Error al cargar rutas'); }
    });
    this.loadPendingOrders(); // Also load pending orders for quick-add feature
  }

  loadPendingOrders(): void {
    this.api.getOrders().subscribe({
      next: (orders) => {
        this.pendingOrders.set(
          orders.filter(o => o.status === 'Pending' || o.status === 'Confirmed')
            .sort((a, b) => (a.clientAddress ? 0 : 1) - (b.clientAddress ? 0 : 1))
        );
      }
    });
  }

  // ─── ROUTE MUTATION ───
  removeOrderFromRoute(route: any, orderId: number) {
    if (!confirm('¿Seguro que quieres quitar este pedido de la ruta?')) return;

    this.api.removeOrderFromRoute(route.id, orderId).subscribe({
      next: () => {
        this.toast.success('Pedido removido de la ruta ✨');
        this.loadRoutes();
      },
      error: (err) => this.toast.error('Error al remover pedido')
    });
  }

  addOrderToRoute(route: any, orderId: number) {
    this.api.addOrderToRoute(route.id, orderId).subscribe({
      next: () => {
        this.toast.success('Pedido agregado a la ruta 🚀');
        this.loadRoutes();
      },
      error: (err) => this.toast.error(err.error?.message || 'Error al agregar pedido')
    });
  }

  // ═══ CREATE ROUTE ═══
  openCreateModal(): void {
    this.searchQuery.set('');
    this.showCreateModal.set(true);
    this.selectedOrderIds.set(new Set());
    this.loadPendingOrders();
  }

  toggleOrder(id: number): void {
    this.selectedOrderIds.update(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  selectAllFiltered(): void {
    const filtered = this.filteredPendingOrders();
    this.selectedOrderIds.update(s => {
      const next = new Set(s);
      filtered.forEach(o => next.add(o.id));
      return next;
    });
    this.toast.info(`Seleccionados ${filtered.length} pedidos ✨`);
  }

  deselectAll(): void {
    this.selectedOrderIds.set(new Set());
  }

  // ─── AI VOICE ROUTE SELECTION ───
  startVoiceSelection(): void {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      this.toast.error('Tu navegador no soporta el reconocimiento de voz. Usa Chrome o Safari.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'es-MX';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.isListeningVoice.set(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      this.isListeningVoice.set(false);
      this.toast.info(`Escuché: "${transcript}"... Procesando 🧠`);
      this.processVoiceCommandWithGemini(transcript);
    };

    recognition.onerror = (event: any) => {
      this.isListeningVoice.set(false);
      console.error('Speech recognition error', event.error);
      if (event.error === 'no-speech') {
        this.toast.warning('No escuché nada. Intenta hablar más fuerte o revisa tu micrófono.');
      } else if (event.error === 'not-allowed') {
        this.toast.error('Permiso de micrófono denegado.');
      } else {
        this.toast.error('Ocurrió un error al escuchar. Intenta de nuevo.');
      }
    };

    recognition.onend = () => {
      this.isListeningVoice.set(false);
    };

    recognition.start();
  }

  private processVoiceCommandWithGemini(command: string): void {
    const orders = this.pendingOrders();
    if (orders.length === 0) {
      this.toast.error('No hay pedidos pendientes para seleccionar.');
      return;
    }

    this.isProcessingVoice.set(true);

    this.api.getAiRouteSelection(command, orders).subscribe({
      next: (response) => {
        this.isProcessingVoice.set(false);

        if (response && response.selectedOrderIds && response.selectedOrderIds.length > 0) {
          this.toast.success(response.aiConfirmationMessage || '¡Ruta armada con éxito!');
          this.runOrchestrationSequence(response);
        } else {
          this.toast.info(response?.aiConfirmationMessage || '🤖 Gemini no encontró pedidos que coincidan con lo que dijiste.');
        }
      },
      error: (err) => {
        this.isProcessingVoice.set(false);
        console.error('Gemini error', err);
        this.toast.error('Error al comunicarse con Gemini. Intenta de nuevo.');
      }
    });
  }

  private async runOrchestrationSequence(response: AiRouteSelectionResponse) {
    this.isOrchestrating.set(true);
    this.orchestrationFeed.set(["🛰️ Iniciando sistema de orquestación...", "🧠 CAMI analizando coincidencias..."]);
    
    // 1. Reproducir audio si existe
    if (response.audioBase64) {
      const audio = new Audio(`data:audio/mp3;base64,${response.audioBase64}`);
      audio.play().catch(e => console.error("Error playing orchestration audio", e));
    }

    // 2. Procesar cada ID de forma secuencial con delay para el efecto WOW
    for (const id of response.selectedOrderIds) {
      const order = this.pendingOrders().find(o => o.id === id);
      if (!order) continue;

      this.activeOrchestrationId.set(id);
      this.orchestrationFeed.update(f => [`📍 Localizando a ${order.clientName}...`, ...f.slice(0, 4)]);
      
      // Simular tiempo de "búsqueda" y animación
      await new Promise(r => setTimeout(r, 1200));

      // Marcar checkbox
      this.selectedOrderIds.update(s => {
        const next = new Set(s);
        next.add(id);
        return next;
      });

      // Si tiene dirección, mover el mapa (o simular impacto)
      if (order.clientAddress) {
        this.orchestrationFeed.update(f => [`✨ ${order.clientName} fijada en el radar`, ...f.slice(0, 4)]);
      }
    }

    // 3. Finalizar
    await new Promise(r => setTimeout(r, 1000));
    this.orchestrationFeed.update(f => ["✅ Orquestación completada con éxito", ...f]);
    this.toast.success(`🤖 ${response.aiConfirmationMessage}`);
    
    setTimeout(() => {
      this.isOrchestrating.set(false);
      this.activeOrchestrationId.set(null);
      this.orchestrationFeed.set([]);
    }, 2000);
  }

  // ─── LIVE RE-ORDERING (Drag & Drop) ───
  dropDelivery(event: CdkDragDrop<RouteDeliveryDto[]>, route: RouteDto) {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(route.deliveries, event.previousIndex, event.currentIndex);
    route.deliveries.forEach((d, index) => d.sortOrder = index + 1);
    const newOrderIds = route.deliveries.map(d => d.deliveryId);
    this.api.reorderRouteDeliveries(route.id, newOrderIds).subscribe({
      next: () => this.toast.success('Ruta reordenada ✨🚗'),
      error: () => { this.toast.error('Error al guardar el nuevo orden'); this.loadRoutes(); }
    });
  }

  moveDelivery(route: RouteDto, index: number, dir: 1 | -1): void {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= route.deliveries.length) return;
    moveItemInArray(route.deliveries, index, newIndex);
    route.deliveries.forEach((d, i) => d.sortOrder = i + 1);
    // Optimistic update — signal Angular that the array changed
    this.routes.update(rs => [...rs]);
    const newOrderIds = route.deliveries.map(d => d.deliveryId);
    this.api.reorderRouteDeliveries(route.id, newOrderIds).subscribe({
      next: () => this.toast.success('Ruta reordenada ✨'),
      error: () => { this.toast.error('Error al guardar'); this.loadRoutes(); }
    });
  }

  // ─── ROUTE OPTIMIZER INTEGRATION ───
  openOptimizer(): void {
    if (this.selectedOrderIds().size === 0) return;
    this.showCreateModal.set(false); // Hide the basic list modal
    this.showOptimizerModal.set(true); // Show the magic map
  }

  getSelectedOrdersForOptimization(): OrderSummaryDto[] {
    const ids = this.selectedOrderIds();
    return this.pendingOrders().filter(o => ids.has(o.id));
  }

  createOptimizedRoute(orderedIds: number[]): void {
    this.showOptimizerModal.set(false);
    this.toast.info('Creando ruta mágica... ✨🚗');

    // Call API with exactly the array of ordered IDs
    this.api.createRoute(orderedIds).subscribe({
      next: () => {
        this.toast.success('¡Ruta creada y optimizada con éxito! 🎉');
        this.selectedOrderIds.set(new Set());
        this.loadRoutes();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Error al crear la ruta mágica');
      }
    });
  }

  // ═══ DEPRECATED (Kept for reference, replaced by Optimization flow) ═══
  createRoute(): void {
    this.creating.set(true);
    this.api.createRoute([...this.selectedOrderIds()]).subscribe({
      next: () => {
        this.toast.success('¡Ruta creada! 🚗✨');
        this.showCreateModal.set(false);
        this.selectedOrderIds.set(new Set());
        this.loadRoutes();
        this.creating.set(false);
      },
      error: (err) => { this.toast.error(err.error?.message || 'Error al crear ruta'); this.creating.set(false); }
    });
  }

  // ═══ DRIVER LINK ═══
  copyDriverLink(route: RouteDto): void {
    const link = route.driverLink || `${window.location.origin}/repartidor/${route.driverToken}`;
    navigator.clipboard.writeText(link).then(() => this.toast.success('¡Link copiado! 📋✅'));
  }

  shareWhatsApp(route: RouteDto): void {
    const link = route.driverLink || `${window.location.origin}/repartidor/${route.driverToken}`;
    const text = `🚗 Ruta #${route.id}\n📦 ${route.deliveries.length} entregas\n\n🔗 ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  // ═══ DELETE ═══
  deleteRoute(id: number): void {
    if (!confirm('¿Eliminar esta ruta? Los pedidos volverán a estar pendientes.')) return;
    this.api.deleteRoute(id).subscribe({
      next: () => { this.toast.success('Ruta eliminada 🗑️'); this.loadRoutes(); },
      error: (err) => this.toast.error(err.error?.message || 'Error al eliminar')
    });
  }

  // ═══ GOOGLE MAPS MODAL ═══
  openMap(route: RouteDto): void {
    this.mapRoute.set(route);
    this.mapDeliveries = route.deliveries;
    this.mapDirections.set(undefined);
    this.showMapModal.set(true);

    // Try to center on device GPS first
    this.getCurrentLocation().then(pos => {
      this.mapCenter = pos || { lat: GEO_CONFIG.defaultLat, lng: GEO_CONFIG.defaultLng };
      setTimeout(() => this.plotMapRoute(route), 300);
    });
  }

  closeMap(): void {
    this.showMapModal.set(false);
    this.mapRoute.set(null);
  }

  getDeliveryMarkerOpts(d: RouteDeliveryDto): google.maps.MarkerOptions {
    let color = '#f472b6';
    if (d.status === 'Delivered') color = '#22c55e';
    else if (d.status === 'InTransit') color = '#3b82f6';
    else if (d.status === 'NotDelivered') color = '#ef4444';

    return {
      label: { text: d.sortOrder.toString(), color: 'white', fontWeight: 'bold' },
      icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: color, fillOpacity: 1, strokeColor: 'white', strokeWeight: 2, scale: 12 },
      title: `${d.sortOrder}. ${d.clientName} (${d.status})`
    };
  }

  private async plotMapRoute(route: RouteDto): Promise<void> {
    this.plottingMap.set(true);
    const sorted = [...route.deliveries].sort((a, b) => a.sortOrder - b.sortOrder);
    const path: google.maps.LatLngLiteral[] = [this.mapCenter];
    const waypoints: google.maps.DirectionsWaypoint[] = [];

    for (const d of sorted) {
      let lat = d.latitude;
      let lng = d.longitude;
      if (!lat || !lng) {
        const coords = await this.geocodeAddress(d.clientAddress || '');
        if (coords) { lat = coords.lat; lng = coords.lng; d.latitude = lat; d.longitude = lng; }
      }
      if (lat && lng) {
        waypoints.push({ location: { lat, lng }, stopover: true });
        path.push({ lat, lng });
      }
    }

    if (path.length > 1) {
      const ds = new google.maps.DirectionsService();
      ds.route({
        origin: path[0], destination: path[path.length - 1],
        waypoints: waypoints.slice(0, -1),
        optimizeWaypoints: false, travelMode: google.maps.TravelMode.DRIVING
      }, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          this.mapDirections.set(result);
        }
      });
    }

    this.plottingMap.set(false);
    setTimeout(() => {
      if (this.googleMap) {
        const bounds = new google.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        this.googleMap.fitBounds(bounds, 50);
      }
    }, 400);
  }

  // ═══ CORTE / LIQUIDACIÓN ═══
  openCorteModal(route: RouteDto): void {
    this.corteRoute.set(route);
    this.showCorteModal.set(true);
  }

  closeCorte(): void {
    this.corteRoute.set(null);
    this.showCorteModal.set(false);
  }

  corteData(): { totalCash: number; totalTransfer: number; totalExpenses: number; totalToDeliver: number } {
    const route = this.corteRoute();
    if (!route) return { totalCash: 0, totalTransfer: 0, totalExpenses: 0, totalToDeliver: 0 };

    let totalCash = 0, totalTransfer = 0;
    route.deliveries.forEach(d => {
      if (d.payments?.length) {
        d.payments.forEach(p => {
          if (p.method === 'Efectivo') totalCash += p.amount;
          else totalTransfer += p.amount;
        });
      }
    });

    const totalExpenses = route.expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
    return { totalCash, totalTransfer, totalExpenses, totalToDeliver: totalCash - totalExpenses };
  }

  confirmLiquidate(): void {
    const route = this.corteRoute();
    if (!route) return;
    this.liquidating.set(true);
    this.api.liquidateRoute(route.id).subscribe({
      next: () => {
        this.liquidating.set(false);
        this.toast.success('✅ Ruta liquidada correctamente');
        this.closeCorte();
        this.loadRoutes();
      },
      error: () => {
        this.liquidating.set(false);
        this.toast.error('Error al liquidar la ruta');
      }
    });
  }

  // ═══ GEOCODING ═══
  private async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    if (!address) return null;
    const key = address.toLowerCase().trim();
    if (this.geocodeCache.has(key)) return this.geocodeCache.get(key) ?? null;

    return new Promise(resolve => {
      const geocoder = new google.maps.Geocoder();
      const lower = address.toLowerCase();
      const hasCity = lower.includes('nuevo laredo') || lower.includes('nvo laredo');
      const full = hasCity ? `${address}, ${GEO_CONFIG.state}, ${GEO_CONFIG.country}` : `${address}, ${GEO_CONFIG.city}, ${GEO_CONFIG.state}, ${GEO_CONFIG.country}`;

      geocoder.geocode({ address: full, region: 'mx' }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
          const loc = { lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() };
          this.geocodeCache.set(key, loc);
          resolve(loc);
        } else {
          this.geocodeCache.set(key, null);
          resolve(null);
        }
      });
    });
  }

  // ═══ GEOLOCATION ═══
  private getCurrentLocation(): Promise<google.maps.LatLngLiteral | null> {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  // ─── GOD MODE LOGIC (Phase 38) ───
  private async initGodModeMap() {
    if (this.godModeMapInitialized) return;
    const el = document.getElementById('god-mode-map');
    if (!el || typeof (window as any).google === 'undefined') return;

    this.godModeMap = new (window as any).google.maps.Map(el, {
      center: { lat: GEO_CONFIG.defaultLat, lng: GEO_CONFIG.defaultLng }, // Center
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] }
      ]
    });
    this.godModeMapInitialized = true;
  }

  private updateGodModeDriver(token: string, lat: number, lng: number) {
    if (!this.godModeMap) return;

    let markerData = this.godModeMarkers.get(token);
    const newPos = new (window as any).google.maps.LatLng(lat, lng);

    // Info Window lazy instantiation
    if (!this.godModeMap._globalInfoWindow) {
      this.godModeMap._globalInfoWindow = new (window as any).google.maps.InfoWindow();
    }

    if (!markerData) {
      const marker = new (window as any).google.maps.Marker({
        position: newPos,
        map: this.godModeMap,
        icon: {
          path: (window as any).google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#ec4899', // Pink-500
          fillOpacity: 1,
          strokeColor: '#be185d',
          strokeWeight: 2,
          rotation: 0
        },
        zIndex: 100,
        title: `Chofer ${localStorage.getItem('token_' + token) || token.substring(0, 4)}`
      });

      marker.addListener('click', () => {
        const lastSeen = new Date().toLocaleTimeString('es-MX', { hour12: false });
        const content = `
           <div style="padding: 10px; font-family: sans-serif;">
             <strong style="color: #ec4899; font-size: 14px;">Chofer Activo</strong><br>
             <span style="font-size: 11px; color: #666;">ID: ${token.substring(0, 8)}...</span><br>
             <span style="font-size: 11px; color: #666;">Última vez visto: ${lastSeen}</span>
           </div>
         `;
        this.godModeMap._globalInfoWindow.setContent(content);
        this.godModeMap._globalInfoWindow.open({
          anchor: marker,
          map: this.godModeMap,
        });
      });

      this.godModeMarkers.set(token, { marker, lastLat: lat, lastLng: lng });
      return;
    }

    const marker = markerData.marker;

    // Animate to new position
    const startPos = marker.getPosition();
    const startTime = performance.now();
    const duration = 1500;

    // Calculate Bearing for Rotation
    const startLat = startPos.lat() * (Math.PI / 180);
    const startLng = startPos.lng() * (Math.PI / 180);
    const endLat = lat * (Math.PI / 180);
    const endLng = lng * (Math.PI / 180);
    const dLng = endLng - startLng;
    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
    let brng = Math.atan2(y, x);
    brng = brng * (180 / Math.PI);
    const rotation = (brng + 360) % 360;

    // Optional: Calculate pseudo-velocity
    const distMeters = this.getHaversineDistance(startPos.lat(), startPos.lng(), lat, lng);
    // Rough velocity (m/s) if assuming 5 seconds tick rate
    const velocityKmh = Math.round((distMeters / 5) * 3.6);

    const icon = marker.getIcon();
    icon.rotation = rotation;
    marker.setIcon(icon);

    markerData.lastLat = lat;
    markerData.lastLng = lng;

    const animate = (time: number) => {
      let progress = (time - startTime) / duration;
      if (progress > 1) progress = 1;
      // Easing out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      const currentLat = startPos.lat() + (lat - startPos.lat()) * ease;
      const currentLng = startPos.lng() + (lng - startPos.lng()) * ease;

      marker.setPosition(new (window as any).google.maps.LatLng(currentLat, currentLng));

      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    // Auto fit-bounds gently? Only if it's way out? We'll leave it as is so user can drag map around freely.
  }

  private getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const p = 0.017453292519943295; // Math.PI / 180
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p) / 2 +
      c(lat1 * p) * c(lat2 * p) *
      (1 - c((lon2 - lon1) * p)) / 2;
    return 12742 * Math.asin(Math.sqrt(a)) * 1000; // 2 * R; R = 6371 km returns meters
  }

  private playSuccessChime() {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc2.frequency.setValueAtTime(1108.73, ctx.currentTime); // C#6

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 1.5);
      osc2.stop(ctx.currentTime + 1.5);
    } catch (e) { }
  }

  private playCashSound() {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      // A quick cha-ching sound synthesis
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);

      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(2000, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
        gain2.gain.setValueAtTime(0, ctx.currentTime);
        gain2.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.4);
      }, 100);

    } catch (e) { }
  }
}
