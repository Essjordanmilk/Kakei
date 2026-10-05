// Constantes globales de la aplicación

export const NOMBRE_APP = 'Kane';
// 金 (kane): "dinero" en japonés
export const LOGO_APP = '金';
export const ESLOGAN_APP = 'Tu dinero, en orden';

export const LOCALE = 'es-CO';

export const RUTAS = {
  inicio: '/',
  auth: '/auth',
} as const;

// Debe coincidir con el script inline de src/index.html que aplica el tema antes de arrancar
export const PREFIJO_ALMACENAMIENTO = 'kane:';
// Prefijo que usaba la app antes de llamarse Kane: sus datos se migran una vez
export const PREFIJO_ALMACENAMIENTO_LEGADO = 'mi-vida:';

export const CLAVES_ALMACENAMIENTO = {
  tema: 'tema',
  preferenciasDinero: 'dinero:preferencias',
  cacheDinero: (usuarioId: string): string => `dinero:cache:${usuarioId}`,
} as const;

export const ATRIBUTO_TEMA = 'tema';

// Duración de la transición de colores al cambiar de tema (ms)
export const DURACION_TRANSICION_TEMA = 350;
