import { Injectable, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { db } from '../core/supabase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly usuario = signal<User | null>(null);

  constructor() {
    db.auth.getSession().then(({ data }) => {
      if (data.session?.user) this.usuario.set(data.session.user);
    });
    db.auth.onAuthStateChange((_evento, sesion) => {
      this.usuario.set(sesion?.user ?? null);
    });
  }

  get usuarioActual(): User | null {
    return this.usuario();
  }

  async iniciarSesion(email: string, password: string): Promise<string | null> {
    const { error } = await db.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }

  async crearCuenta(
    email: string,
    password: string,
    perfil?: Record<string, unknown>,
  ): Promise<string | null> {
    const { error } = await db.auth.signUp({
      email,
      password,
      options: perfil ? { data: perfil } : undefined,
    });
    return error ? error.message : null;
  }

  async cerrarSesion(): Promise<void> {
    await db.auth.signOut();
  }
}
