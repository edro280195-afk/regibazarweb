import { Component, inject, signal, OnInit, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RaffleService } from '../../../core/services/raffle.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { RaffleDetailDto, RaffleParticipantDto } from '../../../core/models';
import { RaffleAnimationComponent } from '../../admin/raffles/raffle-animation/raffle-animation.component';
import { gsap } from 'gsap';
import confetti from 'canvas-confetti';

@Component({
    selector: 'app-live-view',
    standalone: true,
    imports: [CommonModule, RaffleAnimationComponent],
    template: `
        <div class="live-container" [class.has-winner]="hasWinner()">
            <div class="live-bg"></div>
            
            <!-- Header con branding -->
            <header class="live-header">
                <div class="brand-mark">
                    <span class="brand-text">REGI BAZAR</span>
                    <span class="brand-sparkle">✨</span>
                </div>
                @if (raffle()) {
                    <div class="raffle-name">{{ raffle()!.name }}</div>
                }
            </header>

            @if (loading()) {
                <div class="loading-state">
                    <div class="heart-loader">💖</div>
                    <p class="animate-pulse">Cargando sorteо...</p>
                </div>
            } @else if (error()) {
                <div class="error-state">
                    <p>Error al cargar el sorteо</p>
                    <button (click)="loadRaffle()" class="retry-btn">Reintentar</button>
                </div>
            } @else {
                <!-- Timer o Animación -->
                <main class="live-content">
                    @if (!raffle()) {
                        <div class="no-raffle">
                            <p>Sorteо no encontrado</p>
                        </div>
                    } @else if (raffle()!.status === 'Draft') {
                        <div class="pending-state">
                            <div class="pending-icon">📝</div>
                            <p class="pending-text">Sorteо en preparación</p>
                            <p class="pending-subtext">Muy pronto iniciaremos</p>
                        </div>
                    } @else if (!started() && !hasWinner()) {
                        <!-- Estado: Esperando iniciar -->
                        <div class="waiting-state">
                            <div class="countdown-wrapper">
                                <div class="countdown-label">El sorteо empezarà en</div>
                                <div class="countdown">
                                    @if (countdownTime()) {
                                        <span class="time-block">{{ countdownTime()!.minutes }}</span>
                                        <span class="time-sep">:</span>
                                        <span class="time-block">{{ countdownTime()!.seconds }}</span>
                                    } @else {
                                        <span class="time-block">00</span>
                                        <span class="time-sep">:</span>
                                        <span class="time-block">00</span>
                                    }
                                </div>
                            </div>
                            
                            <div class="participants-count">
                                <span class="count">{{ participants().length }}</span>
                                <span class="label">participantes</span>
                            </div>

                            @if (isAdmin()) {
                                <button (click)="startRaffle()" [disabled]="starting()" class="start-btn">
                                    {{ starting() ? '✨ Iniciando...' : '🎰 INICIAR SORTEO' }}
                                </button>
                            }
                        </div>
                    } @else if (started() && !hasWinner()) {
                        <!-- Estado: Animación en curso -->
                        <div class="animation-wrapper">
                            <app-raffle-animation
                                #raffleAnim
                                [participants]="animationParticipants()"
                                [animationType]="animType"
                                [winnerNames]="animationWinnerNames()"
                                [isPreview]="false"
                                (startRequested)="handleStartRequested()"
                                (close)="handleAnimationComplete()">
                            </app-raffle-animation>
                        </div>
                    } @else if (hasWinner()) {
                        <!-- Estado: Winner! -->
                        <div class="winner-state">
                            <div class="winner-reveal">
                                <div class="sparkles"></div>
                                <p class="winner-badge">🏆 ¡TENEMOS GANADORA! 🏆</p>
                                @for (name of winnerNames(); track name) {
                                    <h2 class="winner-name">{{ name }}</h2>
                                }
                                <div class="winner-stars">✨✨✨✨✨</div>
                                
                                @if (isAdmin()) {
                                    <div class="admin-actions">
                                        <button (click)="announceWinner()" [disabled]="announcing()" class="announce-btn">
                                            📢 Anunciar
                                        </button>
                                        <button (click)="downloadImage()" class="download-btn">
                                            📥 Imagen
                                        </button>
                                    </div>
                                }
                            </div>
                        </div>
                    }
                </main>
            }


            <!-- Botón Ir a Live (solo admin desde elsewhere) -->
            @if (!isAdmin() && raffle()) {
                <a [href]="'/admin/raffles/' + raffle()!.id" class="admin-link">
                    ⚙️ Admin
                </a>
            }
        </div>

        <canvas #socialCanvas class="hidden-canvas"></canvas>

        <style>
            :host {
                display: block;
                width: 100%;
                height: 100vh;
                overflow: hidden;
            }

            .live-container {
                position: relative;
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                font-family: 'Poppins', 'Inter', sans-serif;
                background: #0a0612;
                color: white;
            }

            .live-bg {
                position: absolute;
                inset: 0;
                background: 
                    radial-gradient(ellipse at 20% 0%, rgba(236, 72, 153, 0.15) 0%, transparent 50%),
                    radial-gradient(ellipse at 80% 100%, rgba(168, 85, 247, 0.1) 0%, transparent 50%),
                    linear-gradient(180deg, #0a0612 0%, #1a0a1f 50%, #0a0612 100%);
                z-index: 0;
            }

            .live-container.has-winner .live-bg {
                background: 
                    radial-gradient(ellipse at 50% 30%, rgba(236, 72, 153, 0.25) 0%, transparent 60%),
                    radial-gradient(ellipse at 80% 100%, rgba(251, 191, 36, 0.15) 0%, transparent 50%),
                    linear-gradient(180deg, #0a0612 0%, #1f0a1f 50%, #0a0612 100%);
            }

            /* Header */
            .live-header {
                position: relative;
                z-index: 10;
                padding: 1.5rem 1rem 1rem;
                text-align: center;
            }

            .brand-mark {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
            }

            .brand-text {
                font-family: 'Poppins', sans-serif;
                font-weight: 900;
                font-size: 1.5rem;
                letter-spacing: 0.3em;
                background: linear-gradient(135deg, #f472b6, #e879f9, #f472b6);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .brand-sparkle {
                font-size: 1.2rem;
                animation: sparkle 2s ease-in-out infinite;
            }

            @keyframes sparkle {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(0.8); }
            }

            .raffle-name {
                font-size: 0.875rem;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.6);
                margin-top: 0.5rem;
            }

            /* Main Content */
            .live-content {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1rem;
                position: relative;
                z-index: 10;
            }

            /* Loading */
            .loading-state, .error-state, .no-raffle {
                text-align: center;
            }

            .heart-loader {
                font-size: 3rem;
                animation: pulseHeart 1s infinite;
                margin-bottom: 1rem;
            }

            @keyframes pulseHeart {
                0%, 100% { transform: scale(1); opacity: 0.8; }
                50% { transform: scale(1.2); opacity: 1; filter: drop-shadow(0 0 10px #ec4899); }
            }

            .retry-btn {
                background: #ec4899;
                color: white;
                border: none;
                padding: 0.75rem 2rem;
                border-radius: 2rem;
                font-weight: 600;
                cursor: pointer;
                margin-top: 1rem;
            }

            /* Waiting State */
            .waiting-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2rem;
                width: 100%;
                max-width: 500px;
            }

            .countdown-wrapper {
                text-align: center;
            }

            .countdown-label {
                font-size: 0.875rem;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.5);
                text-transform: uppercase;
                letter-spacing: 0.2em;
                margin-bottom: 0.5rem;
            }

            .countdown {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.25rem;
                font-size: 3rem;
                font-weight: 900;
            }

            .time-block {
                background: rgba(255, 255, 255, 0.1);
                padding: 0.5rem 1rem;
                border-radius: 0.75rem;
                min-width: 80px;
                font-variant-numeric: tabular-nums;
            }

            .time-sep {
                color: rgba(255, 255, 255, 0.3);
            }

            .participants-preview {
                text-align: center;
                width: 100%;
            }

            .participants-count {
                margin-bottom: 1.5rem;
            }

            .participants-count .count {
                font-size: 2.5rem;
                font-weight: 900;
                display: block;
                color: #f472b6;
            }

            .participants-count .label {
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.5);
                text-transform: uppercase;
                letter-spacing: 0.1em;
            }

            .top-3 {
                display: flex;
                justify-content: center;
                gap: 0.75rem;
                flex-wrap: wrap;
            }

            .top-card {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                padding: 0.75rem 1.25rem;
                border-radius: 1rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .top-card.rank-1 {
                background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1));
                border-color: rgba(251, 191, 36, 0.4);
            }

            .top-card .crown {
                font-size: 1.25rem;
            }

            .top-card .name {
                font-weight: 700;
                font-size: 0.9rem;
            }

            .start-btn {
                background: linear-gradient(135deg, #ec4899, #db2777);
                color: white;
                border: none;
                padding: 1rem 3rem;
                border-radius: 3rem;
                font-size: 1.25rem;
                font-weight: 900;
                cursor: pointer;
                box-shadow: 0 10px 40px rgba(236, 72, 153, 0.4);
                transition: all 0.3s ease;
            }

            .start-btn:hover:not(:disabled) {
                transform: scale(1.05);
                box-shadow: 0 15px 50px rgba(236, 72, 153, 0.5);
            }

            .start-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .spinner {
                display: inline-block;
                animation: spin 1s linear infinite;
            }

            /* Pending State */
            .pending-state {
                text-align: center;
            }

            .pending-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
            }

            .pending-text {
                font-size: 1.5rem;
                font-weight: 900;
                margin-bottom: 0.5rem;
            }

            .pending-subtext {
                color: rgba(255, 255, 255, 0.5);
            }

            /* Animation Wrapper */
            .animation-wrapper {
                width: 100%;
                max-width: 600px;
                aspect-ratio: 1;
            }

            /* Winner State */
            .winner-state {
                text-align: center;
                width: 100%;
            }

            .winner-reveal {
                position: relative;
            }

            .sparkles {
                position: absolute;
                inset: -50px;
                background-image: radial-gradient(circle, rgba(251, 191, 36, 0.3) 1px, transparent 1px);
                background-size: 20px 20px;
                animation: rotateBg 10s linear infinite;
                pointer-events: none;
            }

            @keyframes rotateBg { to { transform: rotate(360deg); } }

            .winner-badge {
                font-weight: 900;
                font-size: 1rem;
                letter-spacing: 0.2em;
                color: #fbbf24;
                margin-bottom: 1rem;
            }

            .winner-name {
                font-size: 3.5rem;
                font-weight: 950;
                line-height: 1.1;
                margin-bottom: 1rem;
                text-shadow: 0 0 40px rgba(251, 191, 36, 0.5);
                max-width: 100%;
                overflow-wrap: anywhere;
            }

            .winner-stars {
                font-size: 1.5rem;
                margin-bottom: 2rem;
            }

            .admin-actions {
                display: flex;
                justify-content: center;
                gap: 1rem;
                flex-wrap: wrap;
            }

            .announce-btn, .download-btn {
                padding: 0.75rem 2rem;
                border-radius: 2rem;
                font-weight: 700;
                cursor: pointer;
                border: none;
                transition: all 0.3s;
            }

            .announce-btn {
                background: #fbbf24;
                color: #1a0612;
            }

            .download-btn {
                background: rgba(255, 255, 255, 0.15);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
            }

            .announce-btn:hover:not(:disabled), .download-btn:hover {
                transform: translateY(-2px);
            }

            /* Footer */
            .live-footer {
                position: relative;
                z-index: 10;
                padding: 1rem;
                text-align: center;
                display: flex;
                justify-content: center;
                gap: 2rem;
                flex-wrap: wrap;
                color: rgba(255, 255, 255, 0.4);
                font-size: 0.875rem;
            }

            .hashtag {
                font-weight: 700;
            }

            /* Admin Link */
            .admin-link {
                position: fixed;
                bottom: 1rem;
                right: 1rem;
                background: rgba(0, 0, 0, 0.5);
                color: rgba(255, 255, 255, 0.5);
                padding: 0.5rem 1rem;
                border-radius: 1rem;
                font-size: 0.75rem;
                text-decoration: none;
                z-index: 100;
            }

            /* Hidden canvas */
            .hidden-canvas {
                display: none;
            }

            /* Mobile optimizations */
            @media (max-width: 480px) {
                .brand-text {
                    font-size: 1.25rem;
                }

                .countdown {
                    font-size: 2.5rem;
                }

                .time-block {
                    min-width: 60px;
                    padding: 0.375rem 0.75rem;
                }

                .winner-name {
                    font-size: 2.5rem;
                }

                .top-card {
                    padding: 0.5rem 1rem;
                }

                .top-card .name {
                    font-size: 0.8rem;
                }
            }
        </style>
    `
})
export class LiveViewComponent implements OnInit, AfterViewInit, OnDestroy {
    private readonly route = inject(ActivatedRoute);
    private readonly raffleService = inject(RaffleService);
    private readonly toast = inject(ToastService);
    private readonly authService = inject(AuthService);

