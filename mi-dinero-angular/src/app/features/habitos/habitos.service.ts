import { Injectable, signal } from '@angular/core';
import { db } from '../../core/supabase';
import { diaSemanaIso, fechaHoyIso } from '../../core/utils';

export const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
export const DIAS_SEMANA_LABEL: Record<string, string> = {
  dom: 'Dom', lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb',
};

export interface Habito {
  id: string;
  nombre: string;
  categoria: string;
  frecuencia: string;
  hora_objetivo: string | null;
  prioridad: 'alta' | 'media' | 'baja';
  activo: boolean;
  created_at: string;
}

export interface RegistroHabito {
  id: string;
  habito_id: string;
  fecha: string;
  estado: 'completado' | 'saltado';
}

@Injectable({ providedIn: 'root' })
export class HabitosService {
  readonly habitos = signal<Habito[]>([]);
  readonly registros = signal<RegistroHabito[]>([]);

  constructor() {
    this.iniciarAuth();
  }

  private iniciarAuth(): void {
    db.auth.onAuthStateChange((_evento, sesion) => {
      if (sesion) this.cargarTodo();
    });
  }

  async cargarTodo(): Promise<void> {
    await Promise.all([this.cargarHabitos(), this.cargarRegistros()]);
  }

  async cargarHabitos(): Promise<void> {
    const { data, error } = await db
      .from('habitos')
      .select('*')
      .eq('activo', true)
      .order('created_at', { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    this.habitos.set(data as Habito[]);
  }

  async cargarRegistros(): Promise<void> {
    const { data, error } = await db.from('habitos_registros').select('*');
    if (error) {
      console.error(error);
      return;
    }
    this.registros.set(data as RegistroHabito[]);
  }

  registroDe(habitoId: string, fechaIso: string): RegistroHabito | undefined {
    return this.registros().find((r) => r.habito_id === habitoId && r.fecha === fechaIso);
  }

  habitoAplicaEnFecha(habito: Habito, fechaIso: string): boolean {
    if (habito.frecuencia === 'diario') return true;
    const diasActivos = habito.frecuencia.split(',').map((d) => d.trim());
    const diaHoy = DIAS_SEMANA[diaSemanaIso(fechaIso)];
    return diasActivos.includes(diaHoy);
  }

  descripcionFrecuencia(frecuencia: string): string {
    if (frecuencia === 'diario') return 'Todos los días';
    return frecuencia
      .split(',')
      .map((d) => DIAS_SEMANA_LABEL[d.trim()])
      .join(', ');
  }

  // Racha actual: cuenta hacia atrás desde hoy, días "completado" consecutivos.
  // Un día "saltado" o sin marcar ROMPE la racha. Hoy sin marcar no la rompe todavía.
  calcularRachaActual(habito: Habito): number {
    let racha = 0;
    let fecha = new Date();
    for (let i = 0; i < 3650; i++) {
      const fechaIso = fecha.toISOString().slice(0, 10);
      const esHoy = fechaIso === fechaHoyIso();
      if (this.habitoAplicaEnFecha(habito, fechaIso)) {
        const reg = this.registroDe(habito.id, fechaIso);
        if (reg && reg.estado === 'completado') {
          racha++;
        } else if (esHoy && !reg) {
          // hoy todavía no se marcó: no cuenta a favor ni rompe
        } else {
          break;
        }
      }
      fecha.setDate(fecha.getDate() - 1);
    }
    return racha;
  }

  calcularRachaMasLarga(habito: Habito): number {
    const fechasCompletadas = this.registros()
      .filter((r) => r.habito_id === habito.id && r.estado === 'completado')
      .map((r) => r.fecha)
      .sort();

    if (fechasCompletadas.length === 0) return 0;

    let maxRacha = 1;
    let rachaActual = 1;

    for (let i = 1; i < fechasCompletadas.length; i++) {
      const fechasEntreMedio = this.diasEsperadosEntre(
        habito,
        fechasCompletadas[i - 1],
        fechasCompletadas[i],
      );
      if (fechasEntreMedio === 1) {
        rachaActual++;
        maxRacha = Math.max(maxRacha, rachaActual);
      } else {
        rachaActual = 1;
      }
    }
    return maxRacha;
  }

  // Cuenta cuántas "ocurrencias esperadas" del hábito hay entre dos fechas
  private diasEsperadosEntre(habito: Habito, fechaIsoA: string, fechaIsoB: string): number {
    const [a1, m1, d1] = fechaIsoA.split('-').map(Number);
    const [a2, m2, d2] = fechaIsoB.split('-').map(Number);
    let cursor = new Date(a1, m1 - 1, d1);
    const fin = new Date(a2, m2 - 1, d2);
    let conteo = 0;
    cursor.setDate(cursor.getDate() + 1);
    while (cursor <= fin) {
      const iso = cursor.toISOString().slice(0, 10);
      if (this.habitoAplicaEnFecha(habito, iso)) conteo++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return conteo;
  }

  async marcarHabito(habitoId: string, nuevoEstado: 'completado' | 'saltado'): Promise<void> {
    const hoy = fechaHoyIso();
    const existente = this.registroDe(habitoId, hoy);

    if (existente && existente.estado === nuevoEstado) {
      await db.from('habitos_registros').delete().eq('id', existente.id);
    } else if (existente) {
      await db.from('habitos_registros').update({ estado: nuevoEstado }).eq('id', existente.id);
    } else {
      await db.from('habitos_registros').insert({ habito_id: habitoId, fecha: hoy, estado: nuevoEstado });
    }

    await this.cargarRegistros();
  }

  async guardarHabito(
    payload: Partial<Habito>,
    id?: string,
  ): Promise<string | null> {
    let error;
    if (id) {
      ({ error } = await db.from('habitos').update(payload).eq('id', id));
    } else {
      ({ error } = await db.from('habitos').insert(payload));
    }
    if (error) return error.message;
    await this.cargarHabitos();
    return null;
  }

  async eliminarHabito(id: string): Promise<string | null> {
    const { error } = await db.from('habitos').update({ activo: false }).eq('id', id);
    if (error) return error.message;
    await this.cargarHabitos();
    return null;
  }
}
