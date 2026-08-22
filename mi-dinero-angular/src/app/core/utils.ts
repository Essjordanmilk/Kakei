// Utilidades compartidas migradas de los app.js originales

export function formatoMoneda(numero: number | null | undefined): string {
  const n = Number(numero) || 0;
  return '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

export function mesActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

export function fechaHoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatoFecha(fechaIso: string): string {
  const [a, m, d] = fechaIso.split('-');
  return `${d}/${m}/${a}`;
}

export function diaSemanaIso(fechaIso: string): number {
  // 0=domingo ... 6=sábado, usando la fecha como local (evita desfase UTC)
  const [a, m, d] = fechaIso.split('-').map(Number);
  return new Date(a, m - 1, d).getDay();
}

export function formatoFechaLarga(fechaIso: string): string {
  const [a, m, d] = fechaIso.split('-').map(Number);
  const fecha = new Date(a, m - 1, d);
  return fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function escapeHtml(texto: string | null | undefined): string {
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}
