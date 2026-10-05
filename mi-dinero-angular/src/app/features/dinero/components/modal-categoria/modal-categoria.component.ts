import { Component, computed, inject, input, linkedSignal, output, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { NotificacionService } from '../../../../core/notificacion.service';
import { CampoMontoComponent } from '../../../../shared/components/campo-monto/campo-monto.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SelectorColorComponent } from '../../../../shared/components/selector-color/selector-color.component';
import { SelectorIconoComponent } from '../../../../shared/components/selector-icono/selector-icono.component';
import { ICONOS, NombreIcono } from '../../../../shared/iconos';
import { MATERIAL_FORMULARIOS } from '../../../../shared/material/material';
import { firmaFormulario } from '../../../../shared/utils/formulario';
import { categoriaPredeterminadaDe } from '../../dinero.calculos';
import { claveColorDeSlot, resolverColor, SLOTS_COLOR } from '../../dinero.constantes';
import { CategoriaGrande, CategoriaGrandePayload, TipoCategoria } from '../../dinero.models';
import { DineroService } from '../../dinero.service';

// Crea o edita una categoría: nombre, presupuesto mensual (solo gastos), color e icono
@Component({
  selector: 'app-modal-categoria',
  imports: [
    FormsModule,
    ...MATERIAL_FORMULARIOS,
    FaIconComponent,
    CampoMontoComponent,
    ModalComponent,
    SelectorColorComponent,
    SelectorIconoComponent,
  ],
  templateUrl: './modal-categoria.component.html',
  styleUrl: './modal-categoria.component.css',
})
export class ModalCategoriaComponent {
  private readonly service = inject(DineroService);
  private readonly notificacion = inject(NotificacionService);

  // null = crear una categoría nueva
  readonly categoria = input<CategoriaGrande | null>(null);
  // Tipo de una categoría nueva; al editar manda el de la categoría
  readonly tipoNueva = input<TipoCategoria>('GASTO');
  readonly cerrar = output<void>();

  // Se cierra a través del modal para que se vea la animación de salida
  private readonly modal = viewChild.required(ModalComponent);

  protected readonly nombre = linkedSignal<string>(() => this.categoria()?.nombre ?? '');
  protected readonly presupuesto = linkedSignal<number | null>(
    () => this.categoria()?.presupuesto_mensual ?? null,
  );
  // Una categoría nueva arranca con el siguiente color de la paleta y un icono genérico
  protected readonly color = linkedSignal<string>(() => {
    const existente = this.categoria();
    if (existente) return this.service.claveColorDeCategoria(existente.id);
    return claveColorDeSlot(SLOTS_COLOR[this.service.categoriasGrandes().length % SLOTS_COLOR.length]);
  });
  protected readonly icono = linkedSignal<NombreIcono>(() => {
    const existente = this.categoria();
    return existente ? this.service.nombreIconoDeCategoria(existente) : 'categoria';
  });

  protected readonly tipo = computed<TipoCategoria>(() => this.categoria()?.tipo ?? this.tipoNueva());
  // Las categorías de ingreso no tienen presupuesto
  protected readonly conPresupuesto = computed<boolean>(() => this.tipo() === 'GASTO');

  protected readonly colorCss = computed<string>(() => resolverColor(this.color()) ?? 'var(--color-primario)');
  protected readonly iconoVista = computed<IconDefinition>(() => ICONOS[this.icono()]);

  protected readonly titulo = computed<string>(() => {
    const accion = this.categoria() ? 'Editar' : 'Nueva';
    return `${accion} categoría de ${this.tipo() === 'GASTO' ? 'gasto' : 'ingreso'}`;
  });

  private readonly borrador = computed(() => ({
    nombre: this.nombre(),
    presupuesto: this.presupuesto(),
    color: this.color(),
    icono: this.icono(),
  }));
  private readonly borradorInicial = linkedSignal({
    source: () => this.categoria(),
    computation: () => firmaFormulario(this.borrador()),
  });
  protected readonly hayCambios = computed(
    () => firmaFormulario(this.borrador()) !== this.borradorInicial(),
  );

  // Al escribir el nombre de una categoría sugerida (p. ej. "Salud") se proponen su color e icono
  protected cambiarNombre(nombre: string): void {
    this.nombre.set(nombre);
    if (this.categoria()) return;
    const sugerida = categoriaPredeterminadaDe(nombre);
    if (sugerida) {
      this.color.set(claveColorDeSlot(sugerida.slot));
      this.icono.set(sugerida.icono);
    }
  }

  protected async guardar(): Promise<void> {
    const nombre = this.nombre().trim();
    if (!nombre) {
      this.notificacion.informar('Escribe un nombre');
      return;
    }
    const presupuesto = this.conPresupuesto() ? Math.max(Number(this.presupuesto()) || 0, 0) : 0;

    const existente = this.categoria();
    const base: CategoriaGrandePayload = {
      nombre,
      presupuesto_mensual: presupuesto,
      color: this.color(),
      icono: this.icono(),
    };
    const payload: CategoriaGrandePayload = existente
      ? base
      : { ...base, tipo: this.tipo(), orden: this.service.categoriasGrandes().length + 1 };

    const error = await this.service.guardarCategoriaGrande(payload, existente?.id);
    if (error) {
      void this.notificacion.error(error);
      return;
    }
    this.modal().cerrarAnimado();
  }
}
