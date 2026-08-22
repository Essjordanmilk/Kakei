import { Injectable, signal } from '@angular/core';
import { db } from '../../core/supabase';
import { fechaHoyIso, mesActual } from '../../core/utils';

export interface Configuracion {
  id?: string;
  ingreso_mensual: number;
}

export interface CategoriaGrande {
  id: string;
  nombre: string;
  porcentaje: number;
  orden: number;
}

export interface Subcategoria {
  id: string;
  nombre: string;
  categoria_grande_id: string;
}

export interface MetaAhorro {
  id: string;
  nombre: string;
  valor_objetivo: number;
  valor_ahorrado: number;
  fecha_objetivo: string | null;
  activa: boolean;
  created_at: string;
}

export interface CorteTarjeta {
  id: string;
  deuda_id: string;
  mes: string;
  monto_corte: number;
  fecha_limite: string | null;
  pagado: boolean;
  movimiento_id?: string | null;
}

export interface Movimiento {
  id: string;
  tipo: 'ingreso' | 'gasto';
  monto: number;
  categoria: string;
  fecha: string;
  nota: string | null;
  metodo_pago: string;
  created_at: string;
}

export interface Deuda {
  id: string;
  nombre: string;
  tipo: 'normal' | 'tarjeta_credito';
  monto_total: number;
  pagado_acumulado: number;
  saldo_tarjeta: number;
  dia_corte: number | null;
  dia_limite_pago: number | null;
  pago_mensual_planeado: number;
  activa: boolean;
  created_at: string;
}

export interface DeudaPago {
  id: string;
  deuda_id: string;
  mes: string;
  movimiento_id?: string;
}

export interface GastoFijo {
  id: string;
  nombre: string;
  monto: number;
  categoria: string;
  activo: boolean;
  created_at: string;
}

export interface GastoFijoPago {
  id: string;
  gasto_fijo_id: string;
  mes: string;
  movimiento_id?: string;
}

@Injectable({ providedIn: 'root' })
export class DineroService {
  readonly configuracion = signal<Configuracion>({ ingreso_mensual: 0 });
  readonly categoriasGrandes = signal<CategoriaGrande[]>([]);
  readonly subcategorias = signal<Subcategoria[]>([]);
  readonly metasAhorro = signal<MetaAhorro[]>([]);
  readonly cortesDelMes = signal<CorteTarjeta[]>([]);
  readonly movimientos = signal<Movimiento[]>([]);
  readonly deudas = signal<Deuda[]>([]);
  readonly deudasPagosDelMes = signal<DeudaPago[]>([]);
  readonly gastosFijos = signal<GastoFijo[]>([]);
  readonly pagosDelMes = signal<GastoFijoPago[]>([]);

  constructor() {
    db.auth.onAuthStateChange((_evento, sesion) => {
      if (sesion) this.cargarTodo();
    });
  }

  // ============================================
  // CARGA GENERAL
  // ============================================
  async cargarTodo(): Promise<void> {
    await Promise.all([
      this.cargarConfiguracion(),
      this.cargarCategoriasGrandes(),
      this.cargarMovimientos(),
      this.cargarDeudas(),
      this.cargarGastosFijos(),
      this.cargarMetasAhorro(),
      this.cargarCortesDelMes(),
    ]);
    await this.cargarSubcategorias();
  }

  async cargarConfiguracion(): Promise<void> {
    const { data, error } = await db.from('configuracion').select('*').maybeSingle();
    if (error) {
      console.error(error);
      return;
    }
    this.configuracion.set(data || { ingreso_mensual: 0 });
  }

  async guardarConfiguracion(ingresoMensual: number): Promise<void> {
    const { data: existente } = await db.from('configuracion').select('id').maybeSingle();
    if (existente) {
      await db.from('configuracion').update({ ingreso_mensual: ingresoMensual }).eq('id', existente.id);
    } else {
      await db.from('configuracion').insert({ ingreso_mensual: ingresoMensual });
    }
  }

