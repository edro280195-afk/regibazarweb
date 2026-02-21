import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Determina si el usuario está en una página pública
 * revisando la RUTA de Angular (no la URL del request API).
 */
function isOnPublicPage(): boolean {
  const path = window.location.pathname.toLowerCase();
  return path.startsWith('/pedido/') || path.startsWith('/repartidor/');
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // En páginas públicas, nunca adjuntar token
  if (isOnPublicPage()) {
    return next(req);
  }

  const token = auth.getToken();

  if (token) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(authReq);
  }

  return next(req);
};