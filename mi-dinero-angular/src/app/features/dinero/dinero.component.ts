import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DineroService } from './dinero.service';
import {
  CategoriaGrande,
  Deuda,
  MetaAhorro,
  Subcategoria,
} from './dinero.service';
import { fechaHoyIso, formatoFecha, formatoMoneda, mesActual } from '../../core/utils';

const PALETA_CATEGORIAS = [
  '#5b8def', '#f87171', '#fbbf24', '#4ade80', '#a78bfa',
  '#f472b6', '#38bdf8', '#fb923c', '#34d399', '#c084fc',
];

@Component({
  selector: 'app-dinero',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dinero.component.html',
  styleUrl: './dinero.component.css',
})
export class DineroComponent {
  protected readonly auth = inject(AuthService);
  protected readonly service = inject(DineroService);

  // ---------- TABS ----------
  protected readonly tabActiva = signal<'dashboard' | 'movimientos' | 'deudas' | 'gastos-fijos' | 'presupuesto'>('dashboard');

  // ---------- MOVIMIENTOS ----------
  protected readonly filtroMesMovimientos = signal(mesActual());
  protected readonly modalMovimientoAbierto = signal(false);
  protected readonly movEditarId = signal<string | null>(null);
  protected readonly movTipo = signal<'ingreso' | 'gasto'>('gasto');
  protected readonly movMonto = signal<number | null>(null);
  protected readonly movCategoria = signal('');
  protected readonly movMetodoPago = signal('efectivo');
  protected readonly movFecha = signal(fechaHoyIso());
  protected readonly movNota = signal('');

  // ---------- DEUDAS ----------
  protected readonly modalDeudaAbierto = signal(false);
  protected readonly deudaEditarId = signal<string | null>(null);
  protected readonly deudaTipo = signal<'normal' | 'tarjeta_credito'>('normal');
  protected readonly deudaNombre = signal('');
  protected readonly deudaMontoTotal = signal<number | null>(null);
  protected readonly deudaPagado = signal(0);
  protected readonly deudaSaldoTarjeta = signal(0);
  protected readonly deudaDiaCorte = signal<number | null>(null);
  protected readonly deudaDiaLimite = signal<number | null>(null);
  protected readonly deudaPagoMensual = signal<number | null>(null);

  protected readonly modalCorteAbierto = signal(false);
  protected readonly corteDeudaId = signal('');
  protected readonly corteMonto = signal<number | null>(null);
  protected readonly corteFechaLimite = signal('');

  protected readonly modalPagoAbierto = signal(false);
  protected readonly pagoDeudaId = signal('');
  protected readonly pagoMonto = signal<number | null>(null);

  // ---------- GASTOS FIJOS ----------
  protected readonly modalGastoFijoAbierto = signal(false);
  protected readonly gfEditarId = signal<string | null>(null);
  protected readonly gfNombre = signal('');
  protected readonly gfMonto = signal<number | null>(null);
  protected readonly gfCategoria = signal('');

  // ---------- PRESUPUESTO ----------
  protected readonly modalConfigAbierto = signal(false);
  protected readonly cfgIngreso = signal(0);
  protected readonly cfgPorcentajes = signal<Record<string, number>>({});

  protected readonly modalCategoriaAbierto = signal(false);
  protected readonly catEditarId = signal<string | null>(null);
  protected readonly catNombre = signal('');
  protected readonly catPct = signal<number | null>(null);

  protected readonly modalSubcategoriaAbierto = signal(false);
  protected readonly subcategoriaCatGrandeId = signal('');
  protected readonly subcategoriaNombre = signal('');

  protected readonly modalMetaAbierto = signal(false);
  protected readonly metaEditarId = signal<string | null>(null);
  protected readonly metaNombre = signal('');
  protected readonly metaObjetivo = signal<number | null>(null);
  protected readonly metaAhorrado = signal(0);
  protected readonly metaFecha = signal('');

  // ---------- AJUSTE DE SALDO ----------
  protected readonly modalAjusteAbierto = signal(false);
  protected readonly ajusteSaldoReal = signal<number | null>(null);
  protected readonly ajustePreview = signal('');

  // ---------- GRÁFICA ----------
  protected readonly mesGrafica = signal(new Date());
  protected readonly categoriaExpandida = signal<string | null>(null);

  // ============================================
  // LOGIN
  // ============================================
  protected async salir(): Promise<void> {
    await this.auth.cerrarSesion();
  }

  protected cambiarTab(
    tab: 'dashboard' | 'movimientos' | 'deudas' | 'gastos-fijos' | 'presupuesto',
  ): void {
    this.tabActiva.set(tab);
  }

