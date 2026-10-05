import { inject, Injectable } from '@angular/core';
import { esObjeto } from '../../core/almacenamiento-local.service';
import { MensajeError } from '../../core/tipos';
import { fechaHoyIso } from '../../core/utils';
import { descargarJson } from '../../shared/utils/archivos';
import { esColoresCategoria } from './dinero-preferencias.service';
import { LocalDbService } from './local-db.service';
import {
  claveColorDeSlot,
  FORMATO_RESPALDO,
  FORMATO_RESPALDO_LEGADO,
  ORDEN_TABLAS_RESPALDO,
  PREFIJO_ARCHIVO_RESPALDO,
  PREFIJO_ARCHIVO_SEGURIDAD,
  TABLAS_DINERO,
  TablaDinero,
  VERSION_MINIMA_RESPALDO,
  VERSION_RESPALDO,
} from './dinero.constantes';
import {
  ColoresCategoria,
  ConteoRespaldo,
  DatosRespaldo,
  FilaRespaldo,
  RespaldoDinero,
  ResultadoValidacion,
} from './dinero.models';
import { DineroService } from './dinero.service';

// Columnas que asigna la BD a cada usuario: no se copian al importar
const COLUMNAS_PROPIETARIO = ['user_id'] as const;

// Referencias entre tablas que hay que traducir al generar ids nuevos
interface Referencia {
  columna: string;
  tabla: TablaDinero;
  // true = si la fila referenciada no está en el respaldo, se descarta la fila
  obligatoria: boolean;
}

const REFERENCIAS: Partial<Record<TablaDinero, readonly Referencia[]>> = {
  [TABLAS_DINERO.subcategorias]: [
    { columna: 'categoria_grande_id', tabla: TABLAS_DINERO.categoriasGrandes, obligatoria: true },
  ],
  // Las cuentas de una transacción son obligatorias cuando vienen (un gasto sin su
  // cuenta de origen no tendría sentido); las que son null según el tipo se respetan
  [TABLAS_DINERO.movimientos]: [
    { columna: 'cuenta_origen_id', tabla: TABLAS_DINERO.cuentas, obligatoria: true },
    { columna: 'cuenta_destino_id', tabla: TABLAS_DINERO.cuentas, obligatoria: true },
    { columna: 'categoria_id', tabla: TABLAS_DINERO.categoriasGrandes, obligatoria: false },
    { columna: 'subcategoria_id', tabla: TABLAS_DINERO.subcategorias, obligatoria: false },
  ],
  [TABLAS_DINERO.gastosFijos]: [
    { columna: 'cuenta_id', tabla: TABLAS_DINERO.cuentas, obligatoria: false },
    { columna: 'categoria_id', tabla: TABLAS_DINERO.categoriasGrandes, obligatoria: false },
    { columna: 'subcategoria_id', tabla: TABLAS_DINERO.subcategorias, obligatoria: false },
  ],
  [TABLAS_DINERO.tarjetaCortes]: [
    { columna: 'cuenta_id', tabla: TABLAS_DINERO.cuentas, obligatoria: true },
    { columna: 'deuda_id', tabla: TABLAS_DINERO.deudas, obligatoria: false },
    { columna: 'movimiento_id', tabla: TABLAS_DINERO.movimientos, obligatoria: false },
  ],
  [TABLAS_DINERO.deudasPagos]: [
    { columna: 'deuda_id', tabla: TABLAS_DINERO.deudas, obligatoria: true },
    { columna: 'movimiento_id', tabla: TABLAS_DINERO.movimientos, obligatoria: false },
  ],
  [TABLAS_DINERO.gastosFijosPagos]: [
    { columna: 'gasto_fijo_id', tabla: TABLAS_DINERO.gastosFijos, obligatoria: true },
    { columna: 'movimiento_id', tabla: TABLAS_DINERO.movimientos, obligatoria: false },
  ],
};

// Columnas mínimas que debe traer cada fila para considerarse válida
const COLUMNAS_REQUERIDAS: Record<TablaDinero, readonly string[]> = {
  [TABLAS_DINERO.configuracion]: ['ingreso_mensual'],
  [TABLAS_DINERO.cuentas]: ['nombre', 'tipo', 'saldo_inicial'],
  [TABLAS_DINERO.categoriasGrandes]: ['nombre', 'tipo'],
  [TABLAS_DINERO.subcategorias]: ['nombre', 'categoria_grande_id'],
  [TABLAS_DINERO.metasAhorro]: ['nombre', 'valor_objetivo'],
  [TABLAS_DINERO.tarjetaCortes]: ['cuenta_id', 'mes', 'monto_corte'],
  [TABLAS_DINERO.movimientos]: ['tipo', 'monto', 'fecha'],
  [TABLAS_DINERO.deudas]: ['nombre', 'tipo'],
  [TABLAS_DINERO.deudasPagos]: ['deuda_id', 'mes'],
  [TABLAS_DINERO.gastosFijos]: ['nombre', 'monto'],
  [TABLAS_DINERO.gastosFijosPagos]: ['gasto_fijo_id', 'mes'],
};

