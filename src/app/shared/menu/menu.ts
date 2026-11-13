import { Component, signal, inject, DestroyRef } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const MOBILE_BREAKPOINT = 768;

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './menu.html',
})
export class Menu {
  private auth = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private sidebarService = inject(SidebarService);

  isSidebarOpen = this.sidebarService.isOpen;
  isCruceOpen = signal(false);
  isDespieceOpen = signal(false);
  isUsuariosOpen = signal(false);
  isKitsOpen = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT) {
          this.sidebarService.close();
        }
      });
  }

  toggleSidebar() {
    this.sidebarService.toggle();
  }

  toggleCruce() {
    this.isCruceOpen.update(v => !v);
  }

  onToggleCruce() {
    if (!this.isSidebarOpen()) {
      this.toggleSidebar();
      return;
    }
    this.toggleCruce();
  }

  toggleDespiece() {
    this.isDespieceOpen.update(v => !v);
  }

  onToggleDespiece() {
    if (!this.isSidebarOpen()) {
      this.toggleSidebar();
      return;
    }
    this.toggleDespiece();
  }

  toggleUsuarios() {
    this.isUsuariosOpen.update(v => !v);
  }

  onToggleUsuarios() {
    if (!this.isSidebarOpen()) {
      this.toggleSidebar();
      return;
    }
    this.toggleUsuarios();
  }

  toggleKits() {
    this.isKitsOpen.update(v => !v);
  }

  onToggleKits() {
    if (!this.isSidebarOpen()) {
      this.toggleSidebar();
      return;
    }
    this.toggleKits();
  }

  userRole() {
    return this.auth.getRole();
  }
}