    raffle = signal<RaffleDetailDto | null>(null);
    participants = signal<RaffleParticipantDto[]>([]);
    loading = signal(true);
    error = signal(false);
    started = signal(false);
    hasWinner = signal(false);
    winnerNames = signal<string[]>([]);
    starting = signal(false);
    announcing = signal(false);
    countdownTime = signal<{ minutes: string; seconds: string } | null>(null);

    animationParticipants = signal<{ id: string; name: string }[]>([]);
    animationWinnerNames = signal<string[]>([]);

    @ViewChild('raffleAnim') raffleAnim?: RaffleAnimationComponent;
    @ViewChild('socialCanvas') socialCanvas?: ElementRef<HTMLCanvasElement>;

    private countdownInterval: any;
    private raffleId: string | null = null;

    get animType(): 'roulette' | 'slot' | 'confetti' | 'elimination' {
        const t = this.raffle()?.animationType;
        if (t === 'slot' || t === 'confetti' || t === 'elimination') return t;
        return 'roulette';
    }

    ngOnInit() {
        this.route.paramMap.subscribe(params => {
            this.raffleId = params.get('id');
            if (this.raffleId) {
                this.loadRaffle();
            } else {
                this.loading.set(false);
                this.error.set(true);
            }
        });
    }

    ngAfterViewInit() {
        setTimeout(() => this.animateIn(), 100);
    }

