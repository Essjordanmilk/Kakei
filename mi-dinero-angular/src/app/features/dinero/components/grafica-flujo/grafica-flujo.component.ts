import { Component, computed, inject, signal } from '@angular/core';
import { MonedaService } from '../../../../core/moneda.service';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import { MarcaEje, marcasEje, MargenesGrafica, pathColumna } from '../../../../shared/utils/graficas';
import { maximoEjeRedondo } from '../../dinero.calculos';
import { colorDeSlot } from '../../dinero.constantes';
import { ResumenMes } from '../../dinero.models';
import { DineroService } from '../../dinero.service';

const ANCHO = 600;
const ALTO = 240;
const MARGENES: MargenesGrafica = { arriba: 12, derecha: 8, abajo: 28, izquierda: 56 };
const ANCHO_MAXIMO_COLUMNA = 24;
// Espacio entre la columna de ingresos y la de gastos del mismo mes
const SEPARACION_COLUMNAS = 4;
const CANTIDAD_MARCAS = 4;

const BASE = ALTO - MARGENES.abajo;
const ALTO_UTIL = BASE - MARGENES.arriba;
const ANCHO_UTIL = ANCHO - MARGENES.izquierda - MARGENES.derecha;

export const COLOR_INGRESOS = colorDeSlot(1);
export const COLOR_GASTOS = colorDeSlot(2);

interface GrupoMes {
  mes: ResumenMes;
  banda: { x: number; ancho: number };
  // Rectángulo que resalta el par de columnas del mes (queda centrado con ellas)
  resalte: { x: number; ancho: number };
  ingresos: string;
  gastos: string;
  xEtiqueta: number;
}

// Columnas agrupadas: ingresos vs gastos de los últimos meses
@Component({
  selector: 'app-grafica-flujo',
  imports: [MonedaPipe],
  templateUrl: './grafica-flujo.component.html',
})
export class GraficaFlujoComponent {
  private readonly service = inject(DineroService);
  private readonly monedaService = inject(MonedaService);

  protected readonly viewBox = `0 0 ${ANCHO} ${ALTO}`;
  protected readonly base = BASE;
  protected readonly inicioX = MARGENES.izquierda;
  protected readonly finX = ANCHO - MARGENES.derecha;
  protected readonly colorIngresos = COLOR_INGRESOS;
  protected readonly colorGastos = COLOR_GASTOS;

  protected readonly meses = this.service.historicoMensual;
  protected readonly indiceActivo = signal<number | null>(null);

  protected readonly hayDatos = computed<boolean>(() =>
    this.meses().some((m) => m.ingresos > 0 || m.gastos > 0),
  );

  private readonly maximo = computed<number>(() =>
    maximoEjeRedondo(Math.max(...this.meses().map((m) => Math.max(m.ingresos, m.gastos)))),
  );

  protected readonly marcas = computed<MarcaEje[]>(() =>
    marcasEje(0, this.maximo(), CANTIDAD_MARCAS, (v) => this.aY(v), (v) =>
      this.monedaService.formatearCompacto(v),
    ),
  );

  protected readonly grupos = computed<GrupoMes[]>(() => {
    const meses = this.meses();
    const anchoBanda = ANCHO_UTIL / meses.length;
    const anchoColumna = Math.min(ANCHO_MAXIMO_COLUMNA, (anchoBanda - SEPARACION_COLUMNAS) * 0.35);

    return meses.map((mes, i) => {
      const xBanda = MARGENES.izquierda + i * anchoBanda;
      const centro = xBanda + anchoBanda / 2;
      const xIngresos = centro - SEPARACION_COLUMNAS / 2 - anchoColumna;
      const xGastos = centro + SEPARACION_COLUMNAS / 2;
      // El resaltado abraza el par de columnas (con un pequeño margen) en vez de
      // ocupar toda la franja del mes, que hacía ver las barras desalineadas.
      const anchoResalte = anchoColumna * 2 + SEPARACION_COLUMNAS;
      const margenResalte = 0.4 * anchoColumna;
      return {
        mes,
        banda: { x: xBanda, ancho: anchoBanda },
        resalte: { x: centro - anchoResalte / 2 - margenResalte, ancho: anchoResalte + margenResalte * 2 },
        ingresos: pathColumna(xIngresos, this.aY(mes.ingresos), anchoColumna, BASE),
        gastos: pathColumna(xGastos, this.aY(mes.gastos), anchoColumna, BASE),
        xEtiqueta: centro,
      };
    });
  });

  // Mes que muestra la lectura: el señalado o, por defecto, el actual (último)
  protected readonly mesLeido = computed<ResumenMes | null>(() => {
    const meses = this.meses();
    return meses[this.indiceActivo() ?? meses.length - 1] ?? null;
  });

  private aY(valor: number): number {
    return BASE - (valor / this.maximo()) * ALTO_UTIL;
  }
}
