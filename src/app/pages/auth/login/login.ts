import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  email = '';
  password = '';
  error = '';
  isSubmitting = false;
  showPassword = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  async onSubmit(e: Event): Promise<void> {
    e.preventDefault();

    // ✅ Guard contra doble-submit
    if (this.isSubmitting) return;

    // ✅ Validación en TS
    if (!this.email.trim() || !this.password.trim()) {
      this.error = 'Por favor ingrese email y contraseña.';
      return;
    }

    this.isSubmitting = true;
    this.error = '';
    this.cdr.detectChanges();

    try {
      const success = await this.auth.login(this.email.trim(), this.password);

      if (success) {
        this.router.navigate(['/home']);
      } else {
        this.error = 'Credenciales inválidas. Por favor verifique su correo y contraseña.';
        this.cdr.detectChanges();
      }
    } catch {
      this.error = 'No se pudo conectar con el servidor. Intente nuevamente.';
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }
}