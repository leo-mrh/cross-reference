import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { EtlApi } from '../../services/etl.api';
import { ToastService } from '../../services/toast.service';
import { SidebarService } from '../../services/sidebar.service';
import { Menu } from '../../shared/menu/menu';

/* ----------------------------------------------------------
   INTERFAZ PARA TIPAR LA RESPUESTA DEL PERFIL DE USUARIO
   TODO: mover a src/app/models/user-profile.model.ts
---------------------------------------------------------- */
interface UserProfile {
  role?: string;
  idRol?: number;
  id_role?: number;
  roleId?: number;
  email?: string;
  sCorreo?: string;
  user?: UserProfile;
  usuario?: UserProfile;
  perfil?: UserProfile;
  profile?: UserProfile;
  [key: string]: any;
}

/* ----------------------------------------------------------
   ESTADOS POSIBLES DEL PROCESO ETL
   TODO: mover a src/app/services/etl.api.ts
---------------------------------------------------------- */
enum EtlStatus {
  Fail       = 0,
  Success    = 1,
  Retry      = 2,
  Cancel     = 3,
  InProgress = 4,
}

/** Estructura real devuelta por GET /api/refacciones/stats */
interface RefaccionesStats {
  total: number;
  valueParts: number;
  reman: number;
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [Menu, NgClass, RouterLink],  // ✅ RouterLink agregado para los accesos rápidos
  templateUrl: './home-page.html',
})
export class HomePage implements OnInit, OnDestroy {

  private auth           = inject(AuthService);
  private http           = inject(HttpClient);
  private etl            = inject(EtlApi);
  private toast          = inject(ToastService);
  private sidebarService = inject(SidebarService);  // ✅ SidebarService inyectado

  // ✅ Estado del sidebar expuesto al template — sin acoplamiento a <app-menu>
  isSidebarOpen = this.sidebarService.isOpen;
  toggleSidebar(): void { this.sidebarService.toggle(); }

  // ✅ Lee directamente desde el signal currentUser (reactivo)
  userRole = computed(() => this.auth.currentUser()?.role || 'user');
  userEmail = computed(
    () => this.auth.currentUser()?.email || this.auth.currentUser()?.sCorreo || '—',
  );
  etlBusy  = signal(false);

  // ✅ Estadísticas reales del catálogo de refacciones (GET /api/refacciones/stats)
  stats = signal<RefaccionesStats | null>(null);
  statsLoading = signal(true);
  statsError = signal(false);

  /** Timeout para el polling — setTimeout recursivo (no setInterval) */
  private etlTimeout: ReturnType<typeof setTimeout> | null = null;

  /* ----------------------------------------------------------
     ESTADÍSTICAS DEL CATÁLOGO
  ---------------------------------------------------------- */
  private async loadStats(): Promise<void> {
    this.statsLoading.set(true);
    this.statsError.set(false);

    try {
      const data = await firstValueFrom(
        this.http.get<RefaccionesStats>('/api/refacciones/stats'),
      );
      this.stats.set(data);
    } catch (err) {
      console.error('Error al cargar estadísticas de refacciones:', err);
      this.statsError.set(true);
    } finally {
      this.statsLoading.set(false);
    }
  }

  /* ----------------------------------------------------------
     SINCRONIZACIÓN ETL
  ---------------------------------------------------------- */
  async syncData(): Promise<void> {
    if (this.etlBusy()) return;

    this.etlBusy.set(true);
    this.toast.show('Iniciando sincronización...', 'info');

    try {
      await this.etl.startJob();
      this.toast.show('Proceso iniciado. Verificando estado...', 'success');
      await this.pollStatus();   // ✅ await — Promise manejada correctamente

    } catch (err) {
      console.error('Error al iniciar sincronización ETL:', err);
      this.toast.show('Error al iniciar sincronización', 'error');
      this.etlBusy.set(false);
    }
  }

