import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  currentUser = signal<any>(null);
  private http = inject(HttpClient);

  constructor(private router: Router) {
    this.loadUser();
  }

  private loadUser() {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        this.currentUser.set(JSON.parse(stored));
      } catch {
        this.logout();
      }
    }
  }

  async login(email: string, pass: string): Promise<boolean> {
    const start = Date.now();
    try {
      console.log('Iniciando petición de login con HttpClient...');
      const data = await firstValueFrom(
        this.http.post<any>('/api/auth/login', { email, password: pass })
      );

      console.log(`Respuesta recibida en ${Date.now() - start}ms`);

      if (data && data.access_token) {
        localStorage.setItem('token', data.access_token);

        let user = data.user ?? null;

        try {
          const me = await firstValueFrom(this.http.get<any>('/api/auth/me'));
          if (me) user = me;
        } catch {}

        if (user) {
          localStorage.setItem('user', JSON.stringify(user));
          this.currentUser.set(user);
        }

        return true;
      }
    } catch (e: any) {
      console.error('Error en login:', e);
      console.log(`Error detectado tras ${Date.now() - start}ms. Status: ${e.status}`);
    }
    return false;
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken() {
    return localStorage.getItem('token');
  }

  getRole() {
    const u = this.currentUser();
    if (!u) return null as any;
    if (typeof u.role === 'string') return u.role;
    const id = (u.idRol ?? u.id_role ?? u.roleId) as number | undefined;
    if (typeof id === 'number') {
      return id === 1 ? 'admin' : 'user';
    }
    return 'user';
  }
}
