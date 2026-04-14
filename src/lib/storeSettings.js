import { supabase } from './supabase';
import { DEFAULT_DELIVERY_SETTINGS, normalizeDeliverySettings } from './delivery';
import { storeConfig } from '../config/store';

const DELIVERY_SETTINGS_KEY = 'delivery';
const PAYMENT_SETTINGS_KEY = 'payment';

export const DEFAULT_PAYMENT_SETTINGS = {
  transfer: {
    owner: String(storeConfig.transfer?.owner || '').trim(),
    bank: String(storeConfig.transfer?.bank || '').trim(),
    account: String(storeConfig.transfer?.account || '').trim(),
    instructions: '',
  },
  whatsapp: {
    extraMessage: '',
  },
};

export function normalizePaymentSettings(settings) {
  const next = settings || {};

  return {
    transfer: {
      owner: String(next.transfer?.owner ?? DEFAULT_PAYMENT_SETTINGS.transfer.owner ?? '').trim(),
      bank: String(next.transfer?.bank ?? DEFAULT_PAYMENT_SETTINGS.transfer.bank ?? '').trim(),
      account: String(next.transfer?.account ?? DEFAULT_PAYMENT_SETTINGS.transfer.account ?? '').trim(),
      instructions: String(next.transfer?.instructions ?? DEFAULT_PAYMENT_SETTINGS.transfer.instructions ?? '').trim(),
    },
    whatsapp: {
      extraMessage: String(next.whatsapp?.extraMessage ?? DEFAULT_PAYMENT_SETTINGS.whatsapp.extraMessage ?? '').trim(),
    },
  };
}

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

export async function fetchPaymentSettings() {
  if (!supabase) {
    return DEFAULT_PAYMENT_SETTINGS;
  }

  const { data, error } = await supabase
    .from('store_settings')
    .select('value')
    .eq('key', PAYMENT_SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    console.error('No se pudo cargar la configuracion de cobros', error);
    return DEFAULT_PAYMENT_SETTINGS;
  }

  return normalizePaymentSettings(data?.value);
}

export async function savePaymentSettings(settings) {
  if (!supabase) {
    throw new Error('Supabase no esta configurado');
  }

  const payload = normalizePaymentSettings(settings);
  const { error } = await supabase
    .from('store_settings')
    .upsert(
      {
        key: PAYMENT_SETTINGS_KEY,
        value: payload,
      },
      { onConflict: 'key' }
    );

  if (error) {
    throw error;
  }

  return payload;
}
