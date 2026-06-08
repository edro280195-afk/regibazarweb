import { Component, inject, signal, computed, ElementRef, ViewChild, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RaffleService } from '../../../../core/services/raffle.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
    RaffleDetailDto,
    CreateRaffleDto,
    UpdateRaffleDto,
    SelectWinnerDto,
    RaffleParticipantDto,
    RaffleDrawDto
} from '../../../../core/models';
import { RaffleAnimationComponent } from '../raffle-animation/raffle-animation.component';
import { gsap } from 'gsap';
@Component({
    selector: 'app-raffle-detail',
    standalone: true,
    imports: [CommonModule, FormsModule, RaffleAnimationComponent],
    template: `
        <div class="relative min-h-[80vh] overflow-hidden -m-4 lg:-m-8 p-4 lg:p-8">
            <div class="absolute inset-0 pointer-events-none z-[-1] overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-br from-pink-50/50 via-purple-50/50 to-rose-50/50"></div>
                <div class="absolute top-[10%] left-[5%] text-6xl animate-pulse-slow blur-[1px]">🎉</div>
                <div class="absolute top-[20%] right-[20%] text-4xl animate-float-delayed">🎀</div>
                <div class="absolute top-[75%] left-[15%] text-5xl animate-bounce-slow blur-[1px]">💖</div>
            </div>
            
            <div class="space-y-6 relative z-10 max-w-7xl mx-auto">
                <div class="flex items-center justify-between mb-8 animate-slide-down">
                    <div class="flex items-center gap-2">
                        <button (click)="goBack()" class="btn-coquette bg-white/50 backdrop-blur-md text-pink-600 px-4 py-2 rounded-xl border-white/60 hover:bg-pink-100 transition-colors flex items-center gap-2">
                            ← Volver
                        </button>
                        
                        @if (!isNew() && raffle()) {
                            <a [href]="'/live/' + raffle()!.id" target="_blank" class="btn-coquette bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform">
                                📺 Live
                            </a>
                        }
                    </div>
                    
                    @if (!isNew() && raffle()?.status === 'Draft') {
                        <button (click)="activateRaffle()" class="btn-coquette bg-green-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-600 transition-colors">
                            🚀 Activar Sorteo
                        </button>
                    }
                    
                    <!-- Wizard Progress -->
                    <div class="flex items-center gap-4 bg-white/30 backdrop-blur-md p-2 rounded-2xl border border-white/40">
                        @for (step of [1, 2, 3]; track step) {
                            <div class="flex items-center gap-2 px-4 py-1.5 rounded-xl transition-all duration-500"
                                 [class]="currentStep() === step ? 'bg-pink-500 text-white shadow-lg shadow-pink-200 scale-105' : 'text-pink-400 opacity-60'">
                                <span class="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-xs font-black">{{ step }}</span>
                                <span class="text-xs font-bold uppercase tracking-widest hidden md:inline">
                                    {{ step === 1 ? 'Identidad' : step === 2 ? 'Filtros' : 'Finalizar' }}
                                </span>
                            </div>
                            @if (step < 3) {
                                <div class="w-4 h-px bg-pink-200"></div>
                            }
                        }
                    </div>
                    
                    <div class="w-24"></div> <!-- Spacer for symmetry -->
                </div>

                @if (loading()) {
                    <div class="shimmer h-[500px] rounded-[3rem]"></div>
                } @else {
                    <div class="relative min-h-[500px]">
                        
                        <!-- STEP 1: IDENTITY & PRIZE -->
                        <div id="step-1" class="wizard-step" [class.hidden]="currentStep() !== 1">
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                <div class="card-coquette p-8 space-y-6 bg-white/60 backdrop-blur-xl border-white shadow-2xl">
                                    <div class="space-y-1">
                                        <h2 class="text-3xl font-black text-pink-900 font-display">Prepara tu Sorteo ✨</h2>
                                        <p class="text-pink-500 font-medium text-sm italic">Define el nombre y el premio espectacular que entregarás</p>
                                    </div>

                                    <div class="space-y-5">
                                        <div class="group">
                                            <label class="label-coquette text-pink-800 font-black mb-2 block tracking-wide">Nombre del Evento</label>
                                            <input class="input-coquette text-lg py-4 border-2 border-pink-50 focus:border-pink-300 transition-all bg-white/80" 
                                                   [(ngModel)]="form.name" name="name" placeholder="Ej: Gran Sorteo VIP de Primavera 🌸" />
                                        </div>

                                        <div class="group">
                                            <label class="label-coquette text-pink-800 font-black mb-2 block tracking-wide">Descripción del Premio</label>
                                            <textarea class="input-coquette min-h-[120px] bg-white/80" 
                                                      [(ngModel)]="form.description" name="description"
                                                      placeholder="Cuéntales qué ganarán..."></textarea>
                                        </div>

                                        <div class="grid grid-cols-2 gap-4">
                                            <div class="group">
                                                <label class="label-coquette text-pink-800 font-black mb-2 block tracking-wide">Nº Ganadoras</label>
                                                <input class="input-coquette py-3" type="number" min="1" max="50" [(ngModel)]="form.winnerCount" name="winnerCount" />
                                            </div>
                                            <div class="group">
                                                <label class="label-coquette text-pink-800 font-black mb-2 block tracking-wide">Fecha del Evento</label>
                                                <input class="input-coquette py-3" type="datetime-local" [(ngModel)]="form.raffleDate" name="raffleDate" />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="pt-6">
                                        <button (click)="goToStep(2)" class="btn-coquette w-full bg-pink-500 text-white py-4 rounded-2xl shadow-xl shadow-pink-200 font-black text-lg hover:bg-pink-600 transition-colors">
                                            Siguiente: Definir Calificación ➔
                                        </button>
                                    </div>
                                </div>

                                <div class="space-y-6">
                                    <div class="card-coquette p-8 bg-gradient-to-br from-pink-50 to-purple-50 border-white shadow-xl relative overflow-hidden group">
                                        <div class="absolute -top-10 -right-10 text-9xl opacity-10 group-hover:rotate-12 transition-transform duration-700">🖼️</div>
                                        <h3 class="text-xl font-black text-pink-900 mb-6 flex items-center gap-2">
                                            <span>📸</span> Visuales del Sorteo
                                        </h3>
                                        
                                        <div class="space-y-4">
                                            <div class="group">
                                                <label class="label-coquette text-pink-400 font-bold mb-1 block text-[10px] uppercase tracking-widest">URL Imagen Principal</label>
                                                <input class="input-coquette py-2 text-sm" [(ngModel)]="form.imageUrl" name="imageUrl" placeholder="https://..." />
                                            </div>
                                            <div class="group">
                                                <label class="label-coquette text-pink-400 font-bold mb-1 block text-[10px] uppercase tracking-widest">URL Imagen Social Share</label>
                                                <input class="input-coquette py-2 text-sm" [(ngModel)]="form.socialShareImageUrl" name="socialShareImageUrl" placeholder="https://..." />
                                            </div>
                                            
                                            <div class="aspect-video w-full rounded-2xl bg-white/40 border-2 border-dashed border-pink-200 overflow-hidden flex items-center justify-center relative">
                                                @if (form.imageUrl) {
                                                    <img [src]="form.imageUrl" class="w-full h-full object-cover" />
                                                } @else {
                                                    <div class="text-center p-6">
                                                        <span class="text-4xl block mb-2 opacity-30">🎁</span>
                                                        <p class="text-xs font-bold text-pink-300">Vista previa del sorteo</p>
                                                    </div>
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- STEP 2: ELIGIBILITY & REAL-TIME PREVIEW -->
                        <div id="step-2" class="wizard-step" [class.hidden]="currentStep() !== 2">
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                <div class="card-coquette p-8 space-y-6 bg-white/60 backdrop-blur-xl border-white shadow-2xl">
                                    <div class="space-y-1">
                                        <h2 class="text-3xl font-black text-pink-900 font-display">Reglas de Calificación 📏</h2>
                                        <p class="text-pink-500 font-medium text-sm italic">Define quiénes tienen la oportunidad de ganar</p>
                                    </div>

                                    <div class="space-y-6 pt-4">
                                        <div class="p-4 rounded-2xl bg-pink-50/50 border border-pink-100">
                                            <label class="label-coquette text-pink-800 font-black mb-4 block tracking-wide flex items-center gap-2">
                                                <span>📅</span> Rango de fechas de compra
                                            </label>
                                            <div class="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-1 block">Desde</label>
                                                    <input class="input-coquette py-2 text-sm" type="datetime-local" [(ngModel)]="form.dateRangeStart" name="dateRangeStart" (change)="evalParticipantsPreview()" />
                                                </div>
                                                <div>
                                                    <label class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-1 block">Hasta</label>
                                                    <input class="input-coquette py-2 text-sm" type="datetime-local" [(ngModel)]="form.dateRangeEnd" name="dateRangeEnd" (change)="evalParticipantsPreview()" />
                                                </div>
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-2 gap-6">
                                            <div class="group">
                                                <label class="label-coquette text-pink-800 font-black mb-2 block tracking-wide">Monto Mínimo ($)</label>
                                                <input class="input-coquette py-3" type="number" min="0" step="0.01" [(ngModel)]="form.minOrderTotal" name="minOrderTotal" (change)="evalParticipantsPreview()" />
                                            </div>
                                            <div class="group">
                                                <label class="label-coquette text-pink-800 font-black mb-2 block tracking-wide">Compras Req.</label>
                                                <input class="input-coquette py-3" type="number" min="1" [(ngModel)]="form.requiredPurchases" name="requiredPurchases" (change)="evalParticipantsPreview()" />
                                            </div>
                                        </div>

                                        <div class="group">
                                            <label class="label-coquette text-pink-800 font-black mb-2 block tracking-wide">Segmento de Clientas</label>
                                            <select class="input-coquette py-3 bg-white/80" [(ngModel)]="form.clientFilter" name="clientFilter" (change)="evalParticipantsPreview()">
                                                <option value="all">💖 Todas las clientas</option>
                                                <option value="new">🌟 Solo clientas nuevas</option>
                                                <option value="frequent">🔄 Solo clientas frecuentes</option>
                                                <option value="newAndFrequent">💕 Nuevas + Frecuentes</option>
                                                <option value="vip">👑 Solo VIP</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div class="flex gap-4 pt-6">
                                        <button (click)="goToStep(1)" class="btn-coquette bg-pink-100 text-pink-600 px-6 py-4 rounded-2xl font-black">
                                            Volver
                                        </button>
                                        <button (click)="goToStep(3)" class="btn-coquette flex-1 bg-pink-500 text-white py-4 rounded-2xl shadow-xl shadow-pink-200 font-black text-lg">
                                            Siguiente: Animación ➔
                                        </button>
                                    </div>
                                </div>

                                <div class="space-y-6">
                                    <div class="card-coquette p-8 bg-gradient-to-br from-purple-50 to-pink-50 border-white shadow-xl relative overflow-hidden group">
                                        <div class="absolute -top-10 -right-10 text-9xl opacity-10 group-hover:rotate-12 transition-transform duration-700">🔍</div>
                                        <h3 class="text-xl font-black text-pink-900 mb-6 flex items-center gap-2">
                                            <span>💫</span> Impacto en Tiempo Real
                                        </h3>
                                        
                                        <div class="text-center py-10 space-y-4">
                                            @if (evaluatingPreview()) {
                                                <div class="animate-pulse flex flex-col items-center gap-4">
                                                    <div class="w-32 h-32 rounded-full bg-pink-200 flex items-center justify-center text-4xl">🔄</div>
                                                    <p class="font-black text-pink-400 text-xl tracking-tighter">Analizando base de datos...</p>
                                                </div>
                                            } @else if (!raffleId || raffleId === 'new') {
                                                <div class="relative inline-block">
                                                    <div class="w-40 h-40 rounded-full bg-pink-50 shadow-inner flex flex-col items-center justify-center border-8 border-pink-100 overflow-hidden p-2 text-center opacity-70">
                                                        <span class="text-4xl mb-2">💾</span>
                                                        <span class="text-[10px] font-black text-pink-500 uppercase">Se calculará al guardar</span>
                                                    </div>
                                                </div>
                                                <div class="space-y-1 mt-4">
                                                    <p class="text-xl font-black text-pink-900 tracking-tight">Cálculo Pendiente</p>
                                                    <p class="text-pink-400 font-bold text-sm">Guarda el sorteo para aplicar los filtros</p>
                                                </div>
                                            } @else {
                                                <div class="relative inline-block">
                                                    <div class="w-40 h-40 rounded-full bg-white shadow-2xl flex items-center justify-center border-8 border-pink-100 overflow-hidden">
                                                        <span class="text-5xl font-black text-pink-600">{{ participantCountPreview() }}</span>
                                                    </div>
                                                    <div class="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center text-2xl shadow-lg border-4 border-white animate-bounce">✓</div>
                                                </div>
                                                <div class="space-y-1 mt-4">
                                                    <p class="text-2xl font-black text-pink-900 tracking-tight">Clientas Calificadas</p>
                                                    <p class="text-pink-400 font-bold text-sm">Este sorteo tendrá un gran impacto en tu comunidad</p>
                                                </div>
                                            }
                                        </div>

                                        @if (participants().length > 0) {
                                            <div class="mt-6 p-4 rounded-2xl bg-white/40 border border-white/60">
                                                <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-3">Muestra de participantes</p>
                                                <div class="flex flex-wrap gap-2">
                                                    @for (p of participants().slice(0, 5); track p.clientId) {
                                                        <span class="px-3 py-1 bg-pink-100 text-pink-600 rounded-lg text-xs font-bold">{{ p.client.name }}</span>
                                                    }
                                                    @if (participants().length > 5) {
                                                        <span class="px-3 py-1 bg-purple-100 text-purple-600 rounded-lg text-xs font-bold">+{{ participants().length - 5 }} más</span>
                                                    }
                                                </div>
                                            </div>
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- STEP 3: ANIMATION & FINAL REVIEW -->
                        <div id="step-3" class="wizard-step" [class.hidden]="currentStep() !== 3">
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                <div class="card-coquette p-8 space-y-6 bg-white/60 backdrop-blur-xl border-white shadow-2xl">
                                    <div class="space-y-1">
                                        <h2 class="text-3xl font-black text-pink-900 font-display">Gran Final 🎬</h2>
                                        <p class="text-pink-500 font-medium text-sm italic">Elige cómo se revelará la ganadora</p>
                                    </div>

                                    <div class="space-y-6 pt-4">
                                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <button (click)="form.animationType = 'roulette'" 
                                                     class="p-4 rounded-2xl border-2 transition-all duration-300 text-center space-y-2 group"
                                                     [class]="form.animationType === 'roulette' ? 'border-pink-500 bg-pink-50 shadow-lg' : 'border-pink-50 bg-white/50 grayscale hover:grayscale-0 hover:border-pink-200'">
                                                 <span class="text-4xl block group-hover:scale-110 transition-transform">🎡</span>
                                                 <span class="text-[10px] font-black text-pink-900 uppercase">Ruleta</span>
                                             </button>
                                             <button (click)="form.animationType = 'slot'" 
                                                     class="p-4 rounded-2xl border-2 transition-all duration-300 text-center space-y-2 group"
                                                     [class]="form.animationType === 'slot' ? 'border-purple-500 bg-purple-50 shadow-lg' : 'border-pink-50 bg-white/50 grayscale hover:grayscale-0 hover:border-pink-200'">
                                                 <span class="text-4xl block group-hover:scale-110 transition-transform">🎰</span>
                                                 <span class="text-[10px] font-black text-pink-900 uppercase">Slot</span>
                                             </button>
                                             <button (click)="form.animationType = 'elimination'" 
                                                     class="p-4 rounded-2xl border-2 transition-all duration-300 text-center space-y-2 group"
                                                     [class]="form.animationType === 'elimination' ? 'border-blue-500 bg-blue-50 shadow-lg' : 'border-pink-50 bg-white/50 grayscale hover:grayscale-0 hover:border-pink-200'">
                                                 <span class="text-4xl block group-hover:scale-110 transition-transform">⚡</span>
                                                 <span class="text-[10px] font-black text-pink-900 uppercase">Elimina</span>
                                             </button>
                                             <button (click)="form.animationType = 'confetti'" 
                                                     class="p-4 rounded-2xl border-2 transition-all duration-300 text-center space-y-2 group"
                                                     [class]="form.animationType === 'confetti' ? 'border-rose-500 bg-rose-50 shadow-lg' : 'border-pink-50 bg-white/50 grayscale hover:grayscale-0 hover:border-pink-200'">
                                                 <span class="text-4xl block group-hover:scale-110 transition-transform">🎊</span>
                                                 <span class="text-[10px] font-black text-pink-900 uppercase">Regalo</span>
                                             </button>
                                        </div>

                                        <div class="card-coquette p-6 bg-white/40 border-pink-100 flex items-center justify-between">
                                            <div>
                                                <p class="text-xl font-black text-pink-900">{{ form.name || 'Sorteo sin nombre' }}</p>
                                                <p class="text-sm font-bold text-pink-400">{{ participantCountPreview() }} participantes listos</p>
                                            </div>
                                            <span class="text-4xl">🪄</span>
                                        </div>
                                    </div>
                                    
                                    <div class="flex gap-4 pt-6">
                                        <button (click)="goToStep(2)" class="btn-coquette bg-pink-100 text-pink-600 px-6 py-4 rounded-2xl font-black">
                                            Volver
                                        </button>
                                        <button (click)="saveRaffle()" [disabled]="saving()" class="btn-coquette flex-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white py-4 rounded-2xl shadow-xl shadow-pink-200 font-black text-lg">
                                            @if (saving()) {
                                                <span class="animate-spin inline-block">⏳</span> Creando...
                                            } @else {
                                                <span>✨</span> Finalizar y Guardar
                                            }
                                        </button>
                                    </div>
                                </div>

                                <div class="space-y-6">
                                    <div class="card-coquette p-4 bg-black border-pink-900/50 shadow-2xl relative overflow-hidden group min-h-[400px] flex flex-col">
                                        <div class="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
                                            <span class="text-[10px] font-black text-pink-500 bg-pink-500/10 px-3 py-1 rounded-full border border-pink-500/20">LIVE PREVIEW</span>
                                            <div class="flex gap-1">
                                                <div class="w-2 h-2 rounded-full bg-red-500"></div>
                                                <div class="w-2 h-2 rounded-full bg-yellow-500"></div>
                                                <div class="w-2 h-2 rounded-full bg-green-500"></div>
                                            </div>
                                        </div>
                                        
                                        <div class="flex-1 flex items-center justify-center">
                                            <app-raffle-animation
                                                [participants]="previewParticipants()"
                                                [animationType]="$any(form.animationType)"
                                                [isPreview]="true">
                                            </app-raffle-animation>
                                        </div>

                                        <div class="p-4 text-center">
                                            <p class="text-[10px] font-bold text-pink-800/80 uppercase tracking-widest">Este es el espectáculo que verán tus clientas</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                    
                    <!-- Management View (Only if not new) -->
                    @if (!isNew() && raffle()) {
                        <div class="mt-12 space-y-12 animate-slide-up">
                            <hr class="border-white/40" />
                            
                            <!-- Participant Management -->
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div class="card-coquette p-8 bg-white/40 backdrop-blur-md border-white">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-2xl font-black text-pink-900 font-display flex items-center gap-3">
                                            <span class="text-3xl">👥</span> Participantes
                                        </h2>
                                        <button (click)="evaluateRaffle()" [disabled]="evaluating()"
                                                class="btn-coquette bg-purple-500 text-white px-6 py-2 rounded-full shadow-lg shadow-purple-200">
                                            @if (evaluating()) {
                                                <span class="animate-spin inline-block">⏳</span> Analizando...
                                            } @else {
                                                <span>🔍</span> Actualizar Lista
                                            }
                                        </button>
                                    </div>

                                    <!-- Filtro de participantes -->
                                    <div class="relative mb-6">
                                        <input type="text" 
                                               [value]="searchTerm()"
                                               (input)="onSearchChange($event)"
                                               placeholder="Buscar clienta por nombre..." 
                                               class="w-full pl-12 pr-4 py-3 bg-white/60 border border-white/80 rounded-2xl focus:ring-2 focus:ring-pink-300 focus:border-pink-300 outline-none transition-all font-medium text-pink-900 placeholder:text-pink-300">
                                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-40">🔎</span>
                                    </div>

                                    @if (participants().length === 0) {
                                        <div class="py-20 text-center space-y-4">
                                            <span class="text-6xl block opacity-30">📪</span>
                                            <p class="text-pink-400 font-bold uppercase tracking-widest text-xs">Sin participantes calificados</p>
                                        </div>
                                    } @else {
                                        <div class="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                            @for (p of filteredParticipants(); track p.clientId) {
                                                <div class="group flex items-center justify-between p-4 rounded-2xl bg-white/40 border border-white/60 hover:border-pink-200 hover:bg-pink-50/30 transition-all duration-300"
                                                     [class.bg-yellow-50]="p.isWinner"
                                                     [class.bg-pink-50/50]="isPreselected(p.clientId)">
                                                    <div class="flex items-center gap-4">
                                                        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform">
                                                            {{ p.isWinner ? '🏆' : '👑' }}
                                                        </div>
                                                        <div>
                                                            <p class="font-black text-pink-900 transition-all">
                                                               {{ p.client.name }}
                                                               @if (isPreselected(p.clientId)) {
                                                                   <span class="text-[8px] text-pink-300 ml-1">✨</span>
                                                               }
                                                            </p>
                                                            <p class="text-[10px] font-bold text-pink-400 uppercase">{{ p.qualifyingOrders }} compras calificadas</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div class="flex items-center gap-3">
                                                        @if (p.isWinner) {
                                                            <span class="px-3 py-1 bg-yellow-200 text-yellow-800 rounded-lg text-[10px] font-black uppercase tracking-tighter">GANADORA</span>
                                                        }
                                                        
                                                        <label class="relative inline-flex items-center cursor-pointer group/check">
                                                            <input type="checkbox" 
                                                                   class="sr-only peer" 
                                                                   [checked]="isPreselected(p.clientId)"
                                                                   (change)="togglePreselected(p.clientId)">
                                                            <div class="w-10 h-10 bg-white/60 border-2 border-white peer-checked:bg-pink-500 peer-checked:border-pink-200 rounded-xl flex items-center justify-center transition-all shadow-sm group-hover/check:scale-110 group-hover/check:border-pink-200">
                                                                <span class="text-white text-lg opacity-0 peer-checked:opacity-100 transition-opacity">✨</span>
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>
                                            }
                                        </div>
                                    }
                                </div>

                                <div class="card-coquette p-8 bg-gradient-to-br from-pink-600 to-rose-600 text-white border-transparent shadow-pink-200 shadow-2xl relative overflow-hidden">
                                    <div class="absolute -top-20 -right-20 text-[15rem] opacity-10 pointer-events-none">🎰</div>
                                    <h2 class="text-2xl font-black font-display mb-8 flex items-center gap-3">
                                        <span class="text-3xl">🏁</span> Ejecutar Sorteo
                                    </h2>

                                    @if (participants().length === 0) {
                                        <p class="text-pink-100 font-bold text-center py-20 bg-black/10 rounded-3xl border border-white/10">Primero evalúa los participantes para abrir la arena de sorteo</p>
                                    } @else {
                                        <div class="space-y-6 relative z-10">
                                            @if (allWinners().length > 0) {
                                                <div class="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 space-y-4">
                                                    <p class="text-xs font-black uppercase tracking-[0.2em] text-pink-200 text-center">Ganadoras Seleccionadas</p>
                                                    <div class="space-y-2">
                                                        @for (w of allWinners(); track w.id) {
                                                            <div class="flex items-center gap-3 p-3 bg-white/20 rounded-2xl border border-white/30">
                                                                <span class="text-2xl">👑</span>
                                                                <span class="font-black text-lg">{{ w.client.name }}</span>
                                                            </div>
                                                        }
                                                    </div>
                                                    
                                                    @if (raffle()?.status === 'Active') {
                                                        <div class="space-y-4 mt-6">
                                                            <button (click)="announceWinner()" [disabled]="announcing()" class="w-full bg-yellow-400 text-yellow-900 py-4 rounded-2xl font-black text-lg hover:bg-yellow-300 transition-colors shadow-xl shadow-yellow-900/20">
                                                                @if (announcing()) {
                                                                    <span class="animate-spin inline-block">⏳</span> Anunciando...
                                                                } @else {
                                                                    <span>📢</span> Finalizar y Anunciar
                                                                }
                                                            </button>

                                                            <button (click)="generateAndDownload()" class="w-full bg-white/20 border border-white/40 text-white py-3 rounded-2xl font-bold hover:bg-white/30 transition-all">
                                                                📸 Generar Imagen para Historias
                                                            </button>
                                                        </div>
                                                    } @else {
                                                        <div class="mt-6 p-4 bg-green-500/20 border border-green-500/40 rounded-2xl text-center">
                                                            <p class="text-sm font-black text-green-200 uppercase tracking-widest mb-2">Sorteo Finalizado ✨</p>
                                                            <button (click)="generateAndDownload()" class="text-xs font-bold text-white underline decoration-pink-500 underline-offset-4">Descargar imagen de ganadoras</button>
                                                        </div>
                                                    }
                                                </div>
                                            } @else {
                                                <div class="text-center p-6 bg-white/10 rounded-3xl border border-white/20">
                                                    <p class="text-4xl font-black mb-2">{{ participantCountPreview() }}</p>
                                                    <p class="text-xs font-bold text-pink-200 uppercase tracking-widest">Clientas listas para el azar</p>
                                                </div>

                                                <a [href]="'/live/' + raffleId" target="_blank" class="block w-full bg-white text-pink-600 py-6 rounded-[2rem] font-black text-2xl text-center hover:scale-105 transition-all shadow-2xl shadow-pink-900/40">
                                                    📺 IR A LIVE
                                                </a>
                                            }
                                        </div>
                                    }
                                </div>
                            </div>

                            <!-- Social Canvas Section (Only if completed) -->
                            @if (showImageCanvas()) {
                                <div class="card-coquette p-10 bg-white/40 backdrop-blur-md border-white animate-slide-up">
                                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                                        <div class="space-y-6">
                                            <h2 class="text-4xl font-black text-pink-900 font-display">Arte de Victoria 🎨</h2>
                                            <p class="text-pink-500 font-medium">Hemos generado una imagen espectacular para que la compartas en tus redes sociales. El diseño es automático y de primer nivel.</p>
                                            <div class="flex gap-4">
                                                <button (click)="downloadSocialImage()" class="btn-coquette bg-pink-500 text-white px-8 py-4 rounded-2xl shadow-xl shadow-pink-200 font-black flex items-center gap-3">
                                                    <span>📥</span> Descargar para Instagram
                                                </button>
                                                <button (click)="showImageCanvas.set(false)" class="btn-coquette bg-pink-100 text-pink-600 px-6 py-4 rounded-2xl font-black">
                                                    Cerrar
                                                </button>
                                            </div>
                                        </div>
                                        <div class="relative group">
                                            <canvas #socialCanvas class="w-full rounded-3xl shadow-[0_30px_60px_-15px_rgba(236,72,153,0.3)] border-4 border-white group-hover:scale-[1.02] transition-transform duration-500"></canvas>
                                            <div class="absolute inset-0 rounded-3xl bg-gradient-to-t from-pink-500/20 to-transparent pointer-events-none"></div>
                                        </div>
                                    </div>
                                </div>
                            }

                            <!-- History Section -->
                            @if (draws().length > 0) {
                                <div class="space-y-6">
                                    <h3 class="text-2xl font-black text-pink-900 font-display flex items-center gap-2">
                                        <span>📜</span> Historial de este Evento
                                    </h3>
                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        @for (d of draws(); track d.id) {
                                            <div class="card-coquette p-5 bg-white/40 border-white/60 hover:border-pink-200 transition-colors">
                                                <p class="text-lg font-black text-pink-900">{{ d.winner.name }}</p>
                                                <p class="text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-3">
                                                    {{ getDrawDate(d.drawDate) }} • {{ d.selectionMethod }}
                                                </p>
                                                @if (d.notes) {
                                                    <p class="text-xs text-pink-600 italic mt-2 bg-pink-50 p-3 rounded-xl">"{{ d.notes }}"</p>
                                                }
                                            </div>
                                        }
                                    </div>
                                </div>
                            }
                        </div>
                    }
                }
            </div>
        </div>

        @if (showAnimation() && raffle()) {
            <app-raffle-animation
                #raffleAnim
                [participants]="animationParticipants()"
                [animationType]="animType"
                [winnerNames]="animationWinnerNames()"
                (close)="onAnimationClose()"
                (startRequested)="handleStartRequested()">
            </app-raffle-animation>
        }

        <canvas #socialCanvas class="hidden" style="display: none;"></canvas>
    `
})
export class RaffleDetailComponent implements OnInit, AfterViewInit {
    private readonly raffleService = inject(RaffleService);
    private readonly toast = inject(ToastService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);