  /* ✅ setTimeout recursivo — evita llamadas concurrentes que setInterval generaba */
  private async pollStatus(): Promise<void> {
    const maxAttempts = 20;
    let attempts = 0;

    const tick = async (): Promise<void> => {
      if (!this.etlBusy()) return;   // fue cancelado externamente
      attempts++;

      try {
        const status = await this.etl.getStatus();

        if (status.run_status === EtlStatus.Success) {
          this.toast.show('Sincronización completada exitosamente', 'success');
          this.etlBusy.set(false);
          void this.loadStats(); // ✅ refresca las tarjetas tras sincronizar
          return; // no reagenda
        }

        if (
          status.run_status === EtlStatus.Fail ||
          status.run_status === EtlStatus.Cancel
        ) {
          this.toast.show(
            'Error en la sincronización: ' + (status.message || 'Fallo desconocido'),
            'error'
          );
          this.etlBusy.set(false);
          return;
        }

        if (attempts >= maxAttempts) {
          this.toast.show(
            'La sincronización está tomando más tiempo de lo esperado.',
            'info'
          );
          this.etlBusy.set(false);
          return;
        }

      } catch (err) {
        console.error('Error al verificar estado ETL:', err);
        this.toast.show('Error al verificar el estado de sincronización', 'error');
        this.etlBusy.set(false);
        return;
      }

      // Reagenda SOLO si sigue en progreso — la siguiente llamada
      // ocurre después de que la anterior terminó
      this.etlTimeout = setTimeout(tick, 3000);
    };

    this.etlTimeout = setTimeout(tick, 3000);
  }

  private clearEtlTimeout(): void {
    if (this.etlTimeout) {
      clearTimeout(this.etlTimeout);
      this.etlTimeout = null;
    }
  }

  /* ----------------------------------------------------------
     BÚSQUEDA PROFUNDA Y ROBUSTA DE CLAVES EN OBJETOS
     TODO: mover a AuthService o src/app/utils/object.utils.ts
  ---------------------------------------------------------- */
  private deepPick(obj: any, keys: string[], depth = 3): string {
    if (!obj || typeof obj !== 'object' || depth < 0) return '';

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const val = this.deepPick(item, keys, depth - 1);
        if (val) return val;
      }
      return '';
    }

    // Búsqueda exacta por clave
    for (const k of keys) {
      const val = obj[k];
      if (val !== undefined && val !== null) {
        const s = String(val).trim();
        if (s) return s;
      }
    }

    // Búsqueda case-insensitive
    const lowerMap = new Map<string, any>();
    for (const k of Object.keys(obj)) {
      lowerMap.set(k.toLowerCase(), obj[k]);
    }
    for (const k of keys) {
      const val = lowerMap.get(k.toLowerCase());
      if (val !== undefined && val !== null) {
        const s = String(val).trim();
        if (s) return s;
      }
    }

    // Búsqueda en contenedores anidados comunes
    const containers = ['user', 'usuario', 'perfil', 'profile', 'data', 'result', 'payload'];
    for (const c of containers) {
      const nested = obj[c];
      if (nested && typeof nested === 'object') {
        const val = this.deepPick(nested, keys, depth - 1);
        if (val) return val;
      }
    }

    return '';
  }

  /* ----------------------------------------------------------
     INICIALIZACIÓN DEL COMPONENTE
     TODO: mover la llamada HTTP a AuthService.fetchMe()
  ---------------------------------------------------------- */
  async ngOnInit(): Promise<void> {
    void this.loadStats(); // ✅ carga estadísticas en paralelo, sin bloquear

    try {
      const me = await firstValueFrom(
        this.http.get<UserProfile>('/api/auth/me')
      );

      if (me && typeof me === 'object') {
        const profile: UserProfile =
          me.user    ??
          me.usuario ??
          me.perfil  ??
          me.profile ??
          me;

        const prev = this.auth.currentUser();

        const roleFromDeepPick = this.deepPick(profile, ['role', 'rol']);

        // ✅ Backend tiene prioridad — el valor local es solo fallback final
        const roleTxt =
          profile?.role ||
          roleFromDeepPick ||
          ((profile?.idRol ?? profile?.id_role ?? profile?.roleId) === 1
            ? 'admin'
            : 'user') ||
          prev?.role ||
          'user';

        this.auth.currentUser.set({
          ...(prev    || {}),
          ...(profile || {}),
          role: roleTxt,
        });
      }

    } catch (err) {
      console.error('Error al cargar información del usuario:', err);
      this.toast.show('No se pudo cargar la información del usuario', 'error');
    }
  }

  ngOnDestroy(): void {
    this.clearEtlTimeout(); // ✅ sin memory leaks
  }
}