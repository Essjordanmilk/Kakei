// Constantes del módulo Mi Dinero

import { NombreIcono } from '../../shared/iconos';
import { OpcionToggle, TabItem } from '../../shared/models/ui.models';
import {
  CategoriaPredeterminada,
  CuentaPredeterminada,
  TabDinero,
  TipoCategoria,
  TipoCuenta,
  TipoMovimiento,
} from './dinero.models';

export const TABLAS_DINERO = {
  configuracion: 'configuracion',
  cuentas: 'cuentas',
  categoriasGrandes: 'categorias_grandes',
  subcategorias: 'subcategorias',
  metasAhorro: 'metas_ahorro',
  tarjetaCortes: 'tarjeta_cortes',
  movimientos: 'movimientos',
  deudas: 'deudas',
  deudasPagos: 'deudas_pagos',
  gastosFijos: 'gastos_fijos',
  gastosFijosPagos: 'gastos_fijos_pagos',
} as const;

export type TablaDinero = (typeof TABLAS_DINERO)[keyof typeof TABLAS_DINERO];

// Orden padre -> hijo: así se insertan al restaurar un respaldo (y al revés se borran)
export const ORDEN_TABLAS_RESPALDO: readonly TablaDinero[] = [
  TABLAS_DINERO.configuracion,
  TABLAS_DINERO.cuentas,
  TABLAS_DINERO.categoriasGrandes,
  TABLAS_DINERO.subcategorias,
  TABLAS_DINERO.metasAhorro,
  TABLAS_DINERO.deudas,
  TABLAS_DINERO.gastosFijos,
  TABLAS_DINERO.movimientos,
  TABLAS_DINERO.tarjetaCortes,
  TABLAS_DINERO.deudasPagos,
  TABLAS_DINERO.gastosFijosPagos,
];

export const TAB_POR_DEFECTO: TabDinero = 'dashboard';

export const TABS_DINERO: readonly TabItem<TabDinero>[] = [
  { id: 'dashboard', etiqueta: 'Dashboard' },
  { id: 'movimientos', etiqueta: 'Movimientos' },
  { id: 'cuentas', etiqueta: 'Cuentas' },
  { id: 'deudas', etiqueta: 'Deudas' },
  { id: 'gastos-fijos', etiqueta: 'Gastos fijos' },
  { id: 'presupuesto', etiqueta: 'Presupuesto' },
];

// ---------- TRANSACCIONES ----------
export const TIPOS_MOVIMIENTO: readonly OpcionToggle<TipoMovimiento>[] = [
  { valor: 'GASTO', etiqueta: 'Gasto', variante: 'negativo' },
  { valor: 'INGRESO', etiqueta: 'Ingreso', variante: 'positivo' },
  { valor: 'TRASLADO', etiqueta: 'Traslado', variante: 'neutro' },
];

export const TIPO_MOVIMIENTO_POR_DEFECTO: TipoMovimiento = 'GASTO';

export const ETIQUETAS_TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  GASTO: 'Gasto',
  INGRESO: 'Ingreso',
  TRASLADO: 'Traslado',
};

// Qué cuentas pide cada tipo de transacción
export const CUENTAS_POR_TIPO: Record<TipoMovimiento, { origen: boolean; destino: boolean }> = {
  GASTO: { origen: true, destino: false },
  INGRESO: { origen: false, destino: true },
  TRASLADO: { origen: true, destino: true },
};

export const CANTIDAD_ULTIMOS_MOVIMIENTOS = 5;

// Etiquetas de las transacciones que genera la app sin categoría
export const ETIQUETA_AJUSTE_SALDO = 'Ajuste de saldo';
export const ETIQUETA_PAGO_DEUDA = 'Pago de deuda';
export const ETIQUETA_PAGO_TARJETA = 'Pago de tarjeta';
export const ETIQUETA_SIN_CATEGORIA = 'Sin categoría';
// Agrupa en las gráficas los gastos que no pertenecen a ninguna categoría del presupuesto
export const CATEGORIA_OTROS = 'Otros';

// La categoría de gasto cuyo nombre contenga alguno de estos textos define el
// "disponible para gastar"
export const NOMBRES_CATEGORIA_OCIO: readonly string[] = ['ocio', 'entretenimiento'];

// ---------- CUENTAS ----------
export const TIPOS_CUENTA: readonly OpcionToggle<TipoCuenta>[] = [
  { valor: 'debito', etiqueta: 'Débito' },
  { valor: 'credito', etiqueta: 'Crédito' },
  { valor: 'inversion', etiqueta: 'Inversión' },
  { valor: 'ahorro', etiqueta: 'Ahorro' },
];

