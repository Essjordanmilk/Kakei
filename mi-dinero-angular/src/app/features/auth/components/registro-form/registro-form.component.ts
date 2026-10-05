import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatSelectChange } from '@angular/material/select';
import { Moneda, MONEDA_POR_DEFECTO, MONEDAS, PerfilRegistro } from '../../../../core/auth.models';
import { fechaHoyIso } from '../../../../core/utils';
import { AuthService } from '../../../../core/auth.service';
import {
  emailValido,
  EvaluacionPassword,
  evaluarPassword,
  telefonoValido,
} from '../../../../core/validacion';
import { CampoFechaComponent } from '../../../../shared/components/campo-fecha/campo-fecha.component';
import { MATERIAL_FORMULARIOS } from '../../../../shared/material/material';
import { FuerzaPasswordComponent } from '../fuerza-password/fuerza-password.component';
import { PasswordInputComponent } from '../password-input/password-input.component';

type CampoRegistro = 'nombres' | 'apellidos' | 'email' | 'telefono' | 'password' | 'confirmar';

type ErroresRegistro = Partial<Record<CampoRegistro, string>>;

const CAMPOS_REGISTRO: readonly CampoRegistro[] = [
  'nombres',
  'apellidos',
  'email',
  'telefono',
  'password',
  'confirmar',
];

const SIN_ERROR: ErrorStateMatcher = { isErrorState: () => false };

const MENSAJE_REGISTRO_EXITOSO =
  'Cuenta creada correctamente. Revisa tu correo para confirmarla e inicia sesión.';

@Component({
  selector: 'app-registro-form',
  imports: [FormsModule, ...MATERIAL_FORMULARIOS, CampoFechaComponent, PasswordInputComponent, FuerzaPasswordComponent],
  templateUrl: './registro-form.component.html',
  styleUrl: './registro-form.component.css',
})
export class RegistroFormComponent {
  private readonly auth = inject(AuthService);

  // Emite el mensaje de éxito para que la vista vuelva al login y lo muestre
  readonly registrado = output<string>();

  protected readonly monedas = MONEDAS;
  protected readonly hoy = fechaHoyIso();

  protected readonly nombres = signal('');
  protected readonly apellidos = signal('');
  protected readonly email = signal('');
  protected readonly telefono = signal('');
  protected readonly password = signal('');
  protected readonly confirmar = signal('');
  protected readonly fechaNacimiento = signal('');
  protected readonly ciudad = signal('');
  protected readonly moneda = signal<Moneda>(MONEDA_POR_DEFECTO);
  protected readonly objetivo = signal('');

  protected readonly error = signal('');
  protected readonly enviando = signal(false);
  private readonly tocados = signal<ReadonlySet<CampoRegistro>>(new Set());

  // Evaluación de la contraseña en tiempo real
  protected readonly evaluacion = computed<EvaluacionPassword>(() => evaluarPassword(this.password()));

  private readonly errores = computed<ErroresRegistro>(() => {
    const e: ErroresRegistro = {};
    if (!this.nombres().trim()) e.nombres = 'El nombre es obligatorio.';
    if (!this.apellidos().trim()) e.apellidos = 'Los apellidos son obligatorios.';
    if (!this.email().trim()) e.email = 'El correo es obligatorio.';
    else if (!emailValido(this.email())) e.email = 'El correo no es válido.';
    if (!this.telefono().trim()) e.telefono = 'El teléfono es obligatorio.';
    else if (!telefonoValido(this.telefono())) e.telefono = 'Teléfono no válido (7-15 dígitos).';
    if (!this.password()) e.password = 'La contraseña es obligatoria.';
    else if (!this.evaluacion().cumpleRequisitos) {
      e.password = 'La contraseña no es lo suficientemente segura.';
    }
    if (!this.confirmar()) e.confirmar = 'Confirma tu contraseña.';
    else if (this.confirmar() !== this.password()) e.confirmar = 'Las contraseñas no coinciden.';
    return e;
  });

  // Solo se muestran los errores de campos que el usuario ya visitó (o tras intentar enviar)
  protected readonly erroresVisibles = computed<ErroresRegistro>(() => {
    const errores = this.errores();
    const tocados = this.tocados();
    const visibles: ErroresRegistro = {};
    for (const campo of CAMPOS_REGISTRO) {
      if (tocados.has(campo) && errores[campo]) visibles[campo] = errores[campo];
    }
    return visibles;
  });

  // Un matcher por campo: marca el mat-form-field en rojo cuando su error es visible
  private readonly matchers = new Map<CampoRegistro, ErrorStateMatcher>(
    CAMPOS_REGISTRO.map((campo) => [campo, { isErrorState: () => !!this.erroresVisibles()[campo] }]),
  );

  protected matcher(campo: CampoRegistro): ErrorStateMatcher {
    return this.matchers.get(campo) ?? SIN_ERROR;
  }

  protected cambiarMoneda(evento: MatSelectChange): void {
    const moneda = MONEDAS.find((m) => m === evento.value);
    if (moneda) this.moneda.set(moneda);
  }

  protected marcarTocado(campo: CampoRegistro): void {
    this.tocados.update((actuales) => new Set(actuales).add(campo));
  }

  protected async enviar(): Promise<void> {
    this.error.set('');
    const primerError = CAMPOS_REGISTRO.map((campo) => this.errores()[campo]).find(Boolean);
    if (primerError) {
      this.tocados.set(new Set(CAMPOS_REGISTRO));
      this.error.set(primerError);
      return;
    }

    this.enviando.set(true);
    const error = await this.auth.crearCuenta(this.email().trim(), this.password(), this.construirPerfil());
    this.enviando.set(false);
    if (error) {
      this.error.set(error);
      return;
    }
    this.registrado.emit(MENSAJE_REGISTRO_EXITOSO);
  }

  private construirPerfil(): PerfilRegistro {
    return {
      nombres: this.nombres().trim(),
      apellidos: this.apellidos().trim(),
      telefono: this.telefono().trim(),
      fecha_nacimiento: this.fechaNacimiento() || null,
      ciudad: this.ciudad().trim() || null,
      moneda_preferida: this.moneda(),
      objetivo_principal: this.objetivo().trim() || null,
    };
  }
}
