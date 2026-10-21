import {
  Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild,
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
            <div class="p-4 sm:p-6 flex items-center justify-center bg-gray-50/70 overflow-hidden">
              <div
                id="socialCardExport"
                [class]="socialFormat() === 'story' ? 'w-[320px] min-h-[568px] py-6 px-5' : 'w-[320px] h-[320px] p-4'"
                class="bg-gradient-to-b from-[#fff5f7] via-[#fdf2f8] to-[#fce7f3] rounded-[2rem] border-2 border-pink-300 shadow-xl flex flex-col justify-between relative overflow-hidden text-center select-none">
                
                <!-- Decoración de lazo y destellos en el banner -->
                <div class="absolute -top-6 -right-6 text-6xl opacity-15 pointer-events-none">🌸</div>
                <div class="absolute -bottom-6 -left-6 text-6xl opacity-15 pointer-events-none">💖</div>

                <!-- Header de la tarjeta social -->
                <div>
                  <div class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/90 border border-pink-200 text-[10px] font-black text-pink-600 shadow-sm mb-1.5">
                    <span>🎀</span>
                    <span>REGI BAZAR • NUEVO LAREDO</span>
                    <span>✨</span>
                  </div>

                  <h2 class="text-xl sm:text-2xl font-black text-pink-900 tracking-tight leading-tight">
                    TOP COLONIAS MÁS REGIS 💖
                  </h2>
                  <p class="text-[11px] text-pink-600 font-bold mt-0.5">
                    ¿De qué colonia eres tú? ¡Nuevo Laredo es territorio Regi Bazar! 🛍️
                  </p>
                </div>

                <!-- Mini ilustración gráfica de mapa con pines coquette -->
                <div class="my-2 p-3 bg-white/80 rounded-2xl border border-pink-200/70 shadow-inner flex flex-col gap-2">
                  <div class="flex items-center justify-between text-[11px] font-black text-pink-800 pb-1 border-b border-pink-100">
                    <span class="flex items-center gap-1">📍 Ranking Oficial</span>
                    <span class="text-pink-500 font-bold">% de Compras</span>
                  </div>

                  <!-- Ranking Top 4 + Pickup -->
                  <div class="space-y-1.5 text-left">
                    @for (c of topColoniasForSocial(); track c.coloniaName; let idx = $index) {
                      <div class="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-pink-50/80 border border-pink-100">
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span class="text-xs">{{ idx === 0 ? '👑' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '🌸')) }}</span>
                          <span class="text-xs font-black text-pink-900 truncate">{{ c.coloniaName }}</span>
                        </div>
                        <span class="text-xs font-black text-pink-600 bg-white px-2 py-0.5 rounded-full border border-pink-200">
                          {{ c.percentage }}%
                        </span>
                      </div>
                    }

                    @if (pickupStats(); as p) {
                      <div class="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-purple-50/80 border border-purple-100">
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span class="text-xs">🛍️</span>
                          <span class="text-xs font-black text-purple-900 truncate">Pickup en Matriz</span>
                        </div>
                        <span class="text-xs font-black text-purple-700 bg-white px-2 py-0.5 rounded-full border border-purple-200">
                          {{ p.percentage }}%
                        </span>
                      </div>
                    }
                  </div>
                </div>

                <!-- Footer de la tarjeta social con llamada a la acción -->
                <div class="pt-1">
                  <p class="text-[10px] font-black text-pink-700 bg-white/90 py-1 px-2 rounded-xl border border-pink-200/80 shadow-sm">
                    💬 ¡Comenta tu colonia para que suba al #1 en el próximo live! 💕
                  </p>
                  <p class="text-[9px] font-extrabold text-pink-400 mt-1">
                    @regibazar • Sistema de Entregas Oficial
                  </p>
                </div>

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
    this.mapZoom.set(15);
    if (this.nativeMap) {
      this.nativeMap.panTo({ lat: c.latitude, lng: c.longitude });
      this.nativeMap.setZoom(15);
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

  // Generador de iconos SVG vectoriales cute para marcadores
  getMarkerOptions(c: ColoniaStatsDto): google.maps.MarkerOptions {
    let svg = '';
    let size = 36;

    if (c.isPickup) {
      // Icono de Tienda / Regi Bazar Matriz
      svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="20" fill="#9333ea" stroke="#ffffff" stroke-width="3"/>
          <text x="22" y="27" font-size="18" text-anchor="middle" dominant-baseline="middle">🛍️</text>
        </svg>
      `;
      size = 44;
    } else if (c.rank === 1) {
      // Corona dorada para la Colonia Reina
      svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="22" fill="#ec4899" stroke="#ffffff" stroke-width="3"/>
          <circle cx="24" cy="24" r="18" fill="#f43f5e"/>
          <text x="24" y="29" font-size="22" text-anchor="middle" dominant-baseline="middle">👑</text>
        </svg>
      `;
      size = 48;
    } else if (c.rank === 2) {
      svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill="#f472b6" stroke="#ffffff" stroke-width="2.5"/>
          <text x="20" y="25" font-size="18" text-anchor="middle" dominant-baseline="middle">🥈</text>
        </svg>
      `;
      size = 40;
    } else if (c.rank === 3) {
      svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill="#f472b6" stroke="#ffffff" stroke-width="2.5"/>
          <text x="20" y="25" font-size="18" text-anchor="middle" dominant-baseline="middle">🥉</text>
        </svg>
      `;
      size = 40;
    } else {
      // Pin rosa estándar con corazón o punto
      svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="#fb7185" stroke="#ffffff" stroke-width="2"/>
          <text x="16" y="20" font-size="12" text-anchor="middle" dominant-baseline="middle">💖</text>
        </svg>
      `;
      size = 32;
    }

    return {
      title: `${c.coloniaName} (${c.percentage}%)`,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: typeof google !== 'undefined' ? new google.maps.Size(size, size) : undefined,
        anchor: typeof google !== 'undefined' ? new google.maps.Point(size / 2, size / 2) : undefined
      }
    };
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
