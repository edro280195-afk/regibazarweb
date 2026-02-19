import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

import { AiAssistantComponent } from '../ai-assistant/ai-assistant.component';
import { GlobalSearchComponent } from './global-search.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, AiAssistantComponent, GlobalSearchComponent],
  template: `
    <div class="admin-shell">
      <aside class="sidebar" [class.open]="sidebarOpen">
        <div class="sidebar-header">
          <div class="brand">
            <span class="brand-icon">
              <img src="assets/LogoRegi.png" alt="PMM Logo" class="logo-image" />
            </span>
            <div>
              <span class="brand-name">Gestion de Pedidos</span>
              <span class="brand-tag">Panel de control ✨</span>
            </div>
          </div>
          <button class="close-btn" (click)="sidebarOpen = false">✕</button>
        </div>

        <nav class="sidebar-nav">
          <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}"
             (click)="sidebarOpen = false">
            <span class="nav-icon">🏠</span> Inicio
          </a>
          <a routerLink="/admin/upload" routerLinkActive="active"
             (click)="sidebarOpen = false">
            <span class="nav-icon">📄</span> Cargar pedidos
          </a>
          <a routerLink="/admin/orders" routerLinkActive="active"
             (click)="sidebarOpen = false">
            <span class="nav-icon">🛒</span> Pedidos
          </a>
          <a routerLink="/admin/calendar" routerLinkActive="active"
             (click)="sidebarOpen = false">
            <span class="nav-icon">📅</span> Calendario
          </a>
          <a routerLink="/admin/routes" routerLinkActive="active"
             (click)="sidebarOpen = false">
            <span class="nav-icon">🚗</span> Rutas
          </a>
          <a routerLink="/admin/clients" routerLinkActive="active"
             (click)="sidebarOpen = false">
            <span class="nav-icon">💁‍♀️</span> Mis clientas
          </a>
          <a routerLink="/admin/suppliers" routerLinkActive="active"
             (click)="sidebarOpen = false">
            <span class="nav-icon">📦</span> Proveedores
          </a>
          <a routerLink="/admin/financials" routerLinkActive="active"
             (click)="sidebarOpen = false">
            <span class="nav-icon">📈</span> Finanzas
          </a>
          <a routerLink="/admin/payments" routerLinkActive="active"
             (click)="sidebarOpen = false">
            <span class="nav-icon">💸</span> Pagos
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="theme-selector">
            <button class="theme-btn" [class.active]="theme() === 'default'" (click)="setTheme('default')" title="Coquette 🌸">🌸</button>
            <button class="theme-btn" [class.active]="theme() === 'dark'" (click)="setTheme('dark')" title="Midnight 🌙">🌙</button>
            <button class="theme-btn" [class.active]="theme() === 'bold'" (click)="setTheme('bold')" title="Bold 💃">💃</button>
            <button class="theme-btn" [class.active]="theme() === 'minimal'" (click)="setTheme('minimal')" title="Minimal ☁️">☁️</button>
          </div>
          <div class="footer-row">
            <div class="user-info">
              <div class="user-avatar">{{ auth.userName()?.charAt(0)?.toUpperCase() }}</div>
              <span class="user-name">{{ auth.userName() }}</span>
            </div>
            <button class="logout-btn" (click)="auth.logout()">👋</button>
          </div>
        </div>
      </aside>

      @if (sidebarOpen) {
        <div class="overlay" (click)="sidebarOpen = false"></div>
      }

      <main class="main-content">
        <header class="top-bar">
          <button class="menu-btn" (click)="sidebarOpen = true">☰</button>
          <app-global-search></app-global-search>
          <span class="page-greeting">¡Hola, {{ auth.userName() }}! 💖</span>
        </header>
        <div class="content-area">
          <router-outlet></router-outlet>
        </div>
        
        <app-ai-assistant></app-ai-assistant>
      </main>
    </div>
  `,
  styles: [`
    .admin-shell {
      display: flex; min-height: 100vh;
      background: var(--bg-main);
      position: relative; z-index: 1;
    }

    .sidebar {
      width: 260px;
      background: var(--bg-glass);
      backdrop-filter: blur(20px);
      border-right: 1px solid var(--border-soft);
      display: flex; flex-direction: column;
      position: fixed; top: 0; left: 0; bottom: 0;
      z-index: 100;
      transition: transform 0.35s var(--ease-smooth);
      box-shadow: 4px 0 24px rgba(255, 107, 157, 0.06);
    }

    .sidebar-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1.25rem 1.25rem;
      border-bottom: 1px solid var(--border-soft);
    }

    .brand { display: flex; align-items: center; gap: 0.65rem; }
    .brand-icon { 
      font-size: 1.75rem; animation: heartbeat 3s ease-in-out infinite; 
      width: 38px; height: 38px;
      display: flex; justify-content: center; align-items: center;
    }
    .logo-image {
      width: 100%;
      height: 100%;
      object-fit: contain; /* Esto asegura que el logo no se deforme */
      display: block;
    }
    @keyframes heartbeat {
      0%, 100% { transform: scale(1); }
      25% { transform: scale(1.12); }
      50% { transform: scale(1); }
    }
    .brand-name {
      font-family: var(--font-display);
      color: var(--pink-600); font-size: 1.2rem; font-weight: 700;
      display: block; line-height: 1.1;
    }
    .brand-tag {
      font-family: var(--font-script);
      color: var(--rose-gold); font-size: 0.75rem;
    }

    .close-btn {
      display: none; background: none; border: none;
      color: var(--text-muted); font-size: 1.2rem; cursor: pointer;
    }

    .sidebar-nav {
      flex: 1; padding: 0.75rem;
      display: flex; flex-direction: column; gap: 0.2rem;

      a {
        display: flex; align-items: center; gap: 0.75rem;
        padding: 0.7rem 1rem; border-radius: 0.85rem;
        color: var(--text-medium); text-decoration: none;
        font-size: 0.9rem; font-weight: 600;
        transition: all 0.25s var(--ease-smooth);

        &:hover {
          background: rgba(255, 107, 157, 0.06);
          color: var(--pink-500);
          transform: translateX(3px);
        }

        &.active {
          background: linear-gradient(135deg, rgba(255,107,157,0.12), rgba(232,160,191,0.12));
          color: var(--pink-600);
          box-shadow: var(--shadow-sm);
          border: 1px solid rgba(255, 107, 157, 0.1);
        }

        .nav-icon { font-size: 1.1rem; width: 24px; text-align: center; }
      }
    }

    .sidebar-footer {
      padding: 1rem 1.1rem;
      border-top: 1px solid var(--border-soft);
      display: flex; flex-direction: column; gap: 0.75rem;
    }
    .footer-row { display: flex; justify-content: space-between; align-items: center; width: 100%; }
    .theme-selector { display: flex; justify-content: center; gap: 0.5rem; background: rgba(255,255,255,0.5); padding: 0.4rem; border-radius: 1rem; }
    .theme-btn {
      background: none; border: none; font-size: 1.1rem; padding: 0.3rem; border-radius: 50%; cursor: pointer; transition: transform 0.2s; opacity: 0.6;
      &:hover { transform: scale(1.2); opacity: 0.8; }
      &.active { opacity: 1; transform: scale(1.2); background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    }

    .user-info { display: flex; align-items: center; gap: 0.5rem; }

    .user-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, var(--pink-400), var(--rose-gold));
      color: white; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 0.8rem;
      box-shadow: 0 2px 8px rgba(255, 107, 157, 0.3);
    }

    .user-name { color: var(--text-medium); font-size: 0.85rem; font-weight: 600; }

    .logout-btn {
      padding: 0.35rem 0.75rem;
      background: rgba(255, 107, 157, 0.08);
      border: 1px solid rgba(255, 107, 157, 0.15);
      border-radius: 0.5rem;
      color: var(--pink-500); cursor: pointer;
      font-size: 0.78rem; font-family: var(--font-body); font-weight: 600;
      transition: all 0.2s;
      &:hover { background: rgba(255, 107, 157, 0.15); }
    }

    .overlay {
      position: fixed; inset: 0;
      background: rgba(61, 31, 61, 0.3);
      backdrop-filter: blur(4px);
      z-index: 99;
      display: none; /* Controlled by media query or JS logic */
    }

    .main-content {
      flex: 1; margin-left: 260px;
      display: flex; flex-direction: column;
      position: relative; 
      /* z-index: 1;  <-- REMOVED to allow fixed children (modals) to escape this stacking context and be above sidebar */
    }

    .top-bar {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border-soft);
      background: var(--bg-glass);
      backdrop-filter: blur(12px);
      display: flex; align-items: center; gap: 1rem;
    }

    .menu-btn {
      display: none; background: none; border: none;
      color: var(--pink-400); font-size: 1.5rem; cursor: pointer;
    }

    .page-greeting {
      color: var(--text-medium); font-size: 0.95rem; font-weight: 600;
    }

    .content-area { padding: 1.5rem; flex: 1; }

    /* MEDIA QUERIES FOR IPAD & MOBILE */
    @media (max-width: 1024px) {
      .sidebar { 
        transform: translateX(-100%); 
        width: 250px;
        box-shadow: 4px 0 24px rgba(0,0,0,0.15);
      }
      .sidebar.open { transform: translateX(0); }
      
      .main-content { margin-left: 0; width: 100%; }
      .menu-btn { display: block; font-size: 1.8rem; }
      .close-btn { display: block; font-size: 1.5rem; }
      
      .overlay { 
        display: block; opacity: 0; pointer-events: none; transition: opacity 0.3s; 
      }
      .sidebar.open ~ .overlay { opacity: 1; pointer-events: auto; }
      
      .content-area { padding: 1rem; }
    }

    @media (max-width: 480px) {
      .sidebar { width: 85%; }
      .brand-name { font-size: 1.1rem; }
    }
  `]
})
export class AdminLayoutComponent {
  sidebarOpen = false;
  theme = signal<string>('default');

  constructor(public auth: AuthService) {
    const saved = localStorage.getItem('theme') || 'default';
    this.setTheme(saved);
  }

  setTheme(t: string) {
    this.theme.set(t);
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }
}