  async cargarCategoriasGrandes(): Promise<void> {
    const { data, error } = await db
      .from('categorias_grandes')
      .select('*')
      .order('orden', { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    this.categoriasGrandes.set(data || []);
  }

  async cargarSubcategorias(): Promise<void> {
    if (this.categoriasGrandes().length === 0) {
      this.subcategorias.set([]);
      return;
    }
    const { data, error } = await db
      .from('subcategorias')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    this.subcategorias.set(data || []);
  }

  async cargarMetasAhorro(): Promise<void> {
    const { data, error } = await db
      .from('metas_ahorro')
      .select('*')
      .eq('activa', true)
      .order('created_at', { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    this.metasAhorro.set(data || []);
  }

  async cargarCortesDelMes(): Promise<void> {
    const { data, error } = await db.from('tarjeta_cortes').select('*').eq('mes', mesActual());
    if (error) {
      console.error(error);
      return;
    }
    this.cortesDelMes.set(data || []);
  }

  corteDelMes(deudaId: string): CorteTarjeta | undefined {
    return this.cortesDelMes().find((c) => c.deuda_id === deudaId);
  }

  async cargarMovimientos(): Promise<void> {
    const { data, error } = await db
      .from('movimientos')
      .select('*')
      .order('fecha', { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    this.movimientos.set(data as Movimiento[]);
  }

  async cargarDeudas(): Promise<void> {
    const { data, error } = await db
      .from('deudas')
      .select('*')
      .eq('activa', true)
      .order('created_at', { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    this.deudas.set(data as Deuda[]);

    const { data: pagos, error: errorPagos } = await db
      .from('deudas_pagos')
      .select('*')
      .eq('mes', mesActual());
    if (errorPagos) {
      console.error(errorPagos);
      return;
    }
    this.deudasPagosDelMes.set(pagos as DeudaPago[]);
  }

  estaDeudaPagadaEsteMes(deudaId: string): boolean {
    return this.deudasPagosDelMes().some((p) => p.deuda_id === deudaId);
  }

  async cargarGastosFijos(): Promise<void> {
    const { data: fijos, error: errorFijos } = await db
      .from('gastos_fijos')
      .select('*')
      .eq('activo', true)
      .order('created_at', { ascending: true });
    if (errorFijos) {
      console.error(errorFijos);
      return;
    }
    this.gastosFijos.set(fijos as GastoFijo[]);

    const { data: pagos, error: errorPagos } = await db
      .from('gastos_fijos_pagos')
      .select('*')
      .eq('mes', mesActual());
    if (errorPagos) {
      console.error(errorPagos);
      return;
    }
    this.pagosDelMes.set(pagos as GastoFijoPago[]);
  }

  estaPagadoEsteMes(gastoFijoId: string): boolean {
    return this.pagosDelMes().some((p) => p.gasto_fijo_id === gastoFijoId);
  }

  // ============================================
  // MOVIMIENTOS
  // ============================================
  descripcionMetodoPago(metodoPago: string | null | undefined): string {
    if (!metodoPago || metodoPago === 'efectivo') return 'Efectivo';
    if (metodoPago === 'debito') return 'Débito';
    if (metodoPago.startsWith('credito:')) {
      const deudaId = metodoPago.split(':')[1];
      const deuda = this.deudas().find((d) => d.id === deudaId);
      return 'Crédito: ' + (deuda ? deuda.nombre : 'tarjeta eliminada');
    }
    return metodoPago;
  }

  async guardarMovimiento(payload: Partial<Movimiento>, id?: string): Promise<string | null> {
    let error;
    if (id) {
      ({ error } = await db.from('movimientos').update(payload).eq('id', id));
    } else {
      ({ error } = await db.from('movimientos').insert(payload));
    }
    return error ? error.message : null;
  }

  async eliminarMovimiento(id: string): Promise<string | null> {
    const { error } = await db.from('movimientos').delete().eq('id', id);
    return error ? error.message : null;
  }

  // Suma (o resta) al saldo de una tarjeta. Lee el saldo directo de la BD
  // para evitar que dos ajustes seguidos pisen el valor del otro.
  async ajustarSaldoTarjeta(metodoPago: string, delta: number): Promise<void> {
    const deudaId = metodoPago.split(':')[1];
    const { data: deuda, error: errorLectura } = await db
      .from('deudas')
      .select('saldo_tarjeta')
      .eq('id', deudaId)
      .maybeSingle();
    if (errorLectura || !deuda) return;
    const nuevoSaldo = Math.max(deuda.saldo_tarjeta + delta, 0);
    await db.from('deudas').update({ saldo_tarjeta: nuevoSaldo }).eq('id', deudaId);
  }

  // ============================================
  // DEUDAS
  // ============================================
  async guardarDeuda(payload: Partial<Deuda>, id?: string): Promise<string | null> {
    let error;
    if (id) {
      ({ error } = await db.from('deudas').update(payload).eq('id', id));
    } else {
      ({ error } = await db.from('deudas').insert(payload));
    }
    return error ? error.message : null;
  }

  async eliminarDeuda(id: string): Promise<string | null> {
    const { error } = await db.from('deudas').delete().eq('id', id);
    return error ? error.message : null;
  }

  async guardarCorte(payload: Partial<CorteTarjeta>): Promise<string | null> {
    const { error } = await db
      .from('tarjeta_cortes')
      .upsert(payload, { onConflict: 'deuda_id,mes' });
    return error ? error.message : null;
  }

  async registrarPagoDeuda(
    deuda: Deuda,
    monto: number,
  ): Promise<string | null> {
    const esTarjeta = deuda.tipo === 'tarjeta_credito';
    const corte = esTarjeta ? this.corteDelMes(deuda.id) : null;

    const { error: errorDeuda } = esTarjeta
      ? await db.from('deudas').update({ saldo_tarjeta: Math.max(deuda.saldo_tarjeta - monto, 0) }).eq('id', deuda.id)
      : await db.from('deudas').update({ pagado_acumulado: deuda.pagado_acumulado + monto }).eq('id', deuda.id);
    if (errorDeuda) return errorDeuda.message;

    const { data: mov, error: errorMov } = await db
      .from('movimientos')
      .insert({
        tipo: 'gasto',
        monto,
        categoria: 'Pago de deuda',
        fecha: fechaHoyIso(),
        nota: `Pago${esTarjeta ? ' corte' : ''}: ${deuda.nombre}`,
        metodo_pago: 'efectivo',
      })
      .select()
      .single();
    if (errorMov) return errorMov.message;

    if (esTarjeta) {
      if (corte) {
        await db.from('tarjeta_cortes').update({ pagado: true, movimiento_id: mov.id }).eq('id', corte.id);
      }
    } else {
      await db.from('deudas_pagos').upsert(
        { deuda_id: deuda.id, mes: mesActual(), movimiento_id: mov.id },
        { onConflict: 'deuda_id,mes' },
      );
    }
    return null;
  }

  // ============================================
  // GASTOS FIJOS
  // ============================================
  async togglePagoGastoFijo(gastoFijoId: string, marcarComoPagado: boolean): Promise<void> {
    const gasto = this.gastosFijos().find((g) => g.id === gastoFijoId);
    const mes = mesActual();

    if (marcarComoPagado && gasto) {
      const { data: movimiento, error: errorMov } = await db
        .from('movimientos')
        .insert({
          tipo: 'gasto',
          monto: gasto.monto,
          categoria: gasto.categoria,
          fecha: fechaHoyIso(),
          nota: `Pago automático: ${gasto.nombre}`,
        })
        .select()
        .single();
      if (errorMov) return alert('Error: ' + errorMov.message);

      const { error: errorPago } = await db.from('gastos_fijos_pagos').insert({
        gasto_fijo_id: gastoFijoId,
        mes,
        movimiento_id: movimiento.id,
      });
      if (errorPago) return alert('Error: ' + errorPago.message);
    } else {
      const pago = this.pagosDelMes().find((p) => p.gasto_fijo_id === gastoFijoId);
      if (pago) {
        if (pago.movimiento_id) {
          await db.from('movimientos').delete().eq('id', pago.movimiento_id);
        }
        await db.from('gastos_fijos_pagos').delete().eq('id', pago.id);
      }
    }

    await Promise.all([this.cargarGastosFijos(), this.cargarMovimientos()]);
  }

  async guardarGastoFijo(payload: Partial<GastoFijo>, id?: string): Promise<string | null> {
    let error;
    if (id) {
      ({ error } = await db.from('gastos_fijos').update(payload).eq('id', id));
    } else {
      ({ error } = await db.from('gastos_fijos').insert(payload));
    }
    return error ? error.message : null;
  }

  async eliminarGastoFijo(id: string): Promise<string | null> {
    const { error } = await db.from('gastos_fijos').update({ activo: false }).eq('id', id);
    return error ? error.message : null;
  }

  // ============================================
  // PRESUPUESTO
  // ============================================
  async guardarCategoriaGrande(payload: Partial<CategoriaGrande>, id?: string): Promise<string | null> {
    let error;
    if (id) {
      ({ error } = await db.from('categorias_grandes').update(payload).eq('id', id));
    } else {
      ({ error } = await db.from('categorias_grandes').insert(payload));
    }
    return error ? error.message : null;
  }

  async eliminarCategoriaGrande(id: string): Promise<string | null> {
    const { error } = await db.from('categorias_grandes').delete().eq('id', id);
    return error ? error.message : null;
  }

  async guardarSubcategoria(nombre: string, categoriaGrandeId: string): Promise<string | null> {
    const { error } = await db.from('subcategorias').insert({ nombre, categoria_grande_id: categoriaGrandeId });
    return error ? error.message : null;
  }

  async eliminarSubcategoria(id: string): Promise<string | null> {
    const { error } = await db.from('subcategorias').delete().eq('id', id);
    return error ? error.message : null;
  }

  async guardarMeta(payload: Partial<MetaAhorro>, id?: string): Promise<string | null> {
    let error;
    if (id) {
      ({ error } = await db.from('metas_ahorro').update(payload).eq('id', id));
    } else {
      ({ error } = await db.from('metas_ahorro').insert(payload));
    }
    return error ? error.message : null;
  }

  async eliminarMeta(id: string): Promise<string | null> {
    const { error } = await db.from('metas_ahorro').update({ activa: false }).eq('id', id);
    return error ? error.message : null;
  }

  // ============================================
  // CÁLCULOS DEL DASHBOARD
  // ============================================
  balance(): number {
    return this.movimientos().reduce((acc, m) => {
      return acc + (m.tipo === 'ingreso' ? m.monto : -m.monto);
    }, 0);
  }

  movimientosDelMes(): Movimiento[] {
    const mes = mesActual();
    return this.movimientos().filter((m) => m.fecha.slice(0, 7) === mes);
  }

  comprometidoEsteMes(): number {
    const gastosFijosPendientes = this.gastosFijos()
      .filter((g) => !this.estaPagadoEsteMes(g.id))
      .reduce((acc, g) => acc + g.monto, 0);

    const deudasPendientesEsteMes = this.deudas()
      .filter((d) => !this.estaDeudaPagadaEsteMes(d.id))
      .reduce((acc, d) => {
        if (d.tipo === 'tarjeta_credito') {
          const corte = this.corteDelMes(d.id);
          return acc + (corte ? corte.monto_corte : 0);
        }
        return acc + d.pago_mensual_planeado;
      }, 0);

    return gastosFijosPendientes + deudasPendientesEsteMes;
  }

  deudaTotalPendiente(): number {
    return this.deudas().reduce((acc, d) => {
      if (d.tipo === 'tarjeta_credito') return acc + d.saldo_tarjeta;
      return acc + Math.max(d.monto_total - d.pagado_acumulado, 0);
    }, 0);
  }

  // Disponible para gastar = presupuesto de Ocio - lo gastado en Ocio este mes
  disponibleParaGastar(movimientosDelMes: Movimiento[]): number {
    const catOcio = this.categoriasGrandes().find((c) => c.nombre.toLowerCase().includes('ocio'));
    if (catOcio && this.configuracion().ingreso_mensual > 0) {
      const presupuestoOcio = this.configuracion().ingreso_mensual * (catOcio.porcentaje / 100);
      const subsOcio = new Set(
        this.subcategorias()
          .filter((s) => s.categoria_grande_id === catOcio.id)
          .map((s) => s.nombre),
      );
      subsOcio.add(catOcio.nombre);
      const gastadoOcio = movimientosDelMes
        .filter((m) => m.tipo === 'gasto' && subsOcio.has(m.categoria))
        .reduce((acc, m) => acc + m.monto, 0);
      return presupuestoOcio - gastadoOcio;
    }
    // fallback si no hay categoría de Ocio configurada
    return this.balance() - this.comprometidoEsteMes();
  }

  // Gastos del mes agrupados por categoría
  gastosPorCategoria(movimientosDelMes: Movimiento[]): Record<string, number> {
    const gastosPorCategoria: Record<string, number> = {};
    movimientosDelMes
      .filter((m) => m.tipo === 'gasto')
      .forEach((m) => {
        gastosPorCategoria[m.categoria] = (gastosPorCategoria[m.categoria] || 0) + m.monto;
      });
    return gastosPorCategoria;
  }
}
