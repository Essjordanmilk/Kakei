import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { emailValido, evaluarPassword, telefonoValido } from '../../core/validacion';

@Component({
  selector: 'app-auth',
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css',
})
export class AuthComponent {
  protected readonly auth = inject(AuthService);

  protected readonly modo = signal<'login' | 'registro'>('login');
  protected readonly modoRegistro = computed(() => this.modo() === 'registro');

  // ---------- LOGIN ----------
  protected readonly loginEmail = signal('');
  protected readonly loginPassword = signal('');
  protected readonly loginError = signal('');
  protected readonly mostrarLoginPassword = signal(false);

  // ---------- REGISTRO ----------
  protected readonly regNombres = signal('');
  protected readonly regApellidos = signal('');
  protected readonly regEmail = signal('');
  protected readonly regTelefono = signal('');
  protected readonly regPassword = signal('');
  protected readonly regConfirmar = signal('');
  protected readonly regFechaNacimiento = signal('');
  protected readonly regCiudad = signal('');
  protected readonly regMoneda = signal('COP');
  protected readonly regObjetivo = signal('');
  protected readonly regError = signal('');
  protected readonly regExito = signal('');
  protected readonly mostrarRegPassword = signal(false);
  protected readonly mostrarRegConfirmar = signal(false);

  protected readonly monedas = ['COP', 'USD', 'EUR', 'MXN', 'ARS', 'CLP', 'PEN'];

  // Evaluación de la contraseña en tiempo real
  protected readonly evalPassword = computed(() => evaluarPassword(this.regPassword()));

  // ============ LOGIN ============
  protected alternarModo(): void {
    this.modo.update((m) => (m === 'login' ? 'registro' : 'login'));
    this.loginError.set('');
    this.regError.set('');
    this.regExito.set('');
  }

  protected async enviarLogin(): Promise<void> {
    this.loginError.set('');
    const email = this.loginEmail().trim();
    const password = this.loginPassword();

    if (!email || !password) {
      this.loginError.set('Completa correo y contraseña.');
      return;
    }
    if (!emailValido(email)) {
      this.loginError.set('El correo no tiene un formato válido.');
      return;
    }
    if (password.length < 6) {
      this.loginError.set('La contraseña es demasiado corta.');
      return;
    }

    const error = await this.auth.iniciarSesion(email, password);
    if (error) this.loginError.set(this.mensajeLogin(error));
  }

  // Traduce errores comunes de Supabase a mensajes amigables
  private mensajeLogin(error: string): string {
    const e = error.toLowerCase();
    if (e.includes('invalid login') || e.includes('invalid email or password')) {
      return 'Usuario o contraseña incorrectos.';
    }
    if (e.includes('email not confirmed')) {
      return 'Debes confirmar tu correo antes de entrar. Revisa tu bandeja.';
    }
    if (e.includes('too many')) {
      return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
    }
    return error;
  }

  // ============ REGISTRO ============
  // Errores por campo (solo se muestran tras intentar enviar o al perder foco)
  protected readonly erroresRegistro = computed(() => {
    const e: Record<string, string> = {};
    if (!this.regNombres().trim()) e['nombres'] = 'El nombre es obligatorio.';
    if (!this.regApellidos().trim()) e['apellidos'] = 'Los apellidos son obligatorios.';
    if (!this.regEmail().trim()) e['email'] = 'El correo es obligatorio.';
    else if (!emailValido(this.regEmail())) e['email'] = 'El correo no es válido.';
    if (!this.regTelefono().trim()) e['telefono'] = 'El teléfono es obligatorio.';
    else if (!telefonoValido(this.regTelefono())) e['telefono'] = 'Teléfono no válido (7-15 dígitos).';
    if (!this.regPassword()) e['password'] = 'La contraseña es obligatoria.';
    else if (!this.evalPassword().cumpleRequisitos)
      e['password'] = 'La contraseña no es lo suficientemente segura.';
    if (this.regConfirmar() && this.regConfirmar() !== this.regPassword())
      e['confirmar'] = 'Las contraseñas no coinciden.';
    return e;
  });

  protected readonly registroValido = computed(() => Object.keys(this.erroresRegistro()).length === 0);

  protected async enviarRegistro(): Promise<void> {
    this.regError.set('');
    this.regExito.set('');

    if (!this.registroValido()) {
      const primerError = Object.values(this.erroresRegistro())[0];
      this.regError.set(primerError || 'Revisa los campos resaltados.');
      return;
    }

    const perfil = {
      nombres: this.regNombres().trim(),
      apellidos: this.regApellidos().trim(),
      telefono: this.regTelefono().trim(),
      fecha_nacimiento: this.regFechaNacimiento() || null,
      ciudad: this.regCiudad().trim() || null,
      moneda_preferida: this.regMoneda(),
      objetivo_principal: this.regObjetivo().trim() || null,
    };

    const error = await this.auth.crearCuenta(this.regEmail().trim(), this.regPassword(), perfil);
    if (error) {
      this.regError.set(this.mensajeRegistro(error));
      return;
    }

    this.regExito.set(
      'Cuenta creada correctamente. Revisa tu correo para confirmarla e inicia sesión.',
    );
    this.limpiarRegistro();
    this.modo.set('login');
  }

  private mensajeRegistro(error: string): string {
    const e = error.toLowerCase();
    if (e.includes('already registered') || e.includes('user already exists')) {
      return 'Este correo ya está registrado. Inicia sesión.';
    }
    if (e.includes('password should be')) {
      return 'La contraseña no cumple los requisitos mínimos.';
    }
    if (e.includes('invalid email')) return 'El correo no es válido.';
    return error;
  }

  private limpiarRegistro(): void {
    this.regNombres.set('');
    this.regApellidos.set('');
    this.regEmail.set('');
    this.regTelefono.set('');
    this.regPassword.set('');
    this.regConfirmar.set('');
    this.regFechaNacimiento.set('');
    this.regCiudad.set('');
    this.regMoneda.set('COP');
    this.regObjetivo.set('');
  }
}
