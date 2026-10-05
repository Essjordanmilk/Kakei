import { computed, inject, Injectable, signal } from '@angular/core';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { MonedaService } from '../../core/moneda.service';
import { NotificacionService } from '../../core/notificacion.service';
import { MensajeError } from '../../core/tipos';
import {
  claveMes,
  fechaHoyIso,
  mesActual,
  mesRelativo,
  normalizarTexto,
} from '../../core/utils';
import { esNombreIcono, ICONOS, NombreIcono } from '../../shared/iconos';
import { OpcionSelect } from '../../shared/models/ui.models';
import { DineroPreferenciasService } from './dinero-preferencias.service';
import { LocalDbService } from './local-db.service';
import {
  aplicacionesPendientes,
  calcularInfoTarjeta,
  calcularPatrimonio,
  calcularSaldos,
  categoriaPredeterminadaDe,
  claveRegistroGastoFijo,
  ClasificacionGasto,
  estadoPresupuesto,
  resumenUltimosMeses,
  saldoDeudaNormal,
  soloGastos,
  sumarMontos,
} from './dinero.calculos';
import {
  CATEGORIA_OTROS,
  CATEGORIAS_PREDETERMINADAS,
  COLOR_INGRESO,
  COLOR_SIN_CATEGORIA,
  COLOR_TRASLADO,
  claveColorDeSlot,
  colorDeSlot,
  CUENTAS_PREDETERMINADAS,
  DIFERENCIA_MINIMA_AJUSTE,
  ETIQUETA_AJUSTE_SALDO,
  ETIQUETA_PAGO_DEUDA,
  ETIQUETA_PAGO_TARJETA,
  ETIQUETA_SIN_CATEGORIA,
  ETIQUETAS_TIPO_CUENTA,
  INTERVALO_REVISION_GASTOS_FIJOS_MS,
  MESES_HISTORICO,
  MESES_RECUPERACION_GASTOS_FIJOS,
  NOMBRES_CATEGORIA_OCIO,
  PORCENTAJE_TOTAL,
  resolverColor,
  SLOTS_COLOR,
  TABLAS_DINERO,
  TablaDinero,
} from './dinero.constantes';
import {
  AplicacionGastoFijo,
  CategoriaGrande,
  CategoriaGrandePayload,
  CategoriaPredeterminada,
  CortePayload,
  CorteTarjeta,
  Cuenta,
  CuentaConSaldo,
  CuentaPayload,
  Deuda,
  DeudaPago,
  DeudaPayload,
  GastoFijo,
  GastoFijoPago,
  GastoFijoPayload,
  GrupoCategoria,
  InfoTarjeta,
  MetaAhorro,
  MetaAhorroPayload,
  PresupuestosPorCategoria,
  ResumenCategoria,
  ResumenMes,
  ResumenPatrimonio,
  Subcategoria,
  TipoCategoria,
  Transaccion,
  TransaccionPayload,
} from './dinero.models';

// La tabla `deudas` conserva la columna `tipo`; la app ya solo maneja préstamos
// normales. Se declara aquí porque el modelo no la expone.
type DeudaFila = Deuda & { tipo?: string };

const TIPO_DEUDA_NORMAL = 'normal';

// Identificador único local (uuid) para las filas nuevas
function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo guardar en el almacenamiento local.';
}

@Injectable({ providedIn: 'root' })
export class DineroService {
  private readonly db = inject(LocalDbService);
  private readonly preferencias = inject(DineroPreferenciasService);
  private readonly notificacion = inject(NotificacionService);
  private readonly monedaService = inject(MonedaService);

  // ============================================
  // ESTADO (solo escribible desde el servicio)
  // ============================================
  private readonly estado = {
    cuentas: signal<Cuenta[]>([]),
    categoriasGrandes: signal<CategoriaGrande[]>([]),
    subcategorias: signal<Subcategoria[]>([]),
    metasAhorro: signal<MetaAhorro[]>([]),
    cortesDelMes: signal<CorteTarjeta[]>([]),
    movimientos: signal<Transaccion[]>([]),
    deudas: signal<Deuda[]>([]),
    deudasPagosDelMes: signal<DeudaPago[]>([]),
    gastosFijos: signal<GastoFijo[]>([]),
    pagosDelMes: signal<GastoFijoPago[]>([]),
  };

  // true cuando el estado ya refleja los datos locales
  private readonly datosListos = signal(false);

  // Evita dos revisiones simultáneas de gastos fijos en este dispositivo
  private aplicandoGastosFijos = false;
  private temporizadorGastosFijos: ReturnType<typeof setInterval> | null = null;

  readonly categoriasGrandes = this.estado.categoriasGrandes.asReadonly();
  readonly subcategorias = this.estado.subcategorias.asReadonly();
  readonly metasAhorro = this.estado.metasAhorro.asReadonly();
  readonly cortesDelMes = this.estado.cortesDelMes.asReadonly();
  readonly movimientos = this.estado.movimientos.asReadonly();
  readonly deudas = this.estado.deudas.asReadonly();
  readonly gastosFijos = this.estado.gastosFijos.asReadonly();

  constructor() {
    // Todo vive en IndexedDB: se carga al arrancar (sin sesión ni backend).
    void this.inicializar();
  }

  private async inicializar(): Promise<void> {
    await this.cargarTodo();
    await this.asegurarValoresPorDefecto();
    await this.migrarColoresLocales();
    await this.aplicarGastosFijosPendientes();
    this.iniciarRevisionGastosFijos();
  }

  // ============================================
  // DERIVADOS
  // ============================================
  // ---------- CUENTAS Y PATRIMONIO ----------
  // El saldo de cada cuenta se recalcula con cada transacción: crear, editar o
  // borrar una transacción nunca deja saldos desincronizados
  readonly cuentas = computed<CuentaConSaldo[]>(() =>
    calcularSaldos(this.estado.cuentas(), this.movimientos()),
  );

