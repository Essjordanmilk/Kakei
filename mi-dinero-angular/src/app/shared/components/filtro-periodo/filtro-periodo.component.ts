import { Component, computed, model } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { fechaDesdeIso, fechaIsoLocal, mesRelativo } from '../../../core/utils';
import { ICONOS } from '../../iconos';
import { MATERIAL_FORMULARIOS } from '../../material/material';
import { PeriodoFechas } from '../../models/ui.models';

// Período del mes de `referencia`: del día 1 al último día
export function periodoDelMes(referencia: Date = new Date()): PeriodoFechas {
  const inicio = mesRelativo(referencia, 0);
  const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0);
  return { desde: fechaIsoLocal(inicio), hasta: fechaIsoLocal(fin) };
}

// Filtro de fechas con selector de rango de Material (se pueden elegir días sueltos)
// y atajos para moverse mes a mes. Uso: <app-filtro-periodo [(periodo)]="periodo" />
@Component({
  selector: 'app-filtro-periodo',
  imports: [...MATERIAL_FORMULARIOS, MatDatepickerModule, MatIconButton, FaIconComponent],
  templateUrl: './filtro-periodo.component.html',
  styleUrl: './filtro-periodo.component.css',
})
export class FiltroPeriodoComponent {
  readonly periodo = model.required<PeriodoFechas>();

  protected readonly iconos = ICONOS;

  protected readonly desde = computed<Date>(() => fechaDesdeIso(this.periodo().desde));
  protected readonly hasta = computed<Date | null>(() => {
    const hasta = this.periodo().hasta;
    return hasta ? fechaDesdeIso(hasta) : null;
  });

  protected readonly esMesActual = computed<boolean>(() => {
    const actual = periodoDelMes();
    return this.periodo().desde === actual.desde && this.periodo().hasta === actual.hasta;
  });

  protected cambiarDesde(evento: MatDatepickerInputEvent<Date>): void {
    const fecha = evento.value;
    if (!fecha || isNaN(fecha.getTime())) return;
    // Mientras se elige el rango, el fin queda vacío hasta que se escoja
    this.periodo.set({ desde: fechaIsoLocal(fecha), hasta: '' });
  }

  protected cambiarHasta(evento: MatDatepickerInputEvent<Date>): void {
    const fecha = evento.value;
    if (!fecha || isNaN(fecha.getTime())) return;
    this.periodo.update((p) => ({ ...p, hasta: fechaIsoLocal(fecha) }));
  }

  // Salta al mes anterior/siguiente al del inicio del período
  protected moverMes(delta: number): void {
    this.periodo.set(periodoDelMes(mesRelativo(this.desde(), delta)));
  }

  protected irAMesActual(): void {
    this.periodo.set(periodoDelMes());
  }
}
