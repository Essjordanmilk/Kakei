import { Component, computed, inject, input, model } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { ICONOS } from '../../../../shared/iconos';
import { MATERIAL_FORMULARIOS } from '../../../../shared/material/material';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import { colorDeSlot, ETIQUETAS_TIPO_CUENTA, ICONOS_TIPO_CUENTA } from '../../dinero.constantes';
import { DineroService } from '../../dinero.service';

interface OpcionCuenta {
  id: string;
  nombre: string;
  tipo: string;
  color: string;
  icono: IconDefinition;
}

// mat-select de cuentas con su icono y color. Uso: <app-selector-cuenta etiqueta="Desde" [(valor)]="origenId" />
@Component({
  selector: 'app-selector-cuenta',
  imports: [...MATERIAL_FORMULARIOS, FaIconComponent, MonedaPipe],
  templateUrl: './selector-cuenta.component.html',
  styleUrl: '../selector-categoria/selector-opcion.css',
})
export class SelectorCuentaComponent {
  private readonly service = inject(DineroService);

  readonly valor = model.required<string | null>();
  readonly etiqueta = input<string>('Cuenta');
  // Cuenta que no se puede elegir (p. ej. el origen al elegir el destino de un traslado)
  readonly excluir = input<string | null>(null);

  protected readonly opciones = computed<OpcionCuenta[]>(() =>
    this.service
      .cuentas()
      .filter((c) => c.id !== this.excluir())
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        tipo: ETIQUETAS_TIPO_CUENTA[c.tipo],
        color: colorDeSlot(c.color),
        icono: ICONOS[ICONOS_TIPO_CUENTA[c.tipo]],
      })),
  );

  protected readonly elegida = computed<OpcionCuenta | undefined>(() =>
    this.opciones().find((o) => o.id === this.valor()),
  );

  // Muestra el saldo de la cuenta elegida como ayuda
  protected readonly saldoElegida = computed<number | null>(
    () => this.service.cuenta(this.valor())?.saldoActual ?? null,
  );

  protected cambiar(evento: MatSelectChange): void {
    const opcion = this.opciones().find((o) => o.id === evento.value);
    this.valor.set(opcion?.id ?? null);
  }
}