type MapaIds = Map<TablaDinero, Map<string, string>>;

function esFilaRespaldo(valor: unknown, requeridas: readonly string[]): valor is FilaRespaldo {
  return (
    esObjeto(valor) &&
    typeof valor['id'] === 'string' &&
    requeridas.every((columna) => columna in valor)
  );
}

const FORMATOS_ACEPTADOS: readonly unknown[] = [FORMATO_RESPALDO, FORMATO_RESPALDO_LEGADO];

// Respaldo de una versión que esta app ya no puede importar (v1, sin cuentas)
export function esRespaldoAntiguo(valor: unknown): boolean {
  return (
    esObjeto(valor) &&
    FORMATOS_ACEPTADOS.includes(valor['formato']) &&
    typeof valor['version'] === 'number' &&
    valor['version'] < VERSION_MINIMA_RESPALDO
  );
}

// Acepta respaldos de Kane (v3) y de la versión multicuenta anterior (v2)
export function esRespaldoDinero(valor: unknown): valor is RespaldoDinero {
  if (!esObjeto(valor) || !FORMATOS_ACEPTADOS.includes(valor['formato'])) return false;
  const version = valor['version'];
  if (typeof version !== 'number' || version < VERSION_MINIMA_RESPALDO || version > VERSION_RESPALDO) {
    return false;
  }
  const datos = valor['datos'];
  const preferencias = valor['preferencias'];
  return (
    esObjeto(datos) &&
    ORDEN_TABLAS_RESPALDO.every((tabla) => {
      const filas = datos[tabla];
      return Array.isArray(filas) && filas.every((f) => esFilaRespaldo(f, COLUMNAS_REQUERIDAS[tabla]));
    }) &&
    (preferencias === undefined ||
      (esObjeto(preferencias) && esColoresCategoria(preferencias['coloresCategoria'])))
  );
}

export function contarRespaldo(respaldo: RespaldoDinero): ConteoRespaldo {
  return Object.fromEntries(
    ORDEN_TABLAS_RESPALDO.map((tabla) => [tabla, respaldo.datos[tabla].length]),
  ) as ConteoRespaldo;
}

// Exporta todos los datos de Mi Dinero a un archivo JSON portable y los restaura
// desde ese archivo, en esta u otra cuenta/plataforma.
@Injectable({ providedIn: 'root' })
export class DineroRespaldoService {
  private readonly db = inject(LocalDbService);
  private readonly dinero = inject(DineroService);

  // ============================================
  // EXPORTAR
  // ============================================
  async exportar(prefijoArchivo: string = PREFIJO_ARCHIVO_RESPALDO): Promise<MensajeError> {
    const resultado = await this.construir();
    if (!resultado.ok) return resultado.error;
    descargarJson(`${prefijoArchivo}-${fechaHoyIso()}.json`, resultado.valor);
    return null;
  }

  // Lee todas las tablas y arma el respaldo en memoria (lo usan el JSON y el QR)
  async construir(): Promise<ResultadoValidacion<RespaldoDinero>> {
    const lecturas = await Promise.all(ORDEN_TABLAS_RESPALDO.map((tabla) => this.leerTabla(tabla)));
    const error = lecturas.find((l) => l.error !== null)?.error;
    if (error) return { ok: false, error };

    const datos = Object.fromEntries(
      ORDEN_TABLAS_RESPALDO.map((tabla, i) => [tabla, lecturas[i].filas]),
    ) as DatosRespaldo;

    return {
      ok: true,
      valor: { formato: FORMATO_RESPALDO, version: VERSION_RESPALDO, exportadoEn: new Date().toISOString(), datos },
    };
  }

  // Lee todas las filas de la tabla desde IndexedDB
  private async leerTabla(tabla: TablaDinero): Promise<{ filas: FilaRespaldo[]; error: MensajeError }> {
    try {
      const filas = await this.db.tabla<FilaRespaldo>(tabla).toArray();
      return { filas, error: null };
    } catch (error) {
      return {
        filas: [],
        error: error instanceof Error ? error.message : 'No se pudo leer el almacenamiento local.',
      };
    }
  }

