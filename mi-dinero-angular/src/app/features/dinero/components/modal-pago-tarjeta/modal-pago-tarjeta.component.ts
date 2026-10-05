import { Component, computed, inject, input, linkedSignal, output, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificacionService } from '../../../../core/notificacion.service';
import { MATERIAL_FORMULARIOS } from '../../../../shared/material/material';
import { CampoMontoComponent } from '../../../../shared/components/campo-monto/campo-monto.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import { firmaFormulario } from '../../../../shared/utils/formulario';
import { deudaDeCredito } from '../../dinero.calculos';
import { CuentaConSaldo } from '../../dinero.models';
import { DineroService } from '../../dinero.service';
import { SelectorCuentaComponent } from '../selector-cuenta/selector-cuenta.component';

// Pago de una tarjeta de crédito: TRASLADO de la cuenta elegida hacia la tarjeta.
// Reduce la deuda sin cambiar el patrimonio neto.
@Component({
  selector: 'app-modal-pago-tarjeta',
  imports: [FormsModule, ...MATERIAL_FORMULARIOS, CampoMontoComponent, ModalComponent, MonedaPipe, SelectorCuentaComponent],
  templateUrl: './modal-pago-tarjeta.component.html',
})
export class ModalPagoTarjetaComponent {
  private readonly service = inject(DineroService);
  private readonly notificacion = inject(NotificacionService);

  readonly tarjeta = input.required<CuentaConSaldo>();
  readonly cerrar = output<void>();

  // Se cierra a través del modal para que se vea la animación de salida
  private readonly modal = viewChild.required(ModalComponent);

  protected readonly deuda = computed<number>(() => deudaDeCredito(this.tarjeta()));

  protected readonly montoCorte = computed<number>(() => {
    const corte = this.service.corteDelMes(this.tarjeta().id);
    return corte && !corte.pagado ? corte.monto_corte : 0;
  });

  // Sugerido: el corte pendiente o, si no hay, toda la deuda
  protected readonly monto = linkedSignal<number | null>(() => this.montoCorte() || Math.max(this.deuda(), 0));
  protected readonly cuentaOrigenId = linkedSignal<string | null>(() => this.service.cuentaPrincipalId());

  protected readonly titulo = computed<string>(() => `Pagar ${this.tarjeta().nombre}`);

  private readonly borrador = computed(() => ({
    monto: this.monto(),
    cuentaOrigenId: this.cuentaOrigenId(),
  }));
  private readonly borradorInicial = linkedSignal({
    source: () => this.tarjeta(),
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
    const error = await this.service.pagarTarjeta(this.tarjeta(), monto, origen);
    if (error) {
      this.notificacion.error(error);
      return;
    }
    this.modal().cerrarAnimado();
  }
}
