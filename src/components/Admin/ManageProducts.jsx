import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { supabase } from '../../lib/supabase';
import { getCategoryLabel } from '../../config/store';
import { getCategoryMeta, hasLegacyCatalog, sortCategoriesForStore } from '../../config/catalog';
import { seedNightStoreCatalog } from '../../lib/catalogMigration';
import { getPrimaryProductImage, getProductImages, mergeUniqueImageUrls, parseImageUrlText } from '../../lib/productImages';

const EMPTY = {
  name: '',
  brand: '',
  description: '',
  price: '',
  old_price: '',
  category_id: '',
  stock: '',
  is_active: true,
  image_urls_text: '',
};

const MAX_PRODUCT_IMAGES = 6;

const PRODUCT_FILTERS = [
  { value: 'active', label: 'Activos' },
  { value: 'discounted', label: 'Con descuento' },
  { value: 'inactive', label: 'Archivados' },
  { value: 'all', label: 'Todos' },
];

const BULK_SCOPES = [
  { value: 'filtered', label: 'Productos en vista' },
  { value: 'category', label: 'Toda una categoria' },
  { value: 'all_active', label: 'Todos los activos' },
];

function getUploadErrorMessage(error) {
  if (!error) return 'No se pudo subir la imagen.';

  if (error.code === 'storage/unauthorized') {
    return 'Firebase Storage rechazo la subida. Revisa las reglas del bucket.';
  }

  if (error.code === 'storage/canceled') {
    return 'La subida de imagen fue cancelada o tardo demasiado.';
  }

  if (error.code === 'storage/object-not-found') {
    return 'El bucket de Firebase Storage no encontro la ruta del archivo.';
  }

  return error.message || 'No se pudo subir la imagen.';
}

function isFirebaseHostedUrl(url) {
  return /firebasestorage|googleapis\.com|^gs:\/\//.test(String(url || ''));
}

function isBlobPreviewUrl(url) {
  return /^blob:/.test(String(url || ''));
}

function releaseBlobPreviews(urls) {
  for (const url of urls) {
    if (isBlobPreviewUrl(url)) {
      URL.revokeObjectURL(url);
    }
  }
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`No se pudo procesar "${file.name}" como imagen.`));
    };

    image.src = objectUrl;
  });
}

async function compressImageToDataUrl(file) {
  const image = await loadImageElement(file);
  const maxWidth = 1280;
  const maxHeight = 1280;
  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo preparar la compresion de la imagen.');
  }

  context.drawImage(image, 0, 0, width, height);

  const webp = canvas.toDataURL('image/webp', 0.72);
  if (webp && webp.startsWith('data:image/webp')) {
    return webp;
  }

  return canvas.toDataURL('image/jpeg', 0.78);
}

