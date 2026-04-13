import { supabase } from './supabase';
import { DEFAULT_DELIVERY_SETTINGS, normalizeDeliverySettings } from './delivery';

const DELIVERY_SETTINGS_KEY = 'delivery';

export async function fetchDeliverySettings() {
  if (!supabase) {
    return DEFAULT_DELIVERY_SETTINGS;
  }

  const { data, error } = await supabase
    .from('store_settings')
    .select('value')
    .eq('key', DELIVERY_SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    console.error('No se pudo cargar la configuracion de delivery', error);
    return DEFAULT_DELIVERY_SETTINGS;
  }

  return normalizeDeliverySettings(data?.value);
}

export async function saveDeliverySettings(settings) {
  if (!supabase) {
    throw new Error('Supabase no esta configurado');
  }

  const payload = normalizeDeliverySettings(settings);
  const { error } = await supabase
    .from('store_settings')
    .upsert(
      {
        key: DELIVERY_SETTINGS_KEY,
        value: payload,
      },
      { onConflict: 'key' }
    );

  if (error) {
    throw error;
  }

  return payload;
}
