import {
  Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, ViewChildren, QueryList,
  signal, computed, inject, CUSTOM_ELEMENTS_SCHEMA
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMap, MapMarker, MapCircle, MapInfoWindow } from '@angular/google-maps';
import { ColoniaService, PINK_COQUETTE_MAP_STYLES, REGIBY_DEPOT } from '../../../../core/services/colonia.service';
import { ColoniaReportDto, ColoniaStatsDto } from '../../../../core/models';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-colonia-map-report',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [CommonModule, GoogleMap, MapMarker, MapCircle, MapInfoWindow],
  template: `
    <div class="space-y-6 animate-fade-in pb-12">
      <!-- ── BARRA SUPERIOR COQUETTE: REINA DEL MES Y ACCIONES ── -->
      <div class="card-coquette p-5 bg-gradient-to-r from-pink-500/10 via-rose-400/10 to-purple-400/10 border-pink-200/80 shadow-md backdrop-blur-md relative overflow-hidden">
        <!-- Decoraciones flotantes -->
        <div class="absolute -right-6 -bottom-6 text-7xl opacity-20 pointer-events-none select-none">👑</div>
        <div class="absolute right-24 top-2 text-3xl opacity-30 pointer-events-none select-none animate-pulse">✨</div>
        <div class="absolute left-1/2 -top-4 text-2xl opacity-25 pointer-events-none select-none">🎀</div>

        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-pink-500 text-white shadow-sm shadow-pink-300">
                <span>👑</span> Colonia Reina de Compras
              </span>
              <span class="text-xs font-bold text-pink-400">Nuevo Laredo, Tamaulipas</span>
            </div>
            
            <h2 class="text-2xl sm:text-3xl font-black text-pink-900 tracking-tight mt-1.5 flex items-center gap-2 flex-wrap">
              <span>{{ report()?.topColoniaName || 'Calculando...' }}</span>
              @if (report()?.topColoniaPercentage) {
                <span class="text-lg sm:text-xl font-black text-pink-600 bg-white/80 px-3 py-0.5 rounded-2xl border border-pink-200 shadow-inner">
                  {{ report()!.topColoniaPercentage }}% del total
                </span>
              }
            </h2>
            <p class="text-xs sm:text-sm text-pink-700/80 font-medium mt-1">
              {{ getCheerleaderMessage(report()?.topColoniaName) }}
            </p>
          </div>

          <!-- BOTONES DE ACCIÓN: PRESUMIR EN REDES -->
          <div class="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              (click)="openSocialModal()"
              type="button"
              class="btn-coquette bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 text-white px-5 py-3 rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-pink-300 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
              <span class="text-lg">📸</span>
              <span>Presumir en Redes</span>
              <span class="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-black">Story & Post</span>
            </button>

            <button
              (click)="centerOnNLD()"
              type="button"
              class="btn-coquette bg-white text-pink-700 border-2 border-pink-200 px-4 py-3 rounded-2xl font-black text-xs hover:bg-pink-50 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm">
              <span>🎯</span>
              <span>Centrar Mapa</span>
            </button>
          </div>
        </div>

        <!-- Mini métricas rápidas de distribución -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-pink-100/70">
          <div class="bg-white/70 rounded-2xl p-3 border border-pink-100 shadow-sm">
            <p class="text-[10px] font-black uppercase text-pink-400 tracking-widest">Total Pedidos</p>
            <p class="text-xl font-black text-pink-900 mt-0.5">{{ report()?.totalOrders || 0 }}</p>
          </div>

          <div class="bg-white/70 rounded-2xl p-3 border border-pink-100 shadow-sm">
            <p class="text-[10px] font-black uppercase text-pink-400 tracking-widest">Colonias Activas</p>
            <p class="text-xl font-black text-pink-900 mt-0.5">{{ deliveryColonias().length }}</p>
          </div>

          <div class="bg-white/70 rounded-2xl p-3 border border-pink-100 shadow-sm">
            <p class="text-[10px] font-black uppercase text-pink-400 tracking-widest">A Domicilio</p>
            <p class="text-xl font-black text-pink-900 mt-0.5">
              {{ deliveryPercentage() }}%
              <span class="text-[11px] font-bold text-pink-400">({{ report()?.totalColoniaOrders || 0 }})</span>
            </p>
          </div>

          <div class="bg-white/70 rounded-2xl p-3 border border-pink-100 shadow-sm">
            <p class="text-[10px] font-black uppercase text-purple-400 tracking-widest">Pasan a Pickup</p>
            <p class="text-xl font-black text-purple-900 mt-0.5">
              {{ pickupPercentage() }}%
              <span class="text-[11px] font-bold text-purple-400">({{ report()?.totalPickupOrders || 0 }})</span>
            </p>
          </div>
        </div>
      </div>

      <!-- ── CONTENEDOR PRINCIPAL: MAPA ROSA + LEADERBOARD ── -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <!-- ── COLUMNA IZQUIERDA: EL MAPA ROSA INTERACTIVO (7 COLS EN DESKTOP) ── -->
        <div class="lg:col-span-7 flex flex-col gap-4">
          <div class="card-coquette p-3 bg-white/80 border-pink-200/80 shadow-lg rounded-3xl overflow-hidden relative">
            
            <!-- Header del Mapa con controles sutiles -->
            <div class="px-3 py-2 flex items-center justify-between border-b border-pink-50 mb-2">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-pink-500 animate-ping"></span>
                <h3 class="text-xs font-black text-pink-900 uppercase tracking-widest flex items-center gap-1.5">
                  🗺️ Mapa de Calor Coquette • Nuevo Laredo
                </h3>
              </div>
              <div class="flex items-center gap-1.5 text-[11px] font-bold text-pink-500">
                <span class="inline-block w-2.5 h-2.5 rounded-full bg-pink-500 shadow-sm"></span>
                <span>Burbujas por % de compras</span>
              </div>
            </div>

            <!-- Google Map Viewport -->
            <div class="relative w-full h-[400px] sm:h-[480px] lg:h-[540px] rounded-2xl overflow-hidden bg-pink-50 shadow-inner">
              <google-map
                #googleMapRef
                [center]="mapCenter()"
                [zoom]="mapZoom()"
                [options]="mapOptions"
                width="100%"
                height="100%"
                (mapInitialized)="onMapInit($event)">

                <!-- Círculos de calor para cada colonia -->
                @for (c of report()?.colonias; track c.coloniaName) {
                  <map-circle
                    [center]="{ lat: c.latitude, lng: c.longitude }"
                    [radius]="getCircleRadius(c)"
                    [options]="getCircleOptions(c)"
                    (circleClick)="onSelectColonia(c)">
                  </map-circle>
                }

                <!-- Marcadores con pines cute y coronas -->
                @for (c of report()?.colonias; track c.coloniaName) {
                  <map-marker
                    [position]="{ lat: c.latitude, lng: c.longitude }"
                    [options]="getMarkerOptions(c)"
                    (mapClick)="onMarkerClick(c, markerRef)"
                    #markerRef="mapMarker">
                  </map-marker>
                }

                <!-- InfoWindow Coquette al hacer clic -->
                <map-info-window #infoWindow>
                  @if (selectedColonia()) {
                    <div class="p-2.5 max-w-[240px] font-sans text-left">
                      <div class="flex items-center gap-1.5 mb-1">
                        <span class="text-lg">{{ selectedColonia()!.isPickup ? '🛍️' : (selectedColonia()!.rank === 1 ? '👑' : '🌸') }}</span>
                        <h4 class="font-black text-pink-900 text-sm leading-tight">{{ selectedColonia()!.coloniaName }}</h4>
                      </div>

                      @if (selectedColonia()!.isPickup) {
                        <p class="text-[11px] text-purple-700 font-bold mb-2">
                          Clientas que acuden a recoger su paquete en la matriz de Regi Bazar.
                        </p>
                      } @else {
                        <div class="text-[11px] font-extrabold text-pink-500 mb-2">
                          Lugar #{{ selectedColonia()!.rank }} en compras
                        </div>
                      }

                      <div class="bg-pink-50 rounded-xl p-2.5 border border-pink-100 space-y-1.5">
                        <div class="flex items-center justify-between text-xs">
                          <span class="text-pink-600 font-bold">Porcentaje:</span>
                          <span class="text-pink-900 font-black text-sm">{{ selectedColonia()!.percentage }}%</span>
                        </div>

                        <!-- Mini barra de progreso -->
                        <div class="w-full bg-pink-100 rounded-full h-2 overflow-hidden">
                          <div
                            class="bg-gradient-to-r from-pink-400 to-rose-500 h-full rounded-full transition-all duration-500"
                            [style.width.%]="selectedColonia()!.percentage">
                          </div>
                        </div>

                        <div class="flex items-center justify-between text-[11px] text-pink-500 font-medium pt-1">
                          <span>Pedidos: {{ selectedColonia()!.ordersCount }}</span>
                          <span>Clientas: {{ selectedColonia()!.clientsCount }}</span>
                        </div>
                      </div>

                      <p class="text-[10px] text-pink-400 font-bold italic text-center mt-2">
                        ✨ Regi Bazar Delivery Power 💕
                      </p>
                    </div>
                  }
                </map-info-window>
              </google-map>

              <!-- Loading overlay mientras procesa -->
              @if (loading()) {
                <div class="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                  <span class="text-4xl animate-bounce">🎀</span>
                  <p class="text-xs font-black text-pink-600 tracking-wider uppercase animate-pulse">
                    Mapeando las colonias más bellas...
                  </p>
                </div>
              }
            </div>

            <!-- Leyenda Coquette al pie del mapa -->
            <div class="px-3 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-pink-700">
              <div class="flex items-center gap-3">
                <span class="flex items-center gap-1">
                  <span class="text-sm">👑</span> Top 1
                </span>
                <span class="flex items-center gap-1">
                  <span class="text-sm">🥈</span> Top 2
                </span>
                <span class="flex items-center gap-1">
                  <span class="text-sm">🥉</span> Top 3
                </span>
                <span class="flex items-center gap-1">
                  <span class="text-sm">🛍️</span> Pickup Matriz
                </span>
              </div>
              <span class="text-[11px] text-pink-400">💡 Da clic en cualquier punto para ver detalles</span>
            </div>
          </div>
        </div>

        <!-- ── COLUMNA DERECHA: PODIUM TOP 3 + LEADERBOARD + CARD PICKUP (5 COLS) ── -->
        <div class="lg:col-span-5 space-y-4">

          <!-- ── EL PODIUM COQUETTE TOP 3 ── -->
          @if (topThree().length > 0) {
            <div class="card-coquette p-4 bg-gradient-to-b from-white/95 to-pink-50/80 border-pink-200/90 shadow-md">
              <div class="flex items-center justify-between mb-3 pb-2 border-b border-pink-100">
                <div class="flex items-center gap-2">
                  <span class="text-xl">🏆</span>
                  <h3 class="text-sm font-black text-pink-900 uppercase tracking-widest">Podium de Colonias</h3>
                </div>
                <span class="text-[10px] font-bold text-pink-400 bg-pink-100/70 px-2 py-0.5 rounded-full">Top Compradoras</span>
              </div>

              <!-- Escenario del podium 3D -->
              <div class="grid grid-cols-3 gap-2 items-end pt-4 pb-2 text-center">
                
                <!-- 2do Lugar (Izquierda) -->
                @if (topThree()[1]; as second) {
                  <div
                    (click)="onSelectColonia(second)"
                    class="cursor-pointer group flex flex-col items-center transition-all hover:-translate-y-1">
                    <span class="text-2xl mb-1 group-hover:scale-125 transition-transform">🥈</span>
                    <p class="text-xs font-black text-pink-900 truncate max-w-[90px]" [title]="second.coloniaName">
                      {{ cleanColoniaName(second.coloniaName) }}
                    </p>
                    <span class="text-xs font-black text-rose-500 bg-pink-100 px-2 py-0.5 rounded-full mt-1">
                      {{ second.percentage }}%
                    </span>
                    <div class="w-full h-16 bg-gradient-to-t from-pink-300 to-pink-200 rounded-t-2xl mt-2 flex items-center justify-center shadow-inner border border-pink-300/60">
                      <span class="text-white font-black text-sm drop-shadow">#2</span>
                    </div>
                  </div>
                }

                <!-- 1er Lugar (Centro - Más Alto) -->
                @if (topThree()[0]; as first) {
                  <div
                    (click)="onSelectColonia(first)"
                    class="cursor-pointer group flex flex-col items-center -mt-4 transition-all hover:-translate-y-1">
                    <div class="relative">
                      <span class="text-3xl mb-1 inline-block animate-bounce group-hover:scale-125 transition-transform">👑</span>
                      <span class="absolute -top-1 -right-2 text-xs">✨</span>
                    </div>
                    <p class="text-xs sm:text-sm font-black text-pink-900 truncate max-w-[100px]" [title]="first.coloniaName">
                      {{ cleanColoniaName(first.coloniaName) }}
                    </p>
                    <span class="text-xs sm:text-sm font-black text-white bg-gradient-to-r from-pink-500 to-rose-500 px-2.5 py-0.5 rounded-full mt-1 shadow-sm shadow-pink-300">
                      {{ first.percentage }}%
                    </span>
                    <div class="w-full h-24 bg-gradient-to-t from-pink-500 to-rose-400 rounded-t-2xl mt-2 flex flex-col items-center justify-center shadow-md border border-pink-400">
                      <span class="text-white font-black text-base drop-shadow">#1</span>
                      <span class="text-[9px] text-pink-100 font-extrabold uppercase">Reina</span>
                    </div>
                  </div>
                }

                <!-- 3er Lugar (Derecha) -->
                @if (topThree()[2]; as third) {
                  <div
                    (click)="onSelectColonia(third)"
                    class="cursor-pointer group flex flex-col items-center transition-all hover:-translate-y-1">
                    <span class="text-2xl mb-1 group-hover:scale-125 transition-transform">🥉</span>
                    <p class="text-xs font-black text-pink-900 truncate max-w-[90px]" [title]="third.coloniaName">
                      {{ cleanColoniaName(third.coloniaName) }}
                    </p>
                    <span class="text-xs font-black text-rose-500 bg-pink-100 px-2 py-0.5 rounded-full mt-1">
                      {{ third.percentage }}%
                    </span>
                    <div class="w-full h-12 bg-gradient-to-t from-pink-200 to-pink-100 rounded-t-2xl mt-2 flex items-center justify-center shadow-inner border border-pink-200">
                      <span class="text-pink-600 font-black text-xs">#3</span>
                    </div>
                  </div>
                }

              </div>
            </div>
          }

          <!-- ── CARD DE PICKUP (REGLA: CLIENTAS SIN DIRECCIÓN O RETIRO EN MATRIZ) ── -->
          @if (pickupStats(); as pickup) {
            <div
              (click)="onSelectColonia(pickup)"
              class="card-coquette p-4 bg-gradient-to-r from-purple-500/10 via-pink-500/5 to-white/90 border-purple-200/90 shadow-sm cursor-pointer hover:border-purple-300 transition-all group">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform shrink-0">
                    🛍️
                  </div>
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <h4 class="text-sm font-black text-purple-950">Pickup (Matriz Regi Bazar)</h4>
                      <span class="text-[10px] font-black bg-purple-500 text-white px-2 py-0.5 rounded-full">
                        Pasan por pedido
                      </span>
                    </div>
                    <p class="text-xs text-purple-700/80 mt-1 leading-snug">
                      Clientas que pasan a recoger su compra personalmente al domicilio oficial de Regi Bazar.
                    </p>
                  </div>
                </div>

                <div class="text-right shrink-0">
                  <span class="text-xl font-black text-purple-900">{{ pickup.percentage }}%</span>
                  <p class="text-[10px] font-bold text-purple-500">{{ pickup.ordersCount }} compras</p>
                </div>
              </div>

              <!-- Barra de progreso pickup -->
              <div class="mt-3 pt-2 border-t border-purple-100/60 flex items-center justify-between text-[11px] font-bold text-purple-600">
                <div class="flex-1 mr-3 bg-purple-100 rounded-full h-2 overflow-hidden">
                  <div class="bg-gradient-to-r from-purple-400 to-indigo-500 h-full rounded-full" [style.width.%]="pickup.percentage"></div>
                </div>
                <span class="group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  Ver matriz en mapa 📍
                </span>
              </div>
            </div>
          }

          <!-- ── LISTA COMPLETA DE COLONIAS (LEADERBOARD) ── -->
          <div class="card-coquette p-4 bg-white/90 border-pink-200/80 shadow-md">
            <div class="flex items-center justify-between mb-3 pb-2 border-b border-pink-100">
              <h3 class="text-xs font-black text-pink-900 uppercase tracking-widest flex items-center gap-1.5">
                <span>📋</span> Ranking Completo por Colonia
              </h3>
              <span class="text-[11px] font-bold text-pink-400">{{ deliveryColonias().length }} colonias</span>
            </div>

            <div class="max-h-[360px] overflow-y-auto space-y-2 pr-1 custom-pink-scroll">
              @for (c of deliveryColonias(); track c.coloniaName) {
                <div
                  (click)="onSelectColonia(c)"
                  [class.ring-2]="selectedColonia()?.coloniaName === c.coloniaName"
                  [class.ring-pink-400]="selectedColonia()?.coloniaName === c.coloniaName"
                  class="p-2.5 rounded-2xl border border-pink-100 bg-white/60 hover:bg-pink-50/70 cursor-pointer transition-all flex items-center justify-between gap-3 group">
                  
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span
                      [class]="c.rank === 1 ? 'bg-amber-400 text-white font-black' : (c.rank <= 3 ? 'bg-pink-200 text-pink-800 font-bold' : 'bg-pink-50 text-pink-500 font-semibold')"
                      class="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0">
                      {{ c.rank }}
                    </span>
                    <div class="min-w-0">
                      <p class="text-xs font-black text-pink-900 truncate group-hover:text-pink-600 transition-colors">
                        {{ c.coloniaName }}
                      </p>
                      <div class="flex items-center gap-2 text-[10px] text-pink-400 font-medium">
                        <span>{{ c.ordersCount }} compras</span>
                        <span>•</span>
                        <span>{{ c.clientsCount }} clientas</span>
                      </div>
                    </div>
                  </div>

                  <div class="text-right shrink-0">
                    <span class="text-sm font-black text-pink-700">{{ c.percentage }}%</span>
                    <div class="w-16 bg-pink-100 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div
                        class="bg-gradient-to-r from-pink-400 to-rose-500 h-full rounded-full"
                        [style.width.%]="c.percentage">
                      </div>
                    </div>
                  </div>

                </div>
              }
            </div>
          </div>

        </div>

      </div>

      <!-- ── MODAL COQUETTE: PRESUMIR EN REDES SOCIALES (STORY & POST) ── -->
      @if (showSocialModal()) {
        <div
          class="fixed inset-0 z-[7000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          (click)="closeSocialModal()">
          <div
            class="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl border-4 border-pink-200 flex flex-col my-auto animate-scale-up"
            (click)="$event.stopPropagation()">
            
            <!-- Modal Header -->
            <div class="p-4 sm:px-6 sm:py-4 bg-gradient-to-r from-pink-500 via-rose-400 to-pink-500 text-white flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-2xl">🎀</span>
                <div>
                  <h3 class="font-black text-base sm:text-lg leading-tight">Presumir en Redes Sociales</h3>
                  <p class="text-[11px] text-pink-100 font-medium">Exporta tu gráfico aesthetic para Instagram & Facebook</p>
                </div>
              </div>
              <button
                (click)="closeSocialModal()"
                class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-base font-bold transition-all">
                ✕
              </button>
            </div>

            <!-- Selector de Formato: Historia (9:16) vs Post (1:1) -->
            <div class="px-6 pt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                [class]="socialFormat() === 'story' ? 'bg-pink-500 text-white shadow-md' : 'bg-pink-50 text-pink-700 hover:bg-pink-100'"
                (click)="socialFormat.set('story')"
                class="px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5">
                <span>📱</span> Historia (9:16)
              </button>
              <button
                type="button"
                [class]="socialFormat() === 'post' ? 'bg-pink-500 text-white shadow-md' : 'bg-pink-50 text-pink-700 hover:bg-pink-100'"
                (click)="socialFormat.set('post')"
                class="px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5">
                <span>🖼️</span> Post Cuadrado (1:1)
              </button>
            </div>

            <!-- Contenedor del Preview para html2canvas -->
            <div class="p-3 sm:p-5 flex items-center justify-center bg-gray-50/70 overflow-hidden">
              <div
                id="socialCardExport"
                [class]="socialFormat() === 'story' ? 'w-[340px] min-h-[610px] p-4 sm:p-5' : 'w-[360px] h-[360px] p-3 sm:p-4'"
                class="bg-gradient-to-b from-[#fff5f8] via-[#fdf2f8] to-[#fce7f3] rounded-[2.5rem] border-2 border-pink-300 shadow-2xl flex flex-col justify-between relative overflow-hidden text-center select-none font-sans">
                
                <!-- Decoración Coquette de fondo -->
                <div class="absolute -top-8 -right-8 text-7xl opacity-10 pointer-events-none">🌸</div>
                <div class="absolute -bottom-8 -left-8 text-7xl opacity-10 pointer-events-none">✨</div>

                <!-- Header de la tarjeta social -->
                <div class="relative z-10 shrink-0">
                  <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 border border-pink-200 text-[10px] font-black text-pink-600 shadow-sm mb-1">
                    <span>🎀</span>
                    <span>REGI BAZAR • NUEVO LAREDO</span>
                    <span>✨</span>
                  </div>

                  @if (socialFormat() === 'story') {
                    <h2 class="text-lg sm:text-xl font-black text-pink-900 tracking-tight leading-tight mt-0.5">
                      👑 ¿CUÁL ES LA COLONIA MÁS REGIA? 💕
                    </h2>
                    <p class="text-[11px] text-pink-600/90 font-bold mt-0.5">
                      Mapa oficial de entregas en vivo 🛍️
                    </p>
                  } @else {
                    <h2 class="text-base font-black text-pink-900 tracking-tight leading-tight">
                      👑 NUEVO LAREDO ES TERRITORIO REGI BAZAR 💖
                    </h2>
                  }
                </div>

                <!-- ── HERO: EL MAPA ROSA VECTORIAL DE NUEVO LAREDO ── -->
                <div
                  [class]="socialFormat() === 'story' ? 'h-[270px] my-2' : 'h-[210px] my-1.5'"
                  class="relative w-full rounded-2xl overflow-hidden border-2 border-pink-200/90 shadow-md bg-gradient-to-br from-[#fff1f5] via-[#ffe4ec] to-[#fce7f3] z-10 shrink-0">

                  <!-- Fondo Cartográfico SVG de Nuevo Laredo -->
                  <svg viewBox="0 0 100 100" class="w-full h-full absolute inset-0 pointer-events-none" preserveAspectRatio="none">
                    <defs>
                      <radialGradient id="queenHeat" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.8"/>
                        <stop offset="40%" stop-color="#ec4899" stop-opacity="0.45"/>
                        <stop offset="100%" stop-color="#ec4899" stop-opacity="0"/>
                      </radialGradient>
                      <radialGradient id="coloniaHeat" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="#f472b6" stop-opacity="0.7"/>
                        <stop offset="60%" stop-color="#fda4af" stop-opacity="0.3"/>
                        <stop offset="100%" stop-color="#fda4af" stop-opacity="0"/>
                      </radialGradient>
                      <radialGradient id="matrizHeat" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="#a855f7" stop-opacity="0.8"/>
                        <stop offset="60%" stop-color="#c084fc" stop-opacity="0.3"/>
                        <stop offset="100%" stop-color="#c084fc" stop-opacity="0"/>
                      </radialGradient>
                    </defs>

                    <!-- Cuadrícula sutil de coordenadas coquette -->
                    <line x1="20" y1="0" x2="20" y2="100" stroke="#fbcfe8" stroke-width="0.3" stroke-dasharray="1,2" opacity="0.6"/>
                    <line x1="40" y1="0" x2="40" y2="100" stroke="#fbcfe8" stroke-width="0.3" stroke-dasharray="1,2" opacity="0.6"/>
                    <line x1="60" y1="0" x2="60" y2="100" stroke="#fbcfe8" stroke-width="0.3" stroke-dasharray="1,2" opacity="0.6"/>
                    <line x1="80" y1="0" x2="80" y2="100" stroke="#fbcfe8" stroke-width="0.3" stroke-dasharray="1,2" opacity="0.6"/>
                    <line x1="0" y1="30" x2="100" y2="30" stroke="#fbcfe8" stroke-width="0.3" stroke-dasharray="1,2" opacity="0.6"/>
                    <line x1="0" y1="60" x2="100" y2="60" stroke="#fbcfe8" stroke-width="0.3" stroke-dasharray="1,2" opacity="0.6"/>

                    <!-- Río Bravo (Ribbon de agua rosa/lavanda a lo largo del norte y oriente) -->
                    <path d="M 0 6 Q 40 8, 86 16 T 98 28 Q 96 65, 92 100" fill="none" stroke="#fbcfe8" stroke-width="6" stroke-linecap="round"/>
                    <path d="M 0 6 Q 40 8, 86 16 T 98 28 Q 96 65, 92 100" fill="none" stroke="#f472b6" stroke-width="1.8" stroke-linecap="round"/>

                    <!-- Principales avenidas de Nuevo Laredo (blanco y blush) -->
                    <path d="M 86 22 L 81 100" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
                    <path d="M 86 22 L 81 100" stroke="#fecdd3" stroke-width="1" stroke-linecap="round"/>
                    <path d="M 0 42 Q 45 38, 86 28" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
                    <path d="M 0 42 Q 45 38, 86 28" stroke="#fecdd3" stroke-width="0.9" stroke-linecap="round"/>
                    <path d="M 40 10 Q 82 20, 93 32 Q 91 65, 88 95" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
                    <path d="M 15 58 L 94 54" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
                    <path d="M 84 25 L 80 75" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>

                    <!-- Textos geográficos sutiles -->
                    <text x="75" y="8" font-size="3.2" font-weight="bold" fill="#db2777" opacity="0.7">RÍO BRAVO 🌊</text>
                    <text x="96" y="8" font-size="3" font-weight="bold" fill="#9d174d" opacity="0.6">USA 🇺🇸</text>
                    <text x="6" y="94" font-size="3.2" font-weight="bold" fill="#be185d" opacity="0.6">NUEVO LAREDO, TAMPS. 🇲🇽</text>

                    <!-- Roseta náutica coquette -->
                    <text x="6" y="14" font-size="4" font-weight="900" fill="#be185d">N 🎀</text>

                    <!-- Burbujas de calor bajo colonias -->
                    @for (c of deliveryColonias(); track c.coloniaName) {
                      @if (c.rank === 1) {
                        <circle [attr.cx]="getSocialX(c.longitude)" [attr.cy]="getSocialY(c.latitude)" r="14" fill="url(#queenHeat)"/>
                        <circle [attr.cx]="getSocialX(c.longitude)" [attr.cy]="getSocialY(c.latitude)" r="3" fill="#f43f5e" stroke="#ffffff" stroke-width="0.8"/>
                      } @else if (c.rank <= 3) {
                        <circle [attr.cx]="getSocialX(c.longitude)" [attr.cy]="getSocialY(c.latitude)" r="9" fill="url(#coloniaHeat)"/>
                        <circle [attr.cx]="getSocialX(c.longitude)" [attr.cy]="getSocialY(c.latitude)" r="2" fill="#ec4899" stroke="#ffffff" stroke-width="0.6"/>
                      } @else {
                        <circle [attr.cx]="getSocialX(c.longitude)" [attr.cy]="getSocialY(c.latitude)" r="4" fill="#fda4af" opacity="0.5"/>
                        <circle [attr.cx]="getSocialX(c.longitude)" [attr.cy]="getSocialY(c.latitude)" r="1.2" fill="#f472b6"/>
                      }
                    }

                    <!-- Halo Matriz Pickup en C. Rio Indo 1601, Voluntad y Trabajo 3 -->
                    @if (pickupStats(); as p) {
                      <circle [attr.cx]="getSocialX(p.longitude)" [attr.cy]="getSocialY(p.latitude)" r="9" fill="url(#matrizHeat)"/>
                      <circle [attr.cx]="getSocialX(p.longitude)" [attr.cy]="getSocialY(p.latitude)" r="2.2" fill="#9333ea" stroke="#ffffff" stroke-width="0.6"/>
                    }
                  </svg>

                  <!-- Badges Flotantes sobre el mapa de la tarjeta -->
                  <!-- Reina #1 -->
                  @if (topThree()[0]; as first) {
                    <div
                      class="absolute -translate-x-1/2 -translate-y-full mb-1 flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white text-[9.5px] font-black shadow-lg border-2 border-white whitespace-nowrap z-30 pointer-events-none"
                      [style.left.%]="getBadgeX(first.longitude)"
                      [style.top.%]="getBadgeY(first.latitude)">
                      <span>👑</span>
                      <span>#1 {{ cleanColoniaName(first.coloniaName) }}</span>
                      <span class="bg-white/30 text-white px-1.5 py-0.2 rounded-full font-black text-[9px]">{{ first.percentage }}%</span>
                    </div>
                  }

                  <!-- 2do Lugar -->
                  @if (topThree()[1]; as second) {
                    <div
                      class="absolute -translate-x-1/2 -translate-y-full mb-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-pink-800 text-[8.5px] font-black shadow-md border border-pink-300 whitespace-nowrap z-20 pointer-events-none"
                      [style.left.%]="getBadgeX(second.longitude)"
                      [style.top.%]="getBadgeY(second.latitude)">
                      <span>🥈</span>
                      <span>{{ cleanColoniaName(second.coloniaName) }}</span>
                      <span class="text-rose-600 font-black">{{ second.percentage }}%</span>
                    </div>
                  }

                  <!-- 3er Lugar -->
                  @if (topThree()[2]; as third) {
                    <div
                      class="absolute -translate-x-1/2 -translate-y-full mb-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-pink-800 text-[8.5px] font-black shadow-md border border-pink-300 whitespace-nowrap z-20 pointer-events-none"
                      [style.left.%]="getBadgeX(third.longitude)"
                      [style.top.%]="getBadgeY(third.latitude)">
                      <span>🥉</span>
                      <span>{{ cleanColoniaName(third.coloniaName) }}</span>
                      <span class="text-rose-600 font-black">{{ third.percentage }}%</span>
                    </div>
                  }

                  <!-- Matriz Regi Bazar Pickup -->
                  @if (pickupStats(); as p) {
                    <div
                      class="absolute -translate-x-1/2 -translate-y-full mb-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-600 text-white text-[8px] font-black shadow-md border border-white whitespace-nowrap z-20 pointer-events-none"
                      [style.left.%]="getBadgeX(p.longitude)"
                      [style.top.%]="getBadgeY(p.latitude)">
                      <span>🏠</span>
                      <span>Matriz ({{ p.percentage }}%)</span>
                    </div>
                  }
                </div>

                <!-- ── SECCIÓN INFERIOR: PODIUM Y VIRAL CTA ── -->
                @if (socialFormat() === 'story') {
                  <!-- Mini Podium Cards -->
                  <div class="grid grid-cols-2 gap-1.5 my-1 text-left shrink-0">
                    @if (topThree()[0]; as first) {
                      <div class="p-2 rounded-xl bg-pink-500 text-white flex items-center justify-between border border-pink-400 shadow-sm">
                        <div class="min-w-0 pr-1">
                          <p class="text-[9px] uppercase font-bold text-pink-100 flex items-center gap-0.5"><span>👑</span> Colonia Reina</p>
                          <p class="text-[11px] font-black truncate leading-tight">{{ first.coloniaName }}</p>
                        </div>
                        <span class="text-xs font-black bg-white/20 px-1.5 py-0.5 rounded-lg shrink-0">{{ first.percentage }}%</span>
                      </div>
                    }

                    @if (topThree()[1]; as second) {
                      <div class="p-2 rounded-xl bg-white/90 text-pink-900 flex items-center justify-between border border-pink-200 shadow-sm">
                        <div class="min-w-0 pr-1">
                          <p class="text-[9px] uppercase font-bold text-pink-500 flex items-center gap-0.5"><span>🥈</span> 2do Lugar</p>
                          <p class="text-[11px] font-black truncate leading-tight">{{ second.coloniaName }}</p>
                        </div>
                        <span class="text-xs font-black text-rose-500 bg-pink-100 px-1.5 py-0.5 rounded-lg shrink-0">{{ second.percentage }}%</span>
                      </div>
                    }

                    @if (topThree()[2]; as third) {
                      <div class="p-2 rounded-xl bg-white/90 text-pink-900 flex items-center justify-between border border-pink-200 shadow-sm">
                        <div class="min-w-0 pr-1">
                          <p class="text-[9px] uppercase font-bold text-pink-500 flex items-center gap-0.5"><span>🥉</span> 3er Lugar</p>
                          <p class="text-[11px] font-black truncate leading-tight">{{ third.coloniaName }}</p>
                        </div>
                        <span class="text-xs font-black text-rose-500 bg-pink-100 px-1.5 py-0.5 rounded-lg shrink-0">{{ third.percentage }}%</span>
                      </div>
                    }

                    @if (pickupStats(); as p) {
                      <div class="p-2 rounded-xl bg-purple-50 text-purple-950 flex items-center justify-between border border-purple-200 shadow-sm">
                        <div class="min-w-0 pr-1">
                          <p class="text-[9px] uppercase font-bold text-purple-600 flex items-center gap-0.5"><span>🛍️</span> Matriz Pickup</p>
                          <p class="text-[11px] font-black truncate leading-tight">Pasan a Sucursal</p>
                        </div>
                        <span class="text-xs font-black text-purple-700 bg-purple-200/80 px-1.5 py-0.5 rounded-lg shrink-0">{{ p.percentage }}%</span>
                      </div>
                    }
                  </div>

                  <!-- Footer Story -->
                  <div class="pt-1 shrink-0">
                    <p class="text-[10px] font-black text-pink-800 bg-white/95 py-1 px-2.5 rounded-xl border border-pink-200/80 shadow-sm">
                      💬 ¿Dónde vives tú? ¡Comenta en el live para que tu colonia suba al #1! 💕
                    </p>
                    <p class="text-[9px] font-extrabold text-pink-400 mt-1">
                      @regibazar • Sistema de Entregas Oficial
                    </p>
                  </div>
                } @else {
                  <!-- Post Cuadrado Footer -->
                  <div class="pt-1 shrink-0">
                    <div class="flex items-center justify-between gap-1 text-[9.5px] font-black bg-white/95 px-2.5 py-1.5 rounded-xl border border-pink-200 shadow-sm">
                      <span class="truncate">👑 #1 {{ cleanColoniaName(topThree()[0]?.coloniaName || '') }} ({{ topThree()[0]?.percentage }}%)</span>
                      <span>•</span>
                      <span class="truncate">🛍️ Matriz ({{ pickupStats()?.percentage }}%)</span>
                    </div>
                    <p class="text-[9px] font-black text-pink-600 mt-1">
                      💬 ¡Comenta tu colonia para el próximo live! 💕 @regibazar
                    </p>
                  </div>
                }

              </div>
            </div>

            <!-- Botones de Acción en el Modal -->
            <div class="p-4 sm:px-6 bg-white border-t border-gray-100 flex flex-wrap items-center justify-end gap-2">
              <button
                (click)="closeSocialModal()"
                type="button"
                class="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-all">
                Cerrar
              </button>

              <button
                (click)="exportSocialImage()"
                [disabled]="exporting()"
                type="button"
                class="btn-coquette bg-gradient-to-r from-pink-500 to-rose-500 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md shadow-pink-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                @if (exporting()) {
                  <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Generando Imagen...</span>
                } @else {
                  <span>📲</span>
                  <span>Compartir / Descargar</span>
                }
              </button>
            </div>

          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .custom-pink-scroll::-webkit-scrollbar {
      width: 5px;
    }
    .custom-pink-scroll::-webkit-scrollbar-track {
      background: #fdf2f8;
      border-radius: 9999px;
    }
    .custom-pink-scroll::-webkit-scrollbar-thumb {
      background: #f472b6;
      border-radius: 9999px;
    }
    .custom-pink-scroll::-webkit-scrollbar-thumb:hover {
      background: #ec4899;
    }
  `]
})
export class ColoniaMapReportComponent implements OnInit, OnChanges {
  @Input() startDate?: string;
  @Input() endDate?: string;
  @Input() salesPeriodId?: number;

