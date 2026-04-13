import { storeConfig } from '../config/store';
import { parseCoordinatesFromMapInput } from './delivery';
import { supabase } from './supabase';

export const EMPTY_ADDRESS = {
  label: 'Casa',
  full_name: '',
  phone: '',
  street: '',
  neighborhood: '',
  city: storeConfig.city,
  reference: '',
  maps_link: '',
};

export function createAddressDraft(overrides = {}) {
  return {
    ...EMPTY_ADDRESS,
    ...overrides,
    city: String(overrides.city || storeConfig.city || '').trim(),
  };
}

export function validateAddressForm(values) {
  const nextErrors = {};

  if (!String(values?.full_name || '').trim()) nextErrors.full_name = 'Requerido';
  if (!String(values?.phone || '').trim()) nextErrors.phone = 'Requerido';
  if (!String(values?.street || '').trim()) nextErrors.street = 'Requerido';

  return nextErrors;
}

export function buildAddressPayload(values, { firebaseUid, isDefault = false } = {}) {
  if (!firebaseUid) {
    throw new Error('No se encontro el usuario para guardar la direccion');
  }

  const mapsLink = String(values?.maps_link || '').trim();
  const parsedLocation = mapsLink ? parseCoordinatesFromMapInput(mapsLink) : null;

  if (mapsLink && !parsedLocation) {
    const error = new Error('No se pudo leer la ubicacion exacta de Maps');
    error.code = 'invalid-maps-link';
    throw error;
  }

  return {
    firebase_uid: firebaseUid,
    label: String(values?.label || 'Casa').trim() || 'Casa',
    full_name: String(values?.full_name || '').trim(),
    phone: String(values?.phone || '').trim(),
    street: String(values?.street || '').trim(),
    neighborhood: String(values?.neighborhood || '').trim(),
    city: String(values?.city || storeConfig.city || '').trim(),
    reference: String(values?.reference || '').trim(),
    maps_link: mapsLink,
    latitude: parsedLocation?.lat ?? null,
    longitude: parsedLocation?.lng ?? null,
    is_default: Boolean(isDefault),
  };
}

export async function fetchUserAddresses(firebaseUid) {
  if (!supabase || !firebaseUid) return [];

  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('firebase_uid', firebaseUid)
    .order('is_default', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function saveUserAddress({ firebaseUid, values, isDefault = false }) {
  if (!supabase) {
    throw new Error('La app no esta configurada');
  }

  const payload = buildAddressPayload(values, { firebaseUid, isDefault });

  const { data, error } = await supabase
    .from('addresses')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return data;
}
