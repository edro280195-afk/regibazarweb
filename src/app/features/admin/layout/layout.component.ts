import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <!-- Mobile overlay -->
    @if (isMobile() && sidebarOpen()) {
      <div class="mobile-overlay" (click)="sidebarOpen.set(false)"></div>
    }

    <div class="app-shell">
      <!-- ═══════ SIDEBAR ═══════ -->
      <aside class="sidebar"
             [class.collapsed]="!sidebarOpen()"
             [class.mobile-visible]="isMobile() && sidebarOpen()">

        <!-- Brand -->
        <div class="sidebar-brand">
          <div class="brand-logo overflow-hidden border border-pink-200/50">
            <img src="pwa-icon.png" alt="Logo" class="w-full h-full object-cover">
          </div>
          @if (sidebarOpen()) {
            <div class="brand-text">
              <span class="brand-name">Regi Bazar</span>
              <span class="brand-sub">Admin Panel</span>
            </div>
          }
        </div>

        <!-- Navigation -->
        <nav class="sidebar-nav">
          @for (item of navItems; track item.route) {
            <a [routerLink]="item.route"
               routerLinkActive="nav-active"
               [routerLinkActiveOptions]="{ exact: item.route === '/admin' }"
               class="nav-link"
               [class.nav-collapsed]="!sidebarOpen()"
               (click)="onNavClick()">
              <span class="nav-icon">{{ item.icon }}</span>
              @if (sidebarOpen()) {
                <span class="nav-label">{{ item.label }}</span>
              }
              <!-- Tooltip when collapsed -->
              @if (!sidebarOpen()) {
                <div class="nav-tooltip">{{ item.label }}</div>
              }
            </a>
          }
        </nav>

        <!-- Footer -->
        <div class="sidebar-footer">
          <button (click)="sidebarOpen.set(!sidebarOpen())" class="nav-link footer-btn">
            <span class="nav-icon toggle-icon" [class.rotated]="!sidebarOpen()">◀</span>
            @if (sidebarOpen()) {
              <span class="nav-label" style="font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase;">Contraer</span>
            }
          </button>
          <button (click)="logout()" class="nav-link footer-btn logout-btn">
            <span class="nav-icon">🚪</span>
            @if (sidebarOpen()) {
              <span class="nav-label">Salir</span>
            }
          </button>
        </div>
      </aside>

      <!-- ═══════ MAIN ═══════ -->
      <div class="main-area"
           [style.margin-left]="isMobile() ? '0' : (sidebarOpen() ? '272px' : '80px')">

        <!-- Top Bar -->
        <header class="top-bar">
          <div class="top-left">
            @if (isMobile()) {
              <button (click)="sidebarOpen.set(!sidebarOpen())" class="mobile-toggle">
                <span>☰</span>
              </button>
            }
            <div>
              <p class="greeting">{{ greeting() }}</p>
              <h1 class="date-title">{{ todayDate() }}</h1>
            </div>
          </div>
          <div class="user-chip">
            <div class="user-avatar">{{ userInitial() }}</div>
            <div class="user-info">
              <span class="user-role">Administradora</span>
              <span class="user-name">Regi Bazar</span>
            </div>
          </div>
        </header>

        <!-- Page Content -->
        <main class="page-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* ═══ APP SHELL ═══ */
    .app-shell {
      min-height: 100vh;
      background: linear-gradient(160deg, #fff5f7 0%, #fdf2f8 30%, #fce7f3 60%, #fdf2f8 100%);
      position: relative;
    }

    /* ═══ SIDEBAR ═══ */
    .sidebar {
      position: fixed;
      top: 12px;
      left: 12px;
      bottom: 12px;
      width: 256px;
      z-index: 50;
      display: flex;
      flex-direction: column;
      border-radius: 1.5rem;
      background: linear-gradient(180deg, #9d174d 0%, #be185d 40%, #db2777 100%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow:
        0 25px 60px rgba(157, 23, 77, 0.35),
        0 0 80px rgba(236, 72, 153, 0.1),
        0 0 0 1px rgba(255, 255, 255, 0.08) inset,
        0 1px 0 rgba(255, 255, 255, 0.1) inset;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      overflow: hidden;
    }

    .sidebar.collapsed {
      width: 72px;
    }

    /* ═══ BRAND ═══ */
    .sidebar-brand {
      padding: 1.5rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.875rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    }

    .brand-logo {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      background: linear-gradient(135deg, #fbcfe8, #f9a8d4);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 8px 24px rgba(251, 207, 232, 0.5);
      animation: float 4s ease-in-out infinite;
    }

    .logo-emoji { font-size: 1.25rem; }

    .brand-text {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: fadeSlideIn 0.3s ease;
    }

    .brand-name {
      font-family: var(--font-headings);
      color: white;
      font-size: 1.2rem;
      font-weight: 900;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }

    .brand-sub {
      color: rgba(255, 255, 255, 0.35);
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.2em;
    }

    /* ═══ NAV ═══ */
    .sidebar-nav {
      flex: 1;
      padding: 0.75rem 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .sidebar-nav::-webkit-scrollbar { width: 3px; }
    .sidebar-nav::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 10px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.7rem 0.875rem;
      border-radius: 0.875rem;
      color: rgba(255, 255, 255, 0.55);
      text-decoration: none;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      border: 1px solid transparent;
      cursor: pointer;
      background: transparent;
      width: 100%;
      text-align: left;
      font-family: inherit;
    }

    .nav-link:hover {
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.04);
    }

    .nav-link.nav-collapsed {
      justify-content: center;
      padding: 0.7rem;
    }

    .nav-link.nav-collapsed .nav-icon {
      margin: 0;
    }

    .nav-active {
      color: white !important;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(251, 207, 232, 0.15)) !important;
      border-color: rgba(255, 255, 255, 0.3) !important;
      box-shadow:
        0 0 25px rgba(251, 207, 232, 0.25),
        0 8px 20px rgba(157, 23, 77, 0.2);
    }

    .nav-active::before {
      content: '';
      position: absolute;
      left: -4px;
      top: 50%;
      transform: translateY(-50%);
      width: 4px;
      height: 1.25rem;
      background: linear-gradient(180deg, #fbcfe8, #f9a8d4);
      border-radius: 0 4px 4px 0;
      box-shadow: 0 0 16px rgba(251, 207, 232, 0.6);
    }

    .nav-icon {
      font-size: 1.15rem;
      width: 2rem;
      text-align: center;
      flex-shrink: 0;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .nav-link:hover .nav-icon {
      transform: scale(1.2) rotate(8deg);
    }

    .nav-label {
      font-size: 0.825rem;
      font-weight: 600;
      white-space: nowrap;
      letter-spacing: -0.01em;
    }

    .nav-tooltip {
      position: absolute;
      left: calc(100% + 12px);
      top: 50%;
      transform: translateY(-50%);
      padding: 0.375rem 0.75rem;
      background: linear-gradient(135deg, #be185d, #9d174d);
      color: white;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-radius: 0.5rem;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
      box-shadow: 0 8px 24px rgba(157, 23, 77, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.2);
      z-index: 999;
    }

    .nav-link:hover .nav-tooltip {
      opacity: 1;
    }

    /* ═══ FOOTER ═══ */
    .sidebar-footer {
      padding: 0.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .footer-btn {
      font-size: 0.8rem;
    }

    .toggle-icon {
      transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      display: inline-block;
    }

    .toggle-icon.rotated {
      transform: rotate(180deg);
    }

    .logout-btn {
      color: rgba(255, 100, 100, 0.5) !important;
    }

    .logout-btn:hover {
      color: rgba(255, 150, 150, 0.9) !important;
      background: rgba(255, 100, 100, 0.08) !important;
    }

    /* ═══ MAIN AREA ═══ */
    .main-area {
      min-height: 100vh;
      transition: margin-left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      display: flex;
      flex-direction: column;
    }

    .top-bar {
      padding: 1.5rem 2rem;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
    }

    .top-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .greeting {
      font-family: var(--font-accent);
      color: #ec4899;
      font-size: 1.5rem;
      line-height: 1;
      margin-bottom: 0.25rem;
    }

    .date-title {
      font-family: var(--font-headings);
      font-size: 2rem;
      font-weight: 900;
      color: #831843;
      letter-spacing: -0.03em;
      line-height: 1.1;
    }

    .mobile-toggle {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.75rem;
      border: 1px solid rgba(0, 0, 0, 0.06);
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      color: #9d174d;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .mobile-toggle:hover {
      background: #fdf2f8;
      border-color: #f9a8d4;
    }

    .user-chip {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 1rem 0.5rem 0.5rem;
      background: white;
      border-radius: 999px;
      border: 1px solid rgba(0, 0, 0, 0.04);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
      transition: all 0.3s ease;
    }

    .user-chip:hover {
      box-shadow: 0 4px 20px rgba(236, 72, 153, 0.12);
      border-color: rgba(236, 72, 153, 0.15);
    }

    .user-avatar {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      background: linear-gradient(135deg, #f472b6, #ec4899);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 900;
      font-size: 1rem;
      box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);
    }

    .user-info {
      display: flex;
      flex-direction: column;
    }

    .user-role {
      font-size: 0.6rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #1e1b2e;
      line-height: 1;
    }

    .user-name {
      font-size: 0.8rem;
      font-weight: 600;
      color: #9d174d;
    }

    .page-content {
      flex: 1;
      padding: 0 2rem 2rem;
    }

    /* ═══ MOBILE ═══ */
    .mobile-overlay {
      position: fixed;
      inset: 0;
      background: rgba(157, 23, 77, 0.15);
      backdrop-filter: blur(4px);
      z-index: 40;
      animation: fadeIn 0.2s ease;
    }

    @media (max-width: 1024px) {
      .sidebar {
        top: 0;
        left: -300px;
        bottom: 0;
        border-radius: 0 1.5rem 1.5rem 0;
        z-index: 50;
      }

      .sidebar.mobile-visible {
        left: 0;
      }

      .top-bar { padding: 1rem; }
      .page-content { padding: 0 1rem 1rem; }
      .date-title { font-size: 1.5rem; }
      .greeting { font-size: 1.1rem; }
    }

    /* ═══ ANIMATIONS ═══ */
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateX(-8px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `]
})
export class LayoutComponent {
  private auth = inject(AuthService);

  sidebarOpen = signal(window.innerWidth > 1024);
  isMobile = signal(window.innerWidth <= 1024);

  @HostListener('window:resize')
  onResize() {
    this.isMobile.set(window.innerWidth <= 1024);
    if (window.innerWidth > 1024 && !this.sidebarOpen()) {
      this.sidebarOpen.set(true);
    }
  }

  navItems: NavItem[] = [
    { label: 'Dashboard', icon: '🏠', route: '/admin' },
    { label: 'Pedidos', icon: '📦', route: '/admin/orders' },
    { label: 'Clientas', icon: '👩‍💼', route: '/admin/clients' },
    { label: 'Rutas', icon: '🚗', route: '/admin/routes' },
    { label: 'Proveedores', icon: '🏭', route: '/admin/suppliers' },
    { label: 'Finanzas', icon: '💰', route: '/admin/financials' },
    { label: 'Reportes', icon: '📊', route: '/admin/reports' },
    { label: 'Cortes de Venta', icon: '📋', route: '/admin/sales-periods' },
    { label: 'C.A.M.I.', icon: '✦', route: '/admin/cami' }
  ];

  greeting(): string {
    const hour = new Date().getHours();
    const name = this.auth.userName() || 'Hermosa';
    if (hour < 12) return `Buenos días, ${name}`;
    if (hour < 18) return `Buenas tardes, ${name}`;
    return `Buenas noches, ${name}`;
  }

  todayDate(): string {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    const text = date.toLocaleDateString('es-MX', options);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  userInitial(): string {
    const name = this.auth.userName();
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  onNavClick(): void {
    if (this.isMobile()) {
      this.sidebarOpen.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