  // ============================================
  // MOVIMIENTOS
  // ============================================
  protected readonly movimientosFiltrados = computed(() => {
    const filtro = this.filtroMesMovimientos() || mesActual();
    return this.service.movimientos().filter((m) => m.fecha.slice(0, 7) === filtro);
  });

  protected readonly opcionesCategoriaGasto = computed(() => {
    return this.service.categoriasGrandes().map((cg) => {
      const subs = this.service.subcategorias().filter((s) => s.categoria_grande_id === cg.id);
      const opciones =
        subs.length > 0
          ? subs.map((s) => ({ valor: s.nombre, etiqueta: s.nombre }))
          : [{ valor: cg.nombre, etiqueta: `${cg.nombre} (general)` }];
      return { cg, opciones };
    });
  });

  protected readonly opcionesIngreso = ['Salario', 'Venta', 'Regalo', 'Ajuste de saldo', 'Otro ingreso'];

  protected readonly opcionesMetodoPago = computed(() => {
    const tarjetas = this.service.deudas().filter((d) => d.tipo === 'tarjeta_credito');
    return [
      { valor: 'efectivo', etiqueta: 'Efectivo' },
      { valor: 'debito', etiqueta: 'Débito' },
      ...tarjetas.map((t) => ({ valor: `credito:${t.id}`, etiqueta: `Crédito: ${t.nombre}` })),
    ];
  });

  protected abrirModalMovimiento(id?: string): void {
    const m = id ? this.service.movimientos().find((x) => x.id === id) : null;
    this.movEditarId.set(id ?? null);
    this.movTipo.set(m ? m.tipo : 'gasto');
    this.movMonto.set(m ? m.monto : null);
    this.movCategoria.set(m ? m.categoria : '');
    this.movMetodoPago.set(m ? m.metodo_pago : 'efectivo');
    this.movFecha.set(m ? m.fecha : fechaHoyIso());
    this.movNota.set(m ? m.nota || '' : '');
    this.modalMovimientoAbierto.set(true);
  }

  protected cerrarModalMovimiento(): void {
    this.modalMovimientoAbierto.set(false);
  }

  protected async guardarMovimiento(): Promise<void> {
    const tipo = this.movTipo();
    const monto = this.movMonto();
    if (!monto || monto <= 0) {
      alert('Ingresa un monto válido');
      return;
    }
    const categoria = this.movCategoria().trim();
    if (!categoria) {
      alert('Ingresa una categoría');
      return;
    }

    const metodoPago = tipo === 'gasto' ? this.movMetodoPago() : 'efectivo';
    const payload = {
      tipo,
      monto,
      categoria,
      fecha: this.movFecha(),
      nota: this.movNota().trim() || null,
      metodo_pago: metodoPago,
    };

    const editandoId = this.movEditarId();
    const mEditando = editandoId ? this.service.movimientos().find((m) => m.id === editandoId) : null;

    // Revertir el efecto del movimiento anterior sobre la tarjeta (si aplicaba)
    if (mEditando && mEditando.metodo_pago && mEditando.metodo_pago.startsWith('credito:')) {
      await this.service.ajustarSaldoTarjeta(mEditando.metodo_pago, -mEditando.monto);
    }

    const error = await this.service.guardarMovimiento(payload, editandoId ?? undefined);
    if (error) {
      alert('Error: ' + error);
      return;
    }

    if (metodoPago.startsWith('credito:')) {
      await this.service.ajustarSaldoTarjeta(metodoPago, monto);
    }

    this.cerrarModalMovimiento();
    await Promise.all([this.service.cargarMovimientos(), this.service.cargarDeudas()]);
  }

  protected async eliminarMovimiento(id: string): Promise<void> {
    if (!confirm('¿Eliminar este movimiento?')) return;
    const movimiento = this.service.movimientos().find((m) => m.id === id);
    const error = await this.service.eliminarMovimiento(id);
    if (error) {
      alert('Error: ' + error);
      return;
    }
    if (movimiento && movimiento.metodo_pago && movimiento.metodo_pago.startsWith('credito:')) {
      await this.service.ajustarSaldoTarjeta(movimiento.metodo_pago, -movimiento.monto);
      await this.service.cargarDeudas();
    }
    await this.service.cargarMovimientos();
  }

