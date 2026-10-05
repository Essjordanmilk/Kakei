import { Component, computed, inject, input, linkedSignal, output, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSelectChange } from '@angular/material/select';
import { NotificacionService } from '../../../../core/notificacion.service';
import { MATERIAL_FORMULARIOS } from '../../../../shared/material/material';
import { firmaFormulario } from '../../../../shared/utils/formulario';
import { CampoMontoComponent } from '../../../../shared/components/campo-monto/campo-monto.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { DIAS_DEL_MES } from '../../dinero.constantes';
import { GastoFijo, SeleccionCategoria } from '../../dinero.models';
import { DineroService } from '../../dinero.service';
import { SelectorCategoriaComponent } from '../selector-categoria/selector-categoria.component';
import { SelectorCuentaComponent } from '../selector-cuenta/selector-cuenta.component';

// Gasto fijo mensual. Con un día configurado, la app registra el GASTO sola ese día
// de cada mes en la cuenta elegida; sin día, se marca como pagado a mano.
@Component({
  selector: 'app-modal-gasto-fijo',
  imports: [FormsModule, ...MATERIAL_FORMULARIOS, CampoMontoComponent, ModalComponent, SelectorCategoriaComponent, SelectorCuentaComponent],
  templateUrl: './modal-gasto-fijo.component.html',
})
export class ModalGastoFijoComponent {
  private readonly service = inject(DineroService);
  private readonly notificacion = inject(NotificacionService);

  // null = crear un gasto fijo nuevo
  readonly gasto = input<GastoFijo | null>(null);
  readonly cerrar = output<void>();

  // Se cierra a través del modal para que se vea la animación de salida
  private readonly modal = viewChild.required(ModalComponent);

  protected readonly nombre = linkedSignal<string>(() => this.gasto()?.nombre ?? '');
  protected readonly monto = linkedSignal<number | null>(() => this.gasto()?.monto ?? null);
  protected readonly categoria = linkedSignal<SeleccionCategoria>(() => ({
    categoriaId: this.gasto()?.categoria_id ?? null,
    subcategoriaId: this.gasto()?.subcategoria_id ?? null,
  }));
  protected readonly cuentaId = linkedSignal<string | null>(
    () => this.gasto()?.cuenta_id ?? this.service.cuentaPrincipalId(),
  );
  // Un gasto fijo nuevo propone aplicarse el día de hoy cada mes
  protected readonly dia = linkedSignal<number | null>(() => {
    const gasto = this.gasto();
    return gasto ? gasto.dia_aplicacion : new Date().getDate();
  });

  protected readonly diasDelMes = DIAS_DEL_MES;

  protected readonly ayudaDia = computed<string>(() => {
    const dia = this.dia();
    if (!dia) return 'No se registra solo: márcalo como pagado cuando lo pagues.';
    const ajuste = dia > 28 ? ' En meses más cortos se aplica el último día.' : '';
    return `Se descontará automáticamente el día ${dia} de cada mes.${ajuste}`;
  });

  protected readonly titulo = computed<string>(() => `${this.gasto() ? 'Editar' : 'Agregar'} gasto fijo`);

  private readonly borrador = computed(() => ({
    nombre: this.nombre(),
    monto: this.monto(),
    categoria: this.categoria(),
    cuentaId: this.cuentaId(),
    dia: this.dia(),
  }));
  private readonly borradorInicial = linkedSignal({
    source: () => this.gasto(),
    computation: () => firmaFormulario(this.borrador()),
  });
  protected readonly hayCambios = computed(
    () => firmaFormulario(this.borrador()) !== this.borradorInicial(),
  );

  protected cambiarDia(evento: MatSelectChange): void {
    const dia = DIAS_DEL_MES.find((d) => d === evento.value);
    this.dia.set(dia ?? null);
  }

  protected async guardar(): Promise<void> {
    const nombre = this.nombre().trim();
    const monto = this.monto();
    const { categoriaId, subcategoriaId } = this.categoria();
    if (!nombre || !monto) {
      this.notificacion.informar('Completa nombre y monto');
      return;
    }
    if (!categoriaId) {
      this.notificacion.informar('Elige una categoría');
      return;
    }
    const error = await this.service.guardarGastoFijo(
      {
        nombre,
        monto,
        cuenta_id: this.cuentaId(),
        categoria_id: categoriaId,
        subcategoria_id: subcategoriaId,
        dia_aplicacion: this.dia(),
      },
      this.gasto()?.id,
    );
    if (error) {
      this.notificacion.error(error);
      return;
    }
    this.modal().cerrarAnimado();
  }
}
