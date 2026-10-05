import { Component, computed, inject, input, linkedSignal, output, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificacionService } from '../../../../core/notificacion.service';
import { fechaHoyIso } from '../../../../core/utils';
import { CampoFechaComponent } from '../../../../shared/components/campo-fecha/campo-fecha.component';
import { CampoMontoComponent } from '../../../../shared/components/campo-monto/campo-monto.component';
import { MATERIAL_FORMULARIOS } from '../../../../shared/material/material';
import { firmaFormulario } from '../../../../shared/utils/formulario';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { MetaAhorro } from '../../dinero.models';
import { DineroService } from '../../dinero.service';

@Component({
  selector: 'app-modal-meta',
  imports: [FormsModule, ...MATERIAL_FORMULARIOS, CampoFechaComponent, CampoMontoComponent, ModalComponent],
  templateUrl: './modal-meta.component.html',
})
export class ModalMetaComponent {
  private readonly service = inject(DineroService);
  private readonly notificacion = inject(NotificacionService);

  // null = crear una meta nueva
  readonly meta = input<MetaAhorro | null>(null);
  readonly cerrar = output<void>();

  // Se cierra a través del modal para que se vea la animación de salida
  private readonly modal = viewChild.required(ModalComponent);

  protected readonly hoy = fechaHoyIso();

  protected readonly nombre = linkedSignal<string>(() => this.meta()?.nombre ?? '');
  protected readonly objetivo = linkedSignal<number | null>(() => this.meta()?.valor_objetivo ?? null);
  protected readonly ahorrado = linkedSignal<number | null>(() => this.meta()?.valor_ahorrado ?? 0);
  protected readonly fecha = linkedSignal<string>(() => this.meta()?.fecha_objetivo ?? '');

  protected readonly titulo = computed<string>(() => `${this.meta() ? 'Editar' : 'Nueva'} meta de ahorro`);

  private readonly borrador = computed(() => ({
    nombre: this.nombre(),
    objetivo: this.objetivo(),
    ahorrado: this.ahorrado(),
    fecha: this.fecha(),
  }));
  private readonly borradorInicial = linkedSignal({
    source: () => this.meta(),
    computation: () => firmaFormulario(this.borrador()),
  });
  protected readonly hayCambios = computed(
    () => firmaFormulario(this.borrador()) !== this.borradorInicial(),
  );

  protected async guardar(): Promise<void> {
    const nombre = this.nombre().trim();
    const objetivo = this.objetivo();
    if (!nombre || !objetivo) {
      this.notificacion.informar('Completa nombre y valor objetivo');
      return;
    }
    const error = await this.service.guardarMeta(
      {
        nombre,
        valor_objetivo: objetivo,
        valor_ahorrado: this.ahorrado() || 0,
        fecha_objetivo: this.fecha() || null,
      },
      this.meta()?.id,
    );
    if (error) {
      this.notificacion.error(error);
      return;
    }
    this.modal().cerrarAnimado();
  }
}