  private readonly cuentasPorId = computed<Map<string, CuentaConSaldo>>(
    () => new Map(this.cuentas().map((c) => [c.id, c])),
  );

  readonly tarjetasCredito = computed<CuentaConSaldo[]>(() =>
    this.cuentas().filter((c) => c.tipo === 'credito'),
  );

  readonly patrimonio = computed<ResumenPatrimonio>(() => calcularPatrimonio(this.cuentas()));

  // Cuenta que se propone por defecto en los formularios: la primera de débito
  readonly cuentaPrincipalId = computed<string | null>(
    () => (this.cuentas().find((c) => c.tipo === 'debito') ?? this.cuentas()[0])?.id ?? null,
  );

  readonly opcionesCuenta = computed<OpcionSelect[]>(() =>
    this.cuentas().map((c) => ({
      valor: c.id,
      etiqueta: `${c.nombre} · ${ETIQUETAS_TIPO_CUENTA[c.tipo]}`,
    })),
  );

  // ---------- CATEGORÍAS ----------
  readonly categoriasGasto = computed<CategoriaGrande[]>(() =>
    this.categoriasGrandes().filter((c) => c.tipo === 'GASTO'),
  );

  readonly categoriasIngreso = computed<CategoriaGrande[]>(() =>
    this.categoriasGrandes().filter((c) => c.tipo === 'INGRESO'),
  );

  private readonly subcategoriasPorCategoria = computed<Map<string, Subcategoria[]>>(() => {
    const mapa = new Map<string, Subcategoria[]>();
    for (const sub of this.subcategorias()) {
      mapa.set(sub.categoria_grande_id, [...(mapa.get(sub.categoria_grande_id) ?? []), sub]);
    }
    return mapa;
  });

  private readonly categoriasPorId = computed<Map<string, CategoriaGrande>>(
    () => new Map(this.categoriasGrandes().map((c) => [c.id, c])),
  );

  private readonly subcategoriasPorId = computed<Map<string, Subcategoria>>(
    () => new Map(this.subcategorias().map((s) => [s.id, s])),
  );

  // Clave de color de cada categoría ('serie-N' o '#rrggbb'): la guardada
  // o, si no tiene, la de la categoría sugerida con ese nombre o la siguiente de la paleta
  private readonly colorPorCategoria = computed<Map<string, string>>(
    () =>
      new Map(
        this.categoriasGrandes().map((categoria, i): [string, string] => [
          categoria.id,
          resolverColor(categoria.color) !== null && categoria.color
            ? categoria.color
            : claveColorDeSlot(
                categoriaPredeterminadaDe(categoria.nombre)?.slot ?? SLOTS_COLOR[i % SLOTS_COLOR.length],
              ),
        ]),
      ),
  );

  readonly categoriasSugeridasFaltantes = computed<Record<TipoCategoria, CategoriaPredeterminada[]>>(
    () => ({
      GASTO: this.faltantes('GASTO', this.categoriasGasto()),
      INGRESO: this.faltantes('INGRESO', this.categoriasIngreso()),
    }),
  );

  // ---------- RESUMEN DEL MES ----------
  readonly movimientosDelMes = computed<Transaccion[]>(() => this.movimientosDeMes(mesActual()));

  readonly ingresosMes = computed<number>(() => sumarMontos(this.movimientosDelMes(), 'INGRESO'));

  // Solo transacciones tipo GASTO: los traslados (p. ej. pagar la tarjeta) no son consumo
  readonly gastosMes = computed<number>(() => sumarMontos(this.movimientosDelMes(), 'GASTO'));

  // Patrimonio al cierre de los últimos meses + ingresos y gastos de cada uno
  readonly historicoMensual = computed<ResumenMes[]>(() =>
    resumenUltimosMeses(
      this.movimientos(),
      MESES_HISTORICO,
      this.estado.cuentas().reduce((acc, c) => acc + c.saldo_inicial, 0),
    ),
  );

  readonly comprometidoEsteMes = computed<number>(() => {
    const gastosFijosPendientes = this.gastosFijos()
      .filter((g) => !this.estaPagadoEsteMes(g.id))
      .reduce((acc, g) => acc + g.monto, 0);

    const cuotasPendientes = this.deudas()
      .filter((d) => !this.estaDeudaPagadaEsteMes(d.id))
      .reduce((acc, d) => acc + d.pago_mensual_planeado, 0);

    const cortesPendientes = this.cortesDelMes()
      .filter((c) => !c.pagado)
      .reduce((acc, c) => acc + c.monto_corte, 0);

    return gastosFijosPendientes + cuotasPendientes + cortesPendientes;
  });

  // Préstamos pendientes + lo que se debe en tarjetas de crédito
  readonly deudaTotalPendiente = computed<number>(
    () =>
      this.deudas().reduce((acc, d) => acc + saldoDeudaNormal(d), 0) +
      this.patrimonio().deudaCredito,
  );

  readonly resumenCategorias = computed<ResumenCategoria[]>(() => {
    const gastado = new Map<string, number>();
    for (const t of soloGastos(this.movimientosDelMes())) {
      if (t.categoria_id) gastado.set(t.categoria_id, (gastado.get(t.categoria_id) ?? 0) + t.monto);
    }

    return this.categoriasGasto().map((categoria) => {
      const gastadoCategoria = gastado.get(categoria.id) ?? 0;
      const presupuesto = categoria.presupuesto_mensual || 0;
      const porcentajeUsado =
        presupuesto > 0
          ? Math.min((gastadoCategoria / presupuesto) * PORCENTAJE_TOTAL, PORCENTAJE_TOTAL)
          : 0;

      return {
        categoria,
        color: this.colorDeCategoria(categoria.id),
        icono: this.iconoDeCategoria(categoria),
        subcategorias: this.subcategoriasDe(categoria.id),
        presupuesto,
        gastado: gastadoCategoria,
        disponible: presupuesto - gastadoCategoria,
        porcentajeUsado,
        ...estadoPresupuesto(gastadoCategoria, presupuesto),
      };
    });
  });

  // Disponible para gastar = presupuesto de Ocio/Entretenimiento - lo gastado en ella este mes
  readonly disponibleParaGastar = computed<number>(() => {
    const ocio = this.resumenCategorias().find((r) => {
      const nombre = normalizarTexto(r.categoria.nombre);
      return NOMBRES_CATEGORIA_OCIO.some((clave) => nombre.includes(clave));
    });
    if (ocio && ocio.presupuesto > 0) return ocio.disponible;
    // Sin esa categoría: lo que hay en débito menos lo comprometido del mes
    return this.patrimonio().saldoDisponible - this.comprometidoEsteMes();
  });

  // Suma de los presupuestos mensuales de las categorías de gasto
  readonly presupuestoTotal = computed<number>(() =>
    this.categoriasGasto().reduce((acc, cg) => acc + (cg.presupuesto_mensual || 0), 0),
  );

  readonly gruposCategoria = computed<Record<TipoCategoria, GrupoCategoria[]>>(() => ({
    GASTO: this.categoriasGasto().map((c) => this.grupoDe(c)),
    INGRESO: this.categoriasIngreso().map((c) => this.grupoDe(c)),
  }));

  // ============================================
  // CONSULTAS
  // ============================================
  cuenta(id: string | null): CuentaConSaldo | undefined {
    return id ? this.cuentasPorId().get(id) : undefined;
  }

  nombreCuenta(id: string | null): string {
    return this.cuenta(id)?.nombre ?? 'Cuenta eliminada';
  }

  // Cuántas transacciones o gastos fijos usan la cuenta (para impedir borrarla)
  usosDeCuenta(cuentaId: string): number {
    return (
      this.movimientos().filter(
        (t) => t.cuenta_origen_id === cuentaId || t.cuenta_destino_id === cuentaId,
      ).length + this.gastosFijos().filter((g) => g.cuenta_id === cuentaId).length
    );
  }

  subcategoriasDe(categoriaGrandeId: string): Subcategoria[] {
    return this.subcategoriasPorCategoria().get(categoriaGrandeId) ?? [];
  }

  movimientosDeMes(mes: string): Transaccion[] {
    return this.movimientos().filter((m) => m.fecha.startsWith(mes));
  }

  // Transacciones entre dos fechas YYYY-MM-DD, ambas incluidas
  movimientosEntre(desde: string, hasta: string): Transaccion[] {
    return this.movimientos().filter((m) => m.fecha >= desde && m.fecha <= hasta);
  }

  corteDelMes(cuentaId: string): CorteTarjeta | undefined {
    return this.cortesDelMes().find((c) => c.cuenta_id === cuentaId);
  }

  estaDeudaPagadaEsteMes(deudaId: string): boolean {
    return this.estado.deudasPagosDelMes().some((p) => p.deuda_id === deudaId);
  }

  // Un registro marcado como omitido cuenta como "no pagado" (el usuario lo desmarcó)
  estaPagadoEsteMes(gastoFijoId: string): boolean {
    return this.estado.pagosDelMes().some((p) => p.gasto_fijo_id === gastoFijoId && !p.omitido);
  }

  infoTarjeta(cuenta: Cuenta): InfoTarjeta {
    return calcularInfoTarjeta(cuenta, this.corteDelMes(cuenta.id));
  }

  // Clave guardable del color ('serie-N' o '#rrggbb'), para los selectores
  claveColorDeCategoria(categoriaId: string): string {
    return this.colorPorCategoria().get(categoriaId) ?? claveColorDeSlot(SLOTS_COLOR[0]);
  }

  // CSS listo para pintar
  colorDeCategoria(categoriaId: string): string {
    return resolverColor(this.claveColorDeCategoria(categoriaId)) ?? colorDeSlot(SLOTS_COLOR[0]);
  }

  // Icono guardado o, si no tiene, el de la categoría sugerida con ese nombre
  nombreIconoDeCategoria(categoria: Pick<CategoriaGrande, 'nombre' | 'icono'>): NombreIcono {
    if (esNombreIcono(categoria.icono)) return categoria.icono;
    return categoriaPredeterminadaDe(categoria.nombre)?.icono ?? 'categoria';
  }

  iconoDeCategoria(categoria: Pick<CategoriaGrande, 'nombre' | 'icono'>): IconDefinition {
    return ICONOS[this.nombreIconoDeCategoria(categoria)];
  }

  // "Alimentación › Mercado"
  etiquetaCategoria(categoriaId: string | null, subcategoriaId: string | null): string | null {
    const categoria = categoriaId ? this.categoriasPorId().get(categoriaId) : undefined;
    if (!categoria) return null;
    const sub = subcategoriaId ? this.subcategoriasPorId().get(subcategoriaId) : undefined;
    return sub ? `${categoria.nombre} › ${sub.nombre}` : categoria.nombre;
  }

  // Título de una transacción en las listas
  tituloTransaccion(t: Transaccion): string {
    if (t.tipo === 'TRASLADO') return t.categoria ?? 'Traslado';
    return this.etiquetaCategoria(t.categoria_id, t.subcategoria_id) ?? t.categoria ?? ETIQUETA_SIN_CATEGORIA;
  }

  // Cuentas involucradas: "Cuenta Débito", "Cuenta Débito → Trii"
  cuentasDeTransaccion(t: Transaccion): string {
    if (t.tipo === 'TRASLADO') {
      return `${this.nombreCuenta(t.cuenta_origen_id)} → ${this.nombreCuenta(t.cuenta_destino_id)}`;
    }
    return this.nombreCuenta(t.tipo === 'GASTO' ? t.cuenta_origen_id : t.cuenta_destino_id);
  }

  // "Cuenta Débito · Mercado del mes"
  detalleTransaccion(t: Transaccion): string {
    const cuentas = this.cuentasDeTransaccion(t);
    return t.descripcion ? `${cuentas} · ${t.descripcion}` : cuentas;
  }

  // Agrupa un gasto en su categoría grande (o en "Otros") con el color de esa categoría
  clasificarGasto(t: Pick<Transaccion, 'categoria_id'>): ClasificacionGasto {
    const categoria = t.categoria_id ? this.categoriasPorId().get(t.categoria_id) : undefined;
    return categoria
      ? { categoria: categoria.nombre, color: this.colorDeCategoria(categoria.id) }
      : { categoria: CATEGORIA_OTROS, color: COLOR_SIN_CATEGORIA };
  }

  // Indicador de color de una fila de transacción
  colorDeTransaccion(t: Transaccion): string {
    if (t.tipo === 'INGRESO') return COLOR_INGRESO;
    if (t.tipo === 'TRASLADO') return COLOR_TRASLADO;
    return this.clasificarGasto(t).color;
  }

  // ============================================
  // CARGA
  // ============================================
  async cargarTodo(): Promise<void> {
    await Promise.all([
      this.cargarCuentas(),
      this.cargarCategoriasGrandes(),
      this.cargarMovimientos(),
      this.cargarDeudas(),
      this.cargarGastosFijos(),
      this.cargarMetasAhorro(),
      this.cargarCortesDelMes(),
    ]);
    await this.cargarSubcategorias();
    this.datosListos.set(true);
  }

  // Crea las cuentas base si no hay ninguna, y las categorías por defecto si es un
  // usuario nuevo (sin categorías ni transacciones). Así no reaparecen categorías
  // que alguien con historial borró a propósito.
  private async asegurarValoresPorDefecto(): Promise<void> {
    if (!this.datosListos()) return;
    if (this.estado.cuentas().length === 0) await this.crearCuentasPredeterminadas();
    if (this.categoriasGrandes().length === 0 && this.movimientos().length === 0) {
      await this.crearCategoriasPredeterminadas('GASTO');
      await this.crearCategoriasPredeterminadas('INGRESO');
    }
  }

  // Los colores elegidos antes vivían en localStorage: se guardan una vez en las
  // categorías sin color propio y se borran de las preferencias
  private async migrarColoresLocales(): Promise<void> {
    const locales = this.preferencias.coloresCategoria();
    if (Object.keys(locales).length === 0) return;
    const pendientes = this.categoriasGrandes().filter((c) => !c.color && locales[c.id]);
    const errores = await Promise.all(
      pendientes.map((c) =>
        this.actualizarEnTabla(TABLAS_DINERO.categoriasGrandes, c.id, {
          color: claveColorDeSlot(locales[c.id]),
        }),
      ),
    );
    if (errores.every((e) => e === null)) {
      this.preferencias.limpiarColoresLegados();
      if (pendientes.length > 0) await this.cargarCategoriasGrandes();
    }
  }

  async cargarCuentas(): Promise<void> {
    const cuentas = await this.db.tabla<Cuenta>(TABLAS_DINERO.cuentas).toArray();
    cuentas.sort((a, b) => a.orden - b.orden || a.created_at.localeCompare(b.created_at));
    this.estado.cuentas.set(cuentas);
  }

  async cargarCategoriasGrandes(): Promise<void> {
    const categorias = await this.db.tabla<CategoriaGrande>(TABLAS_DINERO.categoriasGrandes).toArray();
    categorias.sort((a, b) => a.orden - b.orden);
    this.estado.categoriasGrandes.set(categorias);
  }

  async cargarSubcategorias(): Promise<void> {
    if (this.categoriasGrandes().length === 0) {
      this.estado.subcategorias.set([]);
      return;
    }
    const subcategorias = await this.db.tabla<Subcategoria>(TABLAS_DINERO.subcategorias).toArray();
    subcategorias.sort((a, b) => a.nombre.localeCompare(b.nombre));
    this.estado.subcategorias.set(subcategorias);
  }

  async cargarMetasAhorro(): Promise<void> {
    const metas = await this.db.tabla<MetaAhorro>(TABLAS_DINERO.metasAhorro).toArray();
    this.estado.metasAhorro.set(
      metas.filter((m) => m.activa).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );
  }

  async cargarCortesDelMes(): Promise<void> {
    const mes = mesActual();
    const cortes = await this.db.tabla<CorteTarjeta>(TABLAS_DINERO.tarjetaCortes).toArray();
    this.estado.cortesDelMes.set(cortes.filter((c) => c.mes === mes && c.cuenta_id !== null));
  }

  async cargarMovimientos(): Promise<void> {
    const movimientos = await this.db.tabla<Transaccion>(TABLAS_DINERO.movimientos).toArray();
    movimientos.sort(
      (a, b) =>
        b.fecha.localeCompare(a.fecha) ||
        b.created_at.localeCompare(a.created_at) ||
        a.id.localeCompare(b.id),
    );
    this.estado.movimientos.set(movimientos);
  }

  async cargarDeudas(): Promise<void> {
    const deudas = await this.db.tabla<DeudaFila>(TABLAS_DINERO.deudas).toArray();
    this.estado.deudas.set(
      deudas
        .filter((d) => d.activa && (d.tipo ?? TIPO_DEUDA_NORMAL) === TIPO_DEUDA_NORMAL)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );

    const mes = mesActual();
    const pagos = await this.db.tabla<DeudaPago>(TABLAS_DINERO.deudasPagos).toArray();
    this.estado.deudasPagosDelMes.set(pagos.filter((p) => p.mes === mes));
  }

  async cargarGastosFijos(): Promise<void> {
    const fijos = await this.db.tabla<GastoFijo>(TABLAS_DINERO.gastosFijos).toArray();
    this.estado.gastosFijos.set(
      fijos.filter((g) => g.activo).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );

    const mes = mesActual();
    const pagos = await this.db.tabla<GastoFijoPago>(TABLAS_DINERO.gastosFijosPagos).toArray();
    this.estado.pagosDelMes.set(pagos.filter((p) => p.mes === mes));
  }

  // ============================================
  // TRANSACCIONES
  // ============================================
  // Los saldos de las cuentas se derivan de las transacciones, así que guardar
  // o borrar una transacción basta para que todos los saldos queden al día.
  guardarTransaccion(payload: TransaccionPayload, id?: string): Promise<MensajeError> {
    return this.conRecarga(this.guardarEnTabla(TABLAS_DINERO.movimientos, payload, id), () =>
      this.cargarMovimientos(),
    );
  }

  eliminarTransaccion(id: string): Promise<MensajeError> {
    return this.conRecarga(this.eliminarDeTabla(TABLAS_DINERO.movimientos, id), () =>
      this.cargarMovimientos(),
    );
  }

  // Crea un ingreso o gasto que lleva el saldo calculado de la cuenta al saldo real
  // indicado. En crédito, `saldoReal` es negativo cuando se debe.
  async registrarAjusteSaldo(cuentaId: string, saldoReal: number): Promise<MensajeError> {
    const cuenta = this.cuenta(cuentaId);
    if (!cuenta) return 'La cuenta no existe';
    const diferencia = saldoReal - cuenta.saldoActual;
    if (Math.abs(diferencia) < DIFERENCIA_MINIMA_AJUSTE) return null;

    const esIngreso = diferencia > 0;
    return this.guardarTransaccion({
      tipo: esIngreso ? 'INGRESO' : 'GASTO',
      monto: Math.abs(diferencia),
      fecha: fechaHoyIso(),
      cuenta_origen_id: esIngreso ? null : cuentaId,
      cuenta_destino_id: esIngreso ? cuentaId : null,
      categoria_id: null,
      subcategoria_id: null,
      categoria: ETIQUETA_AJUSTE_SALDO,
      descripcion: `Ajuste manual: saldo real ${this.monedaService.formatear(saldoReal)}`,
    });
  }

  // ============================================
  // CUENTAS
  // ============================================
  async guardarCuenta(payload: CuentaPayload, id?: string): Promise<MensajeError> {
    const datos: CuentaPayload = id ? payload : { ...payload, orden: this.estado.cuentas().length + 1 };
    return this.conRecarga(this.guardarEnTabla(TABLAS_DINERO.cuentas, datos, id), () =>
      this.cargarCuentas(),
    );
  }

  // Saldo inicial necesario para que el saldo actual de la cuenta sea `saldoActual`
  saldoInicialPara(cuentaId: string | null, saldoActual: number): number {
    const cuenta = this.cuenta(cuentaId);
    return cuenta ? saldoActual - (cuenta.saldoActual - cuenta.saldo_inicial) : saldoActual;
  }

  async eliminarCuenta(cuentaId: string): Promise<MensajeError> {
    const usos = this.usosDeCuenta(cuentaId);
    if (usos > 0) {
      return `La cuenta tiene ${usos} transacciones o gastos fijos asociados. Muévelos a otra cuenta antes de eliminarla.`;
    }
    return this.conRecarga(this.eliminarDeTabla(TABLAS_DINERO.cuentas, cuentaId), () =>
      this.cargarCuentas(),
    );
  }

  private async crearCuentasPredeterminadas(): Promise<MensajeError> {
    try {
      const ahora = new Date().toISOString();
      const filas: Cuenta[] = CUENTAS_PREDETERMINADAS.map((c, i) => ({
        id: nuevoId(),
        nombre: c.nombre,
        tipo: c.tipo,
        color: c.color,
        saldo_inicial: 0,
        dia_corte: null,
        dia_limite_pago: null,
        orden: i + 1,
        created_at: ahora,
      }));
      await this.db.tabla<Cuenta>(TABLAS_DINERO.cuentas).bulkAdd(filas);
      await this.cargarCuentas();
      return null;
    } catch (error) {
      return mensajeError(error);
    }
  }

  // ============================================
  // TARJETAS DE CRÉDITO
  // ============================================
  async guardarCorte(payload: CortePayload): Promise<MensajeError> {
    try {
      const tabla = this.db.tabla<CorteTarjeta>(TABLAS_DINERO.tarjetaCortes);
      const existente = await tabla
        .where('[cuenta_id+mes]')
        .equals([payload.cuenta_id, payload.mes])
        .first();
      if (existente) await tabla.put({ ...existente, ...payload });
      else await tabla.add({ ...payload, id: nuevoId(), pagado: false, movimiento_id: null });
      await this.cargarCortesDelMes();
      return null;
    } catch (error) {
      return mensajeError(error);
    }
  }

  // Pagar la tarjeta es un TRASLADO: sale de la cuenta elegida y reduce la deuda
  // de la tarjeta, sin cambiar el patrimonio neto
  async pagarTarjeta(
    tarjeta: Cuenta,
    monto: number,
    cuentaOrigenId: string,
  ): Promise<MensajeError> {
    const { data: transaccion, error } = await this.insertarTransaccion({
      tipo: 'TRASLADO',
      monto,
      fecha: fechaHoyIso(),
      cuenta_origen_id: cuentaOrigenId,
      cuenta_destino_id: tarjeta.id,
      categoria_id: null,
      subcategoria_id: null,
      categoria: ETIQUETA_PAGO_TARJETA,
      descripcion: `Pago ${tarjeta.nombre}`,
    });
    if (error || !transaccion) return error ?? 'No se pudo registrar el pago';

    const corte = this.corteDelMes(tarjeta.id);
    const errorCorte =
      corte && !corte.pagado
        ? await this.actualizarEnTabla(TABLAS_DINERO.tarjetaCortes, corte.id, {
            pagado: true,
            movimiento_id: transaccion.id,
          })
        : null;

    await Promise.all([this.cargarMovimientos(), this.cargarCortesDelMes()]);
    return errorCorte;
  }

  // ============================================
  // DEUDAS (préstamos)
  // ============================================
  guardarDeuda(payload: DeudaPayload, id?: string): Promise<MensajeError> {
    const datos = id ? payload : { ...payload, tipo: TIPO_DEUDA_NORMAL };
    return this.conRecarga(this.guardarEnTabla(TABLAS_DINERO.deudas, datos, id), () =>
      this.cargarDeudas(),
    );
  }

  eliminarDeuda(id: string): Promise<MensajeError> {
    return this.conRecarga(this.eliminarDeTabla(TABLAS_DINERO.deudas, id), () =>
      this.cargarDeudas(),
    );
  }

  // La cuota es un GASTO de la cuenta elegida (el dinero sale del patrimonio)
  async registrarPagoDeuda(
    deuda: Deuda,
    monto: number,
    cuentaOrigenId: string,
  ): Promise<MensajeError> {
    const errorDeuda = await this.actualizarEnTabla(TABLAS_DINERO.deudas, deuda.id, {
      pagado_acumulado: deuda.pagado_acumulado + monto,
    });
    if (errorDeuda) return errorDeuda;

    const { data: transaccion, error } = await this.insertarTransaccion({
      tipo: 'GASTO',
      monto,
      fecha: fechaHoyIso(),
      cuenta_origen_id: cuentaOrigenId,
      cuenta_destino_id: null,
      categoria_id: null,
      subcategoria_id: null,
      categoria: ETIQUETA_PAGO_DEUDA,
      descripcion: `Pago: ${deuda.nombre}`,
    });
    if (error || !transaccion) return error ?? 'No se pudo registrar el pago';

    try {
      const tabla = this.db.tabla<DeudaPago>(TABLAS_DINERO.deudasPagos);
      const mes = mesActual();
      const existente = await tabla.where('[deuda_id+mes]').equals([deuda.id, mes]).first();
      if (existente) await tabla.put({ ...existente, movimiento_id: transaccion.id });
      else await tabla.add({ id: nuevoId(), deuda_id: deuda.id, mes, movimiento_id: transaccion.id });
    } catch (errorRegistro) {
      await this.cargarDeudas();
      await this.cargarMovimientos();
      return mensajeError(errorRegistro);
    }

    await Promise.all([this.cargarDeudas(), this.cargarMovimientos()]);
    return null;
  }

  // ============================================
  // GASTOS FIJOS
  // ============================================
  // Marcar a mano crea el GASTO del mes; desmarcar lo borra y deja el mes como
  // "omitido" para que la aplicación automática no lo vuelva a registrar.
  async togglePagoGastoFijo(gasto: GastoFijo, marcarComoPagado: boolean): Promise<MensajeError> {
    const error = marcarComoPagado
      ? await this.registrarPagoGastoFijo(gasto, mesActual(), fechaHoyIso())
      : await this.omitirPagoGastoFijo(gasto.id);
    await Promise.all([this.cargarGastosFijos(), this.cargarMovimientos()]);
    return error;
  }

  // Aplica los gastos fijos cuyo día ya llegó (este mes o, si la app no se abrió,
  // los meses recientes). El registro del mes evita aplicarlo dos veces.
  async aplicarGastosFijosPendientes(): Promise<void> {
    if (this.aplicandoGastosFijos) return;
    const gastos = this.gastosFijos().filter((g) => g.dia_aplicacion);
    if (gastos.length === 0) return;

    this.aplicandoGastosFijos = true;
    try {
      const registrados = await this.registrosRecientesGastosFijos(gastos.map((g) => g.id));
      if (!registrados) return;
      const pendientes = aplicacionesPendientes(gastos, registrados);
      const aplicados: string[] = [];
      for (const aplicacion of pendientes) {
        if (await this.aplicarGastoFijo(aplicacion)) aplicados.push(aplicacion.gasto.nombre);
      }
      if (aplicados.length > 0) {
        await Promise.all([this.cargarGastosFijos(), this.cargarMovimientos()]);
        const plural = aplicados.length === 1 ? 'Se aplicó el gasto fijo' : 'Se aplicaron los gastos fijos';
        this.notificacion.informar(`${plural}: ${aplicados.join(', ')}`);
      }
    } finally {
      this.aplicandoGastosFijos = false;
    }
  }

  // Claves "gastoId|mes" con registro (pagado u omitido) en la ventana de recuperación
  private async registrosRecientesGastosFijos(ids: readonly string[]): Promise<Set<string> | null> {
    const meses = new Set(
      Array.from({ length: MESES_RECUPERACION_GASTOS_FIJOS }, (_, i) =>
        claveMes(mesRelativo(new Date(), -i)),
      ),
    );
    try {
      const pagos = await this.db
        .tabla<GastoFijoPago>(TABLAS_DINERO.gastosFijosPagos)
        .where('gasto_fijo_id')
        .anyOf(ids)
        .toArray();
      return new Set(
        pagos
          .filter((p) => meses.has(p.mes))
          .map((p) => claveRegistroGastoFijo(p.gasto_fijo_id, p.mes)),
      );
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  private async aplicarGastoFijo({ gasto, mes, fecha }: AplicacionGastoFijo): Promise<boolean> {
    const tabla = this.db.tabla<GastoFijoPago>(TABLAS_DINERO.gastosFijosPagos);
    const existente = await tabla.where('[gasto_fijo_id+mes]').equals([gasto.id, mes]).first();
    if (existente) return false;

    const pago: GastoFijoPago = { id: nuevoId(), gasto_fijo_id: gasto.id, mes, omitido: false };
    try {
      await tabla.add(pago);
    } catch {
      return false;
    }

    const errorTransaccion = await this.crearTransaccionGastoFijo(gasto, fecha, pago.id);
    if (errorTransaccion) {
      await this.eliminarDeTabla(TABLAS_DINERO.gastosFijosPagos, pago.id);
      console.error(errorTransaccion);
      return false;
    }
    return true;
  }

  private async registrarPagoGastoFijo(gasto: GastoFijo, mes: string, fecha: string): Promise<MensajeError> {
    // Puede existir el registro del mes marcado como omitido: se reutiliza
    const tabla = this.db.tabla<GastoFijoPago>(TABLAS_DINERO.gastosFijosPagos);
    const existente = await tabla.where('[gasto_fijo_id+mes]').equals([gasto.id, mes]).first();
    let pagoId = existente?.id;
    if (!pagoId) {
      const pago: GastoFijoPago = { id: nuevoId(), gasto_fijo_id: gasto.id, mes, omitido: false };
      try {
        await tabla.add(pago);
      } catch (error) {
        return mensajeError(error);
      }
      pagoId = pago.id;
    }
    return this.crearTransaccionGastoFijo(gasto, fecha, pagoId);
  }

  // Crea el GASTO en la cuenta del gasto fijo y lo enlaza a su registro mensual
  private async crearTransaccionGastoFijo(gasto: GastoFijo, fecha: string, pagoId: string): Promise<MensajeError> {
    // Si su cuenta se borró, se paga desde la cuenta principal
    const cuentaId = this.cuenta(gasto.cuenta_id)?.id ?? this.cuentaPrincipalId();
    if (!cuentaId) return 'Crea una cuenta antes de registrar pagos';

    const { data: transaccion, error } = await this.insertarTransaccion({
      tipo: 'GASTO',
      monto: gasto.monto,
      fecha,
      cuenta_origen_id: cuentaId,
      cuenta_destino_id: null,
      categoria_id: gasto.categoria_id,
      subcategoria_id: gasto.subcategoria_id,
      categoria: gasto.categoria_id ? null : gasto.nombre,
      descripcion: `Gasto fijo: ${gasto.nombre}`,
    });
    if (error || !transaccion) return error ?? 'No se pudo registrar el gasto';
    return this.actualizarEnTabla(TABLAS_DINERO.gastosFijosPagos, pagoId, {
      movimiento_id: transaccion.id,
      omitido: false,
    });
  }

  private async omitirPagoGastoFijo(gastoFijoId: string): Promise<MensajeError> {
    const pago = this.estado.pagosDelMes().find((p) => p.gasto_fijo_id === gastoFijoId);
    if (!pago) return null;
    if (pago.movimiento_id) {
      const error = await this.eliminarDeTabla(TABLAS_DINERO.movimientos, pago.movimiento_id);
      if (error) return error;
    }
    return this.actualizarEnTabla(TABLAS_DINERO.gastosFijosPagos, pago.id, {
      omitido: true,
      movimiento_id: null,
    });
  }

  // Con la app abierta se vuelve a revisar cada hora (p. ej. si pasa la medianoche)
  private iniciarRevisionGastosFijos(): void {
    this.detenerRevisionGastosFijos();
    this.temporizadorGastosFijos = setInterval(
      () => void this.aplicarGastosFijosPendientes(),
      INTERVALO_REVISION_GASTOS_FIJOS_MS,
    );
  }

  private detenerRevisionGastosFijos(): void {
    if (this.temporizadorGastosFijos !== null) clearInterval(this.temporizadorGastosFijos);
    this.temporizadorGastosFijos = null;
  }

  // Un gasto nuevo empieza a aplicarse desde hoy: no cobra meses ni días ya pasados
  async guardarGastoFijo(payload: GastoFijoPayload, id?: string): Promise<MensajeError> {
    const datos: GastoFijoPayload = id ? payload : { ...payload, aplicar_desde: fechaHoyIso() };
    const error = await this.conRecarga(this.guardarEnTabla(TABLAS_DINERO.gastosFijos, datos, id), () =>
      this.cargarGastosFijos(),
    );
    if (!error) await this.aplicarGastosFijosPendientes();
    return error;
  }

  // Borrado lógico: conserva el historial de pagos
  eliminarGastoFijo(id: string): Promise<MensajeError> {
    return this.conRecarga(
      this.actualizarEnTabla(TABLAS_DINERO.gastosFijos, id, { activo: false }),
      () => this.cargarGastosFijos(),
    );
  }

  // ============================================
  // PRESUPUESTO Y CATEGORÍAS
  // ============================================
  // Guarda el presupuesto mensual de varias categorías de una vez
  async guardarPresupuestos(presupuestos: PresupuestosPorCategoria): Promise<MensajeError> {
    const errores = await Promise.all(
      Object.entries(presupuestos).map(([id, monto]) =>
        this.actualizarEnTabla(TABLAS_DINERO.categoriasGrandes, id, {
          presupuesto_mensual: Math.max(monto, 0),
        }),
      ),
    );
    await this.cargarCategoriasGrandes();
    return errores.find((e) => e !== null) ?? null;
  }

  guardarCategoriaGrande(payload: CategoriaGrandePayload, id?: string): Promise<MensajeError> {
    return this.conRecarga(
      this.guardarEnTabla(TABLAS_DINERO.categoriasGrandes, payload, id),
      () => this.recargarCategorias(),
    );
  }

  eliminarCategoriaGrande(id: string): Promise<MensajeError> {
    return this.conRecarga(this.eliminarDeTabla(TABLAS_DINERO.categoriasGrandes, id), () =>
      this.recargarCategorias(),
    );
  }

  // Crea las categorías sugeridas de ese tipo que aún no existen, con su color e
  // icono. Entran sin presupuesto: cada quien define cuánto asignarles.
  async crearCategoriasPredeterminadas(tipo: TipoCategoria): Promise<MensajeError> {
    const faltantes = this.categoriasSugeridasFaltantes()[tipo];
    if (faltantes.length === 0) return null;
    const existentes = this.categoriasGrandes().length;
    const filas: CategoriaGrande[] = faltantes.map((sugerida, i) => ({
      id: nuevoId(),
      nombre: sugerida.nombre,
      tipo,
      presupuesto_mensual: 0,
      color: claveColorDeSlot(sugerida.slot),
      icono: sugerida.icono,
      orden: existentes + i + 1,
    }));
    try {
      await this.db.tabla<CategoriaGrande>(TABLAS_DINERO.categoriasGrandes).bulkAdd(filas);
    } catch (error) {
      return mensajeError(error);
    }
    await this.recargarCategorias();
    return null;
  }

  guardarSubcategoria(nombre: string, categoriaGrandeId: string): Promise<MensajeError> {
    return this.conRecarga(
      this.guardarEnTabla(TABLAS_DINERO.subcategorias, {
        nombre,
        categoria_grande_id: categoriaGrandeId,
      }),
      () => this.cargarSubcategorias(),
    );
  }

  eliminarSubcategoria(id: string): Promise<MensajeError> {
    return this.conRecarga(this.eliminarDeTabla(TABLAS_DINERO.subcategorias, id), () =>
      this.cargarSubcategorias(),
    );
  }

  guardarMeta(payload: MetaAhorroPayload, id?: string): Promise<MensajeError> {
    return this.conRecarga(this.guardarEnTabla(TABLAS_DINERO.metasAhorro, payload, id), () =>
      this.cargarMetasAhorro(),
    );
  }

  eliminarMeta(id: string): Promise<MensajeError> {
    return this.conRecarga(
      this.actualizarEnTabla(TABLAS_DINERO.metasAhorro, id, { activa: false }),
      () => this.cargarMetasAhorro(),
    );
  }

  private async recargarCategorias(): Promise<void> {
    await this.cargarCategoriasGrandes();
    await this.cargarSubcategorias();
  }

  private faltantes(
    tipo: TipoCategoria,
    existentes: readonly CategoriaGrande[],
  ): CategoriaPredeterminada[] {
    const nombres = new Set(existentes.map((c) => normalizarTexto(c.nombre)));
    return CATEGORIAS_PREDETERMINADAS[tipo].filter((c) => !nombres.has(normalizarTexto(c.nombre)));
  }

  // Opciones del selector: la categoría "general" y cada una de sus subcategorías.
  // El valor codifica "categoriaId|subcategoriaId" (ver SelectorCategoriaComponent).
  private grupoDe(categoria: CategoriaGrande): GrupoCategoria {
    const opciones: OpcionSelect[] = [
      { valor: `${categoria.id}|`, etiqueta: `${categoria.nombre} (general)` },
      ...this.subcategoriasDe(categoria.id).map((s) => ({
        valor: `${categoria.id}|${s.id}`,
        etiqueta: s.nombre,
      })),
    ];
    return { categoria, opciones };
  }

  // ============================================
  // HELPERS DE ACCESO A DATOS
  // ============================================
  // Ejecuta la operación y, si salió bien, recarga los datos afectados
  private async conRecarga(
    operacion: Promise<MensajeError>,
    ...recargas: ReadonlyArray<() => Promise<void>>
  ): Promise<MensajeError> {
    const error = await operacion;
    if (!error) await Promise.all(recargas.map((recargar) => recargar()));
    return error;
  }

  private async insertarTransaccion(
    payload: TransaccionPayload,
  ): Promise<{ data: Transaccion | null; error: MensajeError }> {
    try {
      const fila: Transaccion = { ...payload, id: nuevoId(), created_at: new Date().toISOString() };
      await this.db.tabla<Transaccion>(TABLAS_DINERO.movimientos).add(fila);
      return { data: fila, error: null };
    } catch (error) {
      return { data: null, error: mensajeError(error) };
    }
  }

  // Inserta si no hay id; actualiza si lo hay
  private async guardarEnTabla<T extends object>(
    tabla: TablaDinero,
    payload: T,
    id?: string,
  ): Promise<MensajeError> {
    try {
      const t = this.db.tabla<T>(tabla);
      if (id) {
        const actual = await t.get(id);
        if (actual) await t.put({ ...actual, ...payload });
        else await t.add({ ...payload, id } as T);
      } else {
        await t.add({ ...payload, id: nuevoId(), created_at: new Date().toISOString() } as T);
      }
      return null;
    } catch (error) {
      return mensajeError(error);
    }
  }

  private async actualizarEnTabla<T extends object>(
    tabla: TablaDinero,
    id: string,
    cambios: T,
  ): Promise<MensajeError> {
    try {
      const t = this.db.tabla<T>(tabla);
      const actual = await t.get(id);
      if (actual) await t.put({ ...actual, ...cambios });
      return null;
    } catch (error) {
      return mensajeError(error);
    }
  }

  private async eliminarDeTabla(tabla: TablaDinero, id: string): Promise<MensajeError> {
    try {
      await this.db.tabla<{ id: string }>(tabla).delete(id);
      return null;
    } catch (error) {
      return mensajeError(error);
    }
  }
}
