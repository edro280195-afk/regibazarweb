import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center relative overflow-hidden">
      <!-- Animated Background -->
      <div class="absolute inset-0 bg-gradient-to-br from-pink-100 via-rose-50 to-purple-100">
        <div class="absolute top-10 left-10 w-72 h-72 bg-pink-300/30 rounded-full blur-3xl animate-float"></div>
        <div class="absolute bottom-10 right-10 w-96 h-96 bg-purple-300/20 rounded-full blur-3xl animate-float" style="animation-delay: 1s"></div>
        <div class="absolute top-1/2 left-1/3 w-64 h-64 bg-rose-300/20 rounded-full blur-3xl animate-float" style="animation-delay: 2s"></div>

        <!-- Decorative elements -->
        <div class="absolute top-20 right-20 text-6xl animate-sparkle">✨</div>
        <div class="absolute bottom-32 left-20 text-5xl animate-sparkle" style="animation-delay: 0.5s">🎀</div>
        <div class="absolute top-40 left-1/4 text-4xl animate-sparkle" style="animation-delay: 1s">💖</div>
        <div class="absolute bottom-20 right-1/3 text-5xl animate-sparkle" style="animation-delay: 1.5s">🌸</div>
        <div class="absolute top-1/3 right-1/4 text-3xl animate-float" style="animation-delay: 0.8s">🦋</div>
      </div>

      <!-- Login Card -->
      <div class="relative z-10 w-full max-w-md mx-4 animate-scale-in">
        <div class="glass-strong rounded-3xl p-8 shadow-2xl" style="box-shadow: 0 25px 60px rgba(236, 72, 153, 0.15)">
          <!-- Logo & Title -->
          <div class="text-center mb-8 animate-slide-down">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white mb-4 shadow-lg animate-pulse-pink overflow-hidden border-2 border-pink-200">
              <img src="pwa-icon.png" alt="Regi Bazar Logo" class="w-full h-full object-cover">
            </div>
            <h1 class="text-3xl font-bold gradient-text font-[var(--font-script)]" style="font-family: 'Dancing Script', cursive; font-size: 2.5rem;">
              Regi Bazar
            </h1>
            <p class="text-pink-400 mt-2 text-sm font-medium">✨ Tu tienda favorita ✨</p>
          </div>

          <!-- Form -->
          <form (ngSubmit)="onLogin()" class="space-y-5">
            <div class="animate-slide-up delay-100" style="opacity: 0">
              <label class="label-coquette">💌 Correo Electrónico</label>
              <input
                type="email"
                class="input-coquette"
                placeholder="tu@correo.com"
                [(ngModel)]="email"
                name="email"
                required
                autocomplete="email" />
            </div>

            <div class="animate-slide-up delay-200" style="opacity: 0">
              <label class="label-coquette">🔐 Contraseña</label>
              <div class="relative">
                <input
                  [type]="showPassword() ? 'text' : 'password'"
                  class="input-coquette pr-12"
                  placeholder="••••••••"
                  [(ngModel)]="password"
                  name="password"
                  required
                  autocomplete="current-password" />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 hover:text-pink-600 transition-colors"
                  (click)="showPassword.set(!showPassword())">
                  {{ showPassword() ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>

            @if (errorMsg()) {
              <div class="animate-bounce-in bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm text-center">
                😿 {{ errorMsg() }}
              </div>
            }

            <button
              type="submit"
              class="btn-coquette btn-pink w-full justify-center py-3.5 text-base animate-slide-up delay-300"
              style="opacity: 0"
              [disabled]="loading()">
              @if (loading()) {
                <span class="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Entrando...</span>
              } @else {
                <span>Entrar</span>
                <span>💖</span>
              }
            </button>
          </form>

          <!-- Footer -->
          <p class="text-center text-pink-300 text-xs mt-6 animate-slide-up delay-400" style="opacity: 0">
            Hecho con 💕 para Regi Bazar
          </p>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  email = '';
  password = '';
  loading = signal(false);
  errorMsg = signal('');
  showPassword = signal(false);

  onLogin(): void {
    if (!this.email || !this.password) {
      this.errorMsg.set('Por favor llena todos los campos 🌸');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');

    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        this.auth.handleLoginSuccess(res);
        this.toast.success('¡Bienvenida, ' + res.name + '! 💖');
        this.router.navigate(['/admin']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err.error?.message || err.error || 'Correo o contraseña incorrectos');
      }
    });
  }
}
