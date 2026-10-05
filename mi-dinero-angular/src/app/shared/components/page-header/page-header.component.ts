import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { AuthService } from '../../../core/auth.service';
import { LOGO_APP, NOMBRE_APP, RUTAS } from '../../../core/constantes';
import { ICONOS } from '../../iconos';
import { BotonTemaComponent } from '../boton-tema/boton-tema.component';

// Barra superior: marca Kane (vuelve al dashboard), acciones proyectadas,
// interruptor de tema y cerrar sesión
@Component({
  selector: 'app-page-header',
  imports: [RouterLink, FaIconComponent, BotonTemaComponent],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.css',
})
export class PageHeaderComponent {
  private readonly auth = inject(AuthService);

  protected readonly rutaInicio = RUTAS.inicio;
  protected readonly nombreApp = NOMBRE_APP;
  protected readonly logo = LOGO_APP;
  protected readonly iconos = ICONOS;

  protected async salir(): Promise<void> {
    await this.auth.cerrarSesion();
  }
}
