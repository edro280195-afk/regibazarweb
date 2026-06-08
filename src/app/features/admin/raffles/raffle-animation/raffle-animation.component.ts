import { Component, inject, signal, input, output, effect, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { gsap } from 'gsap';
import confetti from 'canvas-confetti';

interface Participant {
    id: string;
    name: string;
}

@Component({
    selector: 'app-raffle-animation',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="arena-overlay" [class.preview-mode]="isPreview()">
            
            @if (!isPreview()) {
                <div class="cinematic-bg"></div>
                <button (click)="close.emit()" class="close-btn">×</button>
            }


            <div class="arena-content">
                @if (!isPreview()) {
                    <div class="header-section">
                        <span class="presents">Regi Bazar Presents</span>
                        <h2 class="main-title">
                            @if (customTitle()) {
                                {{ customTitle() }}
                            } @else {
                                {{ animationType() === 'roulette' ? '🎡 La Ruleta' : animationType() === 'slot' ? '🎰 Slot Mania' : animationType() === 'elimination' ? '⚡ Eliminación' : '🎉 Confetti' }}
                            }
                        </h2>
                    </div>
                }


                <div class="animation-workspace">
                    @if (animationType() === 'roulette') {
                        <div class="roulette-container">
                            <!-- Pointer -->
                            <div class="roulette-pointer">
                                <svg width="60" height="60" viewBox="0 0 60 60">
                                    <path d="M30 60 L10 10 Q30 0 50 10 Z" fill="#ec4899" stroke="white" stroke-width="3" />
                                    <circle cx="30" cy="15" r="5" fill="white" />
                                </svg>
                            </div>
                            
                            <div class="roulette-glow"></div>
                            
                            <div class="canvas-wrapper">
                                <canvas #rouletteCanvas></canvas>
                                <!-- Center Piece -->
                                <div class="center-piece">
                                    <div class="center-glow"></div>
                                    <img src="/pwa-icon.png" class="center-logo" alt="RB Logo" />
                                </div>
                            </div>
                        </div>
                    }

                    <!-- SLOT MACHINE -->
                    @if (animationType() === 'slot') {
                        <div class="slot-machine">
                            @for (col of [0, 1, 2]; track col) {
                                <div class="slot-column">
                                    <div class="slot-strip" [id]="'strip-' + col">
                                        @for (item of getSlotItems(col); track $index) {
                                            <div class="slot-item">
                                                <span>{{ item }}</span>
                                            </div>
                                        }
                                    </div>
                                    <div class="slot-overlay"></div>
                                </div>
                            }
                        </div>
                    }

                    @if (animationType() === 'elimination') {
                        <div class="elimination-container">
                            <div class="elimination-grid" [style.grid-template-columns]="getGridColumns()">
                                @for (p of participants(); track p.id) {
                                    <div class="elimination-card" [id]="'p-' + p.id" [style.height]="getCardHeight()">
                                        <div class="card-inner">
                                            <span class="card-name" [style.font-size]="getFontSize()">{{ p.name }}</span>
                                        </div>
                                        <div class="card-x">❌</div>
                                    </div>
                                }
                            </div>
                        </div>
                    }
                </div>

                <div class="footer-section">
                    @if (!winner() && !isPreview()) {
                        <button (click)="startAnimation()" [disabled]="spinning()" class="start-btn">
                            <span class="btn-text">
                                @if (spinning()) {
                                    ⚡ ¡MUCHA SUERTE!
                                } @else {
                                    {{ turnNumbers().length > 0 ? '✨ ¡MOSTRAR LUGARES!' : '✨ ¡INICIAR SORTEO!' }}
                                }
                            </span>
                        </button>
                    }
                </div>
            </div>

            <!-- Full Screen Winner Reveal Overlay -->
            @if (winner() && !summaryMode()) {
                <div class="winner-overlay" #winnerDisplay>
                    <div class="winner-card">
                        <div class="sparkles-bg"></div>
                        <p class="winner-badge">
                           @if (currentWinnerNames().length > 1) {
                              Lugar asignado # {{ getTurnNumber(currentWinnerIndex()) }}
                           } @else {
                              🏆 ¡TENEMOS GANADORA! 🏆
                           }
                        </p>
                        <h3 class="winner-name-final">{{ winner()!.name }}</h3>
                        <div class="winner-stars">✨✨✨✨✨</div>
                        @if (currentWinnerIndex() < currentWinnerNames().length - 1) {
                            <button (click)="nextWinner()" class="continue-btn">CONTINUAR SORTEO</button>
                        } @else {
                            <button (click)="handleClose()" class="continue-btn">FINALIZAR</button>
                        }
                    </div>
                </div>
            }

            <!-- Summary Mode Overlay -->
            @if (summaryMode()) {
                <div class="winner-overlay" #summaryDisplay>
                    <div class="summary-card">
                        <div class="sparkles-bg"></div>
                        <p class="winner-badge mb-2">✨ RESULTADO FINAL ✨</p>
                        <h3 class="summary-title mb-6">
                            {{ turnNumbers().length > 0 ? 'Orden de lugares definido al crear la tanda' : 'Todos los lugares han sido asignados' }}
                        </h3>
                        
                        <div class="summary-list scrollbar-hide">
                            @for (name of currentWinnerNames(); track $index) {
                                <div class="summary-item">
                                    <div class="turn-bubble">#{{ getTurnNumber($index) }}</div>
                                    <div class="name-label">{{ name }}</div>
                                </div>
                            }
                        </div>

                        <button (click)="handleClose()" class="continue-btn mt-6 w-full">FINALIZAR Y VOLVER</button>
                    </div>
                </div>
            }
        </div>

        <style>
            /* ... previous styles ... */
            .winner-overlay {
                position: fixed;
                inset: 0;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0,0,0,0.85);
                backdrop-filter: blur(15px);
                animation: fadeIn 0.5s ease-out forwards;
                pointer-events: all;
            }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

            .winner-card {
                position: relative;
                background: linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05));
                border: 2px solid rgba(255,255,255,0.3);
                padding: 4rem 6rem;
                border-radius: 4rem;
                text-align: center;
                box-shadow: 0 40px 100px rgba(0,0,0,0.8), 0 0 50px rgba(236, 72, 153, 0.3);
                transform: scale(0.8);
                animation: popIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                overflow: hidden;
            }
            @keyframes popIn { to { transform: scale(1); } }

            .sparkles-bg {
                position: absolute;
                inset: 0;
                background-image: radial-gradient(circle, white 1px, transparent 1px);
                background-size: 20px 20px;
                opacity: 0.1;
                animation: rotateBg 20s linear infinite;
                pointer-events: none;
            }
            @keyframes rotateBg { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

            .winner-badge {
                color: #fbbf24;
                font-weight: 900;
                font-size: 1.2rem;
                letter-spacing: 0.5em;
                margin-bottom: 2rem;
                text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
            }

            .winner-name-final {
                color: white;
                font-size: 6rem;
                font-weight: 950;
                line-height: 1;
                margin-bottom: 2rem;
                text-shadow: 0 0 30px rgba(255,255,255,0.5);
                letter-spacing: -2px;
            }

            .winner-stars { font-size: 2rem; margin-bottom: 3rem; color: #fbbf24; pointer-events: none; }

            /* Summary Styles */
            .summary-card {
                position: relative;
                background: linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.02));
                border: 2px solid rgba(255,255,255,0.3);
                padding: 3rem;
                border-radius: 3rem;
                text-align: center;
                box-shadow: 0 40px 100px rgba(0,0,0,0.8), 0 0 50px rgba(236, 72, 153, 0.3);
                width: 90%;
                max-width: 500px;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                animation: popIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                overflow: hidden;
            }

            .summary-title {
                color: white;
                font-size: 1.5rem;
                font-weight: 800;
                text-shadow: 0 0 10px rgba(255,255,255,0.5);
            }

            .summary-list {
                flex: 1;
                overflow-y: auto;
                background: rgba(0,0,0,0.3);
                border-radius: 2rem;
                padding: 1.5rem;
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }

            .summary-item {
                display: flex;
                align-items: center;
                gap: 1rem;
                background: rgba(255,255,255,0.1);
                padding: 0.75rem 1.5rem;
                border-radius: 999px;
                animation: fadeIn 0.5s ease forwards;
            }

            .turn-bubble {
                background: #ec4899;
                color: white;
                font-weight: 900;
                padding: 0.25rem 0.75rem;
                border-radius: 999px;
                font-size: 0.9rem;
                min-width: 3rem;
                text-align: center;
                box-shadow: 0 0 15px rgba(236, 72, 153, 0.5);
            }

            .name-label {
                color: white;
                font-weight: 800;
                font-size: 1.1rem;
                text-align: left;
                flex: 1;
            }

            .center-logo {
                width: 80%;
                height: 80%;
                object-fit: contain;
                z-index: 10;
                filter: drop-shadow(0 0 10px rgba(255,255,255,0.8));
                border-radius: 50%;
            }

            .continue-btn {
                background: white;
                color: black;
                border: none;
                padding: 1rem 3rem;
                border-radius: 2rem;
                font-weight: 900;
                cursor: pointer;
                transition: all 0.3s;
                letter-spacing: 0.1em;
            }
            .continue-btn:hover { background: #ec4899; color: white; transform: translateY(-3px); }

            .arena-overlay {
                position: fixed;
                inset: 0;
                z-index: 9999;
                background: #050005;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Inter', sans-serif;
                overflow: hidden;
            }
            .arena-overlay.preview-mode {
                position: relative;
                width: 100%;
                height: 400px;
                background: transparent;
                z-index: 1;
            }
            .cinematic-bg {
                position: absolute;
                inset: 0;
                background: radial-gradient(circle at center, rgba(131, 24, 67, 0.4) 0%, black 70%);
                animation: pulse 8s infinite alternate;
            }
            @keyframes pulse {
                0% { opacity: 0.5; transform: scale(1); }
                100% { opacity: 0.8; transform: scale(1.1); }
            }
            .close-btn {
                position: absolute;
                top: 2rem;
                right: 2rem;
                background: none;
                border: none;
                color: rgba(236, 72, 153, 0.5);
                font-size: 3rem;
                cursor: pointer;
                transition: all 0.3s;
                z-index: 100;
            }
            .close-btn:hover { color: #ec4899; transform: rotate(90deg); }
            
            .arena-content {
                position: relative;
                z-index: 10;
                width: 100%;
                max-width: 1000px;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 2rem;
            }
            
            .header-section { text-align: center; margin-bottom: 3rem; }
            .presents {
                color: #ec4899;
                text-transform: uppercase;
                letter-spacing: 0.5em;
                font-size: 0.75rem;
                font-weight: 900;
            }
            .main-title {
                color: white;
                font-size: 4rem;
                font-weight: 900;
                margin-top: 0.5rem;
                text-shadow: 0 0 20px rgba(236, 72, 153, 0.5);
            }
            
            .animation-workspace {
                width: 100%;
                height: 500px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            /* Roulette Styles */
            .roulette-container {
                position: relative;
                width: 500px;
                height: 500px;
            }
            .roulette-pointer {
                position: absolute;
                top: -20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 50;
                filter: drop-shadow(0 0 10px white);
            }
            .roulette-glow {
                position: absolute;
                inset: -20px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(236, 72, 153, 0.2) 0%, transparent 70%);
                animation: glowPulse 2s infinite;
            }
            @keyframes glowPulse {
                0%, 100% { transform: scale(1); opacity: 0.5; }
                50% { transform: scale(1.05); opacity: 0.8; }
            }
            .canvas-wrapper {
                position: relative;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                padding: 10px;
                background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
                backdrop-filter: blur(10px);
                box-shadow: 0 0 50px rgba(0,0,0,0.5);
            }
            canvas {
                width: 100%;
                height: 100%;
                border-radius: 50%;
            }
            .center-piece {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 100px;
                height: 100px;
                background: white;
                border-radius: 50%;
                border: 8px solid rgba(236, 72, 153, 0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 30;
                box-shadow: 0 0 30px rgba(0,0,0,0.3);
            }
            .center-emoji { font-size: 3rem; animation: bounce 2s infinite; }
            @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

            /* Slot Styles */
            .slot-machine {
                display: flex;
                gap: 1.5rem;
                background: #111;
                padding: 2rem;
                border-radius: 3rem;
                border: 8px solid #222;
                box-shadow: 0 0 50px rgba(236, 72, 153, 0.2);
            }
            .slot-column {
                width: 150px;
                height: 250px;
                background: black;
                border-radius: 1.5rem;
                overflow: hidden;
                position: relative;
                border: 1px solid rgba(255,255,255,0.1);
            }
            .slot-strip { position: absolute; top: 0; left: 0; width: 100%; }
            .slot-item {
                height: 250px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 900;
                font-size: 1.5rem;
                text-align: center;
                padding: 1rem;
            }
            .slot-overlay {
                position: absolute;
                inset: 0;
                background: linear-gradient(to bottom, black, transparent 20%, transparent 80%, black);
                pointer-events: none;
            }

            /* Elimination Styles */
            .elimination-container {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1rem;
            }
            .elimination-grid {
                display: grid;
                gap: 0.25rem;
                width: 100%;
                max-width: 1000px;
                height: 100%;
                justify-content: center;
                align-content: center;
            }
            .elimination-card {
                position: relative;
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 0.5rem;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s;
                overflow: hidden;
                width: 100%;
            }
            .card-inner { z-index: 2; padding: 2px; text-align: center; }
            .card-name { color: white; font-weight: 700; line-height: 1; }
            .card-x {
                position: absolute;
                inset: 0;
                background: rgba(236, 72, 153, 0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
                color: white;
                opacity: 0;
                transform: scale(2);
                transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                z-index: 5;
            }
            .elimination-card.eliminated {
                opacity: 0.3;
                filter: grayscale(1);
                transform: scale(0.9);
            }
            .elimination-card.eliminated .card-x {
                opacity: 1;
                transform: scale(1);
            }
            .elimination-card.winner-candidate {
                border-color: #fbbf24;
                box-shadow: 0 0 20px #fbbf24;
                transform: scale(1.1);
                z-index: 10;
                background: rgba(251, 191, 36, 0.2);
            }

            /* Footer Styles */
            .footer-section { margin-top: 4rem; height: 150px; display: flex; align-items: center; }
            .start-btn {
                padding: 1.5rem 4rem;
                border-radius: 5rem;
                background: white;
                color: black;
                font-size: 1.5rem;
                font-weight: 900;
                border: none;
                cursor: pointer;
                box-shadow: 0 15px 40px rgba(236, 72, 153, 0.3);
                transition: all 0.3s;
            }
            .start-btn:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 20px 50px rgba(236, 72, 153, 0.5); }
            .start-btn:disabled { opacity: 0.5; cursor: default; }
        </style>
    `
})
export class RaffleAnimationComponent implements AfterViewInit, OnDestroy {
    participants = input<Participant[]>([]);
    winnerNames = input<string[]>([]);
    turnNumbers = input<number[]>([]);
    animationType = input<'roulette' | 'slot' | 'elimination' | 'confetti'>('roulette');
    rouletteColors = input<string[]>(['#ec4899', '#be185d', '#831843', '#fbbf24', '#f472b6']);
    isPreview = input<boolean>(false);
    customTitle = input<string | undefined>();
    
    close = output<void>();
    startRequested = output<void>();

    spinning = signal(false);
    requesting = signal(false);
    winner = signal<Participant | null>(null);

    currentWinnerNames = signal<string[]>([]);
    currentWinnerIndex = signal(0);
    activeParticipants = signal<Participant[]>([]);
    summaryMode = signal<boolean>(false);

    @ViewChild('rouletteCanvas') rouletteCanvas?: ElementRef<HTMLCanvasElement>;
    @ViewChild('winnerDisplay') winnerDisplay?: ElementRef;
    
    private canvasCtx: CanvasRenderingContext2D | null = null;
    rotation = 0;
    private itemsCache: { [col: number]: string[] } = {};
    tickerActive = false;
    audioContext?: AudioContext;
    tickBuffer?: AudioBuffer;
    winnerBuffer?: AudioBuffer;
    private particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];

    constructor() {
        effect(() => {
            // Trigger redraw when these signals change
            this.participants();
            this.activeParticipants();
            const type = this.animationType();
            
            if (type === 'roulette') {
                setTimeout(() => {
                    this.initCanvas();
                    this.drawWheel();
                }, 100);
            }
        });
    }

    private initAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    private playTickSound() {
        if (!this.audioContext) return;
        try {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.frequency.value = 800 + Math.random() * 400;
            gain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);
            osc.start(this.audioContext.currentTime);
            osc.stop(this.audioContext.currentTime + 0.05);
        } catch (e) { }
    }

    private playWinnerSound() {
        if (!this.audioContext) return;
        try {
            const notes = [523, 659, 784, 1047];
            notes.forEach((freq, i) => {
                const osc = this.audioContext!.createOscillator();
                const gain = this.audioContext!.createGain();
                osc.connect(gain);
                gain.connect(this.audioContext!.destination);
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.15, this.audioContext!.currentTime + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext!.currentTime + i * 0.1 + 0.3);
                osc.start(this.audioContext!.currentTime + i * 0.1);
                osc.stop(this.audioContext!.currentTime + i * 0.1 + 0.3);
            });
        } catch (e) { }
    }

    private addParticle(x: number, y: number, color: string) {
        this.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10 - 3,
            life: 1,
            color
        });
    }

    private updateParticles() {
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2;
            p.life -= 0.02;
            return p.life > 0;
        });
    }

    private drawParticles(ctx: CanvasRenderingContext2D) {
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    ngAfterViewInit() {
        if (this.animationType() === 'roulette') {
            this.initCanvas();
        }
        if (this.isPreview()) {
            this.startPreviewLoop();
        }
    }

    private initCanvas() {
        if (!this.rouletteCanvas) return;
        const canvas = this.rouletteCanvas.nativeElement;
        this.canvasCtx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const size = canvas.clientWidth || 500;
        
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        if (this.canvasCtx) {
            this.canvasCtx.scale(dpr, dpr);
        }
        this.drawWheel();
    }

    private drawWheel() {
        if (!this.canvasCtx || !this.rouletteCanvas) return;
        const ctx = this.canvasCtx;
        const size = this.rouletteCanvas.nativeElement.width / (window.devicePixelRatio || 1);
        const center = size / 2;
        const radius = center - 10;
        
        ctx.clearRect(0, 0, size, size);
        
        const participants = this.getRouletteParticipants();
        const total = participants.length;
        const sliceAngle = (Math.PI * 2) / total;
        const colors = this.rouletteColors();

        participants.forEach((p, i) => {
            const startAngle = i * sliceAngle + this.rotation;
            const endAngle = (i + 1) * sliceAngle + this.rotation;
            
            ctx.beginPath();
            ctx.moveTo(center, center);
            ctx.arc(center, center, radius, startAngle, endAngle);
            ctx.closePath();
            
            ctx.fillStyle = colors[i % colors.length];
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.save();
            ctx.translate(center, center);
            ctx.rotate(startAngle + sliceAngle / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = 'white';
            ctx.font = `bold ${this.getFontSizePx(total)}px "Inter", sans-serif`;
            ctx.fillText(p.name.substring(0, 12), radius - 25, 5);
            ctx.restore();
        });

        // Outer glow ring
        ctx.beginPath();
        ctx.arc(center, center, radius + 5, 0, Math.PI * 2);
        const glowGrad = ctx.createRadialGradient(center, center, radius, center, center, radius + 30);
        glowGrad.addColorStop(0, 'rgba(236, 72, 153, 0.3)');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.fill();

        // Rim
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 6;
        ctx.stroke();

        // Inner decorative ring
        ctx.beginPath();
        ctx.arc(center, center, radius - 20, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw particles
        this.drawParticles(ctx);

        // Center piece with REGI BAZAR
        ctx.beginPath();
        ctx.arc(center, center, 45, 0, Math.PI * 2);
        const centerGrad = ctx.createRadialGradient(center, center, 0, center, center, 45);
        centerGrad.addColorStop(0, '#ffffff');
        centerGrad.addColorStop(1, '#fce7f3');
        ctx.fillStyle = centerGrad;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(center, center, 45, 0, Math.PI * 2);
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 4;
        ctx.stroke();

        // REGI BAZAR text
        ctx.fillStyle = '#ec4899';
        ctx.font = '900 8px "Poppins", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('REGI', center, center - 6);
        ctx.font = '900 8px "Poppins", sans-serif';
        ctx.fillText('BAZAR', center, center + 6);
    }

    private getFontSizePx(total: number): number {
        if (total > 20) return 12;
        if (total > 12) return 16;
        return 22;
    }

    private startPreviewLoop() {
        this.tickerActive = true;
        const tick = () => {
            if (!this.tickerActive) return;
            this.rotation += 0.005;
            this.drawWheel();
            requestAnimationFrame(tick);
        };
        tick();
    }

    getRouletteParticipants() {
        const source = this.activeParticipants().length > 0 ? this.activeParticipants() : this.participants();
        if (source.length === 0) return [{id: '1', name: 'Participante 1'}, {id: '2', name: 'Participante 2'}];
        return source.slice(0, 100);
    }

    getSlotItems(col: number): string[] {
        if (this.itemsCache[col]) return this.itemsCache[col];
        const source = this.activeParticipants().length > 0 ? this.activeParticipants() : this.participants();
        const names = source.length > 0 ? source.map(p => p.name) : ['Ana', 'Maria', 'Sofia'];
        const decorations = ['💎', '✨', '💖', '⭐', '🌈', '🎀'];
        const items = [];
        for (let i = 0; i < 60; i++) {
            if (i % 3 === 0) items.push(decorations[Math.floor(Math.random() * decorations.length)]);
            else items.push(names[Math.floor(Math.random() * names.length)]);
        }
        this.itemsCache[col] = items;
        return items;
    }

    startAnimation(emitRequest = true) {
        if (this.spinning() || this.isPreview()) return;
        this.spinning.set(true);
        this.requesting.set(emitRequest);
        this.winner.set(null);
        this.tickerActive = true;

        if (this.animationType() === 'roulette') {
            const obj = { speed: 0 };
            gsap.to(obj, { speed: 0.2, duration: 1, ease: "power2.in" });

            const tick = () => {
                if (!this.tickerActive) return;
                this.rotation += obj.speed;
                this.drawWheel();
                // Usamos tickerActive en lugar de requesting() para permitir giro continuo local
                if (this.tickerActive) requestAnimationFrame(tick);
            };
            tick();
        } else if (this.animationType() === 'slot') {
            for (let i = 0; i < 3; i++) {
                const strip = document.getElementById('strip-' + i);
                if (strip) {
                    // Constant infinite velocity using top or transform loop
                    gsap.to(strip, { 
                        y: -5000, 
                        duration: 1.5, 
                        repeat: -1, 
                        ease: "none"
                    });
                    gsap.to(strip, { filter: "blur(8px)", duration: 0.3 });
                }
            }
        }

        if (emitRequest) {
            this.startRequested.emit();
        }
    }

    setWinnerAndStart(winnerNames: string[]) {
        this.currentWinnerNames.set(winnerNames);
        this.currentWinnerIndex.set(0);
        this.summaryMode.set(false);
        this.winner.set(null);
        this.activeParticipants.set([...this.participants()]);

        this.spinForCurrentIndex();
    }

    private spinForCurrentIndex() {
        this.requesting.set(false);
        this.tickerActive = false;

        // Skip animation for the very last participant to save time, unless it's a 1-winner raffle
        if (this.currentWinnerNames().length > 1 && this.currentWinnerIndex() === this.currentWinnerNames().length - 1) {
            this.showSummary();
            return;
        }

        if (this.currentWinnerIndex() >= this.currentWinnerNames().length) return;

        const winnerName = this.currentWinnerNames()[this.currentWinnerIndex()];
        const type = this.animationType();
        if (type === 'roulette') {
            this.spinRouletteFinal(winnerName);
        } else if (type === 'slot') {
            this.spinSlotFinal(winnerName);
        } else if (type === 'elimination') {
            this.spinElimination(winnerName);
        } else {
            this.showWinner(winnerName);
        }
    }

    nextWinner() {
        const lastWinner = this.winner()!.name;
        let removed = false;
        const remaining = this.activeParticipants().filter(participant => {
            if (!removed && participant.name === lastWinner) {
                removed = true;
                return false;
            }

            return true;
        });
        this.activeParticipants.set(remaining);
        
        this.winner.set(null);
        this.currentWinnerIndex.set(this.currentWinnerIndex() + 1);
        
        this.startAnimation(false);
        
        setTimeout(() => {
            this.spinForCurrentIndex();
        }, 1500);
    }

    getTurnNumber(index: number): number {
        return this.turnNumbers()[index] ?? index + 1;
    }

    private spinRouletteFinal(winnerName: string) {
        const participants = this.getRouletteParticipants();
        const winnerIndex = participants.findIndex(p => p.name === winnerName);
        if (winnerIndex === -1) {
            this.showWinner(winnerName);
            return;
        }

        this.initAudio();
        
        const total = participants.length;
        const sliceAngle = (Math.PI * 2) / total;
        const targetRotation = -Math.PI/2 - (winnerIndex * sliceAngle + sliceAngle/2);
        
        // Cálculo matemático ultra-preciso para garantizar que caiga en el centro exacto del gajo
        const spins = 18; // 18 vueltas para el suspenso ideal
        
        // El targetRotation ya apunta al centro del gajo del ganador (calculado arriba)
        // Normalizamos la rotación actual para que el cálculo de distancia sea limpio
        let currentRotation = this.rotation;
        let normalizedCurrent = currentRotation % (Math.PI * 2);
        if (normalizedCurrent < 0) normalizedCurrent += Math.PI * 2;

        let normalizedTarget = targetRotation % (Math.PI * 2);
        if (normalizedTarget < 0) normalizedTarget += Math.PI * 2;

        let distance = normalizedTarget - normalizedCurrent;
        // Si el giro es hacia atrás o muy corto, forzamos que sea hacia adelante
        if (distance <= 0) distance += Math.PI * 2;
        
        const finalRotation = currentRotation + (spins * Math.PI * 2) + distance;

        let tickCount = 0;
        const obj = { r: currentRotation };
        const colors = ['#ec4899', '#f472b6', '#fbbf24', '#ffffff'];
        
        this.playTickSound();

        gsap.to(obj, {
            r: finalRotation,
            duration: 14, // 14 segundos de elegancia y suspenso
            ease: "power4.out", // Desaceleración suave de alta fidelidad
            onUpdate: () => {
                this.rotation = obj.r;
                this.drawWheel();
                
                tickCount++;
                // Los tics se sincronizan visualmente con el giro
                if (tickCount % 5 === 0) {
                    this.playTickSound();
                }
            },
            onComplete: () => {
                // Forzamos la rotación final exacta para fidelidad absoluta
                this.rotation = finalRotation;
                this.drawWheel();
                this.showWinner(winnerName);
            }
        });
    }

    private spinSlotFinal(winnerName: string) {
        this.initAudio();
        
        for (let i = 0; i < 3; i++) {
            const strip = document.getElementById('strip-' + i);
            if (!strip) continue;
            
            gsap.killTweensOf(strip);
            
            const items = this.getSlotItems(i);
            const targetIndex = 45;
            items[targetIndex] = winnerName;

            gsap.set(strip, { y: 0, filter: "blur(10px)" });
            
            gsap.to(strip, {
                y: -(targetIndex * 250),
                duration: 3 + (i * 0.8),
                ease: "expo.out",
                onStart: () => {
                    this.playTickSound();
                },
                onUpdate: () => {
                    if (Math.random() > 0.7) {
                        this.playTickSound();
                    }
                },
                onComplete: () => { 
                    gsap.to(strip, { filter: "blur(0px)", duration: 0.3 });
                    if (i === 2) {
                        setTimeout(() => {
                            this.playWinnerSound();
                            this.showWinner(winnerName);
                        }, 500);
                    }
                }
            });
        }
    }

    private spinElimination(winnerName: string) {
        const participants = this.participants();
        const winner = participants.find(p => p.name === winnerName);
        const others = participants.filter(p => p.name !== winnerName);
        
        // Shuffle others to eliminate randomly
        const toEliminate = others.sort(() => Math.random() - 0.5);
        
        const timeline = gsap.timeline({
            onComplete: () => {
                const winnerCard = document.getElementById('p-' + (winner?.id || '0'));
                if (winnerCard) winnerCard.classList.add('winner-candidate');
                setTimeout(() => this.showWinner(winnerName), 1000);
            }
        });

        const total = toEliminate.length;
        toEliminate.forEach((p, i) => {
            const card = document.getElementById('p-' + p.id);
            if (card) {
                // Adjust speed: faster at start, slower at end
                const delay = i * Math.max(0.05, (0.5 * (i / total)));
                timeline.to({}, { duration: 0.1 }, delay);
                timeline.call(() => {
                    card.classList.add('eliminated');
                    // Small camera shake or sound effect feel
                    gsap.to('.elimination-grid', { x: 5, duration: 0.05, yoyo: true, repeat: 1 });
                }, [], delay);
            }
        });
    }

    showWinner(name: string) {
        const p = this.participants().find(x => x.name === name) || { id: '0', name };
        this.winner.set(p);
        this.spinning.set(false);
        
        setTimeout(() => {
            if (this.winnerDisplay) {
                gsap.fromTo(this.winnerDisplay.nativeElement, 
                    { scale: 0.5, opacity: 0 },
                    { scale: 1, opacity: 1, duration: 1, ease: "elastic.out" }
                );
                
                // Cinematic Confetti Sequence
                const duration = 5 * 1000;
                const animationEnd = Date.now() + duration;
                const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

                const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

                const interval: any = setInterval(() => {
                    const timeLeft = animationEnd - Date.now();

                    if (timeLeft <= 0) {
                        return clearInterval(interval);
                    }

                    const particleCount = 50 * (timeLeft / duration);
                    // since particles fall down, start a bit higher than random
                    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
                }, 250);

                // Initial Big Bursts
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#ec4899', '#fbbf24', '#ffffff'] });
                setTimeout(() => {
                    confetti({ particleCount: 100, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#ec4899', '#ffffff'] });
                    confetti({ particleCount: 100, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#fbbf24', '#ffffff'] });
                }, 400);
            }
        }, 100);
    }

    showSummary() {
        this.winner.set(null);
        this.spinning.set(false);
        this.tickerActive = false;
        this.summaryMode.set(true);
        this.playWinnerSound();

        setTimeout(() => {
            // Cinematic Confetti Sequence for Summary
            const duration = 3 * 1000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
            const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

            const interval: any = setInterval(() => {
                const timeLeft = animationEnd - Date.now();
                if (timeLeft <= 0) return clearInterval(interval);

                const particleCount = 50 * (timeLeft / duration);
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
            }, 250);

            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#ec4899', '#fbbf24', '#ffffff'] });
        }, 100);
    }

    handleClose() {
        this.tickerActive = false;
        this.close.emit();
    }

    getGridColumns(): string {
        const total = this.participants().length;
        if (total <= 12) return 'repeat(3, 1fr)';
        if (total <= 24) return 'repeat(4, 1fr)';
        if (total <= 40) return 'repeat(6, 1fr)';
        if (total <= 80) return 'repeat(8, 1fr)';
        return 'repeat(10, 1fr)';
    }

    getCardHeight(): string {
        const total = this.participants().length;
        if (total <= 12) return '80px';
        if (total <= 40) return '45px';
        if (total <= 80) return '30px';
        return '25px';
    }

    getFontSize(): string {
        const total = this.participants().length;
        if (total <= 12) return '1rem';
        if (total <= 40) return '0.75rem';
        if (total <= 80) return '0.6rem';
        return '0.5rem';
    }

    ngOnDestroy() {
        this.tickerActive = false;
    }
}
