import { createClient } from '@supabase/supabase-js';
import { env, hasSupabaseEnv } from './env';

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnon = env.VITE_SUPABASE_ANON_KEY;

// Cliente base (lectura publica: productos, categorias)
export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl, supabaseAnon)
  : null;

// Crea un cliente con el firebase_uid seteado como parametro de sesion.
export function supabaseAs(firebaseUid) {
  if (!hasSupabaseEnv) {
    throw new Error('Supabase no esta configurado');
  }

  return createClient(supabaseUrl, supabaseAnon, {
    global: {
      headers: {
        'x-firebase-uid': firebaseUid,
      },
    },
    db: {
      schema: 'public',
    },
  });
}

// Helper: setea el uid en la sesion de postgres para RLS.
export async function setRlsUid(uid) {
  if (!supabase) {
    throw new Error('Supabase no esta configurado');
  }

  await supabase.rpc('set_config', {
    setting: 'app.firebase_uid',
    value: uid,
  }).maybeSingle();
}
