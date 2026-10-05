import { Component, computed, inject, signal } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { NotificacionService } from '../../../../core/notificacion.service';
import { AccionesFilaComponent } from '../../../../shared/components/acciones-fila/acciones-fila.component';
import {
  FiltroPeriodoComponent,
  periodoDelMes,
} from '../../../../shared/components/filtro-periodo/filtro-periodo.component';
import { ICONOS } from '../../../../shared/iconos';
import { PeriodoFechas } from '../../../../shared/models/ui.models';
import { FechaCortaPipe } from '../../../../shared/pipes/fecha-corta.pipe';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import { ControlModal } from '../../../../shared/utils/control-modal';
import { ModalMovimientoComponent } from '../../components/modal-movimiento/modal-movimiento.component';
import { MontoMovimientoComponent } from '../../components/monto-movimiento/monto-movimiento.component';
import { sumarMontos } from '../../dinero.calculos';
import { TIPOS_MOVIMIENTO } from '../../dinero.constantes';
import { TipoMovimiento, Transaccion } from '../../dinero.models';
import { DineroService } from '../../dinero.service';

interface TotalesMes {
  ingresos: number;
  gastos: number;
  traslados: number;
}

@Component({
  selector: 'app-movimientos-tab',
  imports: [
    FaIconComponent,
    FiltroPeriodoComponent,
    AccionesFilaComponent,
    MontoMovimientoComponent,
    ModalMovimientoComponent,
    FechaCortaPipe,
    MonedaPipe,
  ],
  templateUrl: './movimientos-tab.component.html',
})
export class MovimientosTabComponent {
  protected readonly service = inject(DineroService);
  private readonly notificacion = inject(NotificacionService);

  protected readonly iconos = ICONOS;
  protected readonly tipos = TIPOS_MOVIMIENTO;
  protected readonly periodo = signal<PeriodoFechas>(periodoDelMes());
  // null = todos los tipos
  protected readonly filtroTipo = signal<TipoMovimiento | null>(null);
  protected readonly modal = new ControlModal<Transaccion>();

  // Mientras se elige el rango (sin fecha final) se muestra solo el día inicial
  private readonly movimientosDelPeriodo = computed<Transaccion[]>(() => {
    const { desde, hasta } = this.periodo();
    return this.service.movimientosEntre(desde, hasta || desde);
  });

  protected readonly movimientosFiltrados = computed<Transaccion[]>(() => {
    const tipo = this.filtroTipo();
    const movimientos = this.movimientosDelPeriodo();
    return tipo ? movimientos.filter((m) => m.tipo === tipo) : movimientos;
  });

  protected readonly totales = computed<TotalesMes>(() => ({
    ingresos: sumarMontos(this.movimientosDelPeriodo(), 'INGRESO'),
    gastos: sumarMontos(this.movimientosDelPeriodo(), 'GASTO'),
    traslados: sumarMontos(this.movimientosDelPeriodo(), 'TRASLADO'),
  }));

  protected alternarFiltro(tipo: TipoMovimiento): void {
    this.filtroTipo.update((actual) => (actual === tipo ? null : tipo));
  }

  protected async eliminar(movimiento: Transaccion): Promise<void> {
    const mensaje = 'Se eliminará esta transacción y el saldo de sus cuentas se recalculará.';
    if (!(await this.notificacion.confirmarEliminacion(mensaje, 'Eliminar transacción'))) return;
    const error = await this.service.eliminarTransaccion(movimiento.id);
    if (error) this.notificacion.error(error);
  }
}