    raffle = signal<RaffleDetailDto | null>(null);
    participants = signal<RaffleParticipantDto[]>([]);
    draws = signal<RaffleDrawDto[]>([]);
    loading = signal(true);
    refreshing = signal(false);
    evaluating = signal(false);
    selecting = signal(false);
    announcing = signal(false);
    saving = signal(false);
    deleting = signal(false);
    isNew = signal(false);
    manualWinnerId = signal<number | null>(null);
    showAnimation = signal(false);
    animationWinnerNames = signal<string[]>([]);
    animationParticipants = signal<{ id: string; name: string }[]>([]);
    animationWinners = signal<string[]>([]);
    showImageCanvas = signal(false);

    searchTerm = signal('');
    filteredParticipants = computed(() => {
        const term = this.searchTerm().toLowerCase().trim();
        const parts = this.participants();
        if (!term) return parts;
        return parts.filter(p => p.client.name.toLowerCase().includes(term));
    });

    currentStep = signal(1);
    evaluatingPreview = signal(false);
    participantCountPreview = signal<number | string>(0);
    
    previewParticipants = signal<any[]>([
        { id: '1', name: 'Ana Garcia' },
        { id: '2', name: 'Maria Lopez' },
        { id: '3', name: 'Sofia Ruiz' },
        { id: '4', name: 'Laura Martinez' }
    ]);