export default function ManageProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkPercent, setBulkPercent] = useState('10');
  const [bulkScope, setBulkScope] = useState('filtered');
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [imgFiles, setImgFiles] = useState([]);
  const [imgPreviews, setImgPreviews] = useState([]);
  const [uploadPct, setUploadPct] = useState(0);
  const [imgError, setImgError] = useState('');
  const [showUrlField, setShowUrlField] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  function enrichProduct(product) {
    if (!product) return product;

    const category = categories.find((item) => String(item.id) === String(product.category_id || ''));

    return {
      ...product,
      categories: category
        ? {
            name: category.name,
            slug: category.slug,
            emoji: category.emoji,
          }
        : product.categories || null,
    };
  }

  function upsertLocalProduct(product) {
    const enriched = enrichProduct(product);

    setProducts((prev) => {
      const next = [enriched, ...prev.filter((item) => item.id !== enriched.id)];
      return next.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    });

    return enriched;
  }

  function patchLocalProduct(productId, patch) {
    setProducts((prev) =>
      prev.map((item) =>
        item.id === productId
          ? enrichProduct({ ...item, ...patch })
          : item
      )
    );
  }

  async function load() {
    const [{ data: productData }, { data: categoryData }] = await Promise.all([
      supabase.from('products').select('*, categories(name, slug)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*'),
    ]);

    setProducts(productData || []);
    setCategories(sortCategoriesForStore(categoryData || []));
    setLoading(false);
  }

  async function handleSeedCatalog() {
    const confirmed = window.confirm(
      'Esto reemplazara el catalogo actual por categorias y productos de bodega nocturna. Los pedidos existentes no se tocan. Quieres continuar?'
    );
    if (!confirmed) return;

    setCatalogLoading(true);

    try {
      const result = await seedNightStoreCatalog();
      setProducts(result.products || []);
      setCategories(sortCategoriesForStore(result.categories || []));
      setFilter('active');
      setSearch('');
      setCategoryFilter('');
      toast.success('Catalogo nocturno cargado en Supabase');
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'No se pudo cargar el catalogo nocturno');
    } finally {
      setCatalogLoading(false);
    }
  }

  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (filter === 'active') list = list.filter((product) => product.is_active);
    if (filter === 'inactive') list = list.filter((product) => !product.is_active);
    if (filter === 'discounted') list = list.filter((product) => product.old_price && product.old_price > product.price);

    if (categoryFilter) {
      list = list.filter((product) => String(product.category_id || '') === categoryFilter);
    }

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((product) =>
        product.name.toLowerCase().includes(term) ||
        product.brand.toLowerCase().includes(term)
      );
    }

    return list;
  }, [products, filter, categoryFilter, search]);

  const activeCount = products.filter((product) => product.is_active).length;
  const discountedCount = products.filter((product) => product.old_price && product.old_price > product.price).length;
  const hasLegacyData = useMemo(() => hasLegacyCatalog(categories, products), [categories, products]);

  function closeModal() {
    releaseBlobPreviews(imgPreviews);
    setModal(null);
    setForm(EMPTY);
    setImgFiles([]);
    setImgPreviews([]);
    setImgError('');
    setUploadPct(0);
    setShowUrlField(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function openAdd() {
    releaseBlobPreviews(imgPreviews);
    setForm(EMPTY);
    setImgFiles([]);
    setImgPreviews([]);
    setImgError('');
    setUploadPct(0);
    setShowUrlField(false);
    if (fileRef.current) fileRef.current.value = '';
    setModal('add');
  }

  function openEdit(product) {
    const existingImages = getProductImages(product);

    releaseBlobPreviews(imgPreviews);
    setForm({
      ...product,
      price: product.price,
      old_price: product.old_price || '',
      category_id: product.category_id || '',
      image_urls_text: existingImages.join('\n'),
    });
    setImgFiles([]);
    setImgPreviews(existingImages);
    setImgError('');
    setUploadPct(0);
    setShowUrlField(false);
    if (fileRef.current) fileRef.current.value = '';
    setModal('edit');
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));

    if (key === 'image_urls_text') {
      setImgPreviews((prev) =>
        mergeUniqueImageUrls(parseImageUrlText(value), prev.filter((item) => isBlobPreviewUrl(item)))
      );
      setImgError('');
    }
  }

  function handleImgChange(event) {
    const nextFiles = Array.from(event.target.files || []);
    if (!nextFiles.length) return;

    const invalidType = nextFiles.find((file) => !file.type.startsWith('image/'));
    if (invalidType) {
      toast.error(`"${invalidType.name}" no es una imagen valida`);
      return;
    }

    const invalidSize = nextFiles.find((file) => file.size > 3 * 1024 * 1024);
    if (invalidSize) {
      toast.error(`"${invalidSize.name}" supera los 3 MB`);
      return;
    }

    const currentUrls = parseImageUrlText(form.image_urls_text);
    const currentGallery = mergeUniqueImageUrls(
      currentUrls,
      imgPreviews.filter((item) => isBlobPreviewUrl(item))
    );
    const availableSlots = MAX_PRODUCT_IMAGES - currentGallery.length;

    if (availableSlots <= 0) {
      toast.error(`Este producto admite hasta ${MAX_PRODUCT_IMAGES} fotos`);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    const acceptedFiles = nextFiles.slice(0, availableSlots);

    if (acceptedFiles.length < nextFiles.length) {
      toast.error(`Solo se agregaron ${acceptedFiles.length} foto(s). El maximo es ${MAX_PRODUCT_IMAGES}.`);
    }

    const nextPreviews = acceptedFiles.map((file) => URL.createObjectURL(file));
    setImgFiles((prev) => [...prev, ...acceptedFiles]);
    setImgPreviews((prev) => mergeUniqueImageUrls(currentUrls, prev.filter((item) => isBlobPreviewUrl(item)), nextPreviews));
    setImgError('');
    setUploadPct(0);
    if (fileRef.current) fileRef.current.value = '';
  }

  function clearPendingFiles() {
    releaseBlobPreviews(imgPreviews.filter((item) => isBlobPreviewUrl(item)));
    setImgFiles([]);
    setImgPreviews(parseImageUrlText(form.image_urls_text));
    setUploadPct(0);
    setImgError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function getBulkTargets() {
    if (bulkScope === 'all_active') {
      return products.filter((product) => product.is_active);
    }

    if (bulkScope === 'category') {
      return products.filter(
        (product) =>
          product.is_active &&
          String(product.category_id || '') === String(bulkCategoryId || '')
      );
    }

    return filteredProducts.filter((product) => product.is_active);
  }

  async function uploadSingleImage(productId, file, fileIndex, totalFiles, productName) {
    if (!storage) {
      throw new Error('Firebase Storage no esta configurado');
    }

    return new Promise((resolve, reject) => {
      const fileExt = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'jpg';
      const safeName = String(productName || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `product-${productId}`;
      const storageRef = ref(storage, `products/${productId}/${Date.now()}-${fileIndex + 1}-${safeName}.${fileExt}`);
      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'image/jpeg',
      });
      let settled = false;

      const finish = (handler, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        handler(value);
      };

      const timeoutId = window.setTimeout(() => {
        try {
          task.cancel();
        } catch {}
        finish(reject, new Error(`La subida de "${file.name}" tardo demasiado. Revisa Firebase Storage.`));
      }, 45000);

      task.on(
        'state_changed',
        (snapshot) => {
          const fileProgress = snapshot.totalBytes
            ? snapshot.bytesTransferred / snapshot.totalBytes
            : 0;
          const overallProgress = ((fileIndex + fileProgress) / totalFiles) * 100;
          setUploadPct(Math.round(overallProgress));
        },
        (error) => finish(reject, error),
        async () => {
          try {
            const url = await getDownloadURL(task.snapshot.ref);
            finish(resolve, url);
          } catch (error) {
            finish(reject, error);
          }
        }
      );
    });
  }

  async function persistProductImages(productId, urls) {
    const nextPrimary = urls[0] || '';

    const { error } = await supabase
      .from('products')
      .update({
        image_url: nextPrimary,
        image_urls: urls,
      })
      .eq('id', productId);

    if (!error) {
      return {
        gallerySupported: true,
        warning: '',
      };
    }

    if (String(error.message || '').includes('image_urls')) {
      const { error: fallbackError } = await supabase
        .from('products')
        .update({ image_url: nextPrimary })
        .eq('id', productId);

      if (fallbackError) throw fallbackError;

      return {
        gallerySupported: false,
        warning: 'La foto principal se guardo, pero para varias fotos debes ejecutar de nuevo schema.sql en Supabase.',
      };
    }

    throw error;
  }

  async function persistInlineFallbackImages(productId, manualUrls, files) {
    const inlineUrls = [];

    for (const file of files) {
      const dataUrl = await compressImageToDataUrl(file);
      inlineUrls.push(dataUrl);
    }

    const finalUrls = mergeUniqueImageUrls(manualUrls, inlineUrls).slice(0, MAX_PRODUCT_IMAGES);
    const result = await persistProductImages(productId, finalUrls);

    patchLocalProduct(productId, {
      image_url: finalUrls[0] || '',
      image_urls: finalUrls,
      __syncingImages: false,
      __syncWarning: false,
    });

    if (result.warning) {
      toast.error(result.warning);
    } else {
      toast.success('Las fotos quedaron guardadas dentro de la tienda.');
    }
  }

  async function syncImagesInBackground(productId, manualUrls, files, productName) {
    if (!files.length) return;

    if (!storage) {
      try {
        await persistInlineFallbackImages(productId, manualUrls, files);
      } catch (error) {
        console.error('Inline image fallback error:', error);
        patchLocalProduct(productId, {
          __syncingImages: false,
          __syncWarning: true,
        });
        toast.error('El producto se guardo, pero no pudimos conservar las fotos.');
      }
      return;
    }

    try {
      const uploadedUrls = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const url = await uploadSingleImage(productId, file, index, files.length, productName);
        uploadedUrls.push(url);
      }

      const finalUrls = mergeUniqueImageUrls(manualUrls, uploadedUrls).slice(0, MAX_PRODUCT_IMAGES);
      const result = await persistProductImages(productId, finalUrls);

      patchLocalProduct(productId, {
        image_url: finalUrls[0] || '',
        image_urls: finalUrls,
        __syncingImages: false,
        __syncWarning: Boolean(result.warning),
      });

      if (result.warning) {
        toast.error(result.warning);
      } else {
        toast.success('Fotos sincronizadas en segundo plano');
      }
    } catch (error) {
      console.error('Background image sync error:', error);
      try {
        await persistInlineFallbackImages(productId, manualUrls, files);
        toast.error(`Firebase Storage fallo, pero las fotos quedaron guardadas igual. ${getUploadErrorMessage(error)}`);
      } catch (fallbackError) {
        console.error('Inline image fallback error:', fallbackError);
        patchLocalProduct(productId, {
          __syncingImages: false,
          __syncWarning: true,
        });
        toast.error(`El producto se guardo, pero las fotos no terminaron de subir. ${getUploadErrorMessage(error)}`);
      }
    } finally {
      setUploadPct(0);
    }
  }

  async function handleSave() {
    if (!form.name || !form.price || !form.stock) {
      toast.error('Nombre, precio y stock son obligatorios');
      return;
    }

    setSaving(true);

    try {
      const manualUrls = parseImageUrlText(form.image_urls_text);
      const pendingFiles = [...imgFiles];
      const pendingBlobImages = imgPreviews.filter((item) => isBlobPreviewUrl(item));
      const persistedImages = mergeUniqueImageUrls(manualUrls).slice(0, MAX_PRODUCT_IMAGES);
      const localPreviewImages = mergeUniqueImageUrls(
        manualUrls,
        pendingBlobImages
      ).slice(0, MAX_PRODUCT_IMAGES);
      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        description: form.description.trim(),
        price: Number.parseInt(form.price, 10),
        old_price: form.old_price ? Number.parseInt(form.old_price, 10) : null,
        category_id: form.category_id || null,
        stock: Number.parseInt(form.stock, 10),
        is_active: form.is_active,
        image_url: persistedImages[0] || '',
        image_urls: persistedImages,
      };

      let imageWarning = '';
      setImgError('');

      if (modal === 'add') {
        let createResult = await supabase.from('products').insert(payload).select().single();
        if (createResult.error && String(createResult.error.message || '').includes('image_urls')) {
          const fallbackPayload = { ...payload };
          delete fallbackPayload.image_urls;
          createResult = await supabase.from('products').insert(fallbackPayload).select().single();
          imageWarning = persistedImages.length > 1
            ? 'La foto principal se guardo, pero para varias fotos debes ejecutar de nuevo schema.sql en Supabase.'
            : imageWarning;
        }
        if (createResult.error) throw createResult.error;
        const created = createResult.data;
        upsertLocalProduct({
          ...created,
          image_url: localPreviewImages[0] || persistedImages[0] || '',
          image_urls: localPreviewImages.length ? localPreviewImages : persistedImages,
          __syncingImages: pendingFiles.length > 0,
          __syncWarning: false,
        });

        closeModal();

        toast.success(pendingFiles.length ? 'Producto guardado. Las fotos se estan sincronizando en segundo plano.' : 'Producto creado');

        if (pendingFiles.length) {
          void syncImagesInBackground(created.id, manualUrls, pendingFiles, payload.name);
        }
      } else {
        const nextUpdate = { ...payload };

        const { error } = await supabase.from('products').update(nextUpdate).eq('id', form.id);
        if (error) {
          if (String(error.message || '').includes('image_urls')) {
            const fallbackUpdate = { ...nextUpdate };
            delete fallbackUpdate.image_urls;
            const { error: fallbackError } = await supabase.from('products').update(fallbackUpdate).eq('id', form.id);
            if (fallbackError) throw fallbackError;
            imageWarning = [imageWarning, 'La foto principal se guardo, pero para varias fotos debes ejecutar de nuevo schema.sql en Supabase.']
              .filter(Boolean)
              .join(' ');
          } else {
            throw error;
          }
        }

        upsertLocalProduct({
          ...form,
          ...nextUpdate,
          id: form.id,
          created_at: form.created_at,
          image_url: localPreviewImages[0] || persistedImages[0] || '',
          image_urls: localPreviewImages.length ? localPreviewImages : persistedImages,
          __syncingImages: pendingFiles.length > 0,
          __syncWarning: false,
        });

        closeModal();

        toast.success(pendingFiles.length ? 'Cambios guardados. Las fotos se estan sincronizando en segundo plano.' : 'Producto actualizado');

        if (pendingFiles.length) {
          void syncImagesInBackground(form.id, manualUrls, pendingFiles, payload.name);
        }
      }

      if (imageWarning) {
        toast.error(imageWarning);
      }
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'No se pudo guardar el producto');
    } finally {
      setSaving(false);
      setUploadPct(0);
    }
  }

  async function handleDelete(product) {
    const confirmed = window.confirm(`Eliminar "${product.name}"? Esta accion no se puede deshacer.`);
    if (!confirmed) return;

    const hostedImages = getProductImages(product).filter(isFirebaseHostedUrl);

    if (storage) {
      for (const imageUrl of hostedImages) {
        try {
          await deleteObject(ref(storage, imageUrl));
        } catch {}
      }
    }

    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) {
      toast.error('No se pudo eliminar el producto');
      return;
    }

    toast.success('Producto eliminado');
    setProducts((prev) => prev.filter((item) => item.id !== product.id));
  }

  async function toggleActive(product) {
    const { error } = await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id);

    if (error) {
      toast.error('No se pudo actualizar el producto');
      return;
    }

    setProducts((prev) =>
      prev.map((item) =>
        item.id === product.id
          ? { ...item, is_active: !item.is_active }
          : item
      )
    );

    toast.success(product.is_active ? 'Producto archivado' : 'Producto reactivado');
  }

  async function applyBulkDiscount() {
    const percent = Number.parseInt(bulkPercent, 10);
    const targets = getBulkTargets();

    if (!percent || percent <= 0 || percent >= 100) {
      toast.error('Ingresa un porcentaje valido');
      return;
    }

    if (bulkScope === 'category' && !bulkCategoryId) {
      toast.error('Selecciona una categoria');
      return;
    }

    if (targets.length === 0) {
      toast.error('No hay productos para aplicar ese descuento');
      return;
    }

    setBulkLoading(true);

    try {
      await Promise.all(
        targets.map(async (product) => {
          const basePrice = product.old_price && product.old_price > product.price
            ? product.old_price
            : product.price;
          const nextPrice = Math.max(Math.round(basePrice * (1 - percent / 100)), 0);

          const { error } = await supabase
            .from('products')
            .update({
              price: nextPrice,
              old_price: nextPrice === basePrice ? null : basePrice,
            })
            .eq('id', product.id);

          if (error) throw error;
        })
      );

      toast.success(`Descuento aplicado a ${targets.length} producto(s)`);
      await load();
      if (filter !== 'discounted') setFilter('discounted');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo aplicar el descuento masivo');
    } finally {
      setBulkLoading(false);
    }
  }

  async function clearBulkDiscount() {
    const targets = getBulkTargets().filter((product) => product.old_price && product.old_price > product.price);

    if (bulkScope === 'category' && !bulkCategoryId) {
      toast.error('Selecciona una categoria');
      return;
    }

    if (targets.length === 0) {
      toast.error('No hay descuentos que limpiar en esa seleccion');
      return;
    }

    setBulkLoading(true);

    try {
      await Promise.all(
        targets.map(async (product) => {
          const { error } = await supabase
            .from('products')
            .update({
              price: product.old_price,
              old_price: null,
            })
            .eq('id', product.id);

          if (error) throw error;
        })
      );

      toast.success(`Descuentos quitados en ${targets.length} producto(s)`);
      await load();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo quitar el descuento masivo');
    } finally {
      setBulkLoading(false);
    }
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const bulkTargets = getBulkTargets();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Productos</h1>
          <p style={{ fontSize: 14, color: 'var(--txt-muted)' }}>
            {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''} en vista para la bodega.
          </p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">
          <Plus size={16} />
          Agregar producto
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1rem', borderColor: hasLegacyData ? '#FCD34D' : '#FED7AA', background: hasLegacyData ? '#FFF7ED' : '#FFF9F5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Sparkles size={18} style={{ color: '#C2410C' }} />
              <strong>Migracion de catalogo nocturno</strong>
            </div>
            <p style={{ fontSize: 14, color: '#7C2D12' }}>
              Carga categorias y productos base de bodega nocturna en Supabase sin tocar usuarios, pedidos ni roles.
              {hasLegacyData ? ' Detectamos rastros del catalogo viejo de electronica.' : ' Puedes usarlo para relanzar el catalogo cuando quieras.'}
            </p>
          </div>

          <button type="button" onClick={handleSeedCatalog} className="btn btn-primary" disabled={catalogLoading}>
            {catalogLoading ? <Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> : <Sparkles size={16} />}
            Cargar catalogo nocturno
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: '1rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>Total</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand)', fontFamily: "'Space Grotesk', sans-serif" }}>{products.length}</div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>Activos</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand)', fontFamily: "'Space Grotesk', sans-serif" }}>{activeCount}</div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>Con descuento</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand)', fontFamily: "'Space Grotesk', sans-serif" }}>{discountedCount}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
          <Tag size={18} style={{ color: 'var(--brand)' }} />
          <h2 style={{ fontSize: 17 }}>Promos nocturnas</h2>
        </div>

        <div className="responsive-form-grid">
          <div className="field">
            <label>Alcance</label>
            <select className="input" value={bulkScope} onChange={(event) => setBulkScope(event.target.value)}>
              {BULK_SCOPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Porcentaje</label>
            <input
              className="input"
              type="number"
              min="1"
              max="90"
              value={bulkPercent}
              onChange={(event) => setBulkPercent(event.target.value)}
              placeholder="10"
            />
          </div>

          {bulkScope === 'category' && (
            <div className="field full-span">
              <label>Categoria objetivo</label>
              <select className="input" value={bulkCategoryId} onChange={(event) => setBulkCategoryId(event.target.value)}>
                <option value="">Selecciona una categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: '1rem' }}>
          {[5, 10, 15, 20].map((percent) => (
            <button key={percent} type="button" onClick={() => setBulkPercent(String(percent))} className="btn btn-outline btn-sm">
              {percent}% OFF
            </button>
          ))}
        </div>

        <div style={{ marginTop: '1rem', fontSize: 13, color: 'var(--txt-muted)' }}>
          Esta accion afectara a <strong>{bulkTargets.length}</strong> producto(s) segun tu filtro actual.
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: '1rem' }}>
          <button onClick={applyBulkDiscount} className="btn btn-primary" disabled={bulkLoading}>
            {bulkLoading ? <Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} /> : <Tag size={14} />}
            Aplicar descuento masivo
          </button>
          <button onClick={clearBulkDiscount} className="btn btn-outline" disabled={bulkLoading}>
            Quitar descuentos de la seleccion
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 210px', gap: 12, marginBottom: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt-muted)' }} />
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por producto, combo o marca..."
            style={{ paddingLeft: 38 }}
          />
        </div>
        <select className="input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="">Todas las categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
        {PRODUCT_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={filter === item.value ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="product-grid-admin">
        {filteredProducts.map((product) => {
          const percentOff = product.old_price && product.old_price > product.price
            ? Math.round((1 - product.price / product.old_price) * 100)
            : null;
          const productImages = getProductImages(product);
          const primaryImage = getPrimaryProductImage(product);

          return (
            <div key={product.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  height: 160,
                  borderRadius: 'var(--radius)',
                  background: primaryImage ? '#F3F4F6' : getCategoryMeta(product.categories)?.gradient || 'linear-gradient(135deg, #1F2937 0%, #9A3412 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  fontSize: 12,
                  color: 'var(--txt-muted)',
                  position: 'relative',
                }}
              >
                {primaryImage ? (
                  <img src={primaryImage} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="product-media-fallback" style={{ minHeight: 0, height: '100%' }}>
                    <span className="product-media-tag">{getCategoryMeta(product.categories)?.badge || 'CAT'}</span>
                    <strong>{product.name}</strong>
                    <span>{getCategoryMeta(product.categories)?.shortLabel || 'sin foto'}</span>
                  </div>
                )}

                {percentOff && (
                  <span className="promo-pill" style={{ top: 10, right: 10, background: 'var(--danger)', color: '#fff' }}>
                    -{percentOff}%
                  </span>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{product.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--txt-muted)' }}>{product.brand || 'Marca libre'}</div>
                  </div>
                  <span className={`badge ${product.is_active ? 'badge-success' : 'badge-gray'}`}>
                    {product.is_active ? 'Visible' : 'Archivado'}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: 'var(--txt-muted)', marginTop: 8 }}>
                  {product.categories ? getCategoryLabel(product.categories) : 'Sin categoria'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt-muted)', marginTop: 4 }}>
                  {productImages.length} foto{productImages.length !== 1 ? 's' : ''}
                </div>
                {product.__syncingImages && (
                  <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 700, marginTop: 4 }}>
                    Fotos sincronizando en segundo plano...
                  </div>
                )}
                {product.__syncWarning && (
                  <div style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 700, marginTop: 4 }}>
                    Revisa Storage o vuelve a editar para completar la galeria
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>Precio</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--brand)', fontFamily: "'Space Grotesk', sans-serif" }}>
                      Gs. {product.price.toLocaleString('es-PY')}
                    </span>
                    {product.old_price && (
                      <span style={{ fontSize: 12, color: 'var(--txt-muted)', textDecoration: 'line-through' }}>
                        Gs. {product.old_price.toLocaleString('es-PY')}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>Stock</div>
                  <div style={{ fontWeight: 700 }}>{product.stock}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => openEdit(product)} className="btn btn-outline btn-sm">
                  <Pencil size={14} />
                  Editar
                </button>
                <button onClick={() => toggleActive(product)} className="btn btn-outline btn-sm">
                  {product.is_active ? 'Archivar' : 'Reactivar'}
                </button>
                <button onClick={() => handleDelete(product)} className="btn btn-danger btn-sm">
                  <Trash2 size={14} />
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="card">
          <p style={{ color: 'var(--txt-muted)' }}>No hay productos para este filtro.</p>
        </div>
      )}

      {modal && (
        <div className="overlay" onClick={(event) => event.target === event.currentTarget && closeModal()}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <h2>{modal === 'add' ? 'Agregar producto' : 'Editar producto'}</h2>
              <button className="close-btn" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="field">
                <label>Fotos del producto</label>
                <div
                  style={{
                    border: '2px dashed var(--border)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--bg)',
                    overflow: 'hidden',
                    padding: 12,
                  }}
                >
                  {imgPreviews.length ? (
                    <div style={{ width: '100%' }}>
                      <div
                        className="admin-image-preview-grid"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))',
                          gap: 10,
                        }}
                      >
                        {imgPreviews.map((imageUrl, index) => (
                          <div
                            key={`${imageUrl}-${index}`}
                            style={{
                              borderRadius: 10,
                              overflow: 'hidden',
                              background: '#fff',
                              border: '1px solid var(--border)',
                              aspectRatio: '1 / 1',
                            }}
                          >
                            <img
                              src={imageUrl}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--txt-muted)', textAlign: 'center' }}>
                        {imgPreviews.length} / {MAX_PRODUCT_IMAGES} fotos
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--txt-muted)', padding: '0.75rem 0.5rem' }}>
                      <ImagePlus size={28} style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 13 }}>Sube una o varias fotos del producto</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Hasta {MAX_PRODUCT_IMAGES} imagenes, 3 MB cada una</div>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImgChange} />

                <div className="admin-image-toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>
                    <ImagePlus size={14} />
                    {imgPreviews.length ? 'Agregar mas fotos' : 'Agregar fotos'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowUrlField((prev) => !prev)}
                  >
                    {showUrlField ? 'Ocultar URLs' : 'Usar URLs'}
                  </button>
                  {imgFiles.length > 0 && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={clearPendingFiles}>
                      Quitar fotos nuevas
                    </button>
                  )}
                </div>

                {showUrlField && (
                  <div className="field" style={{ marginTop: 10 }}>
                    <label>URLs de fotos opcionales</label>
                    <textarea
                      className="input"
                      rows={2}
                      value={form.image_urls_text}
                      onChange={(event) => setField('image_urls_text', event.target.value)}
                      placeholder={'https://...\nhttps://...'}
                    />
                    <small>
                      Una URL por linea. Puedes mezclar URLs con fotos subidas.
                    </small>
                  </div>
                )}

                {uploadPct > 0 && uploadPct < 100 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 999 }}>
                      <div style={{ height: 4, background: 'var(--blue)', borderRadius: 999, width: `${uploadPct}%` }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt-muted)', marginTop: 2 }}>
                      Subiendo... {uploadPct}%
                    </div>
                  </div>
                )}

                {imgError && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>
                    {imgError}
                  </div>
                )}
              </div>

              <div className="responsive-form-grid">
                <div className="field full-span">
                  <label>Nombre *</label>
                  <input className="input" value={form.name} onChange={(event) => setField('name', event.target.value)} />
                </div>

                <div className="field">
                  <label>Marca / referencia</label>
                  <input className="input" value={form.brand} onChange={(event) => setField('brand', event.target.value)} placeholder="Ej: Pilsen, Monster, Generico" />
                </div>

                <div className="field">
                  <label>Categoria</label>
                  <select className="input" value={form.category_id} onChange={(event) => setField('category_id', event.target.value)}>
                    <option value="">Sin categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Precio *</label>
                  <input className="input" type="number" value={form.price} onChange={(event) => setField('price', event.target.value)} />
                </div>

                <div className="field">
                  <label>Precio anterior</label>
                  <input className="input" type="number" value={form.old_price} onChange={(event) => setField('old_price', event.target.value)} />
                </div>

                <div className="field">
                  <label>Stock *</label>
                  <input className="input" type="number" value={form.stock} onChange={(event) => setField('stock', event.target.value)} />
                </div>

                <div className="field" style={{ justifyContent: 'flex-end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_active} onChange={(event) => setField('is_active', event.target.checked)} />
                    Visible en la tienda
                  </label>
                </div>

                <div className="field full-span">
                  <label>Descripcion</label>
                  <textarea className="input" rows={4} value={form.description} onChange={(event) => setField('description', event.target.value)} placeholder="Texto corto pensado para compra rapida desde el celular." />
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={closeModal} className="btn btn-outline">
                Cancelar
              </button>
              <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {modal === 'add' ? 'Crear producto' : 'Guardar cambios'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
