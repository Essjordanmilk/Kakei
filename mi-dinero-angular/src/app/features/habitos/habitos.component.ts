import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { HabitosService, DIAS_SEMANA, DIAS_SEMANA_LABEL } from './habitos.service';
import { formatoFechaLarga, fechaHoyIso } from '../../core/utils';

@Component({
  selector: 'app-habitos',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './habitos.component.html',
  styleUrl: './habitos.component.css',
})
export class HabitosComponent {
  protected readonly auth = inject(AuthService);
  protected readonly service = inject(HabitosService);

  protected readonly tabActiva = signal<'hoy' | 'habitos' | 'calendario'>('hoy');

  // Estado del modal de hábito
  protected readonly modalHabitoAbierto = signal(false);
  protected readonly modalEditarId = signal<string | null>(null);
  protected readonly modalNombre = signal('');
  protected readonly modalCategoria = signal('Salud');
  protected readonly modalFrecuenciaDiaria = signal(true);
  protected readonly modalDiasActivos = signal<string[]>([]);
  protected readonly modalHora = signal('');
  protected readonly modalPrioridad = signal('media');

  // Estado del calendario
  protected readonly mesCalendario = signal(new Date());
  protected readonly habitoSeleccionado = signal<string>('');

  protected readonly categoriasHabito = ['Salud', 'Estudio', 'Trabajo', 'Personal', 'Hogar', 'Otro'];
  protected readonly diasSemana = DIAS_SEMANA;
  protected readonly diasSemanaLabel = DIAS_SEMANA_LABEL;
  protected readonly formatoFechaLarga = formatoFechaLarga;

  protected readonly hoyIso = fechaHoyIso();

  constructor() {
    this.auth.usuario();
  }

  protected async salir(): Promise<void> {
    await this.auth.cerrarSesion();
  }

  protected cambiarTab(tab: 'hoy' | 'habitos' | 'calendario'): void {
    this.tabActiva.set(tab);
  }

  // ---------- PESTAÑA HOY ----------
  protected readonly habitosDeHoy = computed(() => {
    const hoy = this.hoyIso;
    return this.service.habitos().filter((h) => this.service.habitoAplicaEnFecha(h, hoy));
  });

  protected readonly completadosHoy = computed(
    () =>
      this.habitosDeHoy().filter((h) => {
        const r = this.service.registroDe(h.id, this.hoyIso);
        return r && r.estado === 'completado';
      }).length,
  );

  protected estadoDeHoy(habitoId: string): 'pendiente' | 'completado' | 'saltado' {
    const r = this.service.registroDe(habitoId, this.hoyIso);
    return r ? r.estado : 'pendiente';
  }

  protected async marcarHabito(habitoId: string, estado: 'completado' | 'saltado'): Promise<void> {
    await this.service.marcarHabito(habitoId, estado);
  }

  // ---------- PESTAÑA GESTIÓN DE HÁBITOS ----------
  protected abrirModalHabito(id?: string): void {
    const habito = id ? this.service.habitos().find((h) => h.id === id) : null;
    this.modalEditarId.set(id ?? null);
    this.modalNombre.set(habito ? habito.nombre : '');
    this.modalCategoria.set(habito ? habito.categoria : 'Salud');
    this.modalFrecuenciaDiaria.set(!habito || habito.frecuencia === 'diario');
    this.modalDiasActivos.set(
      habito && habito.frecuencia !== 'diario'
        ? habito.frecuencia.split(',').map((d) => d.trim())
        : [],
    );
    this.modalHora.set(habito && habito.hora_objetivo ? habito.hora_objetivo.slice(0, 5) : '');
    this.modalPrioridad.set(habito ? habito.prioridad : 'media');
    this.modalHabitoAbierto.set(true);
  }

  protected cerrarModalHabito(): void {
    this.modalHabitoAbierto.set(false);
  }

  protected toggleDia(dia: string): void {
    this.modalDiasActivos.update((dias) =>
      dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia],
    );
  }

  protected async guardarHabito(): Promise<void> {
    const nombre = this.modalNombre().trim();
    if (!nombre) {
      alert('Ingresa un nombre para el hábito');
      return;
    }

    let frecuencia = 'diario';
    if (!this.modalFrecuenciaDiaria()) {
      const diasElegidos = this.modalDiasActivos();
      if (diasElegidos.length === 0) {
        alert('Elige al menos un día');
        return;
      }
      frecuencia = diasElegidos.join(',');
    }

    const payload = {
      nombre,
      categoria: this.modalCategoria(),
      frecuencia,
      hora_objetivo: this.modalHora() || null,
      prioridad: this.modalPrioridad() as 'alta' | 'media' | 'baja',
    };

    const error = await this.service.guardarHabito(payload, this.modalEditarId() ?? undefined);
    if (error) {
      alert('Error: ' + error);
      return;
    }
    this.cerrarModalHabito();
  }

  protected async eliminarHabito(id: string): Promise<void> {
    if (!confirm('¿Eliminar este hábito? Se mantiene tu historial de cumplimiento.')) return;
    const error = await this.service.eliminarHabito(id);
    if (error) alert('Error: ' + error);
  }

  // ---------- CALENDARIO ----------
  protected readonly mesTitulo = computed(() =>
    this.mesCalendario().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
  );

  protected readonly rachaActualSel = computed(() => {
    const habito = this.habitoSeleccionadoHabito();
    return habito ? this.service.calcularRachaActual(habito) : 0;
  });

  protected readonly rachaLargaSel = computed(() => {
    const habito = this.habitoSeleccionadoHabito();
    return habito ? this.service.calcularRachaMasLarga(habito) : 0;
  });

  protected readonly habitoSeleccionadoHabito = computed(() =>
    this.service.habitos().find((h) => h.id === this.habitoSeleccionado()),
  );

  protected readonly celdasCalendario = computed(() => {
    const habito = this.habitoSeleccionadoHabito();
    if (!habito) return [];

    const anio = this.mesCalendario().getFullYear();
    const mes = this.mesCalendario().getMonth();
    const primerDiaSemana = new Date(anio, mes, 1).getDay();
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();

    const celdas: { dia: string; clase: string }[] = [];
    for (let i = 0; i < primerDiaSemana; i++) celdas.push({ dia: '', clase: 'dia-vacia' });

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fechaIso = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const reg = this.service.registroDe(habito.id, fechaIso);
      let clase = '';
      if (reg && reg.estado === 'completado') clase = 'dia-completado';
      else if (reg && reg.estado === 'saltado') clase = 'dia-saltado';
      celdas.push({ dia: String(dia), clase });
    }
    return celdas;
  });

  protected cambiarMes(delta: number): void {
    this.mesCalendario.update((m) => {
      const n = new Date(m);
      n.setMonth(n.getMonth() + delta);
      return n;
    });
  }

  protected seleccionarHabitoCalendario(id: string): void {
    this.habitoSeleccionado.set(id);
  }
}
