// Transferencia de datos por una secuencia de códigos QR (sin servidor).
//
// Un QR admite ~3 KB, así que el texto se comprime (gzip), se pasa a base64 y se
// parte en "marcos" numerados. El emisor los muestra en bucle y el receptor junta
// los que va leyendo, en cualquier orden, hasta tenerlos todos.
//
// Formato de cada marco:  KANE1:<huella>:<indice>:<total>:<datos>
//  - huella: primeros caracteres del SHA-256 del contenido completo. Identifica la
//    transferencia (ignora QR de otra) y verifica que el resultado llegó íntegro.

const PREFIJO_MARCO = 'KANE1';
const SEPARADOR = ':';
const LARGO_HUELLA = 12;
// Caracteres de datos por QR: legible por la cámara de un teléfono a 30-40 cm
export const TAMANO_MARCO = 550;

export interface MarcoQr {
  huella: string;
  indice: number;
  total: number;
  datos: string;
}

// ---------- Codificación ----------
// Bytes respaldados por un ArrayBuffer normal (lo que aceptan Blob y los streams)
type Bytes = Uint8Array<ArrayBuffer>;

async function transformar(bytes: Bytes, flujo: CompressionStream | DecompressionStream): Promise<Bytes> {
  const salida = new Blob([bytes]).stream().pipeThrough(flujo);
  return new Uint8Array(await new Response(salida).arrayBuffer());
}

function aBase64(bytes: Bytes): string {
  let binario = '';
  const BLOQUE = 0x8000;
  for (let i = 0; i < bytes.length; i += BLOQUE) {
    binario += String.fromCharCode(...bytes.subarray(i, i + BLOQUE));
  }
  return btoa(binario);
}

function desdeBase64(texto: string): Bytes {
  const binario = atob(texto);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

async function huellaDe(texto: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, LARGO_HUELLA);
}

// ---------- Emisor ----------
export async function crearMarcos(contenido: string, tamano: number = TAMANO_MARCO): Promise<string[]> {
  const comprimido = aBase64(await transformar(new TextEncoder().encode(contenido), new CompressionStream('gzip')));
  const huella = await huellaDe(comprimido);
  const total = Math.max(1, Math.ceil(comprimido.length / tamano));
  return Array.from({ length: total }, (_, i) =>
    [PREFIJO_MARCO, huella, i, total, comprimido.slice(i * tamano, (i + 1) * tamano)].join(SEPARADOR),
  );
}

// ---------- Receptor ----------
// Interpreta el texto de un QR; null si no es un marco de Kane
export function leerMarco(texto: string): MarcoQr | null {
  const partes = texto.split(SEPARADOR);
  if (partes.length !== 5 || partes[0] !== PREFIJO_MARCO) return null;
  const [, huella, indiceTexto, totalTexto, datos] = partes;
  const indice = Number(indiceTexto);
  const total = Number(totalTexto);
  const valido = Number.isInteger(indice) && Number.isInteger(total) && total > 0 && indice >= 0 && indice < total;
  return valido ? { huella, indice, total, datos } : null;
}

// Junta los marcos de una transferencia. Si llega un marco de otra (otra huella),
// empieza de nuevo con esa.
export class ReceptorQr {
  private huella: string | null = null;
  private total = 0;
  private readonly partes = new Map<number, string>();

  // true si el marco era nuevo
  agregar(marco: MarcoQr): boolean {
    if (marco.huella !== this.huella) {
      this.huella = marco.huella;
      this.total = marco.total;
      this.partes.clear();
    }
    if (this.partes.has(marco.indice)) return false;
    this.partes.set(marco.indice, marco.datos);
    return true;
  }

  get recibidos(): number {
    return this.partes.size;
  }

  get esperados(): number {
    return this.total;
  }

  get completo(): boolean {
    return this.total > 0 && this.partes.size === this.total;
  }

  // Reconstruye el contenido; null si falta algo o la huella no coincide
  async ensamblar(): Promise<string | null> {
    if (!this.completo || !this.huella) return null;
    const comprimido = Array.from({ length: this.total }, (_, i) => this.partes.get(i) ?? '').join('');
    if ((await huellaDe(comprimido)) !== this.huella) return null;
    try {
      const bytes = await transformar(desdeBase64(comprimido), new DecompressionStream('gzip'));
      return new TextDecoder().decode(bytes);
    } catch {
      return null;
    }
  }
}
