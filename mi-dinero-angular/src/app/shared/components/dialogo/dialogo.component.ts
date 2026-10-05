import { Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { ICONOS } from '../../iconos';

export type TipoDialogo = 'confirmar' | 'aviso' | 'error';

export interface DatosDialogo {
  tipo: TipoDialogo;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  // Acciones destructivas (eliminar, reemplazar datos): el botón se pinta en rojo
  peligro?: boolean;
}

const ICONO_POR_TIPO: Record<TipoDialogo, IconDefinition> = {
  confirmar: ICONOS.pregunta,
  aviso: ICONOS.informacion,
  error: ICONOS.alerta,
};

// Diálogo genérico de Material para confirmaciones, avisos y errores.
// Devuelve true al cerrarse con el botón principal (ver NotificacionService).
@Component({
  selector: 'app-dialogo',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButton, FaIconComponent],
  templateUrl: './dialogo.component.html',
  styleUrl: './dialogo.component.css',
})
export class DialogoComponent {
  protected readonly datos = inject<DatosDialogo>(MAT_DIALOG_DATA);

  protected readonly icono = ICONO_POR_TIPO[this.datos.tipo];
  protected readonly conCancelar = this.datos.tipo === 'confirmar';
  protected readonly textoConfirmar = computed<string>(
    () => this.datos.textoConfirmar ?? (this.conCancelar ? 'Confirmar' : 'Entendido'),
  );
}
