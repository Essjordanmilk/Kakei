// Utilidades de validación para login y registro.
// Centralizadas para reutilizarse en el feature de autenticación.

export type NivelPassword = 'muy-debil' | 'debil' | 'media' | 'fuerte' | 'muy-fuerte';

export interface EvaluacionPassword {
  puntuacion: number; // 0 - 100
  nivel: NivelPassword;
  etiqueta: string;
  recomendaciones: string[]; // lo que FALTA por cumplir
  cumpleRequisitos: boolean; // longitud + mayúscula + minúscula + número + símbolo
}

const RECOMENDACIONES_BASE = {
  longitud: 'Usa al menos 8 caracteres',
  minuscula: 'Incluye al menos una minúscula (a-z)',
  mayuscula: 'Incluye al menos una mayúscula (A-Z)',
  numero: 'Incluye al menos un número (0-9)',
  simbolo: 'Incluye al menos un símbolo (!@#$%^&*)',
} as const;

export function evaluarPassword(pw: string): EvaluacionPassword {
  const faltantes: string[] = [];
  if (pw.length < 8) faltantes.push(RECOMENDACIONES_BASE.longitud);
  if (!/[a-z]/.test(pw)) faltantes.push(RECOMENDACIONES_BASE.minuscula);
  if (!/[A-Z]/.test(pw)) faltantes.push(RECOMENDACIONES_BASE.mayuscula);
  if (!/[0-9]/.test(pw)) faltantes.push(RECOMENDACIONES_BASE.numero);
  if (!/[^A-Za-z0-9]/.test(pw)) faltantes.push(RECOMENDACIONES_BASE.simbolo);

  let puntos = 0;
  if (pw.length >= 8) puntos += 20;
  if (pw.length >= 12) puntos += 10;
  if (/[a-z]/.test(pw)) puntos += 15;
  if (/[A-Z]/.test(pw)) puntos += 15;
  if (/[0-9]/.test(pw)) puntos += 20;
  if (/[^A-Za-z0-9]/.test(pw)) puntos += 20;
  if (/(.)\1\1/.test(pw)) puntos -= 10; // penaliza repetición excesiva
  puntos = Math.max(0, Math.min(100, puntos));

  let nivel: NivelPassword = 'muy-debil';
  let etiqueta = 'Muy débil';
  if (puntos >= 80) {
    nivel = 'muy-fuerte';
    etiqueta = 'Muy fuerte';
  } else if (puntos >= 60) {
    nivel = 'fuerte';
    etiqueta = 'Fuerte';
  } else if (puntos >= 40) {
    nivel = 'media';
    etiqueta = 'Media';
  } else if (puntos >= 20) {
    nivel = 'debil';
    etiqueta = 'Débil';
  }

  const cumpleRequisitos =
    pw.length >= 8 &&
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw);

  return { puntuacion: puntos, nivel, etiqueta, recomendaciones: faltantes, cumpleRequisitos };
}

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValido(email: string): boolean {
  return REGEX_EMAIL.test(email.trim());
}

// Teléfono: 7 a 15 dígitos, admite + y espacios/guiones.
export function telefonoValido(telefono: string): boolean {
  const limpio = telefono.replace(/[\s-]/g, '');
  return /^\+?\d{7,15}$/.test(limpio);
}