    @ViewChild('socialCanvas') socialCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('raffleAnim') raffleAnim?: RaffleAnimationComponent;

    get animType(): 'roulette' | 'slot' | 'confetti' | 'elimination' {
        const t = this.raffle()?.animationType;
        if (t === 'slot' || t === 'confetti' || t === 'elimination') return t;
        return 'roulette';
    }

    allWinners = (): RaffleParticipantDto[] => this.participants().filter(p => p.isWinner);

    availableParticipants = (): RaffleParticipantDto[] => this.participants().filter(p => !p.isWinner);

    form = {
        name: '',
        description: '',
        imageUrl: '',
        socialShareImageUrl: '',
        animationType: 'roulette',
        requiredPurchases: 1,
        minOrderTotal: 0,
        clientFilter: 'all',
        winnerCount: 1,
        dateRangeStart: '',
        dateRangeEnd: '',
        raffleDate: ''
    };

    public raffleId: string | null = null;

    ngOnInit() {
        this.route.paramMap.subscribe(params => {
            this.raffleId = params.get('id');
            if (this.raffleId === 'new') {
                this.isNew.set(true);
                this.loading.set(false);
                const today = new Date();
                today.setDate(today.getDate() + 7);
                this.form.raffleDate = today.toISOString().slice(0, 16);
            } else {
                this.isNew.set(false);
                this.loadRaffle();
            }
        });
    }

