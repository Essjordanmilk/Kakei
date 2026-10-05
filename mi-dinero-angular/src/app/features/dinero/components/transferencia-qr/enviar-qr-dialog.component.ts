import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatProgressBar } from '@angular/material/progress-bar';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { toCanvas } from 'qrcode';
import { ICONOS } from '../../../../shared/iconos';

export interface DatosEnviarQr {
  marcos: readonly string[];
  resumen: string;
}

// Tiempo que se muestra cada QR. Más corto aprovecha mejor una cámara rápida;
// más largo ayuda a teléfonos lentos.
const INTERVALO_MARCO_MS = 350;
const TAMANO_QR_PX = 320;

// Muestra el respaldo como una secuencia de QR que se repite en bucle hasta que
// el móvil la termina de leer (ver RecibirQrDialogComponent).
@Component({
  selector: 'app-enviar-qr-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatProgressBar,
    FaIconComponent,
  ],
  templateUrl: './enviar-qr-dialog.component.html',
  styleUrl: './transferencia-qr.css',
})
export class EnviarQrDialogComponent {
  protected readonly datos = inject<DatosEnviarQr>(MAT_DIALOG_DATA);
  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');

  protected readonly iconos = ICONOS;
  protected readonly indice = signal(0);
  protected readonly pausado = signal(false);

  protected readonly total = this.datos.marcos.length;
  protected readonly progreso = computed<number>(() => ((this.indice() + 1) / this.total) * 100);

  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor() {
    afterNextRender(() => {
      void this.dibujar();
      this.reanudar();
    });
    inject(DestroyRef).onDestroy(() => this.detener());
  }

  protected alternarPausa(): void {
    if (this.pausado()) this.reanudar();
    else this.detener();
  }

  private reanudar(): void {
    this.detener();
    this.pausado.set(false);
    // Con un solo marco no hace falta rotar
    if (this.total < 2) return;
    this.temporizador = setInterval(() => {
      this.indice.update((i) => (i + 1) % this.total);
      void this.dibujar();
    }, INTERVALO_MARCO_MS);
  }

  private detener(): void {
    if (this.temporizador !== null) clearInterval(this.temporizador);
    this.temporizador = null;
    this.pausado.set(true);
  }

  // El QR siempre es oscuro sobre claro (también en modo oscuro) para que la cámara lo lea
  private async dibujar(): Promise<void> {
    await toCanvas(this.lienzo().nativeElement, this.datos.marcos[this.indice()], {
      errorCorrectionLevel: 'M',
      width: TAMANO_QR_PX,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
  }
}
