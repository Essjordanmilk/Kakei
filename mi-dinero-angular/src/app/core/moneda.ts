// Configuración centralizada de monedas: símbolo, separadores y cantidad de
// decimales. Es la única fuente de verdad del formato de dinero de la app, para
// no duplicar lógica en cada componente.

import { Moneda, MONEDA_POR_DEFECTO } from './auth.models';

export interface MetadatosMoneda {
  // Locale para toLocaleString / Intl (define separador de miles y decimal)
  readonly locale: string;
  readonly simbolo: string;
  // Cantidad de decimales propios de la moneda (COP/CLP = 0; USD/EUR = 2...)
  readonly decimales: number;
  readonly nombre: string;
}

export const METADATOS_MONEDA: Record<Moneda, MetadatosMoneda> = {
  COP: { locale: 'es-CO', simbolo: '$', decimales: 0, nombre: 'Peso colombiano' },
  USD: { locale: 'en-US', simbolo: '$', decimales: 2, nombre: 'Dólar estadounidense' },
  EUR: { locale: 'es-ES', simbolo: '€', decimales: 2, nombre: 'Euro' },
  MXN: { locale: 'es-MX', simbolo: '$', decimales: 2, nombre: 'Peso mexicano' },
  ARS: { locale: 'es-AR', simbolo: '$', decimales: 2, nombre: 'Peso argentino' },
  CLP: { locale: 'es-CL', simbolo: '$', decimales: 0, nombre: 'Peso chileno' },
  PEN: { locale: 'es-PE', simbolo: 'S/', decimales: 2, nombre: 'Sol peruano' },
};

export function metadatosMoneda(moneda: Moneda = MONEDA_POR_DEFECTO): MetadatosMoneda {
  return METADATOS_MONEDA[moneda] ?? METADATOS_MONEDA[MONEDA_POR_DEFECTO];
}

export function decimalesMoneda(moneda: Moneda = MONEDA_POR_DEFECTO): number {
  return metadatosMoneda(moneda).decimales;
}

export function simboloMoneda(moneda: Moneda = MONEDA_POR_DEFECTO): string {
  return metadatosMoneda(moneda).simbolo;
}

// Número sin símbolo, con separadores del locale y los decimales indicados.
// Para los campos de entrada (el símbolo se muestra aparte, como prefijo).
export function formatearNumero(
  valor: number | null | undefined,
  moneda: Moneda = MONEDA_POR_DEFECTO,
  opciones?: { minimoDecimales?: number; maximoDecimales?: number },
): string {
  const { locale, decimales } = metadatosMoneda(moneda);
  const n = Number(valor);
  if (valor === null || valor === undefined || !Number.isFinite(n)) return '';
  const minimo = opciones?.minimoDecimales ?? decimales;
  const maximo = opciones?.maximoDecimales ?? decimales;
  return Math.abs(n).toLocaleString(locale, {
    minimumFractionDigits: minimo,
    maximumFractionDigits: Math.max(minimo, maximo),
    useGrouping: true,
  });
}

// Monto con símbolo, signo y decimales de la moneda. Lo que se muestra en toda
// la interfaz (listas, tarjetas, gráficas, totales).
export function formatearMonto(
  valor: number | null | undefined,
  moneda: Moneda = MONEDA_POR_DEFECTO,
  opciones?: { maximoDecimales?: number },
): string {
  const { simbolo, decimales } = metadatosMoneda(moneda);
  const n = valor === null || valor === undefined ? 0 : Number(valor) || 0;
  const maximo = opciones?.maximoDecimales ?? decimales;
  const cuerpo = formatearNumero(n, moneda, { minimoDecimales: decimales, maximoDecimales: maximo });
  return `${n < 0 ? '-' : ''}${simbolo}${cuerpo}`;
}

// "$1,3 M" para ejes y etiquetas donde no cabe la cifra completa
export function formatearMontoCompacto(
  valor: number | null | undefined,
  moneda: Moneda = MONEDA_POR_DEFECTO,
): string {
  const { locale, simbolo } = metadatosMoneda(moneda);
  const n = Number(valor) || 0;
  const formato = new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return `${n < 0 ? '-' : ''}${simbolo}${formato.format(Math.abs(n))}`;
}

// Convierte lo escrito por el usuario en un número, aceptando tanto '.' como ','
// como separadores (el de la derecha es el decimal; el otro, de miles).
export function parsearMonto(
  texto: string | null | undefined,
  moneda: Moneda = MONEDA_POR_DEFECTO,
): number | null {
  if (!texto) return null;
  let limpio = String(texto).replace(/[^\d.,-]/g, '');
  if (!/\d/.test(limpio)) return null;

  const negativo = limpio.trimStart().startsWith('-');
  limpio = limpio.replace(/-/g, '');

  const decimales = decimalesMoneda(moneda);
  let entero: string;
  let fraccion = '';

  if (decimales === 0) {
    entero = limpio.replace(/[.,]/g, '');
  } else {
    const ultimoPunto = limpio.lastIndexOf('.');
    const ultimaComa = limpio.lastIndexOf(',');
    const separador = Math.max(ultimoPunto, ultimaComa);
    if (separador === -1) {
      entero = limpio;
    } else {
      const candidatoFraccion = limpio.slice(separador + 1).replace(/[.,]/g, '');
      if (candidatoFraccion.length > 0 && candidatoFraccion.length <= decimales) {
        entero = limpio.slice(0, separador).replace(/[.,]/g, '');
        fraccion = candidatoFraccion;
      } else {
        // El "separador" era de miles (p. ej. 1.000.000)
        entero = limpio.replace(/[.,]/g, '');
      }
    }
  }

  const numero = Number(`${entero || '0'}.${fraccion || '0'}`);
  if (!Number.isFinite(numero)) return null;
  return negativo ? -numero : numero;
}

// Redondea al número de decimales de la moneda (evita valores como 1234.567 en COP)
export function redondearMoneda(valor: number, moneda: Moneda = MONEDA_POR_DEFECTO): number {
  const factor = 10 ** decimalesMoneda(moneda);
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}
