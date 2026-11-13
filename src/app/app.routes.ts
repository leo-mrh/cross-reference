import { Routes } from '@angular/router';
import { HomePage } from './pages/home-page/home-page';
import { Login } from './pages/auth/login/login';
import { Create } from './pages/cross-reference/create';
import { List } from './pages/cross-reference/list';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { redirectToLandingGuard } from './guards/redirect-to-landing.guard';
import { User } from './pages/user/list';
import { View } from './pages/view/view';
import { Show } from './pages/cross-reference/show';
import { KitsReparacionInsert } from './pages/kits-reparacion/kit';
import { Blank } from './pages/blank/blank';

export const routes: Routes = [
  {
    path: '',
    component: Blank,
    pathMatch: 'full',
    canActivate: [redirectToLandingGuard],
  },
  { path: 'login', component: Login },
  { 
    path: 'home', 
    component: HomePage,
    canActivate: [authGuard] 
  },
  { 
    path: 'create', 
    component: Create, 
    canActivate: [authGuard, roleGuard(['admin'])] 
  },
  { 
    path: 'list', 
    component: List,
    canActivate: [authGuard, roleGuard(['admin'])]
  },
  { 
    path: 'view', 
    component: View,
    canActivate: [authGuard, roleGuard(['admin'])]
  },
  { 
    path: 'user', 
    component: User,
    canActivate: [authGuard, roleGuard(['admin'])]
  },
  { 
    path: 'show', 
    component: Show,
    canActivate: [authGuard, roleGuard(['admin', 'user'])]
  },
  {
    path: 'kits-reparacion/insert',
    component: KitsReparacionInsert,
    canActivate: [authGuard, roleGuard(['admin'])],
  },
];