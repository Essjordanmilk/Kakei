// Utilidad para detectar cambios sin guardar en formularios, de forma
// reutilizable por todos los modales.

// Firma estable de un borrador; el orden de las claves debe ser el mismo al
// comparar. Los valores deben ser serializables con JSON.stringify.
export function firmaFormulario(valor: unknown): string {
  return JSON.stringify(valor);
}
