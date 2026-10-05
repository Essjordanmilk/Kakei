import { Component, computed, inject, input, linkedSignal, output, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificacionService } from '../../../../core/notificacion.service';
import { MATERIAL_FORMULARIOS } from '../../../../shared/material/material';
import { CampoMontoComponent } from '../../../../shared/components/campo-monto/campo-monto.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import { firmaFormulario } from '../../../../shared/utils/formulario';
import { saldoDeudaNormal } from '../../dinero.calculos';
import { Deuda } from '../../dinero.models';
import { DineroService } from '../../dinero.service';
import { SelectorCuentaComponent } from '../selector-cuenta/selector-cuenta.component';

// Registra la cuota de un préstamo como un gasto de la cuenta elegida
@Component({
  selector: 'app-modal-pago',
  imports: [FormsModule, ...MATERIAL_FORMULARIOS, CampoMontoComponent, ModalComponent, MonedaPipe, SelectorCuentaComponent],
  templateUrl: './modal-pago.component.html',
})
export class ModalPagoComponent {
  private readonly service = inject(DineroService);
  private readonly notificacion = inject(NotificacionService);

  readonly deuda = input.required<Deuda>();
  readonly cerrar = output<void>();

  // Se cierra a través del modal para que se vea la animación de salida
  private readonly modal = viewChild.required(ModalComponent);

  protected readonly saldo = computed<number>(() => saldoDeudaNormal(this.deuda()));

  // Monto sugerido: la cuota planeada
  protected readonly monto = linkedSignal<number | null>(() => this.deuda().pago_mensual_planeado);
  protected readonly cuentaOrigenId = linkedSignal<string | null>(() => this.service.cuentaPrincipalId());

  protected readonly titulo = computed<string>(() => `Pagar ${this.deuda().nombre}`);

  private readonly borrador = computed(() => ({
    monto: this.monto(),
    cuentaOrigenId: this.cuentaOrigenId(),
  }));
  private readonly borradorInicial = linkedSignal({
    source: () => this.deuda(),
    computation: () => firmaFormulario(this.borrador()),
  });
  protected readonly hayCambios = computed(
    () => firmaFormulario(this.borrador()) !== this.borradorInicial(),
  );

  protected async confirmar(): Promise<void> {
    const monto = this.monto();
    const origen = this.cuentaOrigenId();
    if (!monto || monto <= 0) {
      this.notificacion.informar('Ingresa un monto válido');
      return;
    }
    if (!origen) {
      this.notificacion.informar('Elige la cuenta desde la que pagas');
      return;
    }
    const error = await this.service.registrarPagoDeuda(this.deuda(), monto, origen);
    if (error) {
      this.notificacion.error(error);
      return;
    }
    this.modal().cerrarAnimado();
  }
}
