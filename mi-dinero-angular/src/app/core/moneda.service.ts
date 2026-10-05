import { computed, inject, Injectable } from '@angular/core';
import { Moneda, MONEDA_POR_DEFECTO, MONEDAS } from './auth.models';
import { AuthService } from './auth.service';
import {
  decimalesMoneda,
  formatearMonto,
  formatearMontoCompacto,
  formatearNumero,
  parsearMonto,
  redondearMoneda,
  simboloMoneda,
} from './moneda';

function esMoneda(valor: unknown): valor is Moneda {
  return typeof valor === 'string' && (MONEDAS as readonly string[]).includes(valor);
}

// Moneda activa del usuario. Se toma de la preferencia del registro
// (auth.users.user_metadata.moneda_preferida, que la app guarda al crear la
// cuenta) con COP como respaldo. Centraliza el formato de dinero.
@Injectable({ providedIn: 'root' })
export class MonedaService {
  private readonly auth = inject(AuthService);

  readonly moneda = computed<Moneda>(() => {
    const preferida = this.auth.usuario()?.user_metadata?.['moneda_preferida'];
    return esMoneda(preferida) ? preferida : MONEDA_POR_DEFECTO;
  });

  readonly simbolo = computed<string>(() => simboloMoneda(this.moneda()));
  readonly decimales = computed<number>(() => decimalesMoneda(this.moneda()));

  // Monto con símbolo y decimales (para mostrar)
  formatear(valor: number | null | undefined): string {
    return formatearMonto(valor, this.moneda());
  }

  formatearCompacto(valor: number | null | undefined): string {
    return formatearMontoCompacto(valor, this.moneda());
  }

  // Número sin símbolo, para el interior de los campos de entrada
  formatearNumero(valor: number | null | undefined): string {
    return formatearNumero(valor, this.moneda());
  }

  // Mientras el usuario escribe no se fuerzan los ceros decimales
  formatearEntrada(valor: number | null | undefined): string {
    return formatearNumero(valor, this.moneda(), { minimoDecimales: 0 });
  }

  parsear(texto: string | null | undefined): number | null {
    return parsearMonto(texto, this.moneda());
  }

  redondear(valor: number): number {
    return redondearMoneda(valor, this.moneda());
  }
}