    ngAfterViewInit() {
        setTimeout(() => {
            gsap.from('.card-coquette', {
                y: 50,
                opacity: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: "back.out(1.5)"
            });
        }, 100);
    }

    onSearchChange(event: any) {
        this.searchTerm.set(event.target.value);
    }

    isPreselected(clientId: number): boolean {
        const raffle = this.raffle();
        if (!raffle || !raffle.preselectedWinnerIds) return false;
        const ids = raffle.preselectedWinnerIds.split(',').map(s => parseInt(s.trim()));
        return ids.includes(clientId);
    }

    togglePreselected(clientId: number) {
        if (!this.raffleId) return;
        const raffle = this.raffle();
        if (!raffle) return;
        
        let ids = raffle.preselectedWinnerIds ? raffle.preselectedWinnerIds.split(',').map(s => parseInt(s.trim())).filter(id => !isNaN(id)) : [];
        if (ids.includes(clientId)) {
            ids = ids.filter(id => id !== clientId);
        } else {
            ids.push(clientId);
        }
        
        const newPreselected = ids.join(',');
        this.raffleService.updateRaffle(this.raffleId, { preselectedWinnerIds: newPreselected }).subscribe({
            next: () => {
                this.loadRaffle();
            }
        });
    }

    loadRaffle() {
        if (!this.raffleId) return;
        this.loading.set(true);
        this.raffleService.getRaffleById(this.raffleId).subscribe({
            next: (data) => {
                this.raffle.set(data);
                this.participants.set(data.participants || []);
                this.draws.set(data.draws || []);
                this.form.name = data.name;
                this.form.description = data.description || '';
                this.form.imageUrl = data.imageUrl || '';
                this.form.socialShareImageUrl = data.socialShareImageUrl || '';
                this.form.animationType = data.animationType;
                this.form.requiredPurchases = data.requiredPurchases;
                this.form.winnerCount = data.winnerCount || 1;
                this.form.minOrderTotal = data.minOrderTotal || 0;
                if (data.newClientsOnly && data.frequentClientsOnly) {
                    this.form.clientFilter = 'newAndFrequent';
                } else if (data.newClientsOnly) {
                    this.form.clientFilter = 'new';
                } else if (data.frequentClientsOnly) {
                    this.form.clientFilter = 'frequent';
                } else if (data.vipOnly) {
                    this.form.clientFilter = 'vip';
                } else {
                    this.form.clientFilter = 'all';
                }
                this.form.dateRangeStart = data.dateRangeStart ? new Date(data.dateRangeStart).toISOString().slice(0, 16) : '';
                this.form.dateRangeEnd = data.dateRangeEnd ? new Date(data.dateRangeEnd).toISOString().slice(0, 16) : '';
                this.form.raffleDate = new Date(data.raffleDate).toISOString().slice(0, 16);
                this.loading.set(false);
                this.refreshing.set(false);
            },
            error: () => {
                this.toast.error('Error al cargar el sorteo');
                this.loading.set(false);
                this.refreshing.set(false);
            }
        });
    }

