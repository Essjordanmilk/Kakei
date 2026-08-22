import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { db } from './supabase';

// Protege rutas que requieren sesión: redirige a /auth si no hay usuario.
export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const { data } = await db.auth.getSession();
  return data.session?.user ? true : router.createUrlTree(['/auth']);
};

// Protege /auth: si ya hay sesión, manda al inicio.
export const guestGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const { data } = await db.auth.getSession();
  return data.session?.user ? router.createUrlTree(['/']) : true;
};
