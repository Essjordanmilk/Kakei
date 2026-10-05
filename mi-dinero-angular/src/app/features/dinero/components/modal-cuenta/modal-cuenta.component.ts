import { Component, computed, inject, input, linkedSignal, output, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificacionService } from '../../../../core/notificacion.service';
import { MATERIAL_FORMULARIOS } from '../../../../shared/material/material';
import { firmaFormulario } from '../../../../shared/utils/formulario';
import { CampoMontoComponent } from '../../../../shared/components/campo-monto/campo-monto.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SelectorColorComponent } from '../../../../shared/components/selector-color/selector-color.component';
import { ToggleOpcionesComponent } from '../../../../shared/components/toggle-opciones/toggle-opciones.component';
import { deudaDeCredito } from '../../dinero.calculos';
import { claveColorDeSlot, SLOTS_COLOR, slotDeClaveColor, TIPOS_CUENTA } from '../../dinero.constantes';
import { CuentaConSaldo, CuentaPayload, SlotColor, TipoCuenta } from '../../dinero.models';
import { DineroService } from '../../dinero.service';

const DIA_MINIMO = 1;
const DIA_MAXIMO = 31;

function diaValido(dia: number | null): number | null {
  return dia !== null && dia >= DIA_MINIMO && dia <= DIA_MAXIMO ? Math.trunc(dia) : null;
}

// Crea o edita una cuenta. El usuario escribe el saldo que tiene HOY (o la deuda,
// en crédito) y el servicio calcula el saldo inicial que lo produce.
@Component({
  selector: 'app-modal-cuenta',
  imports: [FormsModule, ...MATERIAL_FORMULARIOS, CampoMontoComponent, ModalComponent, SelectorColorComponent, ToggleOpcionesComponent],
  templateUrl: './modal-cuenta.component.html',
})
export class ModalCuentaComponent {
  private readonly service = inject(DineroService);
  private readonly notificacion = inject(NotificacionService);

  // null = crear una cuenta nueva
  readonly cuenta = input<CuentaConSaldo | null>(null);
  readonly cerrar = output<void>();

  // Se cierra a través del modal para que se vea la animación de salida
  private readonly modal = viewChild.required(ModalComponent);

  protected readonly tiposCuenta = TIPOS_CUENTA;

  protected readonly nombre = linkedSignal<string>(() => this.cuenta()?.nombre ?? '');
  protected readonly tipo = linkedSignal<TipoCuenta>(() => this.cuenta()?.tipo ?? 'debito');
  protected readonly slot = linkedSignal<SlotColor>(
    () => this.cuenta()?.color ?? SLOTS_COLOR[this.service.cuentas().length % SLOTS_COLOR.length],
  );
  // En crédito el formulario pide la deuda en positivo
  protected readonly cifra = linkedSignal<number | null>(() => {
    const cuenta = this.cuenta();
    if (!cuenta) return 0;
    return cuenta.tipo === 'credito' ? deudaDeCredito(cuenta) : cuenta.saldoActual;
  });
  protected readonly diaCorte = linkedSignal<number | null>(() => this.cuenta()?.dia_corte ?? null);
  protected readonly diaLimite = linkedSignal<number | null>(() => this.cuenta()?.dia_limite_pago ?? null);

  protected readonly esCredito = computed<boolean>(() => this.tipo() === 'credito');
  // La columna `color` de cuentas guarda la posición en la paleta (1-8)
  protected readonly claveColor = computed<string>(() => claveColorDeSlot(this.slot()));

  protected cambiarColor(clave: string): void {
    const slot = slotDeClaveColor(clave);
    if (slot) this.slot.set(slot);
  }
  protected readonly titulo = computed<string>(() => `${this.cuenta() ? 'Editar' : 'Nueva'} cuenta`);

  private readonly borrador = computed(() => ({
    nombre: this.nombre(),
    tipo: this.tipo(),
    color: this.claveColor(),
    cifra: this.cifra(),
    diaCorte: this.diaCorte(),
    diaLimite: this.diaLimite(),
  }));
  private readonly borradorInicial = linkedSignal({
    source: () => this.cuenta(),
    computation: () => firmaFormulario(this.borrador()),
  });
  protected readonly hayCambios = computed(
    () => firmaFormulario(this.borrador()) !== this.borradorInicial(),
  );

  protected async guardar(): Promise<void> {
    const nombre = this.nombre().trim();
    if (!nombre) {
      this.notificacion.informar('Escribe un nombre para la cuenta');
      return;
    }

    const cifra = Number(this.cifra()) || 0;
    const saldoDeseado = this.esCredito() ? -cifra : cifra;
    const existente = this.cuenta();
    const payload: CuentaPayload = {
      nombre,
      tipo: this.tipo(),
      color: this.slot(),
      saldo_inicial: this.service.saldoInicialPara(existente?.id ?? null, saldoDeseado),
      dia_corte: this.esCredito() ? diaValido(this.diaCorte()) : null,
      dia_limite_pago: this.esCredito() ? diaValido(this.diaLimite()) : null,
    };

    const error = await this.service.guardarCuenta(payload, existente?.id);
    if (error) {
      this.notificacion.error(error);
      return;
    }
    this.modal().cerrarAnimado();
  }
}