    saveRaffle() {
        if (!this.form.name || !this.form.raffleDate) {
            this.toast.error('Nombre y fecha son requeridos');
            return;
        }

        const dto: CreateRaffleDto = {
            name: this.form.name,
            description: this.form.description,
            imageUrl: this.form.imageUrl,
            socialShareImageUrl: this.form.socialShareImageUrl,
            animationType: this.form.animationType,
            requiredPurchases: this.form.requiredPurchases,
            winnerCount: this.form.winnerCount,
            minOrderTotal: this.form.minOrderTotal > 0 ? this.form.minOrderTotal : undefined,
            clientSegmentFilter: this.form.clientFilter,
            newClientsOnly: this.form.clientFilter === 'new' || this.form.clientFilter === 'newAndFrequent',
            frequentClientsOnly: this.form.clientFilter === 'frequent' || this.form.clientFilter === 'newAndFrequent',
            vipOnly: this.form.clientFilter === 'vip',
            dateRangeStart: this.form.dateRangeStart ? new Date(this.form.dateRangeStart).toISOString() : undefined,
            dateRangeEnd: this.form.dateRangeEnd ? new Date(this.form.dateRangeEnd).toISOString() : undefined,
            raffleDate: new Date(this.form.raffleDate).toISOString()
        };

        this.saving.set(true);

        if (this.isNew()) {
            this.raffleService.createRaffle(dto).subscribe({
                next: (data) => {
                    this.toast.success('Sorteo creado exitosamente');
                    this.saving.set(false);
                    this.router.navigate(['/admin/raffles']);
                },
                error: () => {
                    this.toast.error('Error al crear el sorteo');
                    this.saving.set(false);
                }
            });
        } else if (this.raffleId) {
            this.raffleService.updateRaffle(this.raffleId, dto as UpdateRaffleDto).subscribe({
                next: (updated) => {
                    this.raffle.set(updated);
                    this.toast.success('Sorteo actualizado ✨');
                    this.saving.set(false);
                    // Solo refrescamos si es necesario, pero intentamos no resetear todo el formulario
                    // para evitar el salto visual
                },
                error: () => {
                    this.toast.error('Error al actualizar');
                    this.saving.set(false);
                }
            });
        }
    }

