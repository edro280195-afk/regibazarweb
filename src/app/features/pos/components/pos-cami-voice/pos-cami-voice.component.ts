import { Component, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PosApiService } from '../../../../core/services/pos-api.service';
import { PosStateService } from '../../../../core/services/pos-state.service';

@Component({
  selector: 'app-pos-cami-voice',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cami-card card-coquette !bg-white/80 p-6 flex flex-col gap-4 animate-fade-in relative overflow-hidden mb-4">
      <!-- Decoration -->
      <div class="absolute -top-6 -right-6 w-24 h-24 bg-pink-100/40 rounded-full blur-2xl"></div>
      
      <div class="flex items-center justify-between relative z-10">
        <div class="flex items-center gap-3">
          <div class="icon-container w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center shadow-lg shadow-pink-200">
            <span class="text-2xl drop-shadow-sm">🎤</span>
          </div>
          <div>
            <h3 class="text-pink-900 font-black text-lg leading-tight uppercase tracking-tight">Cami Inteligente</h3>
            <p class="text-pink-400 text-[10px] font-bold uppercase tracking-widest">
              {{ isListening() ? 'Escuchando...' : isProcessing() ? 'Procesando...' : 'Asistente de Voz' }}
            </p>
          </div>
        </div>

        <!-- Pulse Button -->
        <button (click)="toggleListening()" 
                [class.listening]="isListening()"
                class="mic-btn w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-md active:scale-90 group relative overflow-visible pointer-events-auto">
          @if (isListening()) {
            <div class="absolute inset-x-0 inset-y-0 rounded-full bg-pink-500 animate-ping opacity-30"></div>
          }
          <span class="text-2xl relative z-10">{{ isListening() ? '⏹️' : '🎙️' }}</span>
        </button>
      </div>

      <!-- Transcription Area -->
      <div class="transcription-area min-h-[70px] bg-pink-50/50 rounded-2xl p-4 border border-pink-100/30 flex items-center justify-center text-center relative overflow-hidden">
        <div class="relative z-10 w-full">
          @if (transcription() || isProcessing()) {
            <p class="text-pink-800 font-bold italic text-sm leading-relaxed">
               {{ isProcessing() ? 'Analizando tu petición... 🎀' : transcription() }}
            </p>
          } @else {
            <p class="text-pink-300 text-[11px] font-bold uppercase tracking-wide opacity-70">
              "Para Mary Carmen agrega un labial..."
            </p>
          }
        </div>
      </div>

      <!-- Footer Visualizer -->
      <div class="flex justify-center items-end gap-1.5 h-4 px-2">
        <div class="w-1.5 h-2 bg-pink-200 rounded-full" [class.animate-bounce]="isListening()" style="animation-duration: 0.6s"></div>
        <div class="w-1.5 h-3 bg-pink-300 rounded-full" [class.animate-bounce]="isListening()" style="animation-duration: 0.8s"></div>
        <div class="w-1.5 h-4 bg-pink-400 rounded-full" [class.animate-bounce]="isListening()" style="animation-duration: 0.5s"></div>
        <div class="w-1.5 h-3 bg-pink-300 rounded-full" [class.animate-bounce]="isListening()" style="animation-duration: 0.7s"></div>
        <div class="w-1.5 h-2 bg-pink-200 rounded-full" [class.animate-bounce]="isListening()" style="animation-duration: 0.9s"></div>
      </div>
    </div>
  `,
  styles: [`
    .mic-btn {
      background: white;
      border: 2px solid #fce7f3;
      color: #ec4899;
    }
    .mic-btn.listening {
      background: #ec4899;
      border-color: #ec4899;
      color: white;
    }
    .card-coquette {
      border-radius: 32px;
      border: 1px solid rgba(255, 255, 255, 0.4);
      box-shadow: 0 10px 30px -5px rgba(255, 133, 162, 0.1);
    }
    .animate-bounce {
      animation: bounce 1s infinite;
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
  `]
})
export class PosCamiVoiceComponent implements OnDestroy {
  private api = inject(PosApiService);
  private state = inject(PosStateService);

  isListening = signal(false);
  isProcessing = signal(false);
  transcription = signal('');
  
  private recognition: any = null;
  private audioPlayer = new Audio();

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    this.recognition = new SR();
    this.recognition.lang = 'es-MX';
    this.recognition.interimResults = true;
    this.recognition.onresult = (e: any) => {
      const text = Array.from(e.results)
        .map((res: any) => res[0].transcript)
        .join('');
      this.transcription.set(text);
    };
    this.recognition.onend = () => {
      if (this.isListening() && this.transcription()) {
        this.processCommand(this.transcription());
      }
      this.isListening.set(false);
    };
    this.recognition.onerror = () => {
      this.isListening.set(false);
    };
  }

  toggleListening() {
    if (this.isListening()) {
      this.recognition?.stop();
    } else {
      this.transcription.set('');
      this.isListening.set(true);
      this.recognition?.start();
      this.playTone(880, 0.1);
    }
  }

  private processCommand(text: string) {
    this.isProcessing.set(true);
    const orderId = this.state.selectedOrder()?.id;

    this.api.voiceCommand(text, orderId).subscribe({
      next: (res) => {
        this.isProcessing.set(false);
        this.transcription.set(res.message);
        
        if (res.audioBase64) {
          this.playAudio(res.audioBase64);
        }

        // Auto-limpiar burbuja después de 5s
        setTimeout(() => {
          if (this.transcription() === res.message) this.transcription.set('');
        }, 5000);
      },
      error: () => {
        this.isProcessing.set(false);
        this.transcription.set('¡Ups! Hubo un problema con la señal. 🎀');
      }
    });
  }

  private playAudio(base64: string) {
    this.audioPlayer.src = `data:audio/mp3;base64,${base64}`;
    this.audioPlayer.play().catch(() => {});
  }

  private playTone(freq: number, duration: number) {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  ngOnDestroy() {
    this.recognition?.stop();
    this.audioPlayer.pause();
  }
}
