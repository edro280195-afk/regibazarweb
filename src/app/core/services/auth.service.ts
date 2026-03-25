import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly tokenKey = 'rb_token';
    private readonly nameKey = 'rb_name';
    private readonly expiresKey = 'rb_expires';
    private readonly roleKey = 'rb_role';

    private _userName = signal<string>(this.storedName());
    private _userRole = signal<string>(this.storedRole());
    private _isLoggedIn = signal<boolean>(this.checkToken());

    readonly userName = this._userName.asReadonly();
    readonly userRole = this._userRole.asReadonly();
    readonly isLoggedIn = this._isLoggedIn.asReadonly();

    constructor(private http: HttpClient, private router: Router) { }

    login(req: LoginRequest) {
        return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, req);
    }

    handleLoginSuccess(res: LoginResponse): void {
        localStorage.setItem(this.tokenKey, res.token);
        localStorage.setItem(this.nameKey, res.name);
        localStorage.setItem(this.roleKey, res.role);
        localStorage.setItem(this.expiresKey, res.expiresAt);
        this._userName.set(res.name);
        this._userRole.set(res.role);
        this._isLoggedIn.set(true);
    }

    logout(): void {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.nameKey);
        localStorage.removeItem(this.roleKey);
        localStorage.removeItem(this.expiresKey);
        this._userName.set('');
        this._userRole.set('Admin');
        this._isLoggedIn.set(false);
        this.router.navigate(['/login']);
    }

    getToken(): string | null {
        return localStorage.getItem(this.tokenKey);
    }

    private storedName(): string {
        if (typeof localStorage === 'undefined') return '';
        return localStorage.getItem(this.nameKey) || '';
    }

    private storedRole(): string {
        if (typeof localStorage === 'undefined') return 'Admin';
        return localStorage.getItem(this.roleKey) || 'Admin';
    }

    private checkToken(): boolean {
        if (typeof localStorage === 'undefined') return false;
        const token = localStorage.getItem(this.tokenKey);
        const expires = localStorage.getItem(this.expiresKey);
        if (!token || !expires) return false;
        return new Date(expires) > new Date();
    }
}