    activateRaffle() {
        if (!this.raffleId) return;
        this.raffleService.updateRaffle(this.raffleId, { status: 'Active' }).subscribe({
            next: (updated) => {
                this.raffle.set(updated);
                this.toast.success('Sorteo activado');
                // No llamamos a loadRaffle para evitar el "refresco" brusco de la página
            },
            error: () => this.toast.error('Error al activar')
        });
    }

    evaluateRaffle() {
        if (!this.raffleId) return;
        this.evaluating.set(true);
        this.raffleService.evaluateRaffle(this.raffleId).subscribe({
            next: (result) => {
                this.participants.set(result.qualifiedParticipants);
                this.participantCountPreview.set(result.totalQualified);
                this.toast.success(`${result.totalQualified} clientas califican`);
                this.evaluating.set(false);
            },
            error: (err) => {
                this.toast.error(err.error?.message || 'Error al evaluar');
                this.evaluating.set(false);
            }
        });
    }

    evalParticipantsPreview() {
        if (!this.raffleId && !this.isNew()) return;
        
        this.evaluatingPreview.set(true);
        
        // Use a slight delay to avoid flickering and make it feel like "analysis"
        setTimeout(() => {
            const dto: CreateRaffleDto = {
                name: this.form.name || 'Temp',
                description: this.form.description,
                imageUrl: this.form.imageUrl,
                animationType: this.form.animationType,
                requiredPurchases: this.form.requiredPurchases,
                winnerCount: this.form.winnerCount,
                minOrderTotal: this.form.minOrderTotal > 0 ? this.form.minOrderTotal : undefined,
                newClientsOnly: this.form.clientFilter === 'new' || this.form.clientFilter === 'newAndFrequent',
                frequentClientsOnly: this.form.clientFilter === 'frequent' || this.form.clientFilter === 'newAndFrequent',
                vipOnly: this.form.clientFilter === 'vip',
                dateRangeStart: this.form.dateRangeStart ? new Date(this.form.dateRangeStart).toISOString() : undefined,
                dateRangeEnd: this.form.dateRangeEnd ? new Date(this.form.dateRangeEnd).toISOString() : undefined,
                raffleDate: new Date(this.form.raffleDate).toISOString()
            };

            // If it's new, we don't have an ID yet, so we just mock or skip real server eval
            // In a real app, we might have a 'preview' endpoint. 
            // Here I'll just trigger evaluateRaffle if we have an ID.
            if (this.raffleId && this.raffleId !== 'new') {
                this.raffleService.evaluateRaffle(this.raffleId).subscribe({
                    next: (res) => {
                        this.participantCountPreview.set(res.totalQualified);
                        this.participants.set(res.qualifiedParticipants);
                        this.evaluatingPreview.set(false);
                    },
                    error: () => this.evaluatingPreview.set(false)
                });
            } else {
                // Cannot evaluate without creating first, show UX text
                this.participantCountPreview.set('Se calculará al guardar');
                this.evaluatingPreview.set(false);
            }
        }, 800);
    }

