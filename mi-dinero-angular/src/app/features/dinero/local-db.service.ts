import { Injectable } from '@angular/core';
import Dexie, { type Table } from 'dexie';
import { TABLAS_DINERO, TablaDinero } from './dinero.constantes';
import {
  CategoriaGrande,
  CorteTarjeta,
  Cuenta,
  Deuda,
  DeudaPago,
  FilaRespaldo,
  GastoFijo,
  GastoFijoPago,
  MetaAhorro,
  Subcategoria,
  Transaccion,
} from './dinero.models';

// Nombre de la base de datos local (IndexedDB) del módulo Mi Dinero.
const NOMBRE_BD = 'kane-dinero';

// Todas las entidades comparten la misma forma de clave: un `id` de texto
// (uuid) autogenerado por la app. Se mantiene `id: string` para no cambiar los
// modelos ni las vistas, que ya trabajan con identificadores de texto.
@Injectable({ providedIn: 'root' })
export class LocalDbService extends Dexie {
  readonly configuracion!: Table<FilaRespaldo, string>;
  readonly cuentas!: Table<Cuenta, string>;
  readonly categorias_grandes!: Table<CategoriaGrande, string>;
  readonly subcategorias!: Table<Subcategoria, string>;
  readonly metas_ahorro!: Table<MetaAhorro, string>;
  readonly tarjeta_cortes!: Table<CorteTarjeta, string>;
  readonly movimientos!: Table<Transaccion, string>;
  readonly deudas!: Table<Deuda, string>;
  readonly deudas_pagos!: Table<DeudaPago, string>;
  readonly gastos_fijos!: Table<GastoFijo, string>;
  readonly gastos_fijos_pagos!: Table<GastoFijoPago, string>;

  constructor() {
    super(NOMBRE_BD);

    // Índices: la clave primaria `id` (string) primero, y los campos por los que
    // se consulta. Los booleanos (activa/activo/pagado) no se indexan porque
    // IndexedDB no admite índices booleanos; se filtran en memoria.
    this.version(1).stores({
      configuracion: 'id',
      cuentas: 'id, orden, nombre',
      categorias_grandes: 'id, tipo, orden, nombre',
      subcategorias: 'id, categoria_grande_id, nombre',
      metas_ahorro: 'id, created_at',
      tarjeta_cortes: 'id, cuenta_id, mes, [cuenta_id+mes]',
      movimientos:
        'id, fecha, created_at, cuenta_origen_id, cuenta_destino_id, categoria_id, subcategoria_id',
      deudas: 'id, created_at',
      deudas_pagos: 'id, deuda_id, mes, [deuda_id+mes]',
      gastos_fijos: 'id, created_at, cuenta_id',
      gastos_fijos_pagos: 'id, gasto_fijo_id, mes, [gasto_fijo_id+mes]',
    });

    this.configuracion = this.table<FilaRespaldo, string>(TABLAS_DINERO.configuracion);
    this.cuentas = this.table<Cuenta, string>(TABLAS_DINERO.cuentas);
    this.categorias_grandes = this.table<CategoriaGrande, string>(TABLAS_DINERO.categoriasGrandes);
    this.subcategorias = this.table<Subcategoria, string>(TABLAS_DINERO.subcategorias);
    this.metas_ahorro = this.table<MetaAhorro, string>(TABLAS_DINERO.metasAhorro);
    this.tarjeta_cortes = this.table<CorteTarjeta, string>(TABLAS_DINERO.tarjetaCortes);
    this.movimientos = this.table<Transaccion, string>(TABLAS_DINERO.movimientos);
    this.deudas = this.table<Deuda, string>(TABLAS_DINERO.deudas);
    this.deudas_pagos = this.table<DeudaPago, string>(TABLAS_DINERO.deudasPagos);
    this.gastos_fijos = this.table<GastoFijo, string>(TABLAS_DINERO.gastosFijos);
    this.gastos_fijos_pagos = this.table<GastoFijoPago, string>(TABLAS_DINERO.gastosFijosPagos);
  }

  // Acceso tipado por nombre de tabla (para el servicio principal y el respaldo)
  tabla<T = FilaRespaldo>(nombre: TablaDinero): Table<T, string> {
    return this.table<T, string>(nombre);
  }
}
