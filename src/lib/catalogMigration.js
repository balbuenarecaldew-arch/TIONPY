import { CATEGORY_SEED, buildSeedProductsPayload, sortCategoriesForStore } from '../config/catalog';
import { supabase } from './supabase';

async function insertSeedProducts(payload) {
  let result = await supabase
    .from('products')
    .insert(payload)
    .select('id');

  if (!result.error) {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name, slug, emoji)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  if (!String(result.error.message || '').includes('image_urls')) {
    throw result.error;
  }

  const fallbackPayload = payload.map(({ image_urls, ...product }) => product);
  result = await supabase
    .from('products')
    .insert(fallbackPayload)
    .select('id');

  if (result.error) {
    throw result.error;
  }

  const { data, error } = await supabase
    .from('products')
    .select('*, categories(name, slug, emoji)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function seedNightStoreCatalog() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado');
  }

  const { error: deleteProductsError } = await supabase
    .from('products')
    .delete()
    .gt('id', 0);

  if (deleteProductsError) {
    throw deleteProductsError;
  }

  const { error: deleteCategoriesError } = await supabase
    .from('categories')
    .delete()
    .gt('id', 0);

  if (deleteCategoriesError) {
    throw deleteCategoriesError;
  }

  const { data: categoryRows, error: categoryError } = await supabase
    .from('categories')
    .upsert(
      CATEGORY_SEED.map(({ name, slug, emoji }) => ({ name, slug, emoji })),
      { onConflict: 'slug' }
    )
    .select('*');

  if (categoryError) {
    throw categoryError;
  }

  const sortedCategories = sortCategoriesForStore(categoryRows || []);
  const productPayload = buildSeedProductsPayload(sortedCategories);
  const productRows = await insertSeedProducts(productPayload);

  return {
    categories: sortedCategories,
    products: productRows,
  };
}
