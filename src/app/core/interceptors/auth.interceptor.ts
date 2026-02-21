import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/** URLs de API que no necesitan Bearer token */
const PUBLIC_API_PATTERNS = [
  '/api/clientorder/',   // Vista de la clienta
  '/api/driverroute/',   // Vista del chofer
  '/api/push/',          // Suscripción push (anónima)
];

function isPublicApiRequest(url: string): boolean {
  const lower = url.toLowerCase();
  return PUBLIC_API_PATTERNS.some(pattern => lower.includes(pattern));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  // No enviar token en endpoints públicos — evita 401 con tokens viejos
  if (token && !isPublicApiRequest(req.url)) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(cloned);
  }

  return next(req);
};