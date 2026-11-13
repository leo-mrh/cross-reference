import { CanActivateFn } from '@angular/router';

/**
 * Redirige la ruta raíz ('') hacia la página informativa estática
 * (public/inicio.html), forzando una navegación completa del navegador
 * en lugar de una transición interna del Angular Router.
 */
export const redirectToLandingGuard: CanActivateFn = () => {
  window.location.href = '/inicio.html';
  return false; // Cancela la navegación interna de Angular
};