import { Component, computed, inject, input, output } from '@angular/core';
import { MatCheckbox, MatCheckboxChange } from '@angular/material/checkbox';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { NotificacionService } from '../../../../core/notificacion.service';
import { AccionesFilaComponent } from '../../../../shared/components/acciones-fila/acciones-fila.component';
import { BadgePagoComponent } from '../../../../shared/components/badge-pago/badge-pago.component';
import { ICONOS } from '../../../../shared/iconos';
import { FechaCortaPipe } from '../../../../shared/pipes/fecha-corta.pipe';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import { proximaAplicacion } from '../../dinero.calculos';
import { GastoFijo } from '../../dinero.models';
import { DineroService } from '../../dinero.service';

// Fila de gasto fijo: casilla de pagado este mes y, si es automático, cuándo se aplica
@Component({
  selector: 'app-gasto-fijo-fila',
  imports: [MatCheckbox, FaIconComponent, AccionesFilaComponent, BadgePagoComponent, FechaCortaPipe, MonedaPipe],
  templateUrl: './gasto-fijo-fila.component.html',
})
export class GastoFijoFilaComponent {
  private readonly service = inject(DineroService);
  private readonly notificacion = inject(NotificacionService);

  readonly gasto = input.required<GastoFijo>();
  // Muestra la categoría y los botones Editar/Eliminar
  readonly conDetalle = input<boolean>(false);

  readonly editar = output<void>();

  protected readonly iconos = ICONOS;

  protected readonly color = computed<string>(() => this.service.clasificarGasto(this.gasto()).color);

  // "Servicios › Arriendo · Cuenta Débito"
  protected readonly detalle = computed<string>(() => {
    const g = this.gasto();
    const categoria = this.service.etiquetaCategoria(g.categoria_id, g.subcategoria_id) ?? 'Sin categoría';
    return `${categoria} · ${this.service.nombreCuenta(g.cuenta_id ?? this.service.cuentaPrincipalId())}`;
  });

  protected readonly pagado = computed<boolean>(() => this.service.estaPagadoEsteMes(this.gasto().id));

  // Próxima fecha de aplicación automática (null = gasto manual)
  protected readonly proxima = computed<string | null>(() => proximaAplicacion(this.gasto(), this.pagado()));

  protected async alternarPago(evento: MatCheckboxChange): Promise<void> {
    const error = await this.service.togglePagoGastoFijo(this.gasto(), evento.checked);
    if (error) void this.notificacion.error(error);
  }

  protected async eliminar(): Promise<void> {
    const mensaje = `Se dejará de aplicar "${this.gasto().nombre}" cada mes. Los pagos ya registrados no se borran.`;
    if (!(await this.notificacion.confirmarEliminacion(mensaje, 'Eliminar gasto fijo'))) return;
    const error = await this.service.eliminarGastoFijo(this.gasto().id);
    if (error) this.notificacion.error(error);
  }
}
