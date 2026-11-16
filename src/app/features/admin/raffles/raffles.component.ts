import { Component, inject, signal, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RaffleService } from '../../../core/services/raffle.service';
import { ToastService } from '../../../core/services/toast.service';
import { RaffleSummaryDto } from '../../../core/models';
import { gsap } from 'gsap';

@Component({
    selector: 'app-raffles',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
        <div class="relative min-h-[80vh] overflow-hidden -m-4 lg:-m-8 p-4 lg:p-8">
            <div class="absolute inset-0 pointer-events-none z-[-1] overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-br from-pink-50/50 via-purple-50/50 to-rose-50/50"></div>
                <div class="absolute top-[10%] left-[5%] text-6xl animate-pulse-slow blur-[1px]">🎉</div>
                <div class="absolute top-[60%] right-[10%] text-5xl opacity-50">✨</div>
                <div class="absolute top-[20%] right-[20%] text-4xl animate-float-delayed">🎀</div>
                <div class="absolute top-[75%] left-[15%] text-5xl animate-bounce-slow blur-[1px]">💖</div>
            </div>

            <div class="space-y-6 relative z-10 max-w-7xl mx-auto">
                <div class="flex flex-wrap items-center justify-between gap-6 animate-slide-down">
                    <div>
                        <h1 class="text-4xl font-black text-pink-900 font-display flex items-center gap-4">
                            <span class="animate-wiggle inline-block drop-shadow-xl">✨</span>
                            Centro de Sorteos
                        </h1>
                        <p class="text-pink-500 font-medium ml-1 mt-2 flex items-center gap-2">
                            <span class="w-8 h-px bg-pink-200"></span>
                            Gestiona y premia a tu comunidad con estilo
                        </p>
                    </div>
                    <button routerLink="/admin/raffles/new" class="btn-coquette bg-gradient-to-r from-pink-500 to-rose-500 text-white px-8 py-3 rounded-full shadow-pink-200/50 shadow-2xl hover:scale-105 transition-all duration-300 font-black">
                        <span>💖</span> Crear Nuevo Sorteo
                    </button>
                </div>

                <!-- Quick Stats -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
                    <div class="card-coquette bg-white/40 backdrop-blur-md p-6 border-white/60 flex items-center gap-5 group hover:bg-pink-50/50 transition-colors">
                        <div class="w-14 h-14 rounded-2xl bg-pink-100 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🎰</div>
                        <div>
                            <p class="text-xs font-bold text-pink-400 uppercase tracking-widest">Activos</p>
                            <p class="text-2xl font-black text-pink-900">{{ activeCount() }} Sorteos</p>
                        </div>
                    </div>
                    <div class="card-coquette bg-white/40 backdrop-blur-md p-6 border-white/60 flex items-center gap-5 group hover:bg-purple-50/50 transition-colors">
                        <div class="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">👥</div>
                        <div>
                            <p class="text-xs font-bold text-purple-400 uppercase tracking-widest">Participantes</p>
                            <p class="text-2xl font-black text-pink-900">{{ totalParticipants() }} Totales</p>
                        </div>
                    </div>
                    <div class="card-coquette bg-white/40 backdrop-blur-md p-6 border-white/60 flex items-center gap-5 group hover:bg-rose-50/50 transition-colors">
                        <div class="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🏆</div>
                        <div>
                            <p class="text-xs font-bold text-rose-400 uppercase tracking-widest">Completados</p>
                            <p class="text-2xl font-black text-pink-900">{{ completedCount() }} Exitosos</p>
                        </div>
                    </div>
                </div>

                <div class="card-coquette bg-white/30 backdrop-blur-lg p-6 border-white/40 animate-slide-up delay-100">
                    <div class="flex flex-wrap gap-6 items-end">
                        <div class="w-full min-w-0 md:flex-1 md:min-w-[300px] relative">
                            <label class="label-coquette text-pink-800 font-bold mb-2 block">🔍 Filtrar por nombre</label>
                            <div class="relative group">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400 group-focus-within:text-pink-600 transition-colors">🔍</span>
                                <input class="input-coquette pl-12 bg-white/50 border-white/50 focus:bg-white focus:ring-4 focus:ring-pink-200/50"
                                       placeholder="Buscar sorteo..."
                                       [(ngModel)]="searchQuery" (ngModelChange)="applyFilters()" />
                            </div>
                        </div>

                        <div class="w-64">
                            <label class="label-coquette text-pink-800 font-bold mb-2 block">📋 Estado Actual</label>
                            <select class="input-coquette py-2 bg-white/50 border-white/50" [(ngModel)]="statusFilter" (change)="loadRaffles()">
                                <option value="">🌈 Todos los estados</option>
                                <option value="Draft">📝 Borradores</option>
                                <option value="Active">🟢 Sorteos Activos</option>
                                <option value="Completed">🏆 Finalizados</option>
                                <option value="Cancelled">🚫 Cancelados</option>
                            </select>
                        </div>
                    </div>
                </div>

                @if (loading()) {
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        @for (i of [1,2,3,4,5,6]; track i) {
                            <div class="shimmer h-80 rounded-[2.5rem]"></div>
                        }
                    </div>
                } @else {
                    @if (filteredRaffles().length === 0) {
                        <div class="card-coquette p-20 text-center animate-fade-in bg-white/20 border-dashed border-2 border-white/60">
                            <div class="text-8xl mb-6 animate-bounce">🎀</div>
                            <p class="text-3xl font-black text-pink-900">¿Lista para la magia?</p>
                            <p class="text-pink-500 font-medium mt-3 max-w-md mx-auto">No encontramos sorteos que coincidan con tu búsqueda. Crea uno nuevo y sorprende a tus clientas.</p>
                            <button routerLink="/admin/raffles/new" class="mt-8 btn-coquette btn-pink">Crear mi primer sorteo</button>
                        </div>
                    } @else {
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            @for (raffle of filteredRaffles(); track raffle.id) {
                                <div class="raffle-card card-coquette p-0 overflow-hidden bg-white/40 backdrop-blur-md border-white/60 hover:border-pink-300 hover:shadow-2xl hover:shadow-pink-200/50 transition-all duration-500 cursor-pointer group flex flex-col h-full relative"
                                     [routerLink]="'/admin/raffles/' + raffle.id">
                                    
                                    <!-- Delete Button -->
                                    <button (click)="deleteRaffle(raffle.id, $event)" 
                                            class="absolute top-4 left-4 z-20 w-8 h-8 rounded-full bg-white/80 backdrop-blur-md border border-red-100 text-red-500 flex items-center justify-center shadow-lg hover:bg-red-500 hover:text-white transition-all duration-300 opacity-100 sm:opacity-0 group-hover:opacity-100">
                                        <span class="text-sm">🗑️</span>
                                    </button>

                                    <div class="h-48 overflow-hidden relative shrink-0">
                                        @if (raffle.imageUrl) {
                                            <img [src]="raffle.imageUrl" [alt]="raffle.name"
                                                 class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                        } @else {
                                            <div class="w-full h-full bg-gradient-to-br from-pink-200 via-rose-100 to-purple-200 flex items-center justify-center group-hover:rotate-3 transition-transform duration-500">
                                                <span class="text-7xl drop-shadow-lg">🎁</span>
                                            </div>
                                        }
                                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                                        <div class="absolute top-4 right-4">
                                            <span class="text-[10px] font-black uppercase tracking-tighter px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg"
                                                  [class]="getStatusBadgeClass(raffle.status)">
                                                {{ getStatusLabel(raffle.status) }}
                                            </span>
                                        </div>
                                        <div class="absolute bottom-4 left-4 right-4">
                                            <h3 class="text-white font-black text-xl drop-shadow-md truncate">{{ raffle.name }}</h3>
                                            <p class="text-pink-100 text-[10px] font-bold uppercase tracking-widest mt-0.5">{{ getRaffleDate(raffle.raffleDate) }}</p>
                                        </div>
                                    </div>

                                    <div class="p-6 space-y-5 flex-1 flex flex-col justify-between">
                                        <div class="flex items-center justify-between">
                                            <div class="flex items-center gap-2">
                                                <div class="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold border-2 border-white shadow-sm">
                                                    👥
                                                </div>
                                                <div>
                                                    <p class="text-[10px] font-bold text-pink-400 uppercase leading-none">Audiencia</p>
                                                    <p class="text-sm font-black text-pink-900 leading-tight">{{ raffle.participantCount }} Participantes</p>
                                                </div>
                                            </div>
                                            @if (raffle.winnerName) {
                                                <div class="text-right">
                                                    <p class="text-[10px] font-bold text-purple-400 uppercase leading-none">Ganadora</p>
                                                    <p class="text-sm font-black text-purple-600 flex items-center gap-1 justify-end leading-tight">
                                                        <span>🏆</span> {{ raffle.winnerName }}
                                                    </p>
                                                </div>
                                            }
                                        </div>

                                        <div class="pt-4 border-t border-white/40 flex items-center justify-between text-[11px] font-bold text-pink-400 uppercase tracking-widest">
                                            <div class="flex items-center gap-1.5">
                                                <span class="text-lg animate-pulse">🎬</span>
                                                {{ getAnimationLabel(raffle.animationType) }}
                                            </div>
                                            <span class="group-hover:translate-x-1 transition-transform">Ver detalle →</span>
                                        </div>
                                    </div>
                                </div>
                            }
                        </div>
                    }
                }
            </div>
        </div>
    `
})
export class RafflesComponent implements OnInit {
    private readonly raffleService = inject(RaffleService);
    private readonly toast = inject(ToastService);
    private readonly router = inject(Router);

    raffles = signal<RaffleSummaryDto[]>([]);
    loading = signal(true);
    searchQuery = signal('');
    statusFilter = signal('');

    filteredRaffles = signal<RaffleSummaryDto[]>([]);

    activeCount = signal(0);
    totalParticipants = signal(0);
    completedCount = signal(0);

    ngOnInit() {
        this.loadRaffles();
    }

    ngAfterViewInit() {
        this.animateCards();
    }

    animateCards() {
        setTimeout(() => {
            gsap.from('.raffle-card', {
                y: 60,
                opacity: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: 'back.out(1.5)',
                clearProps: 'all'
            });
        }, 100);
    }

    loadRaffles() {
        this.loading.set(true);
        const status = this.statusFilter();
        this.raffleService.getRaffles(status || undefined).subscribe({
            next: (data) => {
                this.raffles.set(data);
                this.updateStats(data);
                this.applyFilters();
                this.loading.set(false);
                this.animateCards();
            },
            error: (err) => {
                this.toast.error('Error al cargar sorteos');
                this.loading.set(false);
            }
        });
    }

    updateStats(data: RaffleSummaryDto[]) {
        this.activeCount.set(data.filter(r => r.status === 'Active').length);
        this.totalParticipants.set(data.reduce((acc, curr) => acc + curr.participantCount, 0));
        this.completedCount.set(data.filter(r => r.status === 'Completed').length);
    }

    applyFilters() {
        let result = this.raffles();
        const search = this.searchQuery().toLowerCase();
        if (search) {
            result = result.filter(r => r.name.toLowerCase().includes(search));
        }
        this.filteredRaffles.set(result);
    }

    deleteRaffle(id: string, event: Event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (confirm('¿Estás segura de que deseas eliminar este sorteo? Esta acción no se puede deshacer.')) {
            this.raffleService.deleteRaffle(id).subscribe({
                next: () => {
                    this.toast.success('Sorteo eliminado con éxito');
                    this.loadRaffles();
                },
                error: () => {
                    this.toast.error('Error al eliminar el sorteo');
                }
            });
        }
    }

    getStatusBadgeClass(status: string): string {
        switch (status) {
            case 'Draft': return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
            case 'Active': return 'bg-green-100 text-green-700 border border-green-200';
            case 'Completed': return 'bg-purple-100 text-purple-700 border border-purple-200';
            case 'Cancelled': return 'bg-gray-100 text-gray-700 border border-gray-200';
            default: return 'bg-gray-100 text-gray-700 border border-gray-200';
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

    getRaffleDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    getAnimationLabel(type: string): string {
        switch (type) {
            case 'roulette': return 'Ruleta giratoria';
            case 'slot': return 'Slot machine';
            case 'confetti': return 'Confetti';
            default: return type;
        }
    }
}
