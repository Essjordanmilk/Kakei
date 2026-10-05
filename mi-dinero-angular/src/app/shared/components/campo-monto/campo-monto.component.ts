import { Component, computed, inject, input, linkedSignal, model, output } from '@angular/core';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { ErrorStateMatcher } from '@angular/material/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { MonedaService } from '../../../core/moneda.service';
import { MATERIAL_FORMULARIOS } from '../../material/material';

// Campo de monto reutilizable: muestra la cifra con separadores de miles y los
// decimales de la moneda configurada, y expone el valor numérico ya parseado.
// Uso: <app-campo-monto etiqueta="Monto" [(valor)]="monto" />
@Component({
  selector: 'app-campo-monto',
  imports: [...MATERIAL_FORMULARIOS, FaIconComponent],
  templateUrl: './campo-monto.component.html',
  styleUrl: './campo-monto.component.css',
})
export class CampoMontoComponent {
  readonly valor = model<number | null>(null);
  readonly etiqueta = input.required<string>();
  readonly placeholder = input<string>('0');
  readonly ayuda = input<string>('');
  readonly error = input<string>('');
  readonly icono = input<IconDefinition | null>(null);
  readonly colorCategoria = input<string>('');
  // Se emite al perder el foco, para validar cuando el usuario ya usó el campo
  readonly tocado = output<void>();

  private readonly monedaService = inject(MonedaService);

  protected readonly simbolo = computed<string>(() => this.monedaService.simbolo());
  protected readonly matcher: ErrorStateMatcher = { isErrorState: () => !!this.error() };

  // Texto que se muestra en el input. Se regenera al cambiar el valor desde
  // fuera, pero conserva lo que el usuario escribe mientras digita.
  protected readonly texto = linkedSignal<number | null, string>({
    source: () => this.valor(),
    computation: (valor, anterior) => {
      if (anterior && this.monedaService.parsear(anterior.value) === valor) return anterior.value;
      return valor === null ? '' : this.monedaService.formatearEntrada(valor);
    },
  });

  protected alEscribir(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const posicion = entrada.selectionStart ?? entrada.value.length;
    const digitosAntes = (entrada.value.slice(0, posicion).match(/\d/g) ?? []).length;

    const numero = this.monedaService.parsear(entrada.value);
    const mostrado = numero === null ? '' : this.monedaService.formatearEntrada(numero);
    this.texto.set(mostrado);
    this.valor.set(numero);
    // Aplica el texto formateado ya mismo y repone el cursor tras la misma
    // cantidad de dígitos (los separadores de miles no cuentan)
    entrada.value = mostrado;
    queueMicrotask(() => {
      const destino = this.posicionTrasDigitos(mostrado, digitosAntes);
      entrada.setSelectionRange(destino, destino);
    });
  }

  protected alSalir(): void {
    const numero = this.valor();
    this.texto.set(numero === null ? '' : this.monedaService.formatearNumero(numero));
    this.tocado.emit();
  }

  private posicionTrasDigitos(texto: string, cantidad: number): number {
    if (cantidad <= 0) return 0;
    let vistos = 0;
    for (let i = 0; i < texto.length; i++) {
      if (/\d/.test(texto[i])) {
        vistos += 1;
        if (vistos === cantidad) return i + 1;
      }
    }
    return texto.length;
  }
}
