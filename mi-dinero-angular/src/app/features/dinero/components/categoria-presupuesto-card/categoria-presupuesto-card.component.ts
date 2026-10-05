import { Component, computed, inject, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { NotificacionService } from '../../../../core/notificacion.service';
import { ProgressBarComponent } from '../../../../shared/components/progress-bar/progress-bar.component';
import { ICONOS } from '../../../../shared/iconos';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import { PorcentajePipe } from '../../../../shared/pipes/porcentaje.pipe';
import { ResumenCategoria, Subcategoria } from '../../dinero.models';
import { DineroService } from '../../dinero.service';

// Categoría grande del presupuesto: indicador de color e icono, cifras, barra de uso,
// subcategorías y acciones
@Component({
  selector: 'app-categoria-presupuesto-card',
  imports: [MatIconButton, MatMenuModule, FaIconComponent, ProgressBarComponent, MonedaPipe, PorcentajePipe],
  templateUrl: './categoria-presupuesto-card.component.html',
  styleUrl: './categoria-presupuesto-card.component.css',
})
export class CategoriaPresupuestoCardComponent {
  private readonly service = inject(DineroService);
  private readonly notificacion = inject(NotificacionService);

  readonly resumen = input.required<ResumenCategoria>();

  readonly editar = output<void>();
  readonly agregarSubcategoria = output<void>();

  protected readonly iconos = ICONOS;

  // Una categoría con presupuesto 0 no tiene límite: no se muestran barra ni disponible
  protected readonly tieneLimite = computed<boolean>(() => this.resumen().presupuesto > 0);

  protected readonly textoSubcategorias = computed<string>(() => {
    const cantidad = this.resumen().subcategorias.length;
    if (cantidad === 0) return 'Sin subcategorías';
    return `${cantidad} ${cantidad === 1 ? 'subcategoría' : 'subcategorías'}`;
  });

  protected async eliminar(): Promise<void> {
    const mensaje = `Se eliminarán "${this.resumen().categoria.nombre}" y sus subcategorías. Los movimientos registrados no se borran.`;
    if (!(await this.notificacion.confirmarEliminacion(mensaje, 'Eliminar categoría'))) return;
    const error = await this.service.eliminarCategoriaGrande(this.resumen().categoria.id);
    if (error) this.notificacion.error(error);
  }

  protected async eliminarSubcategoria(subcategoria: Subcategoria): Promise<void> {
    const mensaje = `Se eliminará la subcategoría "${subcategoria.nombre}". Sus movimientos quedan en la categoría principal.`;
    if (!(await this.notificacion.confirmarEliminacion(mensaje, 'Eliminar subcategoría'))) return;
    const error = await this.service.eliminarSubcategoria(subcategoria.id);
    if (error) this.notificacion.error(error);
  }
}
