import { Component, AfterViewInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Menu } from '../../shared/menu/menu';
import { Modal } from '../../shared/modal/modal';
import { UserInsert } from './insert';

type UserModel = {
  idUsuario: number;
  idRol?: number | null;
  idArea?: number | null;
  sNombre?: string;
  sApellidoPaterno?: string;
  sApellidoMaterno?: string;
  sUsuario?: string;
  sCorreo: string;
  bActivo?: number | null;
};

type EstadoFiltro = 'todos' | 'activos' | 'inactivos';

/** Payload editable de un usuario (coincide con UpdateUserDto del backend). */
type UpdateUserPayload = {
  sNombre?: string;
  sApellidoPaterno?: string;
  sApellidoMaterno?: string;
  sUsuario?: string;
  sCorreo?: string;
  idRol?: number;
  idArea?: number;
};

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Menu,
    Modal,
    UserInsert,
  ],
  templateUrl: './list.html',
})
export class User implements AfterViewInit {

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  users = signal<UserModel[]>([]);
  userSearchTerm = signal('');
  estadoFiltro = signal<EstadoFiltro>('todos');
  pageSize = 10;
  page = signal(1);

  // -------------------------------
  // Usuario actualmente logueado (para el candado de auto-desactivación)
  // -------------------------------
  currentUserId = signal<number | null>(null);

  filteredUsers = computed(() => {
    const term = this.userSearchTerm().trim().toLowerCase();
    const estado = this.estadoFiltro();

    return this.users().filter((u) => {
      if (estado === 'activos' && Number(u.bActivo) !== 1) return false;
      if (estado === 'inactivos' && Number(u.bActivo) !== 0) return false;

      if (!term) return true;

      const values = [
        u.idUsuario, u.sNombre, u.sApellidoPaterno, u.sApellidoMaterno,
        u.sUsuario, u.sCorreo, u.idRol, u.idArea, u.bActivo,
      ];
      return values
        .filter((v) => v !== null && v !== undefined)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  });

  pageCount = computed(() => {
    const total = this.filteredUsers().length;
    return Math.max(1, Math.ceil(total / this.pageSize));
  });

  paginatedUsers = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredUsers().slice(start, start + this.pageSize);
  });

  range = computed(() => {
    const total = this.filteredUsers().length;
    const start = total ? (this.page() - 1) * this.pageSize + 1 : 0;
    const end = Math.min(this.page() * this.pageSize, total);
    return { start, end, total };
  });

  // Contador para las pestañas de filtro
  countActivos = computed(() => this.users().filter((u) => Number(u.bActivo) === 1).length);
  countInactivos = computed(() => this.users().filter((u) => Number(u.bActivo) === 0).length);

  // -------------------------------
  // Modal: Ver (solo lectura)
  // -------------------------------
  viewOpen = signal(false);
  viewingUser = signal<UserModel | null>(null);

  // -------------------------------
  // Modal: Insertar
  // -------------------------------
  createUserModalOpen = signal(false);

  // -------------------------------
  // Modal: Editar usuario
  // -------------------------------
  editOpen = signal(false);
  editingUser = signal<UserModel | null>(null);
  editForm = signal<UpdateUserPayload>({});
  editBusy = signal(false);
  editError = signal<string | null>(null);

  // -------------------------------
  // Modal: Confirmar Activar/Desactivar
  // -------------------------------
  toggleConfirmOpen = signal(false);
  userToToggle = signal<UserModel | null>(null);
  toggleBusy = signal(false);
  toggleError = signal<string | null>(null);

  // -------------------------------
  // Modal: Operación exitosa
  // -------------------------------
  savedModalOpen = signal(false);
  savedModalMessage = signal('Datos guardados exitosamente');

  ngAfterViewInit(): void {
    void this.loadUsers();
    this.currentUserId.set(this.getCurrentUserIdFromToken());

    const modal = this.route.snapshot.queryParamMap.get('modal');
    if (modal === 'insert') {
      this.openCreateUserModal();
    }
  }

