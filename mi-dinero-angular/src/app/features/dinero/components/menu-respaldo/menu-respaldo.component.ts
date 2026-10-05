import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';
import { NotificacionService } from '../../../../core/notificacion.service';
import { ICONOS } from '../../../../shared/iconos';
import { leerArchivoJson } from '../../../../shared/utils/archivos';
import { crearMarcos } from '../../../../shared/utils/transferencia-qr';
import {
  contarRespaldo,
  DineroRespaldoService,
  esRespaldoAntiguo,
  esRespaldoDinero,
} from '../../dinero-respaldo.service';
import { TABLAS_DINERO } from '../../dinero.constantes';
import { RespaldoDinero } from '../../dinero.models';

const CONFIG_DIALOGO_QR: MatDialogConfig = {
  width: 'min(28rem, calc(100vw - 2rem))',
  maxHeight: '92vh',
  enterAnimationDuration: '220ms',
  exitAnimationDuration: '160ms',
  panelClass: 'kane-dialogo',
};

function resumenRespaldo(respaldo: RespaldoDinero): string {
  const conteo = contarRespaldo(respaldo);
  return (
    `${conteo[TABLAS_DINERO.cuentas]} cuentas, ${conteo[TABLAS_DINERO.movimientos]} movimientos, ` +
    `${conteo[TABLAS_DINERO.deudas]} deudas, ${conteo[TABLAS_DINERO.gastosFijos]} gastos fijos ` +
    `y ${conteo[TABLAS_DINERO.categoriasGrandes]} categorías`
  );
}

// Menú del encabezado para respaldar los datos: archivo JSON o transferencia por QR
// (escritorio -> móvil, sin servidor). Los diálogos de QR se cargan bajo demanda.
@Component({
  selector: 'app-menu-respaldo',
  imports: [MatMenuModule, FaIconComponent],
  templateUrl: './menu-respaldo.component.html',
})
export class MenuRespaldoComponent {
  private readonly respaldo = inject(DineroRespaldoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly dialogo = inject(MatDialog);

  private readonly selectorArchivo = viewChild.required<ElementRef<HTMLInputElement>>('selectorArchivo');

  protected readonly iconos = ICONOS;
  protected readonly ocupado = signal(false);

  // ---------- JSON ----------
  protected async exportar(): Promise<void> {
    this.ocupado.set(true);
    const error = await this.respaldo.exportar();
    this.ocupado.set(false);
    if (error) void this.notificacion.error(error);
  }

  protected elegirArchivo(): void {
    this.selectorArchivo().nativeElement.click();
  }

  protected async importarArchivo(): Promise<void> {
    const entrada = this.selectorArchivo().nativeElement;
    const archivo = entrada.files?.[0];
    // Se limpia para que elegir el mismo archivo otra vez vuelva a disparar el cambio
    entrada.value = '';
    if (!archivo) return;
    await this.importar(await leerArchivoJson(archivo));
  }

  // ---------- QR ----------
  protected async enviarPorQr(): Promise<void> {
    this.ocupado.set(true);
    const resultado = await this.respaldo.construir();
    if (!resultado.ok) {
      this.ocupado.set(false);
      void this.notificacion.error(resultado.error);
      return;
    }
    const [marcos, { EnviarQrDialogComponent }] = await Promise.all([
      crearMarcos(JSON.stringify(resultado.valor)),
      import('../transferencia-qr/enviar-qr-dialog.component'),
    ]);
    this.ocupado.set(false);
    this.dialogo.open(EnviarQrDialogComponent, {
      ...CONFIG_DIALOGO_QR,
      data: { marcos, resumen: `Incluye ${resumenRespaldo(resultado.valor)}.` },
    });
  }

  protected async recibirPorQr(): Promise<void> {
    const { RecibirQrDialogComponent } = await import('../transferencia-qr/recibir-qr-dialog.component');
    const ref = this.dialogo.open(RecibirQrDialogComponent, { ...CONFIG_DIALOGO_QR, disableClose: true });
    const texto = await firstValueFrom(ref.afterClosed());
    if (texto === undefined) return;
    let contenido: unknown = null;
    try {
      contenido = JSON.parse(texto);
    } catch {
      contenido = null;
    }
    await this.importar(contenido);
  }

  // ---------- Importación común (archivo o QR) ----------
  private async importar(contenido: unknown): Promise<void> {
    if (esRespaldoAntiguo(contenido)) {
      await this.notificacion.aviso(
        'Respaldo antiguo',
        'Este respaldo es de una versión anterior (sin cuentas) y no se puede importar. ' +
          'Exporta uno nuevo desde la versión actual.',
      );
      return;
    }
    if (!esRespaldoDinero(contenido)) {
      await this.notificacion.aviso('Respaldo no válido', 'El contenido no es un respaldo de Kane.');
      return;
    }

    const confirmado = await this.notificacion.confirmar(
      `El respaldo contiene ${resumenRespaldo(contenido)}.\n\n` +
        'Importarlo REEMPLAZARÁ todos tus datos actuales. Antes se descargará automáticamente ' +
        'una copia de seguridad de lo que tienes ahora.',
      { titulo: '¿Reemplazar tus datos?', textoConfirmar: 'Importar y reemplazar', peligro: true },
    );
    if (!confirmado) return;

    this.ocupado.set(true);
    const error = await this.respaldo.importar(contenido);
    this.ocupado.set(false);
    if (error) {
      void this.notificacion.error(error);
      return;
    }
    this.notificacion.informar('Datos importados correctamente');
  }
}
