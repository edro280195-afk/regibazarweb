import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
    },
    {
        path: 'admin',
        loadComponent: () => import('./features/admin/layout/layout.component').then(m => m.LayoutComponent),
        canActivate: [authGuard],
        children: [
            {
                path: '',
                loadComponent: () => import('./features/admin/dashboard/dashboard.component').then(m => m.DashboardComponent)
            },
            {
                path: 'orders',
                loadComponent: () => import('./features/admin/orders/orders.component').then(m => m.OrdersComponent)
            },
            {
                path: 'capture',
                loadComponent: () => import('./features/admin/orders/capture-order/capture-order').then(m => m.CaptureOrderComponent)
            },
            {
                path: 'clients',
                loadComponent: () => import('./features/admin/clients/clients.component').then(m => m.ClientsComponent)
            },
            {
                path: 'clients/:id',
                loadComponent: () => import('./features/admin/clients/client-profile/client-profile.component').then(m => m.ClientProfileComponent)
            },
            {
                path: 'routes',
                loadComponent: () => import('./features/admin/routes/routes.component').then(m => m.RoutesComponent)
            },
            {
                path: 'suppliers',
                loadComponent: () => import('./features/admin/suppliers/suppliers.component').then(m => m.SuppliersComponent)
            },
            {
                path: 'financials',
                loadComponent: () => import('./features/admin/financials/financials.component').then(m => m.FinancialsComponent)
            },
            {
                path: 'reports',
                loadComponent: () => import('./features/admin/reports/reports.component').then(m => m.ReportsComponent)
            },
            {
                path: 'sales-periods',
                loadComponent: () => import('./features/admin/sales-periods/sales-periods.component').then(m => m.SalesPeriodsComponent)
            },
            {
                path: 'cami',
                loadComponent: () => import('./features/admin/cami/cami-panel.component').then(m => m.CamiPanelComponent)
            },
            {
                path: 'glow-up',
                loadComponent: () => import('./features/admin/glow-up/glow-up.component').then(m => m.GlowUpComponent)
            }
        ]
    },
    {
        path: 'pedido/:token',
        loadComponent: () => import('./features/client/order-view/order-view.component').then(m => m.OrderViewComponent)
    },
    {
        path: 'repartidor/:token',
        loadComponent: () => import('./features/driver/route-view/route-view.component').then(m => m.RouteViewComponent)
    },
    { path: '', redirectTo: '/admin', pathMatch: 'full' },
    { path: '**', redirectTo: '/admin' }
];