export const ETIQUETAS_TIPO_CUENTA: Record<TipoCuenta, string> = {
  debito: 'Débito',
  credito: 'Crédito',
  inversion: 'Inversión',
  ahorro: 'Ahorro',
};

export const ICONOS_TIPO_CUENTA: Record<TipoCuenta, NombreIcono> = {
  debito: 'cuentaDebito',
  credito: 'tarjeta',
  inversion: 'inversion',
  ahorro: 'ahorro',
};

// Se crean automáticamente si el usuario no tiene ninguna cuenta
export const CUENTAS_PREDETERMINADAS: readonly CuentaPredeterminada[] = [
  { nombre: 'Cuenta Débito', tipo: 'debito', color: 1 },
  { nombre: 'Tarjeta de Crédito', tipo: 'credito', color: 8 },
  { nombre: 'Trii', tipo: 'inversion', color: 7 },
  { nombre: 'Bolsillo de Ahorro', tipo: 'ahorro', color: 3 },
];

// ---------- CATEGORÍAS ----------
// La paleta y las claves de color viven en shared/utils/colores.ts
export {
  claveColorDeSlot,
  colorDeSlot,
  esClaveColor,
  resolverColor,
  SLOTS_COLOR,
  slotDeClaveColor,
} from '../../shared/utils/colores';

// Color para lo que no pertenece a ninguna categoría (ajustes, pagos de deuda...)
export const COLOR_SIN_CATEGORIA = 'var(--color-texto-suave)';
export const COLOR_INGRESO = 'var(--color-positivo)';
export const COLOR_TRASLADO = 'var(--color-primario)';

// Se cargan para usuarios nuevos (sin presupuesto: cada quien define su monto)
export const CATEGORIAS_PREDETERMINADAS: Record<TipoCategoria, readonly CategoriaPredeterminada[]> = {
  GASTO: [
    { nombre: 'Alimentación', slot: 2, icono: 'alimentacion' },
    { nombre: 'Servicios', slot: 7, icono: 'servicios' },
    { nombre: 'Transporte', slot: 1, icono: 'transporte' },
    { nombre: 'Entretenimiento', slot: 5, icono: 'ocio' },
    { nombre: 'Salud', slot: 8, icono: 'salud' },
  ],
  INGRESO: [
    { nombre: 'Salario', slot: 3, icono: 'salario' },
    { nombre: 'Venta', slot: 1, icono: 'negocio' },
    { nombre: 'Regalo', slot: 5, icono: 'regalos' },
    { nombre: 'Otro ingreso', slot: 4, icono: 'categoria' },
  ],
};

// ---------- GASTOS FIJOS ----------
// Meses hacia atrás que se recuperan si la app no se abrió el día de aplicación
export const MESES_RECUPERACION_GASTOS_FIJOS = 3;
// Cada cuánto se revisa, con la app abierta, si hoy toca aplicar algún gasto fijo
export const INTERVALO_REVISION_GASTOS_FIJOS_MS = 60 * 60 * 1000;
export const DIAS_DEL_MES: readonly number[] = Array.from({ length: 31 }, (_, i) => i + 1);

// Meses que muestran las gráficas comparativas del dashboard
export const MESES_HISTORICO = 6;

export const PORCENTAJE_TOTAL = 100;
export const UMBRAL_ADVERTENCIA_PRESUPUESTO = 0.8;
export const DIAS_AVISO_VENCIMIENTO = 5;
// Diferencias de saldo menores a esto no generan ajuste
export const DIFERENCIA_MINIMA_AJUSTE = 1;

// ---------- PERSISTENCIA LOCAL Y RESPALDO ----------
// Subir si cambia la forma de CacheDinero: los cachés viejos se descartan
export const VERSION_CACHE = 3;

export const FORMATO_RESPALDO = 'kane/dinero';
// Respaldos hechos antes de que la app se llamara Kane (siguen siendo importables)
export const FORMATO_RESPALDO_LEGADO = 'mi-vida/dinero';
// v3: Kane (presupuesto por monto, colores e iconos en la BD).
// v2 (multicuenta) se sigue aceptando; v1 no trae cuentas y no se puede importar.
export const VERSION_RESPALDO = 3;
export const VERSION_MINIMA_RESPALDO = 2;
export const PREFIJO_ARCHIVO_RESPALDO = 'kane-respaldo';
export const PREFIJO_ARCHIVO_SEGURIDAD = 'kane-antes-de-importar';

// Supabase devuelve como máximo 1000 filas por consulta
export const TAMANO_PAGINA_LECTURA = 1000;
export const TAMANO_LOTE_ESCRITURA = 500;
