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
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatProgressBar } from '@angular/material/progress-bar';
import jsQR from 'jsqr';
import { leerMarco, ReceptorQr } from '../../../../shared/utils/transferencia-qr';

// El diálogo se cierra con el contenido recibido (texto JSON) o sin nada si se cancela
export type ResultadoRecibirQr = string | undefined;

type EstadoCamara = 'iniciando' | 'escaneando' | 'procesando' | 'error';

// Se analiza como máximo un cuadro cada este tiempo (ahorra batería y CPU)
const INTERVALO_LECTURA_MS = 100;
// Lado máximo de la imagen que se analiza: más grande es más lento sin leer mejor
const LADO_ANALISIS_PX = 640;

// Escanea con la cámara la secuencia de QR que muestra el escritorio
// (EnviarQrDialogComponent) y devuelve el respaldo reconstruido.
@Component({
  selector: 'app-recibir-qr-dialog',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButton, MatProgressBar],
  templateUrl: './recibir-qr-dialog.component.html',
  styleUrl: './transferencia-qr.css',
})
export class RecibirQrDialogComponent {
  private readonly ref = inject<MatDialogRef<RecibirQrDialogComponent, ResultadoRecibirQr>>(MatDialogRef);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  protected readonly estado = signal<EstadoCamara>('iniciando');
  protected readonly mensajeError = signal('');
  protected readonly recibidos = signal(0);
  protected readonly esperados = signal(0);

  protected readonly progreso = computed<number>(() => {
    const esperados = this.esperados();
    return esperados > 0 ? (this.recibidos() / esperados) * 100 : 0;
  });

  private readonly receptor = new ReceptorQr();
  private readonly lienzo = document.createElement('canvas');
  private flujo: MediaStream | null = null;
  private cuadro: number | null = null;
  private ultimaLectura = 0;

  constructor() {
    afterNextRender(() => void this.iniciarCamara());
    inject(DestroyRef).onDestroy(() => this.detenerCamara());
  }

  private async iniciarCamara(): Promise<void> {
    // La cámara solo está disponible en HTTPS (o localhost)
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.fallar('Tu navegador no permite usar la cámara aquí. Abre Kane desde una dirección https.');
      return;
    }
    try {
      this.flujo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch {
      this.fallar('No se pudo acceder a la cámara. Revisa el permiso del navegador e inténtalo de nuevo.');
      return;
    }
    const video = this.video().nativeElement;
    video.srcObject = this.flujo;
    await video.play();
    this.estado.set('escaneando');
    this.cuadro = requestAnimationFrame((t) => this.analizar(t));
  }

  private analizar(tiempo: number): void {
    if (this.estado() !== 'escaneando') return;
    this.cuadro = requestAnimationFrame((t) => this.analizar(t));
    if (tiempo - this.ultimaLectura < INTERVALO_LECTURA_MS) return;
    this.ultimaLectura = tiempo;

    const texto = this.leerCuadro();
    const marco = texto ? leerMarco(texto) : null;
    if (!marco || !this.receptor.agregar(marco)) return;

    this.recibidos.set(this.receptor.recibidos);
    this.esperados.set(this.receptor.esperados);
    if (this.receptor.completo) void this.finalizar();
  }

  private leerCuadro(): string | null {
    const video = this.video().nativeElement;
    if (video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0) return null;
    const escala = Math.min(1, LADO_ANALISIS_PX / Math.max(video.videoWidth, video.videoHeight));
    const ancho = Math.round(video.videoWidth * escala);
    const alto = Math.round(video.videoHeight * escala);
    this.lienzo.width = ancho;
    this.lienzo.height = alto;
    const contexto = this.lienzo.getContext('2d', { willReadFrequently: true });
    if (!contexto) return null;
    contexto.drawImage(video, 0, 0, ancho, alto);
    const imagen = contexto.getImageData(0, 0, ancho, alto);
    return jsQR(imagen.data, ancho, alto, { inversionAttempts: 'dontInvert' })?.data ?? null;
  }

  private async finalizar(): Promise<void> {
    this.estado.set('procesando');
    this.detenerCamara();
    const contenido = await this.receptor.ensamblar();
    if (contenido === null) {
      this.fallar('Los datos llegaron incompletos o dañados. Vuelve a intentarlo.');
      return;
    }
    this.ref.close(contenido);
  }

  private fallar(mensaje: string): void {
    this.detenerCamara();
    this.mensajeError.set(mensaje);
    this.estado.set('error');
  }

  private detenerCamara(): void {
    if (this.cuadro !== null) cancelAnimationFrame(this.cuadro);
    this.cuadro = null;
    this.flujo?.getTracks().forEach((pista) => pista.stop());
    this.flujo = null;
  }
}
