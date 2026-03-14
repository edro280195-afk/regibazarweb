import {
  Component, signal, inject, ElementRef, ViewChild,
  AfterViewChecked, OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { CamiMessage } from '../../../core/models';

interface DisplayMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isError?: boolean;
}

@Component({
  selector: 'app-cami-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[5000] bg-slate-950/95 backdrop-blur-md flex flex-col h-[100dvh] overflow-hidden safe-area-inset-bottom font-sans">

      <!-- ══════════ HEADER ══════════ -->
      <header class="flex-shrink-0 flex items-center justify-between p-4 border-b border-white/5 bg-slate-900/50">
        <div class="flex items-center gap-3">
          <div class="relative w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span class="text-white text-lg drop-shadow-sm">✦</span>
            <div class="absolute -inset-1 border border-indigo-500/30 rounded-full animate-[spin_10s_linear_infinite]"></div>
          </div>
          <div>
            <h1 class="text-white font-black text-base tracking-tight leading-none">C.A.M.I.</h1>
            <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Smart Assistant</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <!-- Voice toggle -->
          <button class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                  [class.text-white/60]="!voiceEnabled()"
                  [class.text-indigo-400]="voiceEnabled()"
                  (click)="toggleVoice()"
                  [title]="voiceEnabled() ? 'Desactivar voz' : 'Activar voz'">
            <span class="text-sm">{{ voiceEnabled() ? '🔊' : '🔇' }}</span>
          </button>
          @if (messages().length > 0) {
            <button class="w-8 h-8 rounded-full bg-white/5 text-white/60 flex items-center justify-center hover:bg-white/10 transition-colors"
                    (click)="clearConversation()">
              <span class="text-lg leading-none">↺</span>
            </button>
          }
          <button class="w-8 h-8 rounded-full bg-white/5 text-white/60 flex items-center justify-center hover:bg-white/10 transition-colors"
                  (click)="onClose()">
            <span class="text-lg leading-none">✕</span>
          </button>
        </div>
      </header>

      <!-- ══════════ MESSAGES AREA ══════════ -->
      <section class="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" #messagesContainer>
        @if (messages().length === 0) {
          <div class="h-full flex flex-col items-center justify-center text-center px-6 animate-fade-in">
            <div class="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-4xl mb-6 animate-pulse">
              ✦
            </div>
            <h2 class="text-white text-xl font-bold mb-2">¿En qué puedo ayudarte hoy?</h2>
            <p class="text-slate-400 text-sm max-w-xs leading-relaxed">
              Consulta pedidos, rutas o deja que te ayude a organizar tu día con inteligencia artificial.
            </p>
          </div>
        }

        @for (msg of messages(); track $index) {
          <div class="flex w-full animate-fade-in-up" [class.justify-end]="msg.role === 'user'">
            <div class="group max-w-[85%]">
              <div class="px-4 py-3 rounded-2xl shadow-sm text-sm"
                   [class.bg-indigo-600]="msg.role === 'user'"
                   [class.text-white]="msg.role === 'user'"
                   [class.rounded-tr-none]="msg.role === 'user'"
                   [class.bg-slate-800]="msg.role === 'model'"
                   [class.text-slate-100]="msg.role === 'model'"
                   [class.rounded-tl-none]="msg.role === 'model'"
                   [class.border]="msg.role === 'model'"
                   [class.border-white/5]="msg.role === 'model'"
                   [class.border-red-500/20]="msg.isError">
                <p class="whitespace-pre-wrap leading-relaxed">{{ msg.text }}</p>
              </div>
              <!-- Timestamp + copy/retry row -->
              <div class="flex items-center gap-2 mt-1 px-1"
                   [class.justify-end]="msg.role === 'user'"
                   [class.justify-start]="msg.role === 'model'">
                <span class="text-[10px] text-slate-500">{{ msg.timestamp | date:'HH:mm' }}</span>
                @if (msg.role === 'model' && !msg.isError) {
                  <button class="text-[10px] text-slate-600 hover:text-slate-400 transition-colors opacity-0 group-hover:opacity-100"
                          (click)="copyMessage(msg.text)" title="Copiar">📋</button>
                }
                @if (msg.isError && $last) {
                  <button class="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                          (click)="retryLast()">↺ Reintentar</button>
                }
              </div>
            </div>
          </div>
        }

        @if (isLoading()) {
          <div class="flex animate-fade-in">
            <div class="bg-slate-800 border border-white/5 px-4 py-3 rounded-2xl rounded-tl-none">
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-1">
                  <span class="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span class="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span class="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                </div>
                <span class="text-xs text-slate-500">Consultando sistema...</span>
              </div>
            </div>
          </div>
        }
      </section>

      <!-- ══════════ CONTROLS AREA ══════════ -->
      <footer class="flex-shrink-0 bg-slate-900/80 backdrop-blur-xl border-t border-white/5 p-4 pb-safe">

        <!-- Suggestion Chips -->
        <div class="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
          @for (s of suggestions; track s) {
            <button class="shrink-0 px-4 py-1.5 rounded-full bg-slate-800 border border-white/5 text-white/80 text-xs font-medium transition-all hover:bg-slate-700 active:scale-95"
                    (click)="sendText(s)">
              {{ s }}
            </button>
          }
        </div>

        <div class="flex flex-col gap-4">
          <!-- Text Input Row -->
          <div class="flex items-center gap-2 bg-slate-800 rounded-full p-1 pl-4 border border-white/5 focus-within:border-indigo-500/50 transition-all shadow-inner">
            <input
              class="flex-1 bg-transparent border-none text-white text-sm outline-none placeholder:text-slate-500 py-2"
              type="text"
              enterkeyhint="send"
              [(ngModel)]="textInput"
              placeholder="Escribe un mensaje..."
              (keyup.enter)="onSendText()"
              [disabled]="isLoading() || voiceStatus() === 'listening'"
            />
            <button class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center transition-all hover:bg-indigo-500 disabled:opacity-30"
                    (click)="onSendText()" [disabled]="!textInput.trim() || isLoading()">
              <span class="text-xs">↑</span>
            </button>
          </div>

          <!-- Giant Mic Button -->
          <div class="flex items-center justify-center pb-2">
            <div class="relative">
              @if (voiceStatus() === 'listening') {
                <div class="absolute inset-0 bg-pink-500 rounded-full blur-2xl animate-pulse opacity-40"></div>
                <div class="absolute -inset-4 bg-pink-500/20 rounded-full animate-ping"></div>
              }

              <button
                class="relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl z-10"
                [class.bg-pink-600]="voiceStatus() === 'listening'"
                [class.bg-indigo-600]="voiceStatus() !== 'listening' && voiceStatus() !== 'speaking'"
                [class.bg-emerald-600]="voiceStatus() === 'speaking'"
                [class.ring-4]="isWakeWordActive()"
                [class.ring-indigo-400/30]="isWakeWordActive()"
                (click)="onMicClick()"
              >
                @if (isWakeWordActive() && voiceStatus() === 'idle' && !isLoading()) {
                  <div class="absolute -top-1 -right-1 w-4 h-4 bg-indigo-400 rounded-full border-2 border-slate-900 animate-pulse"></div>
                }
                @if (voiceStatus() === 'listening') {
                  <span class="text-2xl animate-bounce">🎤</span>
                } @else if (voiceStatus() === 'speaking') {
                   <span class="text-2xl">🔊</span>
                } @else if (isLoading()) {
                   <span class="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                } @else {
                  <span class="text-2xl">🎤</span>
                }
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; position: relative; z-index: 5000; }

    .pb-safe {
      padding-bottom: env(safe-area-inset-bottom, 1rem);
    }

    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }

    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
  `]
})
export class CamiPanelComponent implements AfterViewChecked, OnDestroy, OnInit {
  private api = inject(ApiService);

  @ViewChild('messagesContainer') private container!: ElementRef<HTMLElement>;

  messages = signal<DisplayMessage[]>([]);
  isLoading = signal(false);
  voiceStatus = signal<'idle' | 'listening' | 'speaking'>('idle');
  isWakeWordActive = signal(false);
  voiceEnabled = signal(localStorage.getItem('cami-voice') !== 'off');
  lastError = signal(false);
  lastUserMessage = signal('');
  textInput = '';

  private recognition: any = null;
  private wakeWordRecognition: any = null;
  private audioPlayer = new Audio();
  private needsScroll = false;
  private visibilityHandler = this.onVisibilityChange.bind(this);

  get suggestions(): string[] {
    const h = new Date().getHours();
    if (h < 12) return ['☀️ ¿Resumen de hoy?', '📦 Pendientes', '🚗 Crear ruta', '💰 ¿Cuánto llevamos?'];
    if (h < 17) return ['📊 ¿Cómo vamos?', '💸 Cobros del día', '👑 Clientas top', '🚗 Rutas activas'];
    return ['📋 Resumen del día', '💰 ¿Cuánto cobramos?', '📦 Para mañana', '✨ Semana en números'];
  }

  ngOnInit() {
    this.loadFromStorage();
    this.initWakeWordListener();
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  ngAfterViewChecked(): void {
    if (this.needsScroll) { this.scrollBottom(); this.needsScroll = false; }
  }

  ngOnDestroy(): void {
    this.stopWakeWord();
    this.stopListening();
    this.audioPlayer.pause();
    this.audioPlayer.src = '';
    document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem('cami-history');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<{ role: string; text: string; timestamp: string; isError?: boolean }>;
      this.messages.set(
        parsed.slice(-50).map(m => ({ ...m, role: m.role as 'user' | 'model', timestamp: new Date(m.timestamp) }))
      );
    } catch {}
  }

  private saveToStorage(): void {
    try {
      const toSave = this.messages().slice(-50).map(m => ({ ...m, timestamp: m.timestamp.toISOString() }));
      localStorage.setItem('cami-history', JSON.stringify(toSave));
    } catch {}
  }

  private onVisibilityChange(): void {
    if (document.hidden) {
      this.stopWakeWord();
    } else if (!this.isLoading() && this.voiceStatus() === 'idle') {
      this.startWakeWord();
    }
  }

  onClose() {
    this.stopWakeWord();
    window.history.back();
  }

  toggleVoice(): void {
    const newVal = !this.voiceEnabled();
    this.voiceEnabled.set(newVal);
    localStorage.setItem('cami-voice', newVal ? 'on' : 'off');
    if (!newVal) { this.audioPlayer.pause(); this.voiceStatus.set('idle'); }
  }

  onMicClick(): void {
    if (this.voiceStatus() === 'listening') { this.stopListening(); this.startWakeWord(); return; }
    if (this.voiceStatus() === 'speaking') { this.audioPlayer.pause(); this.audioPlayer.currentTime = 0; this.voiceStatus.set('idle'); this.startWakeWord(); return; }
    if (this.isLoading()) return;
    this.stopWakeWord();
    this.startListening();
  }

  private startListening(): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome.'); return; }
    this.recognition = new SR();
    this.recognition.lang = 'es-MX';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    this.recognition.continuous = false;
    this.recognition.onstart  = () => this.voiceStatus.set('listening');
    this.recognition.onresult = (e: any) => { const t = e.results[0][0].transcript.trim(); if (t) this.sendText(t); };
    this.recognition.onerror = () => this.voiceStatus.set('idle');
    this.recognition.onend = () => { if (this.voiceStatus() === 'listening') this.voiceStatus.set('idle'); };
    this.recognition.start();
  }

  private stopListening(): void {
    this.recognition?.stop(); this.recognition = null; this.voiceStatus.set('idle');
  }

  private initWakeWordListener(): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    this.wakeWordRecognition = new SR();
    this.wakeWordRecognition.lang = 'es-MX';
    this.wakeWordRecognition.continuous = true;
    this.wakeWordRecognition.interimResults = true;
    this.wakeWordRecognition.onresult = (e: any) => {
      const last = e.results[e.results.length - 1];
      const text = last[0].transcript.toLowerCase();
      if (text.includes('cami') || text.includes('kamy') || text.includes('cambio')) this.onWakeWordDetected();
    };
    this.wakeWordRecognition.onerror = (e: any) => { if (e.error === 'not-allowed') this.isWakeWordActive.set(false); };
    this.wakeWordRecognition.onend = () => { if (this.isWakeWordActive()) this.wakeWordRecognition.start(); };
    this.startWakeWord();
  }

  private startWakeWord(): void {
    if (!this.wakeWordRecognition) return;
    try { this.isWakeWordActive.set(true); this.wakeWordRecognition.start(); } catch {}
  }

  private stopWakeWord(): void {
    this.isWakeWordActive.set(false);
    try { this.wakeWordRecognition?.stop(); } catch {}
  }

  private onWakeWordDetected(): void {
    if (this.voiceStatus() !== 'idle' || this.isLoading()) return;
    this.stopWakeWord();
    this.playActivationSound();
    setTimeout(() => this.startListening(), 100);
  }

  private playActivationSound(): void {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(); osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }

  onSendText(): void {
    const t = this.textInput.trim();
    if (!t || this.isLoading()) return;
    this.textInput = '';
    this.sendText(t);
  }

  sendText(text: string): void {
    this.stopListening();
    this.lastError.set(false);
    this.lastUserMessage.set(text);

    // Convert DisplayMessage[] to CamiMessage[] for API (only keep role + text)
    const prev: CamiMessage[] = this.messages().map(m => ({ role: m.role, text: m.text }));

    this.messages.update(m => [...m, { role: 'user', text, timestamp: new Date() }]);
    this.needsScroll = true;
    this.isLoading.set(true);
    this.saveToStorage();

    this.api.camiChat(prev, text).subscribe({
      next: (res: any) => {
        this.messages.update(m => [...m, { role: 'model', text: res.text, timestamp: new Date() }]);
        this.needsScroll = true;
        this.isLoading.set(false);
        this.saveToStorage();
        if (res.audioBase64 && this.voiceEnabled()) {
          this.playAudio(res.audioBase64);
        } else {
          this.startWakeWord();
        }
      },
      error: () => {
        this.lastError.set(true);
        this.messages.update(m => [...m, { role: 'model', text: 'Tuve un problema de conexión. ¿Lo intentamos de nuevo?', timestamp: new Date(), isError: true }]);
        this.needsScroll = true;
        this.isLoading.set(false);
        this.saveToStorage();
        this.startWakeWord();
      }
    });
  }

  retryLast(): void {
    const msg = this.lastUserMessage();
    if (!msg) return;
    // Remove the last error message
    this.messages.update(m => m.slice(0, -1));
    this.sendText(msg);
  }

  copyMessage(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  private playAudio(base64: string): void {
    try {
      this.audioPlayer.src = `data:audio/mp3;base64,${base64}`;
      this.audioPlayer.onplay = () => this.voiceStatus.set('speaking');
      this.audioPlayer.onended = () => { this.voiceStatus.set('idle'); this.startWakeWord(); };
      this.audioPlayer.onerror = () => { this.voiceStatus.set('idle'); this.startWakeWord(); };
      this.audioPlayer.play().catch(() => { this.voiceStatus.set('idle'); this.startWakeWord(); });
    } catch { this.voiceStatus.set('idle'); }
  }

  clearConversation(): void {
    this.audioPlayer.pause(); this.stopListening();
    this.messages.set([]); this.isLoading.set(false); this.voiceStatus.set('idle');
    this.lastError.set(false);
    localStorage.removeItem('cami-history');
  }

  private scrollBottom(): void {
    try { const el = this.container?.nativeElement; if (el) el.scrollTop = el.scrollHeight; } catch {}
  }
}
