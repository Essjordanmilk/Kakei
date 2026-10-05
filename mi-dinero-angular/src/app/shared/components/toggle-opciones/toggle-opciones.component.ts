import { Component, input, model } from '@angular/core';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { OpcionToggle } from '../../models/ui.models';

// Grupo de botones excluyentes de Material (ej. Gasto / Ingreso / Traslado). Uso: [(valor)]="tipo"
@Component({
  selector: 'app-toggle-opciones',
  imports: [MatButtonToggleModule],
  templateUrl: './toggle-opciones.component.html',
  styleUrl: './toggle-opciones.component.css',
})
export class ToggleOpcionesComponent<T extends string> {
  readonly opciones = input.required<readonly OpcionToggle<T>[]>();
  readonly valor = model.required<T>();
  readonly etiqueta = input.required<string>();

  // Se busca la opción elegida para conservar el tipo T sin conversiones
  protected cambiar(evento: MatButtonToggleChange): void {
    const opcion = this.opciones().find((o) => o.valor === evento.value);
    if (opcion) this.valor.set(opcion.valor);
  }
}
