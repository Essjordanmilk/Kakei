import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { NotificacionService } from '../../../../core/notificacion.service';
import { CampoMontoComponent } from '../../../../shared/components/campo-monto/campo-monto.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import { CategoriaGrande, PresupuestosPorCategoria } from '../../dinero.models';
import { DineroService } from '../../dinero.service';

interface FilaPresupuesto {
  categoria: CategoriaGrande;
  color: string;
  icono: IconDefinition;
  monto: number;
}

// Presupuesto mensual (en pesos) de todas las categorías de gasto en un solo formulario.
// No depende del ingreso: cada categoría tiene su propio límite (0 = sin límite).
@Component({
  selector: 'app-modal-presupuestos',
  imports: [CampoMontoComponent, ModalComponent, MonedaPipe],
  templateUrl: './modal-presupuestos.component.html',
})
export class ModalPresupuestosComponent {
  private readonly service = inject(DineroService);
  private readonly notificacion = inject(NotificacionService);

  readonly cerrar = output<void>();

  // Se cierra a través del modal para que se vea la animación de salida
  private readonly modal = viewChild.required(ModalComponent);

  // El formulario parte de los valores guardados al momento de abrir el modal
  private readonly montos = signal<PresupuestosPorCategoria>(
    Object.fromEntries(this.service.categoriasGasto().map((c) => [c.id, c.presupuesto_mensual || 0])),
  );

  protected readonly filas = computed<FilaPresupuesto[]>(() =>
    this.service.categoriasGasto().map((categoria) => ({
      categoria,
      color: this.service.colorDeCategoria(categoria.id),
      icono: this.service.iconoDeCategoria(categoria),
      monto: this.montos()[categoria.id] ?? 0,
    })),
  );

  protected readonly total = computed<number>(() =>
    Object.values(this.montos()).reduce((acc, monto) => acc + monto, 0),
  );

  protected readonly hayCambios = computed<boolean>(() =>
    this.filas().some(
      (fila) => (this.montos()[fila.categoria.id] ?? 0) !== (fila.categoria.presupuesto_mensual || 0),
    ),
  );

  protected actualizar(categoriaId: string, valor: number | null): void {
    this.montos.update((actuales) => ({ ...actuales, [categoriaId]: Math.max(Number(valor) || 0, 0) }));
  }

  protected async guardar(): Promise<void> {
    const error = await this.service.guardarPresupuestos(this.montos());
    if (error) {
      void this.notificacion.error(error);
      return;
    }
    this.modal().cerrarAnimado();
    this.notificacion.informar('Presupuesto actualizado');
  }
}
