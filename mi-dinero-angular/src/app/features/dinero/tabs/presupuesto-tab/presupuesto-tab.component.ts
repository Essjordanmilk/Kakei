import { Component, computed, inject, signal } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { NotificacionService } from '../../../../core/notificacion.service';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { ICONOS } from '../../../../shared/iconos';
import { ControlModal } from '../../../../shared/utils/control-modal';
import { CategoriaPresupuestoCardComponent } from '../../components/categoria-presupuesto-card/categoria-presupuesto-card.component';
import { MetaAhorroCardComponent } from '../../components/meta-ahorro-card/meta-ahorro-card.component';
import { ModalCategoriaComponent } from '../../components/modal-categoria/modal-categoria.component';
import { ModalPresupuestosComponent } from '../../components/modal-presupuestos/modal-presupuestos.component';
import { ModalMetaComponent } from '../../components/modal-meta/modal-meta.component';
import { ModalSubcategoriaComponent } from '../../components/modal-subcategoria/modal-subcategoria.component';
import {
  CategoriaGrande,
  CategoriaPredeterminada,
  MetaAhorro,
  TipoCategoria,
} from '../../dinero.models';
import { DineroService } from '../../dinero.service';

@Component({
  selector: 'app-presupuesto-tab',
  imports: [
    FaIconComponent,
    StatCardComponent,
    CategoriaPresupuestoCardComponent,
    MetaAhorroCardComponent,
    ModalPresupuestosComponent,
    ModalCategoriaComponent,
    ModalSubcategoriaComponent,
    ModalMetaComponent,
  ],
  templateUrl: './presupuesto-tab.component.html',
  styleUrl: './presupuesto-tab.component.css',
})
export class PresupuestoTabComponent {
  protected readonly service = inject(DineroService);
  private readonly notificacion = inject(NotificacionService);

  protected readonly iconos = ICONOS;
  protected readonly creandoSugeridas = signal(false);

  protected readonly modalPresupuestosAbierto = signal(false);
  protected readonly modalCategoria = new ControlModal<CategoriaGrande>();
  protected readonly modalCategoriaIngreso = new ControlModal<CategoriaGrande>();
  protected readonly modalSubcategoria = new ControlModal<CategoriaGrande>();
  protected readonly modalMeta = new ControlModal<MetaAhorro>();

  protected readonly presupuestoExcedido = computed<boolean>(() => {
    const total = this.service.presupuestoTotal();
    return total > 0 && this.service.gastosMes() > total;
  });

  protected readonly sugeridas = computed<CategoriaPredeterminada[]>(
    () => this.service.categoriasSugeridasFaltantes().GASTO,
  );

  protected readonly sugeridasIngreso = computed<CategoriaPredeterminada[]>(
    () => this.service.categoriasSugeridasFaltantes().INGRESO,
  );

  protected readonly nombresSugeridas = computed<string>(() =>
    this.sugeridas()
      .map((c) => c.nombre)
      .join(', '),
  );

  protected async crearSugeridas(tipo: TipoCategoria): Promise<void> {
    this.creandoSugeridas.set(true);
    const error = await this.service.crearCategoriasPredeterminadas(tipo);
    this.creandoSugeridas.set(false);
    if (error) this.notificacion.error(error);
  }

  protected async eliminarCategoriaIngreso(categoria: CategoriaGrande): Promise<void> {
    const mensaje = `Se eliminará la categoría de ingreso "${categoria.nombre}". Sus movimientos no se borran.`;
    if (!(await this.notificacion.confirmarEliminacion(mensaje, 'Eliminar categoría'))) return;
    const error = await this.service.eliminarCategoriaGrande(categoria.id);
    if (error) this.notificacion.error(error);
  }
}
