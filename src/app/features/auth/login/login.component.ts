import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
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
        
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const canReturnToInventory = returnUrl?.startsWith('/admin/inventory');

        if (res.role === 'Driver') {
          this.router.navigate(['/admin/routes']);
        } else if (res.role === 'Scaner') {
          this.router.navigate(['/pos']);
        } else if (res.role === 'Bodega') {
          if (canReturnToInventory && returnUrl) {
            this.router.navigateByUrl(returnUrl);
          } else {
            this.router.navigate(['/admin/inventory']);
          }
        } else if (canReturnToInventory && returnUrl) {
          this.router.navigateByUrl(returnUrl);
        } else {
          this.router.navigate(['/admin']);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err.error?.message || err.error || 'Correo o contraseña incorrectos');
      }
    });
  }
}
