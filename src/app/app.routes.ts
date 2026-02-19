import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/components/login/login.component')
      .then(m => m.LoginComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/components/layout/admin-layout.component')
      .then(m => m.AdminLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/admin/components/dashboard/dashboard.component')
          .then(m => m.DashboardComponent)
      },
      {
        path: 'upload',
        loadComponent: () => import('./features/admin/components/upload-excel/upload-excel.component')
          .then(m => m.UploadExcelComponent)
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/admin/components/orders/orders.component')
          .then(m => m.OrdersComponent)
      },
      {
        path: 'orders/:id',
        loadComponent: () => import('./features/admin/components/orders/order-detail/order-detail.component')
          .then(m => m.OrderDetailComponent)
      },
      {
        path: 'routes',
        loadComponent: () => import('./features/admin/components/route-manager/route-manager.component')
          .then(m => m.RouteManagerComponent)
      },
      {
        path: 'clients',
        loadComponent: () => import('./features/admin/components/clients/clients.component')
          .then(m => m.ClientsComponent)
      },
      {
        path: 'calendar',
        loadComponent: () => import('./features/admin/components/delivery-calendar/delivery-calendar.component')
          .then(m => m.DeliveryCalendarComponent)
      },
      {
        path: 'clients/:id',
        loadComponent: () => import('./features/admin/components/clients/client-profile/client-profile.component')
          .then(m => m.ClientProfileComponent)
      },
      {
        path: 'suppliers',
        loadComponent: () => import('./features/admin/components/suppliers/suppliers.component')
          .then(m => m.SuppliersComponent)
      },
      {
        path: 'financials',
        loadComponent: () => import('./features/admin/components/financials/financials.component')
          .then(m => m.FinancialsComponent)
      },

    ]
  },
  {
    path: 'repartidor/:token',
    loadComponent: () => import('./features/driver/components/route-view/route-view.component')
      .then(m => m.RouteViewComponent)
  },
  {
    path: 'pedido/:token',
    loadComponent: () => import('./features/client/components/order-view/order-view.component')
      .then(m => m.OrderViewComponent)
  },
  { path: '', redirectTo: '/admin', pathMatch: 'full' },
  { path: '**', redirectTo: '/admin' }
];