    ngOnDestroy() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
    }

    loadRaffle() {
        this.loading.set(true);
        this.error.set(false);

        if (!this.raffleId) {
            this.loading.set(false);
            this.error.set(true);
            return;
        }

        this.raffleService.getRaffleById(this.raffleId).subscribe({
            next: (data) => {
                this.raffle.set(data);
                this.participants.set(data.participants || []);

                const winners = data.participants?.filter(p => p.isWinner) || [];
                if (winners.length > 0) {
                    this.hasWinner.set(true);
                    this.winnerNames.set(winners.map(w => w.client.name));
                }

                if (data.status === 'Active') {
                    this.started.set(true);
                }

                // Asegurar que la animación tenga los participantes
                if (data.participants && data.participants.length > 0) {
                    this.animationParticipants.set(
                        data.participants.map(p => ({
                            id: p.clientId.toString(),
                            name: p.client.name
                        }))
                    );
                }

                this.startCountdown();
                this.loading.set(false);
            },
            error: () => {
                this.error.set(true);
                this.loading.set(false);
            }
        });
    }

    startCountdown() {
        const raffle = this.raffle();
        if (!raffle || !raffle.raffleDate) return;

        const updateCountdown = () => {
            const now = new Date().getTime();
            const raffleTime = new Date(raffle.raffleDate).getTime();
            const diff = raffleTime - now;

            if (diff <= 0) {
                this.countdownTime.set(null);
                if (this.countdownInterval) {
                    clearInterval(this.countdownInterval);
                }
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);

            this.countdownTime.set({
                minutes: minutes.toString().padStart(2, '0'),
                seconds: seconds.toString().padStart(2, '0')
            });
        };

        updateCountdown();
        this.countdownInterval = setInterval(updateCountdown, 1000);
    }

    animateIn() {
        gsap.from('.live-header', { y: -30, opacity: 0, duration: 0.6, ease: 'power2.out' });
        gsap.from('.live-content', { y: 30, opacity: 0, duration: 0.6, delay: 0.2, ease: 'power2.out' });
        gsap.from('.live-footer', { y: 20, opacity: 0, duration: 0.4, delay: 0.4, ease: 'power2.out' });
    }

    isAdmin(): boolean {
        return this.authService.isLoggedIn();
    }

    startRaffle() {
        if (!this.raffleId || this.starting()) return;

        this.starting.set(true);
        this.raffleService.evaluateRaffle(this.raffleId).subscribe({
            next: (result) => {
                this.participants.set(result.qualifiedParticipants);
                this.animationParticipants.set(
                    result.qualifiedParticipants.map(p => ({
                        id: p.clientId.toString(),
                        name: p.client.name
                    }))
                );
                this.started.set(true);
                this.starting.set(false);
            },
            error: () => {
                this.starting.set(false);
                this.toast.error('Error al iniciar');
            }
        });
    }

    handleStartRequested() {
        if (!this.raffleId) return;

        this.raffleService.getRaffleById(this.raffleId).subscribe({
            next: (data) => {
                this.raffle.set(data);
                const count = data.winnerCount || 1;

                this.raffleService.selectWinner(this.raffleId!, { selectionMethod: 'random', count }).subscribe({
                    next: (draws) => {
                        const winnerNames = draws.map(d => d.winner.name);
                        // Guardamos todos los ganadores pero no cortamos la animación
                        this.animationWinnerNames.set(winnerNames);

                        // Iniciamos la animación que se encargará de mostrarlos secuencialmente
                        this.raffleAnim?.setWinnerAndStart(winnerNames);

                        // NO seteamos hasWinner a true aquí, dejamos que la animación termine su curso
                        // La animación emitirá 'winnerAnnounced' o similar cuando termine un giro
                    },
                    error: (err) => {
                        this.toast.error(err.error?.message || 'Error al seleccionar ganadoras');
                        this.started.set(false);
                    }
                });
            },
            error: () => {
                this.toast.error('Error al sincronizar datos del sorteo');
            }
        });
    }

    handleAnimationComplete() {
        // La animación ha terminado su ciclo secuencial completo
        // Ahora sí, mostramos la pantalla final de LiveView con el resumen de ganadoras
        this.hasWinner.set(true);
        this.winnerNames.set(this.animationWinnerNames());
        this.triggerConfetti();
    }

    announceWinner() {
        if (!this.raffleId || this.announcing()) return;

        this.announcing.set(true);
        this.raffleService.announceWinner(this.raffleId).subscribe({
            next: () => {
                this.toast.success('¡Ganadora anunciada!');
                this.announcing.set(false);
            },
            error: () => {
                this.toast.error('Error al anunciar');
                this.announcing.set(false);
            }
        });
    }

    downloadImage() {
        if (!this.raffle()) return;

        const canvas = this.socialCanvas?.nativeElement;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = 1080 * dpr;
        canvas.height = 1080 * dpr;
        ctx.scale(dpr, dpr);

        const W = 1080, H = 1080;

        ctx.fillStyle = '#0a0612';
        ctx.fillRect(0, 0, W, H);

        const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 600);
        grad.addColorStop(0, 'rgba(236, 72, 153, 0.2)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#fff';
        ctx.font = '900 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('REGI BAZAR', W / 2, 150);

        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 36px sans-serif';
        ctx.fillText('🏆 GANADORAS 🏆', W / 2, 250);

        ctx.fillStyle = '#fff';
        const names = this.winnerNames();
        const fontSize = names.length > 2 ? 50 : 80;
        ctx.font = `900 ${fontSize}px sans-serif`;

        names.forEach((name, i) => {
            ctx.fillText(name, W / 2, 400 + (i * (fontSize + 20)));
        });

        ctx.fillStyle = '#f472b6';
        ctx.font = '500 32px sans-serif';
        ctx.fillText(this.raffle()!.name, W / 2, 550);

        ctx.fillStyle = '#666';
        ctx.font = '500 24px sans-serif';
        ctx.fillText('#RegiBazar • Nuevo Laredo, NL', W / 2, 900);

        const link = document.createElement('a');
        link.download = `ganadora-${this.raffle()!.name}-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        this.toast.success('Imagen descargada');
    }

    private triggerConfetti() {
        const duration = 4 * 1000;
        const end = Date.now() + duration;

        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ec4899', '#fbbf24', '#ffffff']
        });

        const interval = setInterval(() => {
            if (Date.now() > end) {
                clearInterval(interval);
                return;
            }
            confetti({
                particleCount: 30,
                spread: 60,
                origin: { x: Math.random() * 0.5 + 0.25, y: -0.1 }
            });
        }, 200);
    }
}
