// Paleta categórica de la app (definida en styles.css para cada tema) y claves de color.
// El orden de la paleta es fijo: está validado para que colores vecinos se distingan
// también con daltonismo.

// Posición en la paleta; se pinta como var(--serie-N)
export type SlotColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const SLOTS_COLOR: readonly SlotColor[] = [1, 2, 3, 4, 5, 6, 7, 8];

// Clave de color guardable: 'serie-N' (paleta, se adapta al tema) o '#rrggbb' (color libre)
const PATRON_COLOR_SERIE = /^serie-([1-8])$/;
const PATRON_COLOR_HEX = /^#[0-9a-fA-F]{6}$/;

export function colorDeSlot(slot: SlotColor): string {
  return `var(--serie-${slot})`;
}

export function claveColorDeSlot(slot: SlotColor): string {
  return `serie-${slot}`;
}

export function slotDeClaveColor(clave: string | null): SlotColor | null {
  const coincidencia = clave?.match(PATRON_COLOR_SERIE);
  const slot = coincidencia ? Number(coincidencia[1]) : NaN;
  return SLOTS_COLOR.find((s) => s === slot) ?? null;
}

export function esColorHex(valor: string): boolean {
  return PATRON_COLOR_HEX.test(valor);
}

export function esClaveColor(valor: unknown): valor is string {
  return typeof valor === 'string' && (PATRON_COLOR_SERIE.test(valor) || PATRON_COLOR_HEX.test(valor));
}

// CSS que pinta una clave de color, o null si la clave no es válida
export function resolverColor(clave: string | null): string | null {
  if (!esClaveColor(clave)) return null;
  const slot = slotDeClaveColor(clave);
  return slot ? colorDeSlot(slot) : clave;
}