  // -------------------------------
  // Identidad del usuario logueado
  // -------------------------------
  /**
   * Decodifica el JWT almacenado para obtener el ID del usuario actual.
   * ⚠️ Asume que el token se guarda en localStorage bajo la key "access_token".
   * Ajustar si el proyecto usa otro mecanismo (AuthService, sessionStorage, etc.).
   */
  private getCurrentUserIdFromToken(): number | null {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return null;

      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return null;

      const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson) as { sub?: number };

      return typeof payload.sub === 'number' ? payload.sub : null;
    } catch {
      return null;
    }
  }

  isSelf(u: UserModel): boolean {
    const id = this.currentUserId();
    return id !== null && id === u.idUsuario;
  }

  // -------------------------------
  // Carga de usuarios
  // -------------------------------
  async loadUsers() {
    try {
      const data = await firstValueFrom(this.http.get<UserModel[]>('/api/users'));
      const arr = Array.isArray(data) ? data : [];
      arr.sort((a, b) => Number(a?.idUsuario ?? 0) - Number(b?.idUsuario ?? 0));
      this.users.set(arr);
      this.page.set(1);
    } catch {
      this.users.set([]);
      this.page.set(1);
    }
  }

  // -------------------------------
  // Filtros y paginación
  // -------------------------------
  onSearchUsers(value: string) {
    this.userSearchTerm.set(value);
    this.page.set(1);
  }

  setEstadoFiltro(estado: EstadoFiltro) {
    this.estadoFiltro.set(estado);
    this.page.set(1);
  }

  firstPage() { this.page.set(1); }
  prevPage() { if (this.page() > 1) this.page.update((p) => p - 1); }
  nextPage() { if (this.page() < this.pageCount()) this.page.update((p) => p + 1); }
  lastPage() { this.page.set(this.pageCount()); }

  // -------------------------------
  // Modal: Ver
  // -------------------------------
  openViewModal(u: UserModel) {
    this.viewingUser.set(u);
    this.viewOpen.set(true);
  }

  closeViewModal() {
    this.viewOpen.set(false);
    this.viewingUser.set(null);
  }

  // -------------------------------
  // Modal: Insertar
  // -------------------------------
  openCreateUserModal() {
    this.createUserModalOpen.set(true);
  }

  closeCreateUserModal() {
    this.createUserModalOpen.set(false);

    const modal = this.route.snapshot.queryParamMap.get('modal');
    if (modal === 'insert') {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { modal: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  onUserInserted() {
    void this.loadUsers();
    if (this.createUserModalOpen()) {
      this.closeCreateUserModal();
    }
  }

  goHome() {
    void this.router.navigateByUrl('/home');
  }

  // -------------------------------
  // Modal: Editar usuario
  // -------------------------------
  openEditModal(u: UserModel) {
    this.editingUser.set(u);
    this.editForm.set({
      sNombre: u.sNombre ?? '',
      sApellidoPaterno: u.sApellidoPaterno ?? '',
      sApellidoMaterno: u.sApellidoMaterno ?? '',
      sUsuario: u.sUsuario ?? '',
      sCorreo: u.sCorreo ?? '',
      idRol: u.idRol ?? undefined,
      idArea: u.idArea ?? undefined,
    });
    this.editError.set(null);
    this.editOpen.set(true);
  }

  closeEditModal() {
    if (this.editBusy()) return;
    this.editOpen.set(false);
    this.editingUser.set(null);
    this.editForm.set({});
    this.editError.set(null);
  }

  updateEditField<K extends keyof UpdateUserPayload>(field: K, value: UpdateUserPayload[K]) {
    this.editForm.update((f) => ({ ...f, [field]: value }));
  }

  async updateRegistro() {
    const usuario = this.editingUser();
    if (!usuario || this.editBusy()) return;

    this.editBusy.set(true);
    this.editError.set(null);

    const form = this.editForm();
    const payload: UpdateUserPayload = {
      sNombre: form.sNombre?.trim(),
      sApellidoPaterno: form.sApellidoPaterno?.trim(),
      sApellidoMaterno: form.sApellidoMaterno?.trim(),
      sUsuario: form.sUsuario?.trim(),
      sCorreo: form.sCorreo?.trim(),
      idRol: form.idRol !== undefined ? Number(form.idRol) : undefined,
      idArea: form.idArea !== undefined ? Number(form.idArea) : undefined,
    };

    try {
      await firstValueFrom(
        this.http.patch<UserModel>(`/api/users/${usuario.idUsuario}`, payload)
      );
      await this.loadUsers();
      this.closeEditModal();
      this.savedModalMessage.set('Usuario actualizado exitosamente');
      this.savedModalOpen.set(true);
    } catch (err) {
      this.editError.set(this.extractErrorMessage(err));
    } finally {
      this.editBusy.set(false);
    }
  }

  // -------------------------------
  // Modal: Activar / Desactivar
  // -------------------------------
  openToggleConfirm(u: UserModel) {
    this.userToToggle.set(u);
    this.toggleError.set(null);
    this.toggleConfirmOpen.set(true);
  }

  closeToggleConfirm() {
    if (this.toggleBusy()) return;
    this.toggleConfirmOpen.set(false);
    this.userToToggle.set(null);
    this.toggleError.set(null);
  }

async confirmToggleActivo() {
  const usuario = this.userToToggle();
  if (!usuario || this.toggleBusy()) return;

  const nuevoEstado = Number(usuario.bActivo) !== 1;

  this.toggleBusy.set(true);
  this.toggleError.set(null);

  try {
    await firstValueFrom(
      this.http.patch<UserModel>(`/api/users/${usuario.idUsuario}/activo`, {
        activo: nuevoEstado,
      })
    );
    await this.loadUsers();

    // 👇 Reset directo, sin pasar por closeToggleConfirm() (su guard de
    // toggleBusy() bloquearía el cierre justo aquí, ya que toggleBusy
    // todavía es true en este punto del try).
    this.toggleConfirmOpen.set(false);
    this.userToToggle.set(null);
    this.toggleError.set(null);

    this.savedModalMessage.set(
      nuevoEstado ? 'Usuario reactivado exitosamente' : 'Usuario desactivado exitosamente'
    );
    this.savedModalOpen.set(true);
  } catch (err) {
    this.toggleError.set(this.extractErrorMessage(err));
  } finally {
    this.toggleBusy.set(false);
  }
}

  closeSavedModal() {
    this.savedModalOpen.set(false);
  }

  // -------------------------------
  // Helpers de presentación
  // -------------------------------
  userFullName(u: UserModel): string {
    const parts = [u.sNombre, u.sApellidoPaterno, u.sApellidoMaterno]
      .map((x) => String(x ?? '').trim())
      .filter((x) => x);
    return parts.length ? parts.join(' ') : '—';
  }

  roleLabel(idRol: unknown): string {
    const n = Number(idRol);
    if (n === 1) return 'Admin';
    if (n === 2) return 'Usuario';
    return '—';
  }

  areaLabel(idArea: unknown): string {
    const n = Number(idArea);
    if (n === 1) return 'Ventas';
    if (n === 2) return 'PostVenta';
    return '—';
  }

  activeLabel(bActivo: unknown): string {
    const n = Number(bActivo);
    if (n === 1) return 'Activo';
    if (n === 0) return 'Inactivo';
    return '—';
  }

  isActivo(u: UserModel): boolean {
    return Number(u.bActivo) === 1;
  }

  /** Extrae un mensaje legible de un error HTTP de NestJS (string o array de class-validator). */
  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const msg = err.error?.message;
      if (Array.isArray(msg)) return msg.join(' · ');
      if (typeof msg === 'string') return msg;
    }
    return 'Ocurrió un error inesperado. Intenta nuevamente.';
  }
}