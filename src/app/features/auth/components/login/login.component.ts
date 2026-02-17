import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <div class="bg-gradient"></div>
      
      <div class="deco deco-1">🎀</div>
      <div class="deco deco-2">✨</div>
      <div class="deco deco-3">🌸</div>
      <div class="deco deco-4">🧸</div>
      <div class="deco deco-5">🦋</div>
      <div class="deco deco-6">💄</div>
      <div class="deco deco-7">💖</div>

      <div class="login-card">
        <div class="super-bow">🎀</div>

        <div class="login-header">
          <div class="logo-container">
            <span class="logo-icon">
              <img src="assets/LogoRegi.png" alt="PMM Logo" class="logo-image" />
            </span>
          </div>
          <h1 class="title">Regi Bazar</h1>
          <p class="tagline">Lo mejor para tu hogar ✨</p>
        </div>

        <!-- <div class="toggle-container">
          <div class="slider" [class.register-mode]="isRegister()"></div>
          <button class="toggle-btn" [class.active]="!isRegister()" (click)="isRegister.set(false)">
            💝 Entrar
          </button>
          <button class="toggle-btn" [class.active]="isRegister()" (click)="isRegister.set(true)">
            🌟 Registro
          </button>
        </div> -->

        <form (ngSubmit)="submit()" class="form-content">
          <div class="form-wrapper" [class.expanded]="isRegister()">
            
            <div class="field-container name-field" [class.visible]="isRegister()">
              <div class="input-wrapper">
                <span class="input-icon">👑</span>
                <input type="text" [(ngModel)]="name" name="name" placeholder="¿Cómo te llamas, bonita?" 
                       [required]="isRegister()">
              </div>
            </div>

            <div class="field-container">
              <label>Correo electrónico</label>
              <div class="input-wrapper">
                <span class="input-icon">💌</span>
                <input type="email" [(ngModel)]="email" name="email" placeholder="correo@ejemplo.com" required>
              </div>
            </div>

            <div class="field-container">
              <label>Contraseña secreta</label>
              <div class="input-wrapper">
                <span class="input-icon">🔐</span>
                <input [type]="showPassword() ? 'text' : 'password'" 
                       [(ngModel)]="password" name="password" placeholder="Secreto..." required>
                <button type="button" class="eye-btn" (click)="showPassword.set(!showPassword())">
                  {{ showPassword() ? '👀' : '🙈' }}
                </button>
              </div>
            </div>

          </div>

          @if (error()) {
            <div class="error-msg">
              <span>😿</span> {{ error() }}
            </div>
          }

          <button type="submit" class="btn-primary" [disabled]="loading()">
            @if (loading()) {
              <div class="loading-dots">
                <span>.</span><span>.</span><span>.</span>
              </div>
            } @else {
              {{ isRegister() ? '🌸 Crear mi cuenta' : '💖 Iniciar Sesión' }}
            }
          </button>
        </form>

        <div class="footer-deco">
          <p>hecho con mucho 💗 para la mejor emprendedora</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* FUENTES Y VARIABLES */
    :host {
      --primary-pink: #ff85c0;
      --soft-pink: #fff0f6;
      --deep-pink: #eb2f96;
      --glass-bg: rgba(255, 255, 255, 0.75);
      --glass-border: rgba(255, 255, 255, 0.8);
      --bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      font-family: var(--font-body);
    }

    .logo-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: 50%;
      box-shadow: 0 5px 15px rgba(255,105,180,0.3);
      border: 3px solid white;
      transition: transform 0.5s var(--bounce);
    }
    .logo-image:hover {
      transform: rotate(10deg) scale(1.1);
    }

    /* FONDO DEGRADADO ANIMADO */
    .bg-gradient {
      position: absolute; inset: 0;
      background: linear-gradient(125deg, #fff0f6 0%, #ffe7ba 40%, #ffd6e7 70%, #d3f9d8 100%);
      background-size: 400% 400%;
      animation: gradientBG 15s ease infinite;
      z-index: -2;
    }

    @keyframes gradientBG {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    /* DECORACIONES FLOTANTES */
    .deco {
      position: absolute;
      font-size: 2.5rem;
      filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
      animation: floaty 6s ease-in-out infinite;
      z-index: -1;
      opacity: 0.6;
    }
    .deco-1 { top: 5%; left: 5%; animation-delay: 0s; font-size: 3rem; }
    .deco-2 { top: 15%; right: 10%; animation-delay: 1s; font-size: 1.5rem; }
    .deco-3 { bottom: 10%; left: 10%; animation-delay: 2s; }
    .deco-4 { bottom: 20%; right: 5%; animation-delay: 0.5s; font-size: 2.8rem; }
    .deco-5 { top: 45%; left: -2%; animation-delay: 3s; }
    .deco-6 { top: 10%; left: 45%; animation-delay: 1.5s; font-size: 1.8rem; }
    .deco-7 { bottom: 5%; right: 40%; animation-delay: 2.5s; }

    @keyframes floaty {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      50% { transform: translateY(-20px) rotate(5deg); }
    }

    /* TARJETA DE VIDRIO (GLASSMORPHISM) */
    .login-card {
      width: 90%;
      max-width: 400px;
      background: var(--glass-bg);
      backdrop-filter: blur(25px) saturate(180%);
      -webkit-backdrop-filter: blur(25px) saturate(180%);
      border: 2px solid var(--glass-border);
      border-radius: 2.5rem;
      padding: 2.5rem 2rem;
      box-shadow: 
        0 20px 50px rgba(255, 133, 192, 0.15),
        0 10px 20px rgba(0,0,0,0.05),
        inset 0 0 0 1px rgba(255,255,255,0.5);
      position: relative;
      transform: translateY(0);
      animation: cardEnter 0.8s var(--bounce);
    }

    @keyframes cardEnter {
      from { opacity: 0; transform: translateY(50px) scale(0.9); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .super-bow {
      position: absolute;
      top: -25px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 3.5rem;
      filter: drop-shadow(0 4px 0 rgba(0,0,0,0.1));
      animation: bowBounce 3s ease-in-out infinite;
      z-index: 10;
    }

    @keyframes bowBounce {
      0%, 100% { transform: translateX(-50%) rotate(0deg) scale(1); }
      50% { transform: translateX(-50%) rotate(-5deg) scale(1.1); }
    }

    /* HEADER */
    .login-header { text-align: center; margin-bottom: 2rem; margin-top: 1rem; }
    
    .logo-container { 
      margin-bottom: 0.5rem;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .logo-icon { 
      width: 100px;
      height: 100px;
      display: block;
      animation: pop 0.4s var(--bounce);
      position: relative;
    }
    .logo-icon::after {
      content: '✨'; position: absolute; top: 0; right: 0; font-size: 1.5rem; animation: twinkle 1.5s infinite;
    }
    @keyframes twinkle { 0%,100%{opacity:0;transform:scale(0.5);} 50%{opacity:1;transform:scale(1.2);} }
    
    .title {
      font-family: 'Pacifico', cursive, sans-serif; /* Si no carga Pacifico, usa cursive */
      color: var(--deep-pink);
      font-size: 2.5rem;
      margin: 0;
      text-shadow: 2px 2px 0px rgba(255,255,255,0.8);
    }

    .tagline {
      color: #b08bb6;
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-top: 5px;
    }

    /* SWITCH DESLIZANTE */
    .toggle-container {
      position: relative;
      display: flex;
      background: rgba(255,255,255,0.5);
      border-radius: 50px;
      padding: 5px;
      border: 1px solid white;
      box-shadow: inset 0 2px 5px rgba(0,0,0,0.03);
      margin-bottom: 2rem;
    }

    .slider {
      position: absolute;
      top: 5px; left: 5px; bottom: 5px;
      width: calc(50% - 5px);
      background: linear-gradient(135deg, var(--primary-pink), var(--deep-pink));
      border-radius: 40px;
      transition: transform 0.5s var(--bounce);
      box-shadow: 0 4px 15px rgba(235, 47, 150, 0.4);
      z-index: 1;
    }

    .slider.register-mode { transform: translateX(100%); }

    .toggle-btn {
      flex: 1;
      border: none;
      background: none;
      padding: 12px;
      font-weight: 700;
      font-size: 0.95rem;
      color: #999;
      cursor: pointer;
      z-index: 2;
      transition: color 0.3s;
      position: relative;
    }

    .toggle-btn.active { color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.2); }

    /* FORMULARIOS Y ANIMACIONES */
    .form-wrapper {
      transition: all 0.5s ease;
    }

    .field-container {
      margin-bottom: 1.2rem;
      transition: all 0.4s ease;
    }

    .name-field {
      height: 0;
      opacity: 0;
      overflow: hidden;
      margin-bottom: 0;
      transform: translateY(-10px);
    }

    .name-field.visible {
      height: 70px; /* Ajuste manual para la altura del input */
      opacity: 1;
      margin-bottom: 1.2rem;
      transform: translateY(0);
    }

    label {
      display: block;
      margin-left: 10px;
      margin-bottom: 5px;
      font-size: 0.85rem;
      color: var(--deep-pink);
      font-weight: 700;
    }

    .input-wrapper {
      position: relative;
      transition: transform 0.2s;
    }

    .input-wrapper:focus-within { transform: scale(1.02); }

    .input-icon {
      position: absolute;
      left: 15px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 1.2rem;
      z-index: 2;
    }

    input {
      width: 100%;
      padding: 14px 14px 14px 45px;
      border-radius: 20px;
      border: 2px solid transparent;
      background: rgba(255, 255, 255, 0.8);
      font-size: 0.95rem;
      color: #555;
      outline: none;
      transition: all 0.3s;
      box-shadow: 0 4px 10px rgba(0,0,0,0.03);
      box-sizing: border-box;
      font-family: inherit;
    }

    input:focus {
      background: white;
      border-color: var(--primary-pink);
      box-shadow: 0 0 0 4px rgba(255, 133, 192, 0.2);
    }

    .eye-btn {
      position: absolute;
      right: 15px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.2rem;
      opacity: 0.5;
      transition: opacity 0.2s;
    }
    .eye-btn:hover { opacity: 1; }

    /* BOTON PRINCIPAL */
    .btn-primary {
      width: 100%;
      padding: 16px;
      margin-top: 1rem;
      border: none;
      border-radius: 25px;
      background: linear-gradient(90deg, #ff9a9e 0%, #fecfef 99%, #feada6 100%);
      background-size: 200% auto;
      color: white;
      font-size: 1.1rem;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 10px 20px rgba(255, 154, 158, 0.3);
      transition: all 0.4s var(--bounce);
      text-shadow: 0 2px 2px rgba(0,0,0,0.1);
      position: relative; overflow: hidden;
    }
    .btn-primary::after {
      content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
      transform: skewX(-20deg); animation: shimmer 3s infinite;
    }
    @keyframes shimmer { 0% { left: -100%; } 20% { left: 200%; } 100% { left: 200%; } }

    .btn-primary:hover {
      background-position: right center;
      transform: translateY(-4px);
      box-shadow: 0 15px 30px rgba(255, 154, 158, 0.4);
    }

    .btn-primary:active { transform: scale(0.98); }

    /* ERRORES Y CARGA */
    .error-msg {
      background: #fff1f0;
      border: 1px solid #ffa39e;
      color: #cf1322;
      padding: 10px 15px;
      border-radius: 15px;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 1rem;
      animation: shake 0.4s ease-in-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    .loading-dots span {
      animation: dotFade 1.4s infinite;
      opacity: 0;
      font-size: 1.5rem;
      line-height: 0;
    }
    .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
    .loading-dots span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes dotFade {
      0% { opacity: 0; }
      50% { opacity: 1; }
      100% { opacity: 0; }
    }

    .footer-deco {
      text-align: center;
      margin-top: 2rem;
      font-size: 0.8rem;
      color: #999;
      font-style: italic;
    }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  name = '';
  isRegister = signal(false);
  showPassword = signal(false);
  loading = signal(false);
  error = signal('');

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router
  ) {
    if (auth.isAuthenticated()) {
      router.navigate(['/admin']);
    }
  }

  submit(): void {
    this.error.set('');
    this.loading.set(true);

    const obs = this.isRegister()
      ? this.api.register({ name: this.name, email: this.email, password: this.password })
      : this.api.login({ email: this.email, password: this.password });

    obs.subscribe({
      next: (res) => {
        this.auth.login(res.token, res.name);
        this.router.navigate(['/admin']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || err.error || 'Ups, algo salió mal bonita 💔');
      }
    });
  }
}