  // ============================================
  // DEUDAS
  // ============================================
  protected abrirModalDeuda(id?: string): void {
    const d = id ? this.service.deudas().find((x) => x.id === id) : null;
    this.deudaEditarId.set(id ?? null);
    this.deudaTipo.set(d ? d.tipo : 'normal');
    this.deudaNombre.set(d ? d.nombre : '');
    this.deudaMontoTotal.set(d && d.tipo !== 'tarjeta_credito' ? d.monto_total : null);
    this.deudaPagado.set(d && d.tipo !== 'tarjeta_credito' ? d.pagado_acumulado : 0);
    this.deudaSaldoTarjeta.set(d && d.tipo === 'tarjeta_credito' ? d.saldo_tarjeta : 0);
    this.deudaDiaCorte.set(d && d.dia_corte ? d.dia_corte : null);
    this.deudaDiaLimite.set(d && d.dia_limite_pago ? d.dia_limite_pago : null);
    this.deudaPagoMensual.set(d ? d.pago_mensual_planeado : null);
    this.modalDeudaAbierto.set(true);
  }

  protected cerrarModalDeuda(): void {
    this.modalDeudaAbierto.set(false);
  }

  protected async guardarDeuda(): Promise<void> {
    const tipo = this.deudaTipo();
    const nombre = this.deudaNombre().trim();
    const pagoMensual = this.deudaPagoMensual();
    if (!nombre || !pagoMensual) {
      alert('Completa nombre y pago mensual');
      return;
    }

    const payload: any = { nombre, tipo, pago_mensual_planeado: pagoMensual };

    if (tipo === 'tarjeta_credito') {
      payload.saldo_tarjeta = this.deudaSaldoTarjeta() || 0;
      payload.dia_corte = this.deudaDiaCorte() || null;
      payload.dia_limite_pago = this.deudaDiaLimite() || null;
      payload.monto_total = 0;
      payload.pagado_acumulado = 0;
    } else {
      const montoTotal = this.deudaMontoTotal();
      if (!montoTotal) {
        alert('Completa el monto total');
        return;
      }
      payload.monto_total = montoTotal;
      payload.pagado_acumulado = this.deudaPagado() || 0;
      payload.saldo_tarjeta = 0;
    }

    const error = await this.service.guardarDeuda(payload, this.deudaEditarId() ?? undefined);
    if (error) {
      alert('Error: ' + error);
      return;
    }
    this.cerrarModalDeuda();
    await this.service.cargarDeudas();
  }

  protected async eliminarDeuda(id: string): Promise<void> {
    if (!confirm('¿Eliminar esta deuda?')) return;
    const error = await this.service.eliminarDeuda(id);
    if (error) {
      alert('Error: ' + error);
      return;
    }
    await this.service.cargarDeudas();
  }

  protected abrirModalCorte(deudaId: string): void {
    const deuda = this.service.deudas().find((d) => d.id === deudaId);
    const corte = this.service.corteDelMes(deudaId);
    if (!deuda) return;

    // Fecha límite sugerida desde dia_limite_pago
    let fechaLimiteSugerida = '';
    if (deuda.dia_limite_pago) {
      const hoy = new Date();
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), deuda.dia_limite_pago);
      fecha.setMonth(fecha.getMonth() + (fecha < hoy ? 1 : 0));
      fechaLimiteSugerida = fecha.toISOString().slice(0, 10);
    }

    this.corteDeudaId.set(deudaId);
    this.corteMonto.set(corte ? corte.monto_corte : null);
    this.corteFechaLimite.set(corte && corte.fecha_limite ? corte.fecha_limite : fechaLimiteSugerida);
    this.modalCorteAbierto.set(true);
  }

  protected cerrarModalCorte(): void {
    this.modalCorteAbierto.set(false);
  }

  protected async guardarCorte(): Promise<void> {
    const monto = this.corteMonto();
    if (!monto || monto <= 0) {
      alert('Ingresa el monto del corte');
      return;
    }
    const payload = {
      deuda_id: this.corteDeudaId(),
      mes: mesActual(),
      monto_corte: monto,
      fecha_limite: this.corteFechaLimite() || null,
    };
    const error = await this.service.guardarCorte(payload);
    if (error) {
      alert('Error: ' + error);
      return;
    }
    this.cerrarModalCorte();
    await Promise.all([this.service.cargarCortesDelMes(), this.service.cargarDeudas()]);
  }

  protected abrirModalPago(id: string): void {
    const deuda = this.service.deudas().find((d) => d.id === id);
    if (!deuda) return;
    const esTarjeta = deuda.tipo === 'tarjeta_credito';
    const corte = esTarjeta ? this.service.corteDelMes(id) : null;
    const montoSugerido = esTarjeta ? (corte ? corte.monto_corte : 0) : deuda.pago_mensual_planeado;
    this.pagoDeudaId.set(id);
    this.pagoMonto.set(montoSugerido);
    this.modalPagoAbierto.set(true);
  }

  protected cerrarModalPago(): void {
    this.modalPagoAbierto.set(false);
  }

  protected readonly deudaParaPago = computed(() =>
    this.service.deudas().find((d) => d.id === this.pagoDeudaId()),
  );

  protected async confirmarPago(): Promise<void> {
    const deuda = this.deudaParaPago();
    const monto = this.pagoMonto();
    if (!deuda || !monto || monto <= 0) {
      alert('Ingresa un monto válido');
      return;
    }
    const error = await this.service.registrarPagoDeuda(deuda, monto);
    if (error) {
      alert('Error: ' + error);
      return;
    }
    this.cerrarModalPago();
    await Promise.all([
      this.service.cargarDeudas(),
      this.service.cargarMovimientos(),
      this.service.cargarCortesDelMes(),
    ]);
  }

  // Información para la tarjeta de deuda
  protected infoDeudaNormal(d: Deuda) {
    const saldoRestante = Math.max(d.monto_total - d.pagado_acumulado, 0);
    const porcentaje = Math.min((d.pagado_acumulado / d.monto_total) * 100, 100);
    const mesesFaltantes =
      d.pago_mensual_planeado > 0 ? Math.ceil(saldoRestante / d.pago_mensual_planeado) : 0;
    const fechaEstimada = this.estimarFechaFin(mesesFaltantes);
    return { saldoRestante, porcentaje, mesesFaltantes, fechaEstimada };
  }

  private estimarFechaFin(mesesFaltantes: number): string {
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() + mesesFaltantes);
    return fecha.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
  }

  // Información para tarjetas de crédito
  protected infoTarjeta(d: Deuda) {
    const corte = this.service.corteDelMes(d.id);
    const hoy = new Date();
    const mesLabel = hoy.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

    let fechaCorteStr = d.dia_corte ? `Día ${d.dia_corte} de cada mes` : 'Sin configurar';
    let fechaLimiteStr = 'Sin configurar';
    let alertaVencimiento = '';

    if (d.dia_limite_pago) {
      const diaLimite = d.dia_limite_pago;
      let fechaLimite = new Date(hoy.getFullYear(), hoy.getMonth(), diaLimite);
      if (fechaLimite < hoy && !corte?.pagado) {
        fechaLimite.setMonth(fechaLimite.getMonth() + 1);
      }
      fechaLimiteStr = fechaLimite.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
      const diasRestantes = Math.ceil((fechaLimite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      if (!corte?.pagado) {
        if (diasRestantes <= 0) {
          alertaVencimiento = '⚠ Fecha límite vencida';
        } else if (diasRestantes <= 5) {
          alertaVencimiento = `⚠ Vence en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`;
        }
      }
    }

    const montoCorte = corte ? corte.monto_corte : 0;
    return { fechaCorteStr, fechaLimiteStr, alertaVencimiento, montoCorte, corte, mesLabel };
  }

  // ============================================
  // GASTOS FIJOS
  // ============================================
  protected abrirModalGastoFijo(id?: string): void {
    const g = id ? this.service.gastosFijos().find((x) => x.id === id) : null;
    this.gfEditarId.set(id ?? null);
    this.gfNombre.set(g ? g.nombre : '');
    this.gfMonto.set(g ? g.monto : null);
    this.gfCategoria.set(g ? g.categoria : '');
    this.modalGastoFijoAbierto.set(true);
  }

  protected cerrarModalGastoFijo(): void {
    this.modalGastoFijoAbierto.set(false);
  }

  protected async guardarGastoFijo(): Promise<void> {
    const nombre = this.gfNombre().trim();
    const monto = this.gfMonto();
    if (!nombre || !monto) {
      alert('Completa nombre y monto');
      return;
    }
    const payload = { nombre, monto, categoria: this.gfCategoria() };
    const error = await this.service.guardarGastoFijo(payload, this.gfEditarId() ?? undefined);
    if (error) {
      alert('Error: ' + error);
      return;
    }
    this.cerrarModalGastoFijo();
    await this.service.cargarGastosFijos();
  }

  protected async eliminarGastoFijo(id: string): Promise<void> {
    if (!confirm('¿Eliminar este gasto fijo? (no borra los pagos ya registrados)')) return;
    const error = await this.service.eliminarGastoFijo(id);
    if (error) {
      alert('Error: ' + error);
      return;
    }
    await this.service.cargarGastosFijos();
  }

  protected async togglePagoGastoFijo(gastoFijoId: string, event: Event): Promise<void> {
    const marcado = (event.target as HTMLInputElement).checked;
    await this.service.togglePagoGastoFijo(gastoFijoId, marcado);
  }

  // ============================================
  // DASHBOARD
  // ============================================
  protected readonly balance = computed(() => this.service.balance());

  protected readonly movimientosMes = computed(() => this.service.movimientosDelMes());

  protected readonly ingresosMes = computed(() =>
    this.movimientosMes()
      .filter((m) => m.tipo === 'ingreso')
      .reduce((acc, m) => acc + m.monto, 0),
  );

  protected readonly gastosMes = computed(() =>
    this.movimientosMes()
      .filter((m) => m.tipo === 'gasto')
      .reduce((acc, m) => acc + m.monto, 0),
  );

  protected readonly comprometido = computed(() => this.service.comprometidoEsteMes());

  protected readonly deudaTotal = computed(() => this.service.deudaTotalPendiente());

  protected readonly disponible = computed(() =>
    this.service.disponibleParaGastar(this.movimientosMes()),
  );

  protected readonly gastosFijosDelMes = computed(() => this.service.gastosFijos());

  protected readonly ultimosMovimientos = computed(() => this.service.movimientos().slice(0, 5));

  // ---------- GRÁFICA DE CATEGORÍAS ----------
  protected readonly mesGraficaTitulo = computed(() =>
    this.mesGrafica().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
  );

  protected readonly graficaDatos = computed(() => {
    const claveMes = this.mesGraficaClave();
    const gastosDelMes = this.service
      .movimientos()
      .filter((m) => m.tipo === 'gasto' && m.fecha.slice(0, 7) === claveMes);

    const totalesPorCategoria: Record<string, number> = {};
    gastosDelMes.forEach((m) => {
      totalesPorCategoria[m.categoria] = (totalesPorCategoria[m.categoria] || 0) + m.monto;
    });

    const categoriasOrdenadas = Object.entries(totalesPorCategoria).sort((a, b) => b[1] - a[1]);
    const totalGastos = categoriasOrdenadas.reduce((acc, [, monto]) => acc + monto, 0);

    // Si la categoría expandida ya no existe este mes, se cierra
    if (this.categoriaExpandida() && !totalesPorCategoria[this.categoriaExpandida()!]) {
      this.categoriaExpandida.set(null);
    }

    return { gastosDelMes, categoriasOrdenadas, totalGastos };
  });

  protected readonly categoriasGrafica = computed(() => this.graficaDatos().categoriasOrdenadas);

  protected readonly totalGastosGrafica = computed(() => this.graficaDatos().totalGastos);

  protected readonly segmentosPastel = computed(() =>
    this.generarSvgPastel(this.categoriasGrafica(), this.totalGastosGrafica()),
  );

  protected readonly detalleCategoria = computed(() => {
    const cat = this.categoriaExpandida();
    if (!cat) return null;
    const gastos = this.graficaDatos()
      .gastosDelMes.filter((m) => m.categoria === cat)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const total = gastos.reduce((acc, m) => acc + m.monto, 0);
    return { cat, gastos, total };
  });

  private mesGraficaClave(): string {
    const a = this.mesGrafica().getFullYear();
    const m = String(this.mesGrafica().getMonth() + 1).padStart(2, '0');
    return `${a}-${m}`;
  }

  protected cambiarMesGrafica(delta: number): void {
    this.mesGrafica.update((m) => {
      const n = new Date(m);
      n.setMonth(n.getMonth() + delta);
      return n;
    });
  }

  protected toggleCategoriaExpandida(categoria: string): void {
    this.categoriaExpandida.set(this.categoriaExpandida() === categoria ? null : categoria);
  }

  // Genera los segmentos del SVG de pastel
  private generarSvgPastel(
    categoriasOrdenadas: [string, number][],
    total: number,
  ): Array<{ path: string; color: string; categoria: string; etiqueta?: { x: string; y: string; texto: string } }> {
    const radio = 70;
    const centro = 75;
    let anguloInicio = -90;

    return categoriasOrdenadas.map(([categoria, monto], i) => {
      const porcentaje = monto / total;
      const anguloBarrido = porcentaje * 360;
      const anguloFin = anguloInicio + anguloBarrido;

      const x1 = centro + radio * Math.cos((Math.PI / 180) * anguloInicio);
      const y1 = centro + radio * Math.sin((Math.PI / 180) * anguloInicio);
      const x2 = centro + radio * Math.cos((Math.PI / 180) * anguloFin);
      const y2 = centro + radio * Math.sin((Math.PI / 180) * anguloFin);
      const granArco = anguloBarrido > 180 ? 1 : 0;

      const path =
        porcentaje >= 0.999
          ? `M ${centro - radio} ${centro} A ${radio} ${radio} 0 1 1 ${centro + radio} ${centro} A ${radio} ${radio} 0 1 1 ${centro - radio} ${centro}`
          : `M ${centro} ${centro} L ${x1} ${y1} A ${radio} ${radio} 0 ${granArco} 1 ${x2} ${y2} Z`;

      let etiqueta;
      if (porcentaje >= 0.08) {
        const anguloMedio = anguloInicio + anguloBarrido / 2;
        const radioEtiqueta = radio * 0.65;
        const xEtiqueta = centro + radioEtiqueta * Math.cos((Math.PI / 180) * anguloMedio);
        const yEtiqueta = centro + radioEtiqueta * Math.sin((Math.PI / 180) * anguloMedio);
        etiqueta = {
          x: xEtiqueta.toFixed(1),
          y: yEtiqueta.toFixed(1),
          texto: `${(porcentaje * 100).toFixed(0)}%`,
        };
      }

      anguloInicio = anguloFin;
      const colorRelleno = PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length];
      return { path, color: colorRelleno, categoria, etiqueta };
    });
  }

  // ============================================
  // AJUSTE DE SALDO
  // ============================================
  protected abrirModalAjusteSaldo(): void {
    this.ajusteSaldoReal.set(null);
    this.ajustePreview.set('');
    this.modalAjusteAbierto.set(true);
  }

  protected cerrarModalAjuste(): void {
    this.modalAjusteAbierto.set(false);
  }

  protected actualizarPreviewAjuste(): void {
    const saldoReal = this.ajusteSaldoReal();
    const balanceActual = this.balance();
    if (saldoReal === null || isNaN(saldoReal)) {
      this.ajustePreview.set('');
      return;
    }
    const diferencia = saldoReal - balanceActual;
    if (Math.abs(diferencia) < 1) {
      this.ajustePreview.set('✓ El saldo ya está correcto, no se necesita ajuste.');
      return;
    }
    if (diferencia > 0) {
      this.ajustePreview.set(`Se creará un ingreso de ajuste por ${formatoMoneda(diferencia)}.`);
    } else {
      this.ajustePreview.set(`Se creará un gasto de ajuste por ${formatoMoneda(Math.abs(diferencia))}.`);
    }
  }

  protected async confirmarAjuste(): Promise<void> {
    const saldoReal = this.ajusteSaldoReal();
    const balanceActual = this.balance();
    if (saldoReal === null || isNaN(saldoReal) || saldoReal < 0) {
      alert('Ingresa un monto válido');
      return;
    }
    const diferencia = saldoReal - balanceActual;
    if (Math.abs(diferencia) < 1) {
      this.cerrarModalAjuste();
      return;
    }

    const payload = {
      tipo: (diferencia > 0 ? 'ingreso' : 'gasto') as 'ingreso' | 'gasto',
      monto: Math.abs(diferencia),
      categoria: 'Ajuste de saldo',
      fecha: fechaHoyIso(),
      nota: `Ajuste manual: saldo real ${formatoMoneda(saldoReal)}`,
      metodo_pago: 'efectivo',
    };

    const error = await this.service.guardarMovimiento(payload);
    if (error) {
      alert('Error: ' + error);
      return;
    }
    this.cerrarModalAjuste();
    await this.service.cargarMovimientos();
    alert(`Ajuste aplicado. Nuevo balance: ${formatoMoneda(saldoReal)}`);
  }

  // ============================================
  // PRESUPUESTO
  // ============================================
  protected readonly gastosPorCategoria = computed(() => this.service.gastosPorCategoria(this.movimientosMes()));

  protected readonly totalPorcentajes = computed(() =>
    this.service.categoriasGrandes().reduce((acc, cg) => acc + cg.porcentaje, 0),
  );

  protected readonly alertaPorcentaje = computed(() => {
    const total = this.totalPorcentajes();
    return Math.abs(total - 100) > 0.5
      ? `⚠ Los porcentajes suman ${total}%. Deben sumar 100%.`
      : '';
  });

  protected infoCategoriaGrande(cg: CategoriaGrande) {
    const ingreso = this.service.configuracion().ingreso_mensual || 0;
    const presupuesto = ingreso * (cg.porcentaje / 100);
    const subs = this.service.subcategorias().filter((s) => s.categoria_grande_id === cg.id);

    const nombresSubcats = new Set(subs.map((s) => s.nombre));
    nombresSubcats.add(cg.nombre);
    const gastado = Object.entries(this.gastosPorCategoria())
      .filter(([cat]) => nombresSubcats.has(cat))
      .reduce((acc, [, monto]) => acc + monto, 0);

    const disponibleCat = presupuesto - gastado;
    const porcentajeUsado = presupuesto > 0 ? Math.min((gastado / presupuesto) * 100, 100) : 0;

    let estadoClase = 'barra-ok';
    let estadoLabel = '';
    if (presupuesto > 0) {
      if (gastado > presupuesto) {
        estadoClase = 'barra-excedido';
        estadoLabel = '⚠ Excedido';
      } else if (gastado / presupuesto >= 0.8) {
        estadoClase = 'barra-advertencia';
        estadoLabel = '⚠ Cerca del límite';
      }
    }

    return { presupuesto, gastado, disponibleCat, porcentajeUsado, estadoClase, estadoLabel };
  }

  // ---------- Configuración ----------
  protected abrirModalConfiguracion(): void {
    this.cfgIngreso.set(this.service.configuracion().ingreso_mensual || 0);
    const pcts: Record<string, number> = {};
    this.service.categoriasGrandes().forEach((cg) => {
      pcts[cg.id] = cg.porcentaje;
    });
    this.cfgPorcentajes.set(pcts);
    this.modalConfigAbierto.set(true);
  }

  protected cerrarModalConfig(): void {
    this.modalConfigAbierto.set(false);
  }

  protected readonly cfgSuma = computed(() =>
    Object.values(this.cfgPorcentajes()).reduce((acc, p) => acc + (Number(p) || 0), 0),
  );

  protected readonly cfgSumaAviso = computed(() => {
    const suma = this.cfgSuma();
    return Math.abs(suma - 100) < 0.5
      ? { texto: '✓ Los porcentajes suman 100%', color: 'var(--color-positivo)' }
      : { texto: `⚠ Los porcentajes suman ${suma}% (deben sumar 100%)`, color: 'var(--color-advertencia)' };
  });

  protected async guardarConfiguracion(): Promise<void> {
    const ingreso = this.cfgIngreso() || 0;
    const suma = this.cfgSuma();
    const ids = Object.keys(this.cfgPorcentajes());
    if (ids.length > 0 && Math.abs(suma - 100) > 0.5) {
      if (!confirm(`Los porcentajes suman ${suma}%. ¿Guardar de todas formas?`)) return;
    }
    await this.service.guardarConfiguracion(ingreso);
    for (const id of ids) {
      await this.service.guardarCategoriaGrande({ porcentaje: this.cfgPorcentajes()[id] }, id);
    }
    this.cerrarModalConfig();
    await Promise.all([this.service.cargarConfiguracion(), this.service.cargarCategoriasGrandes()]);
  }

  // ---------- Categoría grande ----------
  protected abrirModalCategoria(id?: string): void {
    const cat = id ? this.service.categoriasGrandes().find((c) => c.id === id) : null;
    this.catEditarId.set(id ?? null);
    this.catNombre.set(cat ? cat.nombre : '');
    this.catPct.set(cat ? cat.porcentaje : 0);
    this.modalCategoriaAbierto.set(true);
  }

  protected cerrarModalCategoria(): void {
    this.modalCategoriaAbierto.set(false);
  }

  protected async guardarCategoria(): Promise<void> {
    const nombre = this.catNombre().trim();
    if (!nombre) {
      alert('Escribe un nombre');
      return;
    }
    const payload = {
      nombre,
      porcentaje: this.catPct() || 0,
      orden: this.catEditarId()
        ? undefined
        : this.service.categoriasGrandes().length + 1,
    };
    const error = await this.service.guardarCategoriaGrande(payload, this.catEditarId() ?? undefined);
    if (error) {
      alert('Error: ' + error);
      return;
    }
    this.cerrarModalCategoria();
    await Promise.all([this.service.cargarCategoriasGrandes(), this.service.cargarSubcategorias()]);
  }

  protected async eliminarCategoriaGrande(id: string): Promise<void> {
    if (!confirm('¿Eliminar esta categoría y todas sus subcategorías? Los movimientos registrados no se borran.')) return;
    const error = await this.service.eliminarCategoriaGrande(id);
    if (error) {
      alert('Error: ' + error);
      return;
    }
    await Promise.all([this.service.cargarCategoriasGrandes(), this.service.cargarSubcategorias()]);
  }

  // ---------- Subcategoría ----------
  protected abrirModalSubcategoria(categoriaGrandeId: string): void {
    this.subcategoriaCatGrandeId.set(categoriaGrandeId);
    this.subcategoriaNombre.set('');
    this.modalSubcategoriaAbierto.set(true);
  }

  protected cerrarModalSubcategoria(): void {
    this.modalSubcategoriaAbierto.set(false);
  }

  protected readonly catGrandeParaSubcategoria = computed(() =>
    this.service.categoriasGrandes().find((c) => c.id === this.subcategoriaCatGrandeId()),
  );

  protected async guardarSubcategoria(): Promise<void> {
    const nombre = this.subcategoriaNombre().trim();
    if (!nombre) {
      alert('Escribe un nombre');
      return;
    }
    const error = await this.service.guardarSubcategoria(nombre, this.subcategoriaCatGrandeId());
    if (error) {
      alert('Error: ' + error);
      return;
    }
    this.cerrarModalSubcategoria();
    await this.service.cargarSubcategorias();
  }

  protected async eliminarSubcategoria(id: string): Promise<void> {
    if (!confirm('¿Eliminar esta subcategoría?')) return;
    const error = await this.service.eliminarSubcategoria(id);
    if (error) {
      alert('Error: ' + error);
      return;
    }
    await this.service.cargarSubcategorias();
  }

  // ---------- Meta de ahorro ----------
  protected abrirModalMeta(id?: string): void {
    const meta = id ? this.service.metasAhorro().find((m) => m.id === id) : null;
    this.metaEditarId.set(id ?? null);
    this.metaNombre.set(meta ? meta.nombre : '');
    this.metaObjetivo.set(meta ? meta.valor_objetivo : null);
    this.metaAhorrado.set(meta ? meta.valor_ahorrado : 0);
    this.metaFecha.set(meta && meta.fecha_objetivo ? meta.fecha_objetivo : '');
    this.modalMetaAbierto.set(true);
  }

  protected cerrarModalMeta(): void {
    this.modalMetaAbierto.set(false);
  }

  protected async guardarMeta(): Promise<void> {
    const nombre = this.metaNombre().trim();
    const objetivo = this.metaObjetivo();
    if (!nombre || !objetivo) {
      alert('Completa nombre y valor objetivo');
      return;
    }
    const payload = {
      nombre,
      valor_objetivo: objetivo,
      valor_ahorrado: this.metaAhorrado() || 0,
      fecha_objetivo: this.metaFecha() || null,
    };
    const error = await this.service.guardarMeta(payload, this.metaEditarId() ?? undefined);
    if (error) {
      alert('Error: ' + error);
      return;
    }
    this.cerrarModalMeta();
    await this.service.cargarMetasAhorro();
  }

  protected async eliminarMeta(id: string): Promise<void> {
    if (!confirm('¿Eliminar esta meta de ahorro?')) return;
    const error = await this.service.eliminarMeta(id);
    if (error) {
      alert('Error: ' + error);
      return;
    }
    await this.service.cargarMetasAhorro();
  }

  protected infoMeta(m: MetaAhorro) {
    const pct = m.valor_objetivo > 0 ? Math.min((m.valor_ahorrado / m.valor_objetivo) * 100, 100) : 0;
    const falta = Math.max(m.valor_objetivo - m.valor_ahorrado, 0);
    const fechaStr = m.fecha_objetivo ? ` · Meta: ${formatoFecha(m.fecha_objetivo)}` : '';
    return { pct, falta, fechaStr };
  }

  // ============================================
  // HELPERS DE PLANTILLA
  // ============================================
  protected readonly fmtMoneda = formatoMoneda;
  protected readonly fmtFecha = formatoFecha;
  protected readonly PALETA_CATEGORIAS = PALETA_CATEGORIAS;
  protected readonly Math = Math;

  protected subcategoriasDe(categoriaGrandeId: string): Subcategoria[] {
    return this.service.subcategorias().filter((s) => s.categoria_grande_id === categoriaGrandeId);
  }

  protected actualizarPorcentajeCategoria(cgId: string, valor: number): void {
    this.cfgPorcentajes.update((p) => ({ ...p, [cgId]: Number(valor) || 0 }));
  }

  protected montoDePorcentaje(cg: CategoriaGrande): string {
    const pct = Number(this.cfgPorcentajes()[cg.id]) || 0;
    return formatoMoneda((this.cfgIngreso() * pct) / 100);
  }

  protected servicioDeudaNombre(deudaId: string): string {
    const deuda = this.service.deudas().find((d) => d.id === deudaId);
    return deuda ? deuda.nombre : '';
  }

  protected mesActualLabel(): string {
    return new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  }
}