  // ============================================
  // IMPORTAR
  // ============================================
  // Reemplaza todos los datos actuales por los del respaldo. Antes descarga una
  // copia de seguridad de lo que hay ahora, por si se importó el archivo equivocado.
  async importar(respaldo: RespaldoDinero): Promise<MensajeError> {
    const errorCopia = await this.exportar(PREFIJO_ARCHIVO_SEGURIDAD);
    if (errorCopia) return `No se pudo crear la copia de seguridad previa: ${errorCopia}`;

    const datos = this.prepararDatos(respaldo);
    const error = await this.reemplazarTodo(datos);

    await this.dinero.cargarTodo();
    return error;
  }

  // Asigna ids nuevos a todas las filas y traduce las referencias entre tablas.
  // Con ids nuevos el archivo se puede importar en otra cuenta sin chocar con los
  // registros originales, que siguen existiendo en la BD con sus propios ids.
  private prepararDatos(respaldo: RespaldoDinero): DatosRespaldo {
    const ids: MapaIds = new Map(
      ORDEN_TABLAS_RESPALDO.map((tabla) => [
        tabla,
        new Map(respaldo.datos[tabla].map((fila) => [fila.id, crypto.randomUUID()])),
      ]),
    );

    const datos = Object.fromEntries(
      ORDEN_TABLAS_RESPALDO.map((tabla) => [tabla, this.prepararFilas(tabla, respaldo.datos[tabla], ids)]),
    ) as DatosRespaldo;

    // Solo hay una configuración por usuario
    datos[TABLAS_DINERO.configuracion] = datos[TABLAS_DINERO.configuracion].slice(0, 1);

    this.aplicarColoresLegados(datos, respaldo.preferencias?.coloresCategoria ?? {}, ids);
    return datos;
  }

  // En respaldos v2 el color de cada categoría venía aparte (preferencias del
  // navegador); ahora se guarda en la propia fila de la categoría
  private aplicarColoresLegados(datos: DatosRespaldo, colores: ColoresCategoria, ids: MapaIds): void {
    const idsCategorias = ids.get(TABLAS_DINERO.categoriasGrandes);
    const slotPorIdNuevo = new Map(
      Object.entries(colores).map(([idViejo, slot]) => [idsCategorias?.get(idViejo), slot]),
    );
    for (const fila of datos[TABLAS_DINERO.categoriasGrandes]) {
      const slot = slotPorIdNuevo.get(fila.id);
      if (slot && !fila['color']) fila['color'] = claveColorDeSlot(slot);
    }
  }

  private prepararFilas(tabla: TablaDinero, filas: readonly FilaRespaldo[], ids: MapaIds): FilaRespaldo[] {
    const propios = ids.get(tabla);
    const referencias = REFERENCIAS[tabla] ?? [];
    const resultado: FilaRespaldo[] = [];

    for (const original of filas) {
      const fila: FilaRespaldo = { ...original, id: propios?.get(original.id) ?? crypto.randomUUID() };
      for (const columna of COLUMNAS_PROPIETARIO) delete fila[columna];

      let valida = true;
      for (const { columna, tabla: destino, obligatoria } of referencias) {
        const valor = fila[columna];
        if (valor === null || valor === undefined) continue;
        const traducido = typeof valor === 'string' ? ids.get(destino)?.get(valor) : undefined;
        if (traducido) fila[columna] = traducido;
        else if (obligatoria) valida = false;
        else fila[columna] = null;
      }

      if (valida) resultado.push(fila);
    }
    return resultado;
  }

  // Reemplaza todas las tablas por los datos del respaldo dentro de una sola
  // transacción de Dexie: si algo falla, no se pierde lo que había.
  private async reemplazarTodo(datos: DatosRespaldo): Promise<MensajeError> {
    const tablas = ORDEN_TABLAS_RESPALDO.map((tabla) => this.db.table(tabla));
    try {
      await this.db.transaction('rw', tablas, async () => {
        // Vacía de hijas a padres y luego inserta de padres a hijas
        for (const tabla of [...ORDEN_TABLAS_RESPALDO].reverse()) {
          await this.db.tabla<FilaRespaldo>(tabla).clear();
        }
        for (const tabla of ORDEN_TABLAS_RESPALDO) {
          const filas = datos[tabla];
          if (filas.length > 0) await this.db.tabla<FilaRespaldo>(tabla).bulkAdd(filas);
        }
      });
      return null;
    } catch (error) {
      return `No se pudo importar el respaldo: ${error instanceof Error ? error.message : 'error desconocido'}`;
    }
  }
}
