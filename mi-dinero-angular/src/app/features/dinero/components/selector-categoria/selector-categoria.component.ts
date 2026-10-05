import { Component, computed, inject, input, model } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { MATERIAL_FORMULARIOS } from '../../../../shared/material/material';
import { OpcionSelect } from '../../../../shared/models/ui.models';
import { SeleccionCategoria, TipoCategoria } from '../../dinero.models';
import { DineroService } from '../../dinero.service';

const SEPARADOR = '|';

interface GrupoVisual {
  id: string;
  nombre: string;
  color: string;
  icono: IconDefinition;
  opciones: OpcionSelect[];
}

// Las opciones del select codifican "categoriaId|subcategoriaId" (subcategoría vacía = general)
function codificar(seleccion: SeleccionCategoria): string {
  return seleccion.categoriaId ? `${seleccion.categoriaId}${SEPARADOR}${seleccion.subcategoriaId ?? ''}` : '';
}

function decodificar(valor: string): SeleccionCategoria {
  const [categoriaId, subcategoriaId] = valor.split(SEPARADOR);
  return { categoriaId: categoriaId || null, subcategoriaId: subcategoriaId || null };
}

// mat-select de categorías (de gasto o de ingreso) agrupadas con sus subcategorías.
// Uso: <app-selector-categoria tipo="GASTO" [(valor)]="seleccion" />
@Component({
  selector: 'app-selector-categoria',
  imports: [...MATERIAL_FORMULARIOS, FaIconComponent],
  templateUrl: './selector-categoria.component.html',
  styleUrl: './selector-opcion.css',
})
export class SelectorCategoriaComponent {
  private readonly service = inject(DineroService);

  readonly valor = model.required<SeleccionCategoria>();
  readonly tipo = input<TipoCategoria>('GASTO');
  readonly etiqueta = input<string>('Categoría');

  protected readonly grupos = computed<GrupoVisual[]>(() =>
    this.service.gruposCategoria()[this.tipo()].map(({ categoria, opciones }) => ({
      id: categoria.id,
      nombre: categoria.nombre,
      color: this.service.colorDeCategoria(categoria.id),
      icono: this.service.iconoDeCategoria(categoria),
      opciones,
    })),
  );

  protected readonly valorCodificado = computed<string>(() => codificar(this.valor()));

  protected readonly etiquetaElegida = computed<string | null>(() => {
    const { categoriaId, subcategoriaId } = this.valor();
    return this.service.etiquetaCategoria(categoriaId, subcategoriaId);
  });

  protected readonly grupoElegido = computed<GrupoVisual | undefined>(() =>
    this.grupos().find((g) => g.id === this.valor().categoriaId),
  );

  protected cambiar(evento: MatSelectChange): void {
    this.valor.set(typeof evento.value === 'string' ? decodificar(evento.value) : decodificar(''));
  }
}