  @ViewChild('googleMapRef') googleMap?: GoogleMap;
  @ViewChild('infoWindow') infoWindow?: MapInfoWindow;
  @ViewChildren(MapMarker) mapMarkers?: QueryList<MapMarker>;

  private coloniaService = inject(ColoniaService);
  private toast = inject(ToastService);

  report = signal<ColoniaReportDto | null>(null);
  loading = signal(false);
  exporting = signal(false);
  showSocialModal = signal(false);
  socialFormat = signal<'story' | 'post'>('story');

  selectedColonia = signal<ColoniaStatsDto | null>(null);

  // Mapa de Nuevo Laredo
  mapCenter = signal<google.maps.LatLngLiteral>({ lat: 27.4861, lng: -99.5150 });
  mapZoom = signal<number>(13);

  mapOptions: google.maps.MapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: PINK_COQUETTE_MAP_STYLES,
    gestureHandling: 'greedy'
  };

  nativeMap?: google.maps.Map;

  // Colonias separadas para ranking y pickup
  deliveryColonias = computed(() => {
    const list = this.report()?.colonias || [];
    return list.filter(c => !c.isPickup);
  });

  pickupStats = computed(() => {
    const list = this.report()?.colonias || [];
    return list.find(c => c.isPickup) || null;
  });

  topThree = computed(() => {
    return this.deliveryColonias().slice(0, 3);
  });

  topColoniasForSocial = computed(() => {
    return this.deliveryColonias().slice(0, 4);
  });

  deliveryPercentage = computed(() => {
    const r = this.report();
    if (!r || r.totalOrders === 0) return 0;
    return Number(((r.totalColoniaOrders / r.totalOrders) * 100).toFixed(1));
  });

  pickupPercentage = computed(() => {
    const r = this.report();
    if (!r || r.totalOrders === 0) return 0;
    return Number(((r.totalPickupOrders / r.totalOrders) * 100).toFixed(1));
  });

  ngOnInit(): void {
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['startDate'] || changes['endDate'] || changes['salesPeriodId']) {
      this.loadData();
    }
  }

  onMapInit(map: google.maps.Map): void {
    this.nativeMap = map;
  }

  loadData(): void {
    this.loading.set(true);
    this.coloniaService.getColoniaReport(this.startDate, this.endDate, this.salesPeriodId).subscribe({
      next: (rep) => {
        this.report.set(rep);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error al cargar reporte de colonias');
      }
    });
  }

  // Centrar mapa en Nuevo Laredo
  centerOnNLD(): void {
    this.mapCenter.set({ lat: 27.4861, lng: -99.5150 });
    this.mapZoom.set(13);
    if (this.nativeMap) {
      this.nativeMap.panTo({ lat: 27.4861, lng: -99.5150 });
      this.nativeMap.setZoom(13);
    }
  }

  onSelectColonia(c: ColoniaStatsDto): void {
    this.selectedColonia.set(c);
    this.mapCenter.set({ lat: c.latitude, lng: c.longitude });
    this.mapZoom.set(16);
    if (this.nativeMap) {
      this.nativeMap.panTo({ lat: c.latitude, lng: c.longitude });
      this.nativeMap.setZoom(16);
    }

    // Abrir automáticamente el InfoWindow sobre la colonia seleccionada
    const colonias = this.report()?.colonias || [];
    const idx = colonias.findIndex(x => x.coloniaName === c.coloniaName);
    const marker = this.mapMarkers?.toArray()[idx];
    if (marker && this.infoWindow) {
      this.infoWindow.open(marker);
    } else if (this.infoWindow?.infoWindow && this.nativeMap) {
      this.infoWindow.infoWindow.setPosition({ lat: c.latitude, lng: c.longitude });
      this.infoWindow.infoWindow.open(this.nativeMap);
    }
  }

  onMarkerClick(c: ColoniaStatsDto, marker: MapMarker): void {
    this.selectedColonia.set(c);
    if (this.infoWindow) {
      this.infoWindow.open(marker);
    }
  }

  // Radio proporcional al porcentaje (mínimo 320m, máximo 1200m)
  getCircleRadius(c: ColoniaStatsDto): number {
    if (c.isPickup) return 400;
    const base = 320;
    const bonus = Math.min(800, c.percentage * 28);
    return base + bonus;
  }

  // Opciones de estilo del círculo en rosa vibrante
  getCircleOptions(c: ColoniaStatsDto): google.maps.CircleOptions {
    const isTop1 = c.rank === 1 && !c.isPickup;
    return {
      strokeColor: isTop1 ? '#db2777' : (c.isPickup ? '#9333ea' : '#ec4899'),
      strokeOpacity: 0.9,
      strokeWeight: isTop1 ? 3 : 2,
      fillColor: isTop1 ? '#f43f5e' : (c.isPickup ? '#a855f7' : '#ec4899'),
      fillOpacity: isTop1 ? 0.38 : (c.isPickup ? 0.28 : Math.min(0.35, 0.15 + (c.percentage / 100) * 0.5)),
      clickable: true
    };
  }

  // Generador de pines/chips speech-bubble limpios, coquette y elegantes (sin emojis tacky de corazón)
  getMarkerOptions(c: ColoniaStatsDto): google.maps.MarkerOptions {
    const isPickup = c.isPickup;
    const isTop1 = c.rank === 1 && !isPickup;
    const isTop2 = c.rank === 2 && !isPickup;
    const isTop3 = c.rank === 3 && !isPickup;

    let width = 54;
    let height = 28;
    let svg = '';

    if (isPickup) {
      width = 86;
      height = 34;
      const w = width;
      const h = height;
      const halfW = w / 2;
      svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <linearGradient id="mGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#9333ea"/>
              <stop offset="100%" stop-color="#7c3aed"/>
            </linearGradient>
            <filter id="mSh" x="-10%" y="-10%" width="125%" height="135%">
              <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#581c87" flood-opacity="0.35"/>
            </filter>
          </defs>
          <path d="M 6 2 h ${w - 12} a 12 12 0 0 1 12 12 a 12 12 0 0 1 -12 12 h -${halfW - 6} l -6 6 l -6 -6 h -${halfW - 6} a 12 12 0 0 1 -12 -12 a 12 12 0 0 1 12 -12 z" fill="url(#mGrad)" stroke="#ffffff" stroke-width="2" filter="url(#mSh)"/>
          <text x="${halfW}" y="15" font-family="Poppins, -apple-system, sans-serif" font-size="11" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="central">🏠 Matriz</text>
        </svg>
      `;
    } else if (isTop1) {
      width = 80;
      height = 34;
      const w = width;
      const h = height;
      const halfW = w / 2;
      svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <linearGradient id="qGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ec4899"/>
              <stop offset="100%" stop-color="#e11d48"/>
            </linearGradient>
            <filter id="qSh" x="-10%" y="-10%" width="125%" height="135%">
              <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#881337" flood-opacity="0.35"/>
            </filter>
          </defs>
          <path d="M 6 2 h ${w - 12} a 12 12 0 0 1 12 12 a 12 12 0 0 1 -12 12 h -${halfW - 6} l -6 6 l -6 -6 h -${halfW - 6} a 12 12 0 0 1 -12 -12 a 12 12 0 0 1 12 -12 z" fill="url(#qGrad)" stroke="#ffffff" stroke-width="2" filter="url(#qSh)"/>
          <text x="${halfW}" y="15" font-family="Poppins, -apple-system, sans-serif" font-size="11.5" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="central">👑 ${c.percentage}%</text>
        </svg>
      `;
    } else if (isTop2 || isTop3) {
      width = 70;
      height = 30;
      const w = width;
      const h = height;
      const halfW = w / 2;
      const label = isTop2 ? `#2 • ${c.percentage}%` : `#3 • ${c.percentage}%`;
      svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <filter id="topSh" x="-10%" y="-10%" width="125%" height="135%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#f43f5e" flood-opacity="0.25"/>
            </filter>
          </defs>
          <path d="M 5 2 h ${w - 10} a 11 11 0 0 1 11 11 a 11 11 0 0 1 -11 11 h -${halfW - 5} l -5 5 l -5 -5 h -${halfW - 5} a 11 11 0 0 1 -11 -11 a 11 11 0 0 1 11 -11 z" fill="#ffffff" stroke="#f472b6" stroke-width="2" filter="url(#topSh)"/>
          <text x="${halfW}" y="14" font-family="Poppins, -apple-system, sans-serif" font-size="10.5" font-weight="900" fill="#be185d" text-anchor="middle" dominant-baseline="central">${label}</text>
        </svg>
      `;
    } else {
      width = 54;
      height = 28;
      const w = width;
      const h = height;
      const halfW = w / 2;
      svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <filter id="pSh" x="-10%" y="-10%" width="125%" height="135%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#f43f5e" flood-opacity="0.2"/>
            </filter>
          </defs>
          <path d="M 5 2 h ${w - 10} a 10 10 0 0 1 10 10 a 10 10 0 0 1 -10 10 h -${halfW - 4} l -4 4 l -4 -4 h -${halfW - 4} a 10 10 0 0 1 -10 -10 a 10 10 0 0 1 10 -10 z" fill="#ffffff" stroke="#fbcfe8" stroke-width="1.8" filter="url(#pSh)"/>
          <text x="${halfW}" y="13" font-family="Poppins, -apple-system, sans-serif" font-size="10" font-weight="800" fill="#9d174d" text-anchor="middle" dominant-baseline="central">${c.percentage}%</text>
        </svg>
      `;
    }

    return {
      title: `${c.coloniaName} (${c.percentage}%)`,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: typeof google !== 'undefined' ? new google.maps.Size(width, height) : undefined,
        anchor: typeof google !== 'undefined' ? new google.maps.Point(width / 2, height - 1) : undefined
      }
    };
  }

  // ── PROYECCIÓN CARTOGRÁFICA PARA EL MAPA ROSA SOCIAL ──
  getSocialX(lng: number): number {
    const lngMin = -99.630;
    const lngMax = -99.490;
    const clamped = Math.max(lngMin, Math.min(lngMax, lng));
    return Number((((clamped - lngMin) / (lngMax - lngMin)) * 100).toFixed(2));
  }

  getSocialY(lat: number): number {
    const latMin = 27.380;
    const latMax = 27.525;
    const clamped = Math.max(latMin, Math.min(latMax, lat));
    return Number((((latMax - clamped) / (latMax - latMin)) * 100).toFixed(2));
  }

  getBadgeX(lng: number): number {
    const x = this.getSocialX(lng);
    return Math.max(16, Math.min(84, x));
  }

  getBadgeY(lat: number): number {
    const y = this.getSocialY(lat);
    return Math.max(12, Math.min(86, y));
  }

  cleanColoniaName(name: string): string {
    return name.replace(/^Col\.\s*|^Fracc\.\s*/i, '');
  }

  getCheerleaderMessage(topColonia?: string): string {
    if (!topColonia || topColonia === 'Sin datos') {
      return 'Explora la distribución de compras en Nuevo Laredo ✨';
    }
    return `¡${topColonia} se lleva la corona en compras este periodo! Gracias por consentirse con Regi Bazar 💕`;
  }

  openSocialModal(): void {
    this.showSocialModal.set(true);
  }

  closeSocialModal(): void {
    this.showSocialModal.set(false);
  }

  async exportSocialImage(): Promise<void> {
    this.exporting.set(true);
    try {
      const topName = this.report()?.topColoniaName || 'Nuevo Laredo';
      const result = await this.coloniaService.exportSocialImage(
        'socialCardExport',
        `regibazar_top_colonias_${Date.now()}`,
        '👑 Top Colonias Regi Bazar',
        `¡${topName} es la colonia reina de compras en Regi Bazar! 💖🛍️`
      );

      if (result.shared) {
        this.toast.success('¡Listo para compartir en Instagram! 📸✨');
      } else {
        this.toast.success('¡Imagen descargada con éxito! 🌸💾');
      }
      this.closeSocialModal();
    } catch (err) {
      console.error(err);
      this.toast.error('No se pudo generar la imagen para redes');
    } finally {
      this.exporting.set(false);
    }
  }
}
