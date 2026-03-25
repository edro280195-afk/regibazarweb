import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AiInsight, GlowUpReportDto } from '../../../core/models';

interface CamiAlert {
  type: string;
  message: string;
  icon: string;
  relatedId?: number;
}

@Component({
  selector: 'app-glow-up',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6 pb-20">
      <!-- Header -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-black text-pink-900 tracking-tighter flex items-center gap-3">
            ✨ <span style="font-family: 'Dancing Script', cursive; color: #ec4899;">Glow Up</span>
          </h1>
          <p class="text-sm text-pink-400 mt-1 font-semibold">Business Intelligence · Análisis con C.A.M.I.</p>
        </div>
        <button class="btn-coquette btn-pink flex items-center gap-2 text-sm"
                (click)="refresh()" [disabled]="loading()">
          @if (loading()) {
            <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          } @else {
            <span>✦</span>
          }
          {{ loading() ? 'Analizando...' : 'Actualizar' }}
        </button>
      </div>

      @if (loading() && !insights().length && !alerts().length) {
        <!-- Loading State -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (i of [1,2,3,4]; track i) {
            <div class="shimmer h-40 rounded-2xl"></div>
          }
        </div>
      }

      <!-- Proactive Alerts -->
      @if (alerts().length > 0) {
        <div class="card-coquette p-6" style="background: linear-gradient(135deg, rgba(255,251,235,0.95), rgba(255,237,213,0.95)); border: 1px solid rgba(251,146,60,0.2);">
          <h2 class="text-base font-black text-orange-900 mb-4 flex items-center gap-2">
            🚨 Alertas del negocio
          </h2>
          <div class="space-y-3">
            @for (alert of alerts(); track alert.type) {
              <div class="flex items-start gap-3 p-3 bg-white/60 rounded-xl border border-orange-100">
                <span class="text-xl shrink-0">{{ alert.icon }}</span>
                <p class="text-sm text-orange-800 font-medium leading-relaxed">{{ alert.message }}</p>
              </div>
            }
          </div>
        </div>
      }

      <!-- Monthly Stats -->
      @if (glowUp()) {
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="card-coquette p-5 text-center">
            <p class="text-3xl font-black text-pink-600">{{ glowUp()!.totalDeliveries }}</p>
            <p class="text-xs text-pink-400 font-semibold mt-1 uppercase tracking-wider">Entregas del mes</p>
          </div>
          <div class="card-coquette p-5 text-center">
            <p class="text-3xl font-black text-purple-600">{{ glowUp()!.newClients }}</p>
            <p class="text-xs text-purple-400 font-semibold mt-1 uppercase tracking-wider">Clientas nuevas</p>
          </div>
          <div class="card-coquette p-5 text-center col-span-2">
            <p class="text-lg font-black text-indigo-700 truncate" title="{{ glowUp()!.topProduct }}">{{ glowUp()!.topProduct }}</p>
            <p class="text-xs text-indigo-400 font-semibold mt-1 uppercase tracking-wider">Producto estrella</p>
          </div>
        </div>
      }

      <!-- AI Insights -->
      @if (insights().length > 0) {
        <div>
          <h2 class="text-base font-black text-pink-900 mb-4 flex items-center gap-2">
            ✦ Análisis estratégico de C.A.M.I.
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (insight of insights(); track insight.title) {
              <div class="card-coquette p-5 hover:shadow-lg transition-shadow"
                   [style.border-left]="'4px solid ' + getCategoryColor(insight.category)">
                <div class="flex items-start gap-3">
                  <span class="text-2xl shrink-0">{{ insight.icon }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                            [style.background]="getCategoryBg(insight.category)"
                            [style.color]="getCategoryColor(insight.category)">
                        {{ insight.category }}
                      </span>
                    </div>
                    <h3 class="text-sm font-bold text-pink-900 leading-snug mb-1">{{ insight.title }}</h3>
                    <p class="text-xs text-pink-700 leading-relaxed mb-3">{{ insight.description }}</p>
                    <div class="bg-pink-50 rounded-xl p-3 border border-pink-100">
                      <p class="text-[11px] font-bold text-pink-600 uppercase tracking-wider mb-1">Acción recomendada</p>
                      <p class="text-xs text-pink-800 leading-relaxed">{{ insight.actionableAdvice }}</p>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      }

      @if (!loading() && !insights().length && !alerts().length) {
        <div class="card-coquette p-12 text-center">
          <div class="text-6xl mb-4">✨</div>
          <h2 class="text-lg font-bold text-pink-900 mb-2">Listo para el análisis</h2>
          <p class="text-sm text-pink-400 mb-6">Presiona "Actualizar" para que C.A.M.I. analice el rendimiento del negocio este mes.</p>
          <button class="btn-coquette btn-pink" (click)="refresh()">✦ Iniciar análisis</button>
        </div>
      }
    </div>
  `
})
export class GlowUpComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(false);
  insights = signal<AiInsight[]>([]);
  alerts = signal<CamiAlert[]>([]);
  glowUp = signal<GlowUpReportDto | null>(null);

  ngOnInit(): void {
    this.loadAlerts();
    this.loadGlowUp();
  }

  private loadAlerts(): void {
    this.api.getCamiAlerts().subscribe({
      next: (a) => this.alerts.set(a),
      error: () => {}
    });
  }

  private loadGlowUp(): void {
    this.api.getGlowUp().subscribe({
      next: (g) => this.glowUp.set(g),
      error: () => {}
    });
  }

  refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.loadAlerts();
    this.loadGlowUp();

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const end = today.toISOString().split('T')[0];

    this.api.getReports(start, end).subscribe({
      next: (report) => {
        this.api.getReportInsights(report).subscribe({
          next: (ins) => { this.insights.set(ins); this.loading.set(false); },
          error: () => { this.loading.set(false); this.toast.error('Error generando insights'); }
        });
      },
      error: () => { this.loading.set(false); this.toast.error('Error cargando reporte'); }
    });
  }

  getCategoryColor(cat: string): string {
    const map: Record<string, string> = {
      'Finanzas': '#16a34a', 'Ventas': '#ec4899', 'Clientas': '#9333ea',
      'Riesgo': '#dc2626', 'Operación': '#2563eb'
    };
    return map[cat] || '#ec4899';
  }

  getCategoryBg(cat: string): string {
    const map: Record<string, string> = {
      'Finanzas': '#f0fdf4', 'Ventas': '#fdf2f8', 'Clientas': '#faf5ff',
      'Riesgo': '#fef2f2', 'Operación': '#eff6ff'
    };
    return map[cat] || '#fdf2f8';
  }
}
