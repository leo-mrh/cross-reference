import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  auth = inject(AuthService);
  toast = inject(ToastService);

  isUserMenuOpen = signal(false);
  isLogoutModalOpen = signal(false);

  // -------------------------------
  // Cierre del dropdown al hacer click fuera
  // -------------------------------
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.isUserMenuOpen()) return;

    const dropdown = document.getElementById('userDropdown');
    const button = document.getElementById('avatarButton');
    const target = event.target as Node;

    if (!dropdown || !button) return;
    if (!dropdown.contains(target) && !button.contains(target)) {
      this.isUserMenuOpen.set(false);
    }
  }

  // -------------------------------
  // Toast (delegado al servicio)
  // -------------------------------
  isToastVisible() {
    return !!this.toast.message();
  }

  toastMessage() {
    return this.toast.message();
  }

  toastType() {
    return this.toast.type();
  }

  showToast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    this.toast.show(msg, type);
  }

  /** ✅ Cierra manualmente el toast */
  closeToast(): void {
    this.toast.show('', this.toast.type());
  }

  // -------------------------------
  // Menú de usuario
  // -------------------------------
  toggleUserMenu() {
    this.isUserMenuOpen.update((v) => !v);
  }

  openLogoutModal() {
    this.isLogoutModalOpen.set(true);
    this.isUserMenuOpen.set(false);
  }

  closeLogoutModal() {
    this.isLogoutModalOpen.set(false);
  }

  // -------------------------------
  // Datos de usuario
  // -------------------------------

  // ✅ Convertidos a computed() — consistente con avatarUrl, sin cambios en el template
  userName = computed(() => {
    const u = this.auth.currentUser();
    const n = (u?.sNombre ?? u?.firstName ?? u?.nombre ?? u?.S_NOMBRE ?? '').toString();
    if (n) return n;
    const email = (u?.email ?? '').toString();
    return email ? email.split('@')[0] : '';
  });

  userApellido = computed(() => {
    const u = this.auth.currentUser();
    return (u?.sApellidoPaterno ?? u?.lastName ?? u?.apellido ?? u?.apellidoPaterno ?? u?.SAPELLIDOPATERNO ?? '').toString();
  });

  /** ✅ URL del avatar con nombre codificado */
  avatarUrl = computed(() => {
    const nombre = encodeURIComponent(`${this.userName()} ${this.userApellido()}`);
    return `https://ui-avatars.com/api/?size=80&name=${nombre}`;
  });

  // -------------------------------
  // Logout
  // -------------------------------
  logout() {
    this.closeLogoutModal();
    this.showToast('Sesión cerrada', 'success');
    this.auth.logout();
  }
}