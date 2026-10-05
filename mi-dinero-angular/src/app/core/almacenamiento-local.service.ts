import { Injectable } from '@angular/core';
import { PREFIJO_ALMACENAMIENTO, PREFIJO_ALMACENAMIENTO_LEGADO } from './constantes';

/** Comprueba en tiempo de ejecución que un valor leído tenga la forma esperada. */
export type ValidadorAlmacenamiento<T> = (valor: unknown) => valor is T;

// Envoltorio tipado de localStorage. Todo acceso va en try/catch porque el
// almacenamiento puede estar bloqueado (modo privado) o lleno.
@Injectable({ providedIn: 'root' })
export class AlmacenamientoLocalService {
  constructor() {
    this.migrarPrefijoLegado();
  }

  leer<T>(clave: string, esValido: ValidadorAlmacenamiento<T>): T | null {
    try {
      const crudo = localStorage.getItem(PREFIJO_ALMACENAMIENTO + clave);
      if (crudo === null) return null;
      const valor: unknown = JSON.parse(crudo);
      return esValido(valor) ? valor : null;
    } catch {
      return null;
    }
  }

  guardar<T>(clave: string, valor: T): boolean {
    try {
      localStorage.setItem(PREFIJO_ALMACENAMIENTO + clave, JSON.stringify(valor));
      return true;
    } catch (error) {
      console.warn('No se pudo guardar en localStorage', error);
      return false;
    }
  }

  eliminar(clave: string): void {
    try {
      localStorage.removeItem(PREFIJO_ALMACENAMIENTO + clave);
    } catch {
      // Sin acceso al almacenamiento: no hay nada que borrar
    }
  }

  // Copia una sola vez lo guardado con el prefijo anterior (tema, preferencias, caché)
  private migrarPrefijoLegado(): void {
    try {
      const legadas = Object.keys(localStorage).filter((k) => k.startsWith(PREFIJO_ALMACENAMIENTO_LEGADO));
      for (const clave of legadas) {
        const nueva = PREFIJO_ALMACENAMIENTO + clave.slice(PREFIJO_ALMACENAMIENTO_LEGADO.length);
        const valor = localStorage.getItem(clave);
        if (valor !== null && localStorage.getItem(nueva) === null) localStorage.setItem(nueva, valor);
        localStorage.removeItem(clave);
      }
    } catch {
      // Sin acceso al almacenamiento: no hay nada que migrar
    }
  }
}

export function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}
