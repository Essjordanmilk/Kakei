import { inject, Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { DatosDialogo, DialogoComponent } from '../shared/components/dialogo/dialogo.component';

export interface OpcionesConfirmacion {
  titulo?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  peligro?: boolean;
}

const DURACION_AVISO_MS = 3500;

// Entrada en escala + fade y salida más corta (las animaciones de MatDialog)
const CONFIG_DIALOGO: MatDialogConfig = {
  width: 'min(26rem, calc(100vw - 2rem))',
  enterAnimationDuration: '220ms',
  exitAnimationDuration: '160ms',
  autoFocus: 'dialog',
  panelClass: 'kane-dialogo',
};

// Punto único para avisos y confirmaciones al usuario:
//  - confirmar / error -> diálogo de Angular Material
//  - informar          -> snackbar (avisos breves que no requieren respuesta)
@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private readonly dialogo = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  informar(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', {
      duration: DURACION_AVISO_MS,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: 'kane-snackbar',
    });
  }

  async error(detalle: string): Promise<void> {
    await this.abrir({ tipo: 'error', titulo: 'Algo salió mal', mensaje: detalle });
  }

  async aviso(titulo: string, mensaje: string): Promise<void> {
    await this.abrir({ tipo: 'aviso', titulo, mensaje });
  }

  // Resuelve true solo si el usuario pulsa el botón de confirmar
  async confirmar(mensaje: string, opciones: OpcionesConfirmacion = {}): Promise<boolean> {
    const resultado = await this.abrir({
      tipo: 'confirmar',
      titulo: opciones.titulo ?? '¿Estás seguro?',
      mensaje,
      textoConfirmar: opciones.textoConfirmar,
      textoCancelar: opciones.textoCancelar,
      peligro: opciones.peligro,
    });
    return resultado === true;
  }

  // Confirmación de borrado: botón rojo "Eliminar"
  confirmarEliminacion(mensaje: string, titulo = '¿Eliminar?'): Promise<boolean> {
    return this.confirmar(mensaje, { titulo, textoConfirmar: 'Eliminar', peligro: true });
  }

  private abrir(datos: DatosDialogo): Promise<boolean | undefined> {
    const ref = this.dialogo.open<DialogoComponent, DatosDialogo, boolean>(DialogoComponent, {
      ...CONFIG_DIALOGO,
      data: datos,
    });
    return firstValueFrom(ref.afterClosed());
  }
}
