// Configuración de conexión a Supabase
// Estas credenciales son públicas por diseño (clave "anon/publishable"),
// la seguridad real la da Row Level Security (RLS) configurado en la base de datos.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://hwajkmsugpksmrbpggsb.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_lvaaj5Ov9MQVXOUTntdiOQ_0rVp5dy2';

export const db: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
