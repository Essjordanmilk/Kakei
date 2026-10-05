import { Component, input, model, output, signal } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ICONOS } from '../../../../shared/iconos';
import { MATERIAL_FORMULARIOS } from '../../../../shared/material/material';

export type AutocompletePassword = 'current-password' | 'new-password';

// Campo de contraseña (mat-form-field) con botón para mostrar/ocultar. Uso: [(valor)]="password"
@Component({
  selector: 'app-password-input',
  imports: [...MATERIAL_FORMULARIOS, MatIconButton, FaIconComponent],
  templateUrl: './password-input.component.html',
})
export class PasswordInputComponent {
  readonly valor = model.required<string>();
  readonly etiqueta = input.required<string>();
  readonly placeholder = input<string>('');
  readonly autocomplete = input<AutocompletePassword>('current-password');
  // Mensaje de error a mostrar bajo el campo ('' = sin error)
  readonly error = input<string>('');

  // Se emite al perder el foco, para validar el campo solo cuando el usuario ya lo usó
  readonly tocado = output<void>();

  protected readonly iconos = ICONOS;
  protected readonly visible = signal(false);
  protected readonly estadoError: ErrorStateMatcher = { isErrorState: () => !!this.error() };

  protected alternarVisibilidad(): void {
    this.visible.update((visible) => !visible);
  }
}
