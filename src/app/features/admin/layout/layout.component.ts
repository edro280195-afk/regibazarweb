import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent {
  readonly auth = inject(AuthService);

  readonly isMobile = signal(this.viewportWidth() <= 1024);
  readonly moreOpen = signal(false);

  readonly canCreateOrders = computed(() => !['Driver', 'Bodega'].includes(this.auth.userRole()));

  readonly navItems = computed<NavItem[]>(() => {
    const role = this.auth.userRole();
    const allItems: NavItem[] = [
      { label: 'Inicio', icon: 'house', route: '/admin' },
      { label: 'Pedidos', icon: 'package', route: '/admin/orders' },
      { label: 'Inventario', icon: 'shopping-basket', route: '/admin/inventory' },
      { label: 'Etiquetas', icon: 'tag', route: '/admin/labels' },
      { label: 'Enviar enlaces', icon: 'mail-heart', route: '/admin/send-links' },
      { label: 'Clientas', icon: 'users', route: '/admin/clients' },
      { label: 'Rutas', icon: 'route', route: '/admin/routes' },
      { label: 'Tandas', icon: 'repeat', route: '/admin/tandas' },
      { label: 'Sorteos', icon: 'party-popper', route: '/admin/raffles' },
      { label: 'Proveedores', icon: 'factory', route: '/admin/suppliers' },
      { label: 'Finanzas', icon: 'wallet', route: '/admin/financials' },
      { label: 'Reportes', icon: 'chart', route: '/admin/reports' },
      { label: 'C.A.M.I.', icon: 'sparkles', route: '/admin/cami' }
    ];

    if (role === 'Driver') {
      return allItems.filter(item => item.route === '/admin/routes');
    }

    if (role === 'Bodega') {
      return allItems.filter(item => item.route === '/admin/inventory' || item.route === '/admin/labels');
    }

    return allItems;
  });

  readonly mobilePrimaryItems = computed<NavItem[]>(() => {
    const items = this.navItems();
    const preferredRoutes = ['/admin', '/admin/orders', '/admin/inventory', '/admin/clients'];
    const preferred = preferredRoutes
      .map(route => items.find(item => item.route === route))
      .filter((item): item is NavItem => Boolean(item));

    for (const item of items) {
      if (preferred.length >= 4) break;
      if (!preferred.some(selected => selected.route === item.route)) preferred.push(item);
    }

    return preferred.slice(0, this.canCreateOrders() ? 3 : 4);
  });

  readonly mobileMoreItems = computed<NavItem[]>(() => {
    const primaryRoutes = new Set(this.mobilePrimaryItems().map(item => item.route));
    return this.navItems().filter(item => !primaryRoutes.has(item.route));
  });

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile.set(this.viewportWidth() <= 1024);
    if (!this.isMobile()) this.moreOpen.set(false);
  }

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

  userRoleLabel(): string {
    switch (this.auth.userRole()) {
      case 'Bodega': return 'Bodega';
      case 'Driver': return 'Repartidora';
      default: return 'Administradora';
    }
  }

  toggleMore(): void {
    this.moreOpen.update(open => !open);
  }

  closeMore(): void {
    this.moreOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
  }

  private viewportWidth(): number {
    return typeof window === 'undefined' ? 1024 : window.innerWidth;
  }
}
