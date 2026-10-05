import { inject, Pipe, PipeTransform } from '@angular/core';
import { MonedaService } from '../../core/moneda.service';

@Pipe({ name: 'moneda' })
export class MonedaPipe implements PipeTransform {
  private readonly moneda = inject(MonedaService);

  transform(valor: number | null | undefined): string {
    return this.moneda.formatear(valor);
  }
}
