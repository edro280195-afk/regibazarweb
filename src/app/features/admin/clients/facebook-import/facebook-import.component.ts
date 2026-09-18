import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ClientDto, FacebookImportPreviewItem, FacebookImportRow } from '../../../../core/models';
import { buildMessengerLink } from '../../../../core/utils/messenger.util';

interface ClientLite { id: number; name: string; }

interface ImportDecision {
  item: FacebookImportPreviewItem;
  url: string;
  urlValid: boolean;
  messengerPreview: string | null;
  selectedClientId: number | null;
  include: boolean;
  searching: boolean;
  searchText: string;
}

@Component({
  selector: 'app-facebook-import',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-4 animate-slide-down">
        <div>
          <h1 class="text-2xl font-bold text-pink-900">𝓶 Importar Facebooks</h1>
          <p class="text-sm text-pink-400 font-medium mt-1">Vincula el Facebook de muchas clientas de un jalón, con revisión a prueba de errores.</p>
        </div>
        <a routerLink="/admin/send-links" class="btn-coquette btn-outline-pink text-center align-middle inline-block">← Centro de Envíos</a>
      </div>

      @if (step() === 'input') {
        <!-- ═══ PASO 1: ENTRADA ═══ -->
        <div class="card-coquette p-6 animate-slide-up space-y-4">
          <div class="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 text-sm text-blue-900 space-y-2">
            <p class="font-black">📋 Cómo usar (lo más fácil):</p>
            <ol class="list-decimal list-inside space-y-1 text-blue-800/90 text-[13px]">
              <li>En tu Excel o Google Sheets pon dos columnas: <b>Nombre</b> y <b>Enlace de Facebook</b>.</li>
              <li>Selecciona las dos columnas, cópialas (Ctrl+C).</li>
              <li>Pégalas aquí abajo (Ctrl+V). El sistema detecta solo cuál es el enlace.</li>
            </ol>
            <p class="text-[12px] text-blue-700/80 pt-1">También sirve pegar separado por comas, o subir un archivo CSV. Acepta enlaces como <code>facebook.com/maria.lopez</code>, <code>facebook.com/profile.php?id=...</code> o <code>m.me/...</code>.</p>
          </div>

          <textarea
            class="input-coquette w-full font-mono text-sm"
            rows="12"
            placeholder="María López	facebook.com/maria.lopez&#10;Juanita Pérez	facebook.com/profile.php?id=100012345&#10;Lupita Ramos	m.me/lupita.ramos"
            [(ngModel)]="rawText"
            (ngModelChange)="onTextChange()"></textarea>

          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <label class="btn-coquette btn-outline-pink cursor-pointer text-sm">
                📎 Subir CSV
                <input type="file" accept=".csv,.txt,.tsv" class="hidden" (change)="onFileSelected($event)" />
              </label>
              <span class="text-sm font-bold" [class.text-pink-400]="parsedCount() === 0" [class.text-pink-700]="parsedCount() > 0">
                {{ parsedCount() }} fila(s) detectada(s)
              </span>
            </div>
            <button class="btn-coquette btn-pink px-6" [disabled]="parsedCount() === 0 || analyzing()" (click)="analyze()">
              {{ analyzing() ? 'Analizando…' : 'Analizar →' }}
            </button>
          </div>
        </div>
      } @else {
        <!-- ═══ PASO 2: REVISIÓN ═══ -->

        <!-- Resumen -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
          <div class="card-coquette p-4 text-center">
            <p class="text-2xl font-black text-emerald-600">{{ countByStatus('matched') }}</p>
            <p class="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Match claro</p>
          </div>
          <div class="card-coquette p-4 text-center">
            <p class="text-2xl font-black text-amber-600">{{ countByStatus('review') }}</p>
            <p class="text-[10px] font-black text-amber-400 uppercase tracking-widest">Por revisar</p>
          </div>
          <div class="card-coquette p-4 text-center">
            <p class="text-2xl font-black text-rose-500">{{ countByStatus('notfound') }}</p>
            <p class="text-[10px] font-black text-rose-400 uppercase tracking-widest">Sin encontrar</p>
          </div>
          <div class="card-coquette p-4 text-center bg-gradient-to-br from-pink-50 to-rose-50">
            <p class="text-2xl font-black text-pink-700">{{ selectedCount() }}</p>
            <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest">A guardar</p>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex gap-2">
            <button class="btn-coquette btn-outline-pink text-xs py-2" (click)="step.set('input')">← Volver a editar</button>
            <button class="text-xs font-bold text-pink-500 hover:text-pink-700 px-2" (click)="selectAllValid()">Marcar todos los válidos</button>
            <button class="text-xs font-bold text-pink-400 hover:text-pink-600 px-2" (click)="deselectAll()">Quitar selección</button>
          </div>
          <button class="btn-coquette btn-pink px-6" [disabled]="selectedCount() === 0 || applying()" (click)="apply()">
            {{ applying() ? 'Guardando…' : '💾 Guardar ' + selectedCount() + ' Facebook(s)' }}
          </button>
        </div>

        <!-- Lista de decisiones -->
        <div class="space-y-2.5 pb-8">
          @for (d of decisions(); track d.item.rowIndex) {
            <div class="card-coquette p-4"
                 [class.opacity-60]="!d.include"
                 [class.ring-2]="d.include"
                 [class.ring-pink-200]="d.include">
              <div class="flex flex-col lg:flex-row lg:items-center gap-3">

                <!-- Checkbox + nombre del archivo -->
                <div class="flex items-start gap-3 lg:w-[28%] min-w-0">
                  <input type="checkbox" class="accent-pink-500 w-5 h-5 mt-0.5 shrink-0"
                         [checked]="d.include" (change)="toggleInclude(d)" />
                  <div class="min-w-0">
                    <p class="text-[10px] font-black text-pink-300 uppercase tracking-widest">Del archivo</p>
                    <p class="font-bold text-pink-900 truncate">{{ d.item.inputName || '(sin nombre)' }}</p>
                    @if (statusBadge(d.item.status); as b) {
                      <span class="text-[10px] font-black px-2 py-0.5 rounded-full" [class]="b.css">{{ b.label }}</span>
                    }
                  </div>
                </div>

                <!-- Flecha -->
                <div class="text-pink-300 font-black hidden lg:block">→</div>

                <!-- Selector de clienta -->
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] font-black text-pink-300 uppercase tracking-widest mb-1">Clienta en el sistema</p>
                  @if (!d.searching && d.item.candidates.length > 0) {
                    <select class="input-coquette text-sm" [ngModel]="d.selectedClientId" (ngModelChange)="onSelectChange(d, $event)">
                      <option [ngValue]="null">— No asignar —</option>
                      @for (c of d.item.candidates; track c.clientId) {
                        <option [ngValue]="c.clientId">{{ c.name }} · {{ (c.score * 100) | number:'1.0-0' }}%{{ c.matchedBy === 'alias' ? ' (alias)' : '' }}</option>
                      }
                      <option [ngValue]="SEARCH_SENTINEL">🔍 Buscar otra clienta…</option>
                    </select>
                  } @else {
                    <input class="input-coquette text-sm" list="all-clients-dl" placeholder="Escribe el nombre de la clienta…"
                           [(ngModel)]="d.searchText" (ngModelChange)="onSearchChange(d, $event)" />
                  }
                  @if (selectedName(d); as nm) {
                    <p class="text-[11px] text-emerald-600 font-bold mt-1">✓ {{ nm }}</p>
                  }
                </div>

                <!-- URL editable + preview -->
                <div class="lg:w-[30%] min-w-0">
                  <p class="text-[10px] font-black text-pink-300 uppercase tracking-widest mb-1">Enlace Facebook</p>
                  <input class="input-coquette text-xs font-mono"
                         [class.border-rose-300]="!d.urlValid"
                         [(ngModel)]="d.url" (ngModelChange)="onUrlChange(d)" placeholder="facebook.com/…" />
                  <div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] font-bold">
                    @if (d.urlValid && d.messengerPreview) {
                      <span class="text-[#0099FF]">→ {{ d.messengerPreview }}</span>
                    } @else {
                      <span class="text-rose-500">⚠️ Enlace no válido</span>
                    }
                    @if (d.item.topAlreadyHasFacebook && d.selectedClientId === d.item.suggestedClientId) {
                      <span class="text-amber-600">⚠️ Ya tenía Facebook (se reemplaza)</span>
                    }
                    @if (d.item.duplicateUrlInBatch) {
                      <span class="text-amber-600">⚠️ Enlace repetido en la lista</span>
                    }
                  </div>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Datalist compartido con todas las clientas (para "buscar otra") -->
        <datalist id="all-clients-dl">
          @for (c of allClients(); track c.id) {
            <option [value]="c.name + ' #' + c.id"></option>
          }
        </datalist>
      }
    </div>
  `
})
export class FacebookImportComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  readonly SEARCH_SENTINEL = -999;

  step = signal<'input' | 'review'>('input');
  rawText = '';
  analyzing = signal(false);
  applying = signal(false);

  decisions = signal<ImportDecision[]>([]);
  allClients = signal<ClientLite[]>([]);
  private clientNameById = new Map<number, string>();
  private clientIdByLabel = new Map<string, number>();

  parsedCount = signal(0);

  ngOnInit(): void {
    this.api.getClients().subscribe({
      next: (clients: ClientDto[]) => {
        const lite = clients
          .map(c => ({ id: c.id, name: c.name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es'));
        this.allClients.set(lite);
        this.clientNameById = new Map(lite.map(c => [c.id, c.name]));
        this.clientIdByLabel = new Map(lite.map(c => [`${c.name} #${c.id}`, c.id]));
      }
    });
  }

  // ─────────── Paso 1: entrada ───────────

  onTextChange(): void {
    this.parsedCount.set(this.parseInput(this.rawText).length);
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.rawText = (reader.result as string) || '';
      this.onTextChange();
      this.toast.success('Archivo cargado ✨');
    };
    reader.onerror = () => this.toast.error('No se pudo leer el archivo');
    reader.readAsText(file);
  }

  /**
   * Parser robusto: por cada línea extrae el enlace de Facebook (donde sea que esté)
   * y toma el resto como nombre. Soporta tab (pegado de Excel), coma, punto y coma.
   */
  private parseInput(text: string): FacebookImportRow[] {
    if (!text) return [];
    const urlRegex = /(?:https?:\/\/\S+|(?:www\.|m\.|web\.)?(?:facebook|fb)\.com\/\S+|m\.me\/\S+|messenger\.com\/\S+)/i;
    const rows: FacebookImportRow[] = [];

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;

      let name = '';
      let url = '';

      const urlMatch = line.match(urlRegex);
      if (urlMatch) {
        url = urlMatch[0].replace(/[,;\t]+$/, '').trim();
        name = line.replace(urlMatch[0], '').replace(/[\t,;]+/g, ' ').trim();
      } else {
        // Sin URL "fuerte": dividir por separadores y tomar la última columna como enlace
        const parts = line.includes('\t') ? line.split('\t')
          : line.includes(';') ? line.split(';')
          : line.includes(',') ? line.split(',')
          : line.split(/\s{2,}/);
        const clean = parts.map(p => p.trim()).filter(p => p.length);
        if (clean.length >= 2) {
          url = clean[clean.length - 1];
          name = clean.slice(0, -1).join(' ');
        } else {
          continue; // una sola columna sin URL: no es útil
        }
      }

      // Saltar encabezado típico
      const nLower = name.toLowerCase();
      const uLower = url.toLowerCase();
      const isHeader = ['nombre', 'name', 'cliente', 'clienta'].includes(nLower) &&
        ['facebook', 'url', 'link', 'enlace', 'perfil'].some(h => uLower.includes(h)) &&
        !uLower.includes('.') && !uLower.includes('/');
      if (isHeader) continue;

      if (!url) continue;
      rows.push({ name, facebookUrl: url });
    }
    return rows;
  }

  analyze(): void {
    const rows = this.parseInput(this.rawText);
    if (rows.length === 0) return;
    this.analyzing.set(true);
    this.api.facebookImportPreview(rows).subscribe({
      next: (res) => {
        const decisions: ImportDecision[] = res.items.map(item => {
          const mPreview = buildMessengerLink(item.inputUrl);
          return {
            item,
            url: item.inputUrl,
            urlValid: item.urlValid && !!mPreview,
            messengerPreview: mPreview ? mPreview.replace('https://', '') : null,
            // Solo los "matched" arrancan con clienta sugerida; los demás se revisan a mano
            selectedClientId: item.status === 'matched' ? (item.suggestedClientId ?? null) : null,
            include: item.status === 'matched' && item.urlValid && !!mPreview,
            searching: item.status === 'notfound',
            searchText: ''
          };
        });
        this.decisions.set(decisions);
        this.step.set('review');
        this.analyzing.set(false);
      },
      error: () => {
        this.analyzing.set(false);
        this.toast.error('No se pudo analizar la lista');
      }
    });
  }

  // ─────────── Paso 2: revisión ───────────

  countByStatus(status: string): number {
    return this.decisions().filter(d => d.item.status === status).length;
  }

  selectedCount = computed(() =>
    this.decisions().filter(d => d.include && d.selectedClientId && d.selectedClientId > 0 && d.urlValid).length
  );

  statusBadge(status: string): { label: string; css: string } | null {
    switch (status) {
      case 'matched': return { label: '✓ Coincidencia clara', css: 'bg-emerald-100 text-emerald-700' };
      case 'review': return { label: '🔎 Revisar', css: 'bg-amber-100 text-amber-700' };
      case 'notfound': return { label: '✋ Sin coincidencia', css: 'bg-rose-100 text-rose-600' };
      default: return null;
    }
  }

  selectedName(d: ImportDecision): string | null {
    if (!d.selectedClientId || d.selectedClientId <= 0) return null;
    return this.clientNameById.get(d.selectedClientId) ?? null;
  }

  onSelectChange(d: ImportDecision, value: number | null): void {
    if (value === this.SEARCH_SENTINEL) {
      d.searching = true;
      d.selectedClientId = null;
      d.searchText = '';
      this.bump();
      return;
    }
    d.selectedClientId = value;
    d.include = !!value && d.urlValid; // al asignar una clienta válida, lo marcamos
    this.bump();
  }

  onSearchChange(d: ImportDecision, text: string): void {
    const id = this.clientIdByLabel.get(text.trim());
    if (id) {
      d.selectedClientId = id;
      d.include = d.urlValid;
    } else {
      d.selectedClientId = null;
      d.include = false;
    }
    this.bump();
  }

  onUrlChange(d: ImportDecision): void {
    const m = buildMessengerLink(d.url);
    d.urlValid = !!m;
    d.messengerPreview = m ? m.replace('https://', '') : null;
    if (!d.urlValid) d.include = false;
    this.bump();
  }

  toggleInclude(d: ImportDecision): void {
    if (!d.include) {
      // Para marcar, debe tener clienta y URL válida
      if (!d.selectedClientId || d.selectedClientId <= 0) {
        this.toast.info('Primero elige la clienta');
        return;
      }
      if (!d.urlValid) {
        this.toast.info('El enlace no es válido');
        return;
      }
    }
    d.include = !d.include;
    this.bump();
  }

  selectAllValid(): void {
    for (const d of this.decisions()) {
      if (d.selectedClientId && d.selectedClientId > 0 && d.urlValid) d.include = true;
    }
    this.bump();
  }

  deselectAll(): void {
    for (const d of this.decisions()) d.include = false;
    this.bump();
  }

  apply(): void {
    const rows = this.decisions()
      .filter(d => d.include && d.selectedClientId && d.selectedClientId > 0 && d.urlValid)
      .map(d => ({ clientId: d.selectedClientId!, facebookUrl: d.url.trim() }));

    if (rows.length === 0) return;
    this.applying.set(true);
    this.api.facebookImportApply(rows).subscribe({
      next: (res) => {
        this.applying.set(false);
        this.toast.success(`¡Listo! ${res.applied} Facebook(s) guardados 𝓶✨`);
        if (res.errors?.length) {
          res.errors.slice(0, 3).forEach(e => this.toast.warning(e));
        }
        // Quitamos de la lista las que ya se aplicaron
        const appliedIds = new Set(rows.map(r => r.clientId));
        this.decisions.update(list => list.filter(d => !(d.selectedClientId && appliedIds.has(d.selectedClientId))));
        if (this.decisions().length === 0) {
          this.step.set('input');
          this.rawText = '';
          this.parsedCount.set(0);
        }
      },
      error: () => {
        this.applying.set(false);
        this.toast.error('No se pudieron guardar los enlaces');
      }
    });
  }

  /** Fuerza recomputo de signals tras mutar objetos de la lista. */
  private bump(): void {
    this.decisions.update(list => [...list]);
  }
}
