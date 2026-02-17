import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'entregas_token';
  private nameKey = 'entregas_user';

  private _token = signal<string | null>(this.getStoredToken());
  private _userName = signal<string | null>(localStorage.getItem(this.nameKey));

  isAuthenticated = computed(() => !!this._token());
  userName = computed(() => this._userName());
  token = computed(() => this._token());

  constructor(private router: Router) {}

  login(token: string, name: string): void {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.nameKey, name);
    this._token.set(token);
    this._userName.set(name);
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.nameKey);
    this._token.set(null);
    this._userName.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this._token();
  }

  private getStoredToken(): string | null {
    const token = localStorage.getItem(this.tokenKey);
    if (!token) return null;

    // Check expiration
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem(this.tokenKey);
        return null;
      }
    } catch {
      return null;
    }

    return token;
  }
}
