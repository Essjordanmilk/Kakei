import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

// Kane se centra solo en el dinero: el dashboard es la página principal y se
// llega a él directamente después de iniciar sesión.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [authGuard],
    title: 'Kane · Dashboard',
    loadComponent: () => import('./features/dinero/dinero.component').then((m) => m.DineroComponent),
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    title: 'Kane · Iniciar sesión',
    loadComponent: () => import('./features/auth/auth.component').then((m) => m.AuthComponent),
  },
  { path: '**', redirectTo: '' },
];
