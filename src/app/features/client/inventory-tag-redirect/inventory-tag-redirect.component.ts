import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/** Puente seguro para las URL que se escriben en cada etiqueta NFC. */
@Component({
  selector: 'app-inventory-tag-redirect',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-screen grid place-items-center bg-rose-50 px-6 text-center text-pink-950">
      <section class="rounded-3xl border border-pink-100 bg-white/80 p-8 shadow-xl shadow-pink-200/30">
        <div class="text-4xl">🧺</div>
        <h1 class="mt-3 text-xl font-black">Abriendo tu caja…</h1>
        <p class="mt-2 text-sm text-pink-700">Un momento, por favor.</p>
      </section>
    </main>
  `
})
export class InventoryTagRedirectComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  constructor() {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      void this.router.navigate(['/admin/inventory']);
      return;
    }

    const target = `/admin/inventory?tag=${encodeURIComponent(token)}`;
    if (this.auth.isLoggedIn()) {
      void this.router.navigateByUrl(target);
      return;
    }

    void this.router.navigate(['/login'], { queryParams: { returnUrl: target } });
  }
}
