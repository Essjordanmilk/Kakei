-- ===========================================================================
--  KANE · Gastos fijos automáticos, presupuesto por monto y categorías visuales
--  Requiere haber ejecutado antes supabase/cuentas.sql (multicuenta).
--  Ejecuta este bloque completo en el SQL Editor de Supabase.
--
--  Qué hace:
--   1. Categorías: presupuesto mensual en pesos (reemplaza el % del ingreso,
--      convirtiendo el valor actual), color e icono personalizables.
--   2. Gastos fijos: día del mes en que se aplican automáticamente y fecha
--      desde la que aplica (para no cobrar meses anteriores al activarlo).
--   3. Pagos de gastos fijos: un registro por gasto y mes (evita que dos
--      dispositivos apliquen el mismo gasto dos veces) y marca de "omitido".
--
--  Todo corre en una transacción y se puede ejecutar más de una vez.
-- ===========================================================================

begin;

-- 0. Verificación: la conversión del presupuesto cruza configuracion y categorías por usuario
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'cuentas') then
    raise exception 'Falta la tabla cuentas: ejecuta primero supabase/cuentas.sql.';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'configuracion' and column_name = 'user_id') then
    raise exception 'La tabla public.configuracion no tiene la columna user_id; revisa el script antes de continuar.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Categorías
-- ---------------------------------------------------------------------------
alter table public.categorias_grandes
  add column if not exists presupuesto_mensual numeric not null default 0 check (presupuesto_mensual >= 0),
  add column if not exists color text,
  add column if not exists icono text;

-- '#rrggbb' (color libre) o 'serie-N' (paleta de la app, se adapta al tema)
alter table public.categorias_grandes drop constraint if exists categorias_grandes_color_check;
alter table public.categorias_grandes add constraint categorias_grandes_color_check
  check (color is null or color ~ '^#[0-9a-fA-F]{6}$' or color ~ '^serie-[1-8]$');

-- El presupuesto pasa de % del ingreso mensual a un monto fijo: se convierte una
-- sola vez con el ingreso que tenía configurado cada usuario
update public.categorias_grandes c
set presupuesto_mensual = round(cf.ingreso_mensual * c.porcentaje / 100)
from public.configuracion cf
where cf.user_id = c.user_id
  and c.tipo = 'GASTO'
  and c.presupuesto_mensual = 0
  and c.porcentaje > 0
  and cf.ingreso_mensual > 0;

-- El porcentaje ya no es obligatorio
alter table public.categorias_grandes alter column porcentaje set default 0;

-- ---------------------------------------------------------------------------
-- 2. Gastos fijos recurrentes
-- ---------------------------------------------------------------------------
alter table public.gastos_fijos
  add column if not exists dia_aplicacion smallint check (dia_aplicacion between 1 and 31),
  add column if not exists aplicar_desde date not null default current_date;

comment on column public.gastos_fijos.dia_aplicacion is
  'Día del mes en que la app registra el gasto automáticamente (null = solo manual).';
comment on column public.gastos_fijos.aplicar_desde is
  'No se aplican automáticamente fechas anteriores a esta.';

-- ---------------------------------------------------------------------------
-- 3. Pagos de gastos fijos: uno por gasto y mes
-- ---------------------------------------------------------------------------
alter table public.gastos_fijos_pagos
  add column if not exists omitido boolean not null default false;

comment on column public.gastos_fijos_pagos.omitido is
  'true = el usuario desmarcó el pago de ese mes; la app no lo vuelve a aplicar.';

-- Si hubiera duplicados previos se conserva el primero de cada gasto y mes
delete from public.gastos_fijos_pagos p
using public.gastos_fijos_pagos q
where p.gasto_fijo_id = q.gasto_fijo_id
  and p.mes = q.mes
  and p.ctid > q.ctid;

create unique index if not exists gastos_fijos_pagos_gasto_mes_idx
  on public.gastos_fijos_pagos (gasto_fijo_id, mes);

commit;
