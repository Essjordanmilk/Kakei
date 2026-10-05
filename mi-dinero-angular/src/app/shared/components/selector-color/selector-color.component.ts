import { Component, computed, input, model } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ICONOS } from '../../iconos';
import { claveColorDeSlot, colorDeSlot, esColorHex, SLOTS_COLOR } from '../../utils/colores';

interface MuestraColor {
  clave: string;
  css: string;
  etiqueta: string;
}

const COLOR_LIBRE_INICIAL = '#3987e5';

// Selector de color: la paleta de la app (se adapta a modo claro/oscuro) y, si se
// permite, un color libre con el color picker del sistema.
// El valor es una clave guardable: 'serie-N' o '#rrggbb'.
@Component({
  selector: 'app-selector-color',
  imports: [FaIconComponent],
  templateUrl: './selector-color.component.html',
  styleUrl: './selector-color.component.css',
})
export class SelectorColorComponent {
  readonly valor = model.required<string>();
  readonly etiqueta = input<string>('Color');
  readonly permitirPersonalizado = input<boolean>(true);

  protected readonly iconos = ICONOS;

  protected readonly muestras: readonly MuestraColor[] = SLOTS_COLOR.map((slot) => ({
    clave: claveColorDeSlot(slot),
    css: colorDeSlot(slot),
    etiqueta: `Color ${slot} de la paleta`,
  }));

  protected readonly esPersonalizado = computed<boolean>(() => esColorHex(this.valor()));
  // Lo que muestra el picker: el color libre elegido o uno inicial
  protected readonly colorLibre = computed<string>(() =>
    this.esPersonalizado() ? this.valor() : COLOR_LIBRE_INICIAL,
  );

  protected elegirLibre(valor: string): void {
    if (esColorHex(valor)) this.valor.set(valor.toLowerCase());
  }
}
