// Configuración y módulos de Angular Material compartidos por los formularios de Kane

import { Provider } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldDefaultOptions, MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AdaptadorFechaLocal, FORMATOS_FECHA } from '../../core/adaptador-fecha';
import { LOCALE } from '../../core/constantes';

// Lo que necesita cualquier formulario: campo, input y select
export const MATERIAL_FORMULARIOS = [MatFormFieldModule, MatInputModule, MatSelectModule] as const;

const OPCIONES_CAMPO: MatFormFieldDefaultOptions = {
  appearance: 'outline',
  // El espacio para mensajes solo aparece cuando hay uno (formularios más compactos)
  subscriptSizing: 'dynamic',
};

// Se registran en las vistas que usan formularios (y no en app.config) para que
// Material solo se descargue al entrar a ellas.
export const PROVEEDORES_FORMULARIOS: Provider[] = [
  { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: OPCIONES_CAMPO },
  { provide: MAT_DATE_LOCALE, useValue: LOCALE },
  { provide: DateAdapter, useClass: AdaptadorFechaLocal },
  { provide: MAT_DATE_FORMATS, useValue: FORMATOS_FECHA },
];
