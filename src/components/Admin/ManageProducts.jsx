import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { supabase } from '../../lib/supabase';
import { getCategoryLabel } from '../../config/store';

const EMPTY = {
  name: '',
  brand: '',
  description: '',
  price: '',
  old_price: '',
  category_id: '',
  stock: '',
  is_active: true,
  image_url: '',
};

const PRODUCT_FILTERS = [
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Archivados' },
  { value: 'all', label: 'Todos' },
];

export default function ManageProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState('active');
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [imgFile, setImgFile] = useState(null);
  const [imgPrev, setImgPrev] = useState('');
  const [uploadPct, setUploadPct] = useState(0);
  const fileRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: productData }, { data: categoryData }] = await Promise.all([
      supabase.from('products').select('*, categories(name, slug)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
    ]);

    setProducts(productData || []);
    setCategories(categoryData || []);
    setLoading(false);
  }

  function openAdd() {
    setForm(EMPTY);
    setImgFile(null);
    setImgPrev('');
    setModal('add');
  }

  function openEdit(product) {
    setForm({
      ...product,
      price: product.price,
      old_price: product.old_price || '',
      category_id: product.category_id || '',
    });
    setImgFile(null);
    setImgPrev(product.image_url || '');
    setModal('edit');
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleImgChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error('La imagen no puede superar 3 MB');
      return;
    }

    setImgFile(file);
    setImgPrev(URL.createObjectURL(file));
  }

  async function uploadImage(productId) {
    if (!storage) {
      throw new Error('Firebase Storage no esta configurado');
    }

    if (!imgFile) return form.image_url || '';

    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, `products/${productId}_${Date.now()}`);
      const task = uploadBytesResumable(storageRef, imgFile);
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
        finish(reject, new Error('La subida de la imagen tardo demasiado. Revisa Firebase Storage.'));
      }, 20000);

      task.on(
        'state_changed',
        (snapshot) => setUploadPct(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
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

  async function handleSave() {
    if (!form.name || !form.price || !form.stock) {
      toast.error('Nombre, precio y stock son obligatorios');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        description: form.description.trim(),
        price: Number.parseInt(form.price, 10),
        old_price: form.old_price ? Number.parseInt(form.old_price, 10) : null,
        category_id: form.category_id || null,
        stock: Number.parseInt(form.stock, 10),
        is_active: form.is_active,
      };

      let imageWarning = '';

      if (modal === 'add') {
        const { data: created, error } = await supabase.from('products').insert(payload).select().single();
        if (error) throw error;

        if (imgFile) {
          try {
            const imageUrl = await uploadImage(created.id);
            if (imageUrl) {
              const { error: imageError } = await supabase
                .from('products')
                .update({ image_url: imageUrl })
                .eq('id', created.id);
              if (imageError) throw imageError;
            }
          } catch (error) {
            console.error('Product image upload error:', error);
            imageWarning = error?.message || 'El producto se creo sin imagen.';
          }
        }

        toast.success(imageWarning ? 'Producto creado sin imagen' : 'Producto creado');
      } else {
        const nextUpdate = { ...payload };

        if (imgFile) {
          try {
            const imageUrl = await uploadImage(form.id);
            nextUpdate.image_url = imageUrl;

            if (form.image_url) {
              try {
                await deleteObject(ref(storage, form.image_url));
              } catch {}
            }
          } catch (error) {
            console.error('Product image upload error:', error);
            imageWarning = error?.message || 'Los cambios se guardaron sin cambiar la imagen.';
          }
        }

        const { error } = await supabase.from('products').update(nextUpdate).eq('id', form.id);
        if (error) throw error;

        toast.success(imageWarning ? 'Producto actualizado sin cambiar imagen' : 'Producto actualizado');
      }

      await load();
      setModal(null);

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

    if (product.image_url) {
      try {
        await deleteObject(ref(storage, product.image_url));
      } catch {}
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

  const filteredProducts = products.filter((product) => {
    if (filter === 'active') return product.is_active;
    if (filter === 'inactive') return !product.is_active;
    return true;
  });

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Productos</h1>
          <p style={{ fontSize: 14, color: 'var(--txt-muted)' }}>
            {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''} en vista.
          </p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">
          <Plus size={16} />
          Agregar producto
        </button>
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
        {filteredProducts.map((product) => (
          <div key={product.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                height: 160,
                borderRadius: 'var(--radius)',
                background: '#F3F4F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                fontSize: 12,
                color: 'var(--txt-muted)',
              }}
            >
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                'Sin imagen'
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{product.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--txt-muted)' }}>{product.brand || 'Sin marca'}</div>
                </div>
                <span className={`badge ${product.is_active ? 'badge-success' : 'badge-gray'}`}>
                  {product.is_active ? 'Visible' : 'Archivado'}
                </span>
              </div>

              <div style={{ fontSize: 13, color: 'var(--txt-muted)', marginTop: 8 }}>
                {product.categories ? getCategoryLabel(product.categories) : 'Sin categoria'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>Precio</div>
                <div style={{ fontWeight: 700, color: 'var(--brand)', fontFamily: "'Space Grotesk', sans-serif" }}>
                  Gs. {product.price.toLocaleString('es-PY')}
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
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="card">
          <p style={{ color: 'var(--txt-muted)' }}>No hay productos para este filtro.</p>
        </div>
      )}

      {modal && (
        <div className="overlay" onClick={(event) => event.target === event.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <h2>{modal === 'add' ? 'Agregar producto' : 'Editar producto'}</h2>
              <button className="close-btn" onClick={() => setModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="field">
                <label>Imagen del producto</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    height: 140,
                    border: '2px dashed var(--border)',
                    borderRadius: 'var(--radius)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: 'var(--bg)',
                    overflow: 'hidden',
                  }}
                >
                  {imgPrev ? (
                    <img src={imgPrev} alt="" style={{ maxHeight: 138, maxWidth: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--txt-muted)' }}>
                      <ImagePlus size={28} style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 13 }}>Click para subir imagen (max. 3 MB)</div>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImgChange} />

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
              </div>

              <div className="responsive-form-grid">
                <div className="field full-span">
                  <label>Nombre *</label>
                  <input className="input" value={form.name} onChange={(event) => setField('name', event.target.value)} />
                </div>

                <div className="field">
                  <label>Marca</label>
                  <input className="input" value={form.brand} onChange={(event) => setField('brand', event.target.value)} />
                </div>

                <div className="field">
                  <label>Categoria</label>
                  <select className="input" value={form.category_id} onChange={(event) => setField('category_id', event.target.value)}>
                    <option value="">Sin categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.emoji} {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Precio *</label>
                  <input className="input" type="number" value={form.price} onChange={(event) => setField('price', event.target.value)} />
                </div>

                <div className="field">
                  <label>Precio tachado</label>
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
                  <textarea className="input" rows={4} value={form.description} onChange={(event) => setField('description', event.target.value)} />
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setModal(null)} className="btn btn-outline">
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