    goToStep(step: number) {
        if (step > this.currentStep()) {
            // Validate current step
            if (this.currentStep() === 1 && !this.form.name) {
                this.toast.error('El nombre es obligatorio');
                return;
            }
        }

        const outDir = step > this.currentStep() ? -50 : 50;
        const inDir = step > this.currentStep() ? 50 : -50;

        gsap.to(`#step-${this.currentStep()}`, {
            x: outDir,
            opacity: 0,
            duration: 0.3,
            ease: 'power2.in',
            onComplete: () => {
                this.currentStep.set(step);
                gsap.fromTo(`#step-${step}`, 
                    { x: inDir, opacity: 0 },
                    { x: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }
                );
            }
        });

        if (step === 2) {
            this.evalParticipantsPreview();
        }
    }

    selectRandomWinners() {
        if (!this.raffleId || this.participants().length === 0) return;
        
        // Just show animation modal, winner will be selected on "Start"
        this.animationParticipants.set(this.participants().map(p => ({ id: p.clientId.toString(), name: p.client.name })));
        this.animationWinnerNames.set([]); // Empty triggers "Real" mode
        this.showAnimation.set(true);
    }

    handleStartRequested() {
        if (!this.raffleId) return;

        const isTanda = this.raffle()?.shuffleTandaTurns;
        const count = this.form.winnerCount;

        if (isTanda) {
            this.raffleService.shuffleTandaTurns(this.raffleId, { selectionMethod: 'tandaShuffle' }).subscribe({
                next: (res) => {
                    const winnerNames = [...res.turnAssignments]
                        .sort((a, b) => a.newTurn - b.newTurn)
                        .map(t => t.clientName);
                    this.animationWinnerNames.set(winnerNames.length > 0 ? winnerNames : ['Tanda']);
                    this.raffleAnim?.setWinnerAndStart(this.animationWinnerNames());
                    this.loadRaffle();
                    this.toast.success('¡Turnos de tanda mezclados!');
                },
                error: (err) => {
                    this.toast.error(err.error?.message || 'Error al mezclar tanda');
                    this.showAnimation.set(false);
                }
            });
        } else {
            this.raffleService.selectWinner(this.raffleId, { selectionMethod: 'random', count }).subscribe({
                next: (draws) => {
                    const winnerNames = draws.map(d => d.winner.name);
                    this.animationWinnerNames.set(winnerNames);
                    this.raffleAnim?.setWinnerAndStart(winnerNames);
                    
                    this.refreshing.set(true);
                    this.loadRaffle();
                },
                error: (err) => {
                    this.toast.error(err.error?.message || 'Error al seleccionar');
                    this.showAnimation.set(false);
                }
            });
        }
    }

    generateAndDownload() {
        this.drawSocialCanvas();
        setTimeout(() => this.downloadSocialImage(), 500);
    }

    selectManualWinner() {
        if (!this.raffleId || !this.manualWinnerId()) return;
        this.selecting.set(true);
        const dto: SelectWinnerDto = {
            selectionMethod: 'manual',
            manualWinnerClientId: this.manualWinnerId()!
        };
        this.raffleService.selectWinner(this.raffleId, dto).subscribe({
            next: (draws) => {
                const winnerNames = draws.map(d => d.winner.name);
                this.toast.success(`${winnerNames[0]} seleccionada`);
                this.refreshing.set(true);
                this.loadRaffle();
                this.manualWinnerId.set(null);
                setTimeout(() => {
                    this.animationParticipants.set(this.participants().map(p => ({ id: p.clientId.toString(), name: p.client.name })));
                    this.animationWinnerNames.set(winnerNames);
                    this.showAnimation.set(true);
                    // Force start since winner is already known
                    setTimeout(() => this.raffleAnim?.setWinnerAndStart(winnerNames), 500);
                }, 500);
            },
            error: (err) => {
                this.toast.error(err.error?.message || 'Error al seleccionar');
                this.selecting.set(false);
            }
        });
    }

    showWinnerAnimation(winnerNames: string[]) {
        this.animationParticipants.set(this.participants().map(p => ({ id: p.clientId.toString(), name: p.client.name })));
        this.animationWinners.set(winnerNames);
        this.animationWinnerNames.set(winnerNames);
        this.showAnimation.set(true);
    }

    onAnimationClose() {
        this.showAnimation.set(false);
        this.animationWinnerNames.set([]);
        this.animationWinners.set([]);
        
        // Refresh data to show new winner in list
        this.refreshing.set(true);
        this.loadRaffle();
    }

    announceWinner() {
        if (!this.raffleId) return;
        this.announcing.set(true);
        this.raffleService.announceWinner(this.raffleId).subscribe({
            next: () => {
                this.toast.success('Ganadoras anunciadas exitosamente');
                this.refreshing.set(true);
                this.loadRaffle();
                const winners = this.allWinners();
                if (winners.length > 0) {
                    setTimeout(() => this.showWinnerAnimation(winners.map(w => w.client.name)), 500);
                }
            },
            error: () => {
                this.toast.error('Error al anunciar');
                this.announcing.set(false);
            }
        });
    }

    generateSocialImage() {
        this.showImageCanvas.set(true);
        setTimeout(() => this.drawSocialCanvas(), 100);
    }

