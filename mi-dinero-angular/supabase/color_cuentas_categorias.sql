-- ===========================================================================
--  KANE · Reparación de esquema (idempotente, SIN transacción)
--  Ejecuta este bloque completo en el SQL Editor de Supabase.
--
--  ¿Por qué sin transacción?
--    En un bloque begin…commit, si UNA sola sentencia falla, Postgres revierte
--    TODO y ninguna columna queda creada (era el motivo de que el error
--    siguiera apareciendo). Aquí cada sentencia se confirma por separado, así
--    que las columnas se crean aunque otra parte falle.
--
--  Crea las columnas que la app envía al guardar categorías y cuentas:
--    categorias_grandes: presupuesto_mensual, color, icono, tipo
--    cuentas:            color
--  y refresca la caché de PostgREST al final.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) categorias_grandes (lo primero, para que siempre se aplique)
-- ---------------------------------------------------------------------------
alter table public.categorias_grandes
  add column if not exists presupuesto_mensual numeric not null default 0,
  add column if not exists color text,
  add column if not exists icono text,
  add column if not exists tipo text not null default 'GASTO';

-- Normaliza el tipo a mayúsculas por si venía en minúsculas de un esquema viejo
update public.categorias_grandes
set tipo = upper(tipo)
where tipo is not null and tipo <> upper(tipo);

-- El porcentaje ya no es obligatorio y no se envía al crear categorías
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'categorias_grandes' and column_name = 'porcentaje'
  ) then
    alter table public.categorias_grandes alter column porcentaje set default 0;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) cuentas.color
-- ---------------------------------------------------------------------------
alter table public.cuentas
  add column if not exists color smallint not null default 1;

-- ---------------------------------------------------------------------------
-- 3) Restricciones (cada una aislada: si falla por datos viejos, no afecta)
-- ---------------------------------------------------------------------------
do $$
begin
  alter table public.categorias_grandes drop constraint if exists categorias_grandes_color_check;
  alter table public.categorias_grandes add constraint categorias_grandes_color_check
    check (color is null or color ~ '^#[0-9a-fA-F]{6}$' or color ~ '^serie-[1-8]$');
exception when others then
  raise notice 'categorias_grandes_color_check no se pudo crear: %', sqlerrm;
end $$;

do $$
begin
  alter table public.categorias_grandes drop constraint if exists categorias_grandes_presupuesto_mensual_check;
  alter table public.categorias_grandes add constraint categorias_grandes_presupuesto_mensual_check
    check (presupuesto_mensual >= 0);
exception when others then
  raise notice 'categorias_grandes_presupuesto_mensual_check no se pudo crear: %', sqlerrm;
end $$;

do $$
begin
  alter table public.categorias_grandes drop constraint if exists categorias_grandes_tipo_check;
  alter table public.categorias_grandes add constraint categorias_grandes_tipo_check
    check (tipo in ('GASTO', 'INGRESO'));
exception when others then
  raise notice 'categorias_grandes_tipo_check no se pudo crear: %', sqlerrm;
end $$;

do $$
begin
  alter table public.cuentas drop constraint if exists cuentas_color_check;
  alter table public.cuentas add constraint cuentas_color_check check (color between 1 and 8);
exception when others then
  raise notice 'cuentas_color_check no se pudo crear: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Integridad referencial de movimientos -> cuentas (opcional, no bloquea)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'movimientos' and column_name = 'cuenta_origen_id'
    )
    and not exists (
      select 1 from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.conrelid = 'public.movimientos'::regclass and c.contype = 'f'
        and c.confrelid = 'public.cuentas'::regclass and a.attname = 'cuenta_origen_id'
    ) then
    alter table public.movimientos
      add constraint movimientos_cuenta_origen_fk
      foreign key (cuenta_origen_id) references public.cuentas (id)
      on delete restrict not valid;
  end if;

  if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'movimientos' and column_name = 'cuenta_destino_id'
    )
    and not exists (
      select 1 from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.conrelid = 'public.movimientos'::regclass and c.contype = 'f'
        and c.confrelid = 'public.cuentas'::regclass and a.attname = 'cuenta_destino_id'
    ) then
    alter table public.movimientos
      add constraint movimientos_cuenta_destino_fk
      foreign key (cuenta_destino_id) references public.cuentas (id)
      on delete restrict not valid;
  end if;
exception when others then
  raise notice 'No se pudieron crear las claves foráneas de movimientos: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Refresca la caché de esquema de PostgREST (Supabase)
-- ---------------------------------------------------------------------------
select pg_notify('pgrst', 'reload schema');

-- ---------------------------------------------------------------------------
-- 6) Verificación: debe devolver 4 filas (color, icono, presupuesto_mensual, tipo)
-- ---------------------------------------------------------------------------
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'categorias_grandes'
  and column_name in ('presupuesto_mensual', 'color', 'icono', 'tipo')
order by column_name;
