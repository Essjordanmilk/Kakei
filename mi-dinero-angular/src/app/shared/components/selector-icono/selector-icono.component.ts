import { Component, input, model } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { ICONOS, ICONOS_CATEGORIA, NombreIcono } from '../../iconos';

interface OpcionIcono {
  nombre: NombreIcono;
  icono: IconDefinition;
}

// Rejilla de iconos para identificar una categoría. `color` tiñe el icono elegido.
@Component({
  selector: 'app-selector-icono',
  imports: [FaIconComponent],
  templateUrl: './selector-icono.component.html',
  styleUrl: './selector-icono.component.css',
})
export class SelectorIconoComponent {
  readonly valor = model.required<NombreIcono>();
  readonly etiqueta = input<string>('Icono');
  readonly color = input<string>('var(--color-primario)');

  protected readonly opciones: readonly OpcionIcono[] = ICONOS_CATEGORIA.map((nombre) => ({
    nombre,
    icono: ICONOS[nombre],
  }));
}