    drawSocialCanvas() {
        const canvas = this.socialCanvas.nativeElement;
        const ctx = canvas.getContext('2d')!;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = 1080 * dpr;
        canvas.height = 1080 * dpr;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        ctx.scale(dpr, dpr);

        const W = 1080, H = 1080;

        // Background - Coquette gradient
        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, '#fce7f3');
        bgGrad.addColorStop(0.5, '#fdf2f8');
        bgGrad.addColorStop(1, '#faf5ff');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Decorative orbes
        ctx.globalAlpha = 0.4;
        
        // Pink orb top-right
        const orb1 = ctx.createRadialGradient(850, 200, 0, 850, 200, 300);
        orb1.addColorStop(0, '#f9a8d4');
        orb1.addColorStop(1, 'transparent');
        ctx.fillStyle = orb1;
        ctx.fillRect(0, 0, W, H);
        
        // Purple orb bottom-left
        const orb2 = ctx.createRadialGradient(200, 850, 0, 200, 850, 250);
        orb2.addColorStop(0, '#c4b5fd');
        orb2.addColorStop(1, 'transparent');
        ctx.fillStyle = orb2;
        ctx.fillRect(0, 0, W, H);
        
        ctx.globalAlpha = 1;

        // Floating elements
        ctx.font = '60px sans-serif';
        ctx.globalAlpha = 0.3;
        ctx.fillText('✨', 120, 180);
        ctx.fillText('💖', 900, 200);
        ctx.fillText('🌸', 150, 900);
        ctx.fillText('🎀', 880, 880);
        ctx.globalAlpha = 1;

        // Main card
        const cardPadding = 80;
        const cardW = W - cardPadding * 2;
        const cardH = H - cardPadding * 2;
        
        ctx.beginPath();
        ctx.roundRect(cardPadding, cardPadding, cardW, cardH, 40);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fill();
        ctx.strokeStyle = '#f9a8d4';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner decorative border
        ctx.beginPath();
        ctx.roundRect(cardPadding + 20, cardPadding + 20, cardW - 40, cardH - 40, 30);
        ctx.strokeStyle = '#fbcfe8';
        ctx.lineWidth = 1;
        ctx.stroke();

        // REGI BAZAR header
        const pinkGrad = ctx.createLinearGradient(W/2 - 200, 0, W/2 + 200, 0);
        pinkGrad.addColorStop(0, '#db2777');
        pinkGrad.addColorStop(0.5, '#ec4899');
        pinkGrad.addColorStop(1, '#db2777');
        
        ctx.fillStyle = pinkGrad;
        ctx.font = 'bold 28px "Poppins", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✨ REGI BAZAR ✨', W / 2, 200);

        // WINNER title
        ctx.fillStyle = '#be185d';
        ctx.font = '900 90px "Poppins", sans-serif';
        ctx.fillText('GANADORA', W / 2, 320);

        // Decorative line
        ctx.fillStyle = '#f9a8d4';
        ctx.fillRect(W/2 - 120, 350, 240, 4);

        // Raffle name
        ctx.fillStyle = '#831843';
        ctx.font = 'italic 500 32px "Poppins", sans-serif';
        ctx.fillText(this.raffle()?.name || 'Sorteo Especial', W / 2, 420);

        // Winner name
        const winners = this.allWinners();
        if (winners.length > 0) {
            ctx.shadowColor = '#ec4899';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#db2777';
            ctx.font = `900 ${winners.length <= 2 ? 80 : 60}px "Poppins", sans-serif`;
            ctx.fillText(winners[0].client.name.toUpperCase(), W / 2, 550);
            ctx.shadowBlur = 0;
            
            if (winners.length > 1) {
                ctx.font = '600 40px "Poppins", sans-serif';
                ctx.fillStyle = '#be185d';
                winners.slice(1).forEach((w, i) => {
                    ctx.fillText(w.client.name.toUpperCase(), W / 2, 620 + i * 50);
                });
            }
        }

        // Footer
        ctx.font = '600 24px "Poppins", sans-serif';
        ctx.fillStyle = '#9d174d';
        ctx.fillText('Nuevo Laredo, NL', W / 2, 880);

        ctx.font = '500 20px "Poppins", sans-serif';
        ctx.fillStyle = '#db2777';
        ctx.fillText('#REGIBAZAR', W / 2, 920);

        // Date
        ctx.font = '400 18px "Poppins", sans-serif';
        ctx.fillStyle = '#831843';
        ctx.globalAlpha = 0.6;
        const todayText = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
        ctx.fillText(todayText, W / 2, 960);
        ctx.globalAlpha = 1;
    }

    roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    downloadSocialImage() {
        const canvas = this.socialCanvas.nativeElement;
        const link = document.createElement('a');
        link.download = `sorteo-${this.raffle()?.name || 'ganadoras'}-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        this.toast.success('Imagen descargada');
    }

    confirmDelete() {
        const status = this.raffle()?.status;
        let msg = '¿Estás segura de eliminar este sorteo? Se borrarán TODAS las participantes, entradas y sorteos. Esta acción NO se puede deshacer.';
        if (status === 'Active') {
            msg = '⚠️ Este sorteo está ACTIVO. Se eliminarán todas las participantes evaluadas, entradas y el sorteo. ¿Continuar?';
        } else if (status === 'Completed') {
            msg = '🏆 Este sorteo ya tiene ganadora anunciada. Se eliminará TODO incluyendo las ganadoras seleccionadas. ¿Continuar?';
        }
        if (confirm(msg)) {
            this.deleteRaffle();
        }
    }

    deleteRaffle() {
        if (!this.raffleId) return;
        this.deleting.set(true);
        this.raffleService.deleteRaffle(this.raffleId).subscribe({
            next: () => {
                this.toast.success('Sorteo eliminado');
                this.router.navigate(['/admin/raffles']);
            },
            error: (err) => {
                this.toast.error(err.error?.message || 'Error al eliminar');
                this.deleting.set(false);
            }
        });
    }

    getStatusBadgeClass(status: string): string {
        switch (status) {
            case 'Draft': return 'bg-yellow-100 text-yellow-700';
            case 'Active': return 'bg-green-100 text-green-700';
            case 'Completed': return 'bg-pink-100 text-pink-700';
            case 'Cancelled': return 'bg-gray-100 text-gray-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    }

    getStatusLabel(status: string): string {
        switch (status) {
            case 'Draft': return '📝 Borrador';
            case 'Active': return '🟢 Activo';
            case 'Completed': return '🏆 Completado';
            case 'Cancelled': return '🚫 Cancelado';
            default: return status;
        }
    }

    getDrawDate(dateStr: string): string {
        return new Date(dateStr).toLocaleDateString('es-MX', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    }

    goBack() {
        this.router.navigate(['/admin/raffles']);
    }
}
