import { Component, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { GlowUpReportDto } from '../../../../shared/models/models';
import html2canvas from 'html2canvas';

@Component({
    selector: 'app-glow-up',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="glow-page">
      <div class="page-header">
        <h1>✨ Glow Up Report</h1>
        <p class="sub">Tu resumen mensual estilo Instagram Story</p>
      </div>

      @if (loading()) {
        <div class="loading">
          <div class="spinner">🎀</div>
          <p>Preparando tu Glow Up...</p>
        </div>
      } @else if (data()) {
        <div class="story-wrapper">
          <!-- ═══ CAPTURE AREA (IG Story 9:16) ═══ -->
          <div class="story-card" #captureArea>
            <div class="bg-shapes">
              <div class="shape s1"></div>
              <div class="shape s2"></div>
              <div class="shape s3"></div>
            </div>
            <div class="sparkles">
              <span class="sparkle sp1">✦</span>
              <span class="sparkle sp2">✨</span>
              <span class="sparkle sp3">✦</span>
              <span class="sparkle sp4">✨</span>
              <span class="sparkle sp5">✦</span>
              <span class="sparkle sp6">✨</span>
              <span class="sparkle sp7">✦</span>
              <span class="sparkle sp8">✧</span>
            </div>

            <div class="story-content">
              <!-- HEADER -->
              <div class="story-header">
                <span class="header-badge">Regi Bazar</span>
                <h2 class="month-title">{{ data()!.monthName }}</h2>
                <p class="month-sub">Glow Up Report ✨</p>
              </div>

              <!-- METRICS -->
              <div class="metrics">
                <div class="metric-card">
                  <span class="metric-number">{{ data()!.totalDeliveries }}</span>
                  <span class="metric-label">Dosis de felicidad<br>entregadas 📦</span>
                </div>
                <div class="metric-card">
                  <span class="metric-number">{{ data()!.newClients }}</span>
                  <span class="metric-label">Nuevas clientas que<br>confiaron en nosotras 💖</span>
                </div>
                <div class="metric-card highlight">
                  <span class="metric-tag">El favorito del mes ✨</span>
                  <span class="metric-product">{{ data()!.topProduct }}</span>
                </div>
              </div>

              <!-- FOOTER -->
              <div class="story-footer">
                <p class="footer-text">
                  Gracias por dejarnos ser parte de sus días.<br>
                  Cada entrega va llena de cariño.
                </p>
                <span class="footer-brand">— Regi Bazar</span>
              </div>
            </div>
          </div>

          <!-- DOWNLOAD BUTTON -->
          <button class="download-btn" (click)="downloadStory()" [disabled]="downloading()">
            @if (downloading()) {
              ⏳ Generando imagen...
            } @else {
              📸 Descargar para Instagram Story
            }
          </button>
        </div>
      }
    </div>
  `,
    styles: [`
    :host { display: block; }

    .glow-page {
      max-width: 600px;
      margin: 0 auto;
      font-family: var(--font-body, 'Segoe UI', Roboto, sans-serif);
    }

    .page-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .page-header h1 {
      margin: 0;
      font-size: 1.6rem;
      color: var(--text-dark, #1f2937);
    }
    .sub {
      color: var(--text-muted, #9ca3af);
      font-size: 0.85rem;
      margin: 4px 0 0;
    }

    .loading {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 300px; gap: 1rem;
    }
    .loading .spinner { font-size: 2rem; animation: spin 1s linear infinite; }
    .loading p { color: var(--text-muted, #9ca3af); }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ═══ STORY WRAPPER ═══ */
    .story-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }

    /* ═══ STORY CARD (9:16 aspect) ═══ */
    .story-card {
      width: 450px;
      height: 800px;
      border-radius: 24px;
      position: relative;
      overflow: hidden;
      background: linear-gradient(155deg, #ff1e7c 0%, #e6347a 20%, #c2185b 40%, #9c1458 60%, #6a0d4b 80%, #3d0a2e 100%);
      box-shadow: 0 20px 60px rgba(194, 24, 91, 0.35), 0 8px 24px rgba(0,0,0,0.2);
    }

    /* Background shapes */
    .bg-shapes { position: absolute; inset: 0; z-index: 0; }
    .shape {
      position: absolute;
      border-radius: 50%;
      opacity: 0.08;
      background: white;
    }
    .s1 { width: 300px; height: 300px; top: -60px; right: -80px; }
    .s2 { width: 200px; height: 200px; bottom: 100px; left: -60px; }
    .s3 { width: 150px; height: 150px; bottom: -30px; right: 40px; opacity: 0.05; }

    /* Sparkles */
    .sparkles { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
    .sparkle {
      position: absolute;
      color: rgba(255,255,255,0.3);
      font-size: 1.2rem;
      animation: twinkle 3s ease-in-out infinite;
    }
    .sp1 { top: 8%; left: 12%; font-size: 1.4rem; animation-delay: 0s; }
    .sp2 { top: 15%; right: 15%; font-size: 0.9rem; animation-delay: 0.5s; }
    .sp3 { top: 35%; left: 8%; font-size: 0.8rem; animation-delay: 1s; }
    .sp4 { top: 50%; right: 10%; font-size: 1.1rem; animation-delay: 1.5s; }
    .sp5 { bottom: 30%; left: 15%; font-size: 0.7rem; animation-delay: 2s; }
    .sp6 { bottom: 18%; right: 20%; font-size: 1rem; animation-delay: 0.8s; }
    .sp7 { top: 70%; left: 5%; font-size: 1.3rem; animation-delay: 1.2s; }
    .sp8 { top: 25%; left: 50%; font-size: 1.5rem; animation-delay: 0.3s; color: rgba(255,255,255,0.15); }

    @keyframes twinkle {
      0%, 100% { opacity: 0.2; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.3); }
    }

    /* ═══ STORY CONTENT ═══ */
    .story-content {
      position: relative;
      z-index: 2;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 48px 32px 36px;
      color: white;
    }

    /* HEADER */
    .story-header {
      text-align: center;
    }
    .header-badge {
      display: inline-block;
      padding: 6px 20px;
      border-radius: 50px;
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 16px;
      border: 1px solid rgba(255,255,255,0.12);
    }
    .month-title {
      font-size: 2.8rem;
      font-weight: 900;
      margin: 8px 0 0;
      letter-spacing: -1px;
      text-shadow: 0 2px 20px rgba(0,0,0,0.15);
      font-family: var(--font-display, 'Playfair Display', Georgia, serif);
    }
    .month-sub {
      font-size: 1rem;
      font-weight: 600;
      opacity: 0.8;
      margin: 4px 0 0;
      letter-spacing: 1px;
    }

    /* METRICS */
    .metrics {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .metric-card {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(12px);
      border-radius: 20px;
      padding: 24px;
      border: 1px solid rgba(255,255,255,0.1);
      text-align: center;
    }
    .metric-number {
      display: block;
      font-size: 3rem;
      font-weight: 900;
      line-height: 1;
      margin-bottom: 8px;
      text-shadow: 0 2px 12px rgba(0,0,0,0.15);
    }
    .metric-label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      opacity: 0.9;
      line-height: 1.4;
      letter-spacing: 0.3px;
    }

    .metric-card.highlight {
      background: rgba(255,255,255,0.18);
      border-color: rgba(255,255,255,0.2);
    }
    .metric-tag {
      display: block;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 8px;
      opacity: 0.8;
    }
    .metric-product {
      display: block;
      font-size: 1.6rem;
      font-weight: 900;
      line-height: 1.2;
      font-family: var(--font-display, 'Playfair Display', Georgia, serif);
    }

    /* FOOTER */
    .story-footer {
      text-align: center;
    }
    .footer-text {
      font-size: 0.78rem;
      line-height: 1.6;
      opacity: 0.75;
      margin: 0 0 8px;
      font-style: italic;
    }
    .footer-brand {
      font-weight: 800;
      font-size: 0.75rem;
      letter-spacing: 1px;
      opacity: 0.6;
    }

    /* ═══ DOWNLOAD BUTTON ═══ */
    .download-btn {
      padding: 16px 36px;
      border-radius: 16px;
      border: none;
      background: linear-gradient(135deg, #ec4899, #be185d);
      color: white;
      font-size: 1rem;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 6px 24px rgba(236,72,153,0.35);
      font-family: var(--font-body, inherit);
    }
    .download-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 32px rgba(236,72,153,0.45);
    }
    .download-btn:disabled {
      opacity: 0.7;
      cursor: wait;
    }

    /* RESPONSIVE */
    @media (max-width: 500px) {
      .story-card {
        width: 100%;
        height: auto;
        aspect-ratio: 9 / 16;
      }
      .story-content { padding: 32px 20px 24px; }
      .month-title { font-size: 2rem; }
      .metric-number { font-size: 2.2rem; }
      .metric-card { padding: 16px; }
      .metric-product { font-size: 1.2rem; }
    }
  `]
})
export class GlowUpComponent implements OnInit {
    @ViewChild('captureArea', { static: false }) captureArea!: ElementRef;

    data = signal<GlowUpReportDto | null>(null);
    loading = signal(true);
    downloading = signal(false);

    constructor(private api: ApiService) { }

    ngOnInit(): void {
        this.api.getGlowUpReport().subscribe({
            next: (d) => {
                this.data.set(d);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
            }
        });
    }

    async downloadStory(): Promise<void> {
        if (!this.captureArea) return;
        this.downloading.set(true);

        try {
            const el = this.captureArea.nativeElement as HTMLElement;
            const canvas = await html2canvas(el, {
                scale: 2,
                useCORS: true,
                backgroundColor: null,
                width: 450,
                height: 800,
            });

            const link = document.createElement('a');
            link.download = `regi-bazar-glowup-${this.data()?.monthName || 'report'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Error generating image:', err);
        } finally {
            this.downloading.set(false);
        }
    }
}
