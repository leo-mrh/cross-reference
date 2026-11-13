import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

type CreatedUser = { idUsuario?: number } & Record<string, any>;

@Component({
  selector: 'app-user-insert',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './insert.html',
})
export class UserInsert {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  @Input() showCancel = true;
  @Output() cancel = new EventEmitter<void>();
  @Output() created = new EventEmitter<CreatedUser>();

  busy = signal(false);
  submitted = signal(false);
  showPassword = signal(false);

  form = this.fb.group({
    sNombre: ['', [Validators.required]],
    sApellidoPaterno: ['', [Validators.required]],
    sApellidoMaterno: ['', [Validators.required]],
    sUsuario: ['', [Validators.required]],
    idRol: ['', [Validators.required]],
    idArea: ['', [Validators.required]],
    sCorreo: ['', [Validators.required, Validators.email]],
    sPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  togglePasswordVisibility() {
    this.showPassword.update((v) => !v);
  }

  showError(controlName: string, errorKey: string): boolean {
    const c = this.form.get(controlName);
    if (!c) return false;
    const shouldShow = this.submitted() || c.touched || c.dirty;
    return shouldShow && !!c.errors?.[errorKey];
  }

  async submit() {
    if (this.busy()) return;

    this.submitted.set(true);
    this.form.markAllAsTouched();

    if (this.form.invalid) return;

    this.busy.set(true);
    try {
      const v = this.form.getRawValue();

      const payload = {
        sNombre: v.sNombre ?? '',
        sApellidoPaterno: v.sApellidoPaterno ?? '',
        sApellidoMaterno: v.sApellidoMaterno ?? '',
        sUsuario: v.sUsuario ?? '',
        sCorreo: v.sCorreo ?? '',
        sPassword: v.sPassword ?? '',
        idRol: Number(v.idRol),
        idArea: Number(v.idArea),
        bActivo: 1,
      };

      const res = await firstValueFrom(this.http.post<CreatedUser>('/api/users', payload));

      this.created.emit(res ?? {});
      this.form.reset({
        sNombre: '',
        sApellidoPaterno: '',
        sApellidoMaterno: '',
        sUsuario: '',
        idRol: '',
        idArea: '',
        sCorreo: '',
        sPassword: '',
      });
      this.submitted.set(false);
      this.showPassword.set(false);
    } catch {
      alert('Error al guardar el usuario');
    } finally {
      this.busy.set(false);
    }
  }
}
