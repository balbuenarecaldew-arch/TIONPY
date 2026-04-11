import React, { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Save, Loader2, Upload, ImagePlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { storage } from '../../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import toast from 'react-hot-toast';
import { getCategoryLabel } from '../../config/store';

const EMPTY = { name:'', brand:'', description:'', price:'', old_price:'', category_id:'', stock:'', is_active:true, image_url:'' };

export default function ManageProducts() {
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(null);   // null | 'add' | 'edit'
  const [form,       setForm]       = useState(EMPTY);
  const [saving,     setSaving]     = useState(false);
  const [imgFile,    setImgFile]    = useState(null);
  const [imgPrev,    setImgPrev]    = useState('');
  const [uploadPct,  setUploadPct]  = useState(0);
  const fileRef = useRef();

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*, categories(name, slug)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
    ]);
    setProducts(prods || []);
    setCategories(cats || []);
    setLoading(false);
  }

  function openAdd()        { setForm(EMPTY); setImgFile(null); setImgPrev(''); setModal('add'); }
  function openEdit(prod)   { setForm({ ...prod, price: prod.price, old_price: prod.old_price || '', category_id: prod.category_id || '' }); setImgFile(null); setImgPrev(prod.image_url || ''); setModal('edit'); }
  function setF(k, v)       { setForm(f => ({ ...f, [k]: v })); }

  function handleImgChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error('La imagen no puede superar 3 MB'); return; }
    setImgFile(file);
    setImgPrev(URL.createObjectURL(file));
  }

  async function uploadImage(productId) {
    if (!imgFile) return form.image_url || '';
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, `products/${productId}_${Date.now()}`);
      const task = uploadBytesResumable(storageRef, imgFile);
      task.on('state_changed',
        snap => setUploadPct(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
        reject,
        async () => { resolve(await getDownloadURL(task.snapshot.ref)); }
      );
    });
  }

  async function handleSave() {
    if (!form.name || !form.price || !form.stock) { toast.error('Nombre, precio y stock son obligatorios'); return; }
    setSaving(true);
    try {
      const payload = {
        name:        form.name.trim(),
        brand:       form.brand.trim(),
        description: form.description.trim(),
        price:       parseInt(form.price),
        old_price:   form.old_price ? parseInt(form.old_price) : null,
        category_id: form.category_id || null,
        stock:       parseInt(form.stock),
        is_active:   form.is_active,
      };

      if (modal === 'add') {
        const { data: created, error } = await supabase.from('products').insert(payload).select().single();
        if (error) throw error;
        const imageUrl = await uploadImage(created.id);
        if (imageUrl !== (form.image_url || '')) {
          await supabase.from('products').update({ image_url: imageUrl }).eq('id', created.id);
          created.image_url = imageUrl;
        }
        toast.success('Producto creado');
      } else {
        // Delete old image from Firebase if replacing
        if (imgFile && form.image_url) {
          try { await deleteObject(ref(storage, form.image_url)); } catch {}
        }
        const imageUrl = await uploadImage(form.id);
        await supabase.from('products').update({ ...payload, image_url: imageUrl }).eq('id', form.id);
        toast.success('Producto actualizado');
      }
      await load();
      setModal(null);
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar el producto');
    } finally {
      setSaving(false);
      setUploadPct(0);
    }
  }

  async function handleDelete(prod) {
    if (!window.confirm(`¿Eliminar "${prod.name}"? Esta acción no se puede deshacer.`)) return;
    if (prod.image_url) {
      try { await deleteObject(ref(storage, prod.image_url)); } catch {}
    }
    await supabase.from('products').delete().eq('id', prod.id);
    toast.success('Producto eliminado');
    setProducts(prev => prev.filter(p => p.id !== prod.id));
  }

  async function toggleActive(prod) {
    await supabase.from('products').update({ is_active: !prod.is_active }).eq('id', prod.id);
    setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, is_active: !p.is_active } : p));
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22 }}>Productos ({products.length})</h1>
        <button onClick={openAdd} className="btn btn-primary">
          <Plus size={16} /> Agregar producto
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              {['Producto','Categoría','Precio','Stock','Estado','Acciones'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--txt-muted)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < products.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ color: 'var(--txt-muted)', fontSize: 12 }}>{p.brand}</div>
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--txt-muted)' }}>{p.categories?.name || '—'}</td>
                <td style={{ padding: '10px 16px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--brand)' }}>
                  ₲ {p.price.toLocaleString('es-PY')}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{
                    fontWeight: 700,
                    color: p.stock === 0 ? 'var(--danger)' : p.stock < 5 ? 'var(--warning)' : 'var(--success)',
                  }}>{p.stock}</span>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <button
                    onClick={() => toggleActive(p)}
                    style={{
                      background: p.is_active ? 'var(--success-bg)' : 'var(--danger-bg)',
                      color: p.is_active ? '#047857' : '#991B1B',
                      border: 'none', borderRadius: 99,
                      padding: '3px 10px', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', fontFamily: "'Sora', sans-serif",
                    }}
                  >{p.is_active ? 'Activo' : 'Inactivo'}</button>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => openEdit(p)} className="btn btn-outline btn-sm" title="Editar"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(p)} className="btn btn-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: 'none' }} title="Eliminar"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal add/edit */}
      {modal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2>{modal === 'add' ? 'Agregar producto' : 'Editar producto'}</h2>
              <button className="close-btn" onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Imagen */}
              <div className="field">
                <label>Imagen del producto</label>
                <div
                  onClick={() => fileRef.current.click()}
                  style={{
                    height: 120, border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    background: 'var(--bg)', overflow: 'hidden', transition: 'border-color .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--blue)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {imgPrev
                    ? <img src={imgPrev} alt="" style={{ maxHeight: 118, maxWidth: '100%', objectFit: 'contain' }} />
                    : <div style={{ textAlign: 'center', color: 'var(--txt-muted)' }}>
                        <ImagePlus size={28} style={{ marginBottom: 8 }} />
                        <div style={{ fontSize: 13 }}>Click para subir imagen (máx. 3 MB)</div>
                      </div>
                  }
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImgChange} />
                {uploadPct > 0 && uploadPct < 100 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 99 }}>
                      <div style={{ height: 4, background: 'var(--blue)', borderRadius: 99, width: `${uploadPct}%`, transition: 'width .2s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt-muted)', marginTop: 2 }}>Subiendo... {uploadPct}%</div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label>Nombre *</label>
                  <input className="input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ej: Auriculares Bluetooth" />
                </div>
                <div className="field">
                  <label>Marca</label>
                  <input className="input" value={form.brand} onChange={e => setF('brand', e.target.value)} placeholder="Ej: Sony" />
                </div>
                <div className="field">
                  <label>Categoría</label>
                  <select className="input" value={form.category_id} onChange={e => setF('category_id', e.target.value)}>
                    <option value="">— Sin categoría —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Precio (₲) *</label>
                  <input className="input" type="number" value={form.price} onChange={e => setF('price', e.target.value)} placeholder="185000" />
                </div>
                <div className="field">
                  <label>Precio tachado (₲)</label>
                  <input className="input" type="number" value={form.old_price} onChange={e => setF('old_price', e.target.value)} placeholder="Dejar vacío si no hay oferta" />
                </div>
                <div className="field">
                  <label>Stock *</label>
                  <input className="input" type="number" value={form.stock} onChange={e => setF('stock', e.target.value)} placeholder="0" />
                </div>
                <div className="field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)} style={{ width: 16, height: 16 }} />
                  <label htmlFor="is_active" style={{ cursor: 'pointer', marginBottom: 0 }}>Visible en la tienda</label>
                </div>
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label>Descripción</label>
                  <textarea className="input" rows={3} value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Descripción del producto..." />
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setModal(null)} className="btn btn-outline">Cancelar</button>
              <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                {saving
                  ? <><Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> Guardando...</>
                  : <><Save size={16} /> {modal === 'add' ? 'Crear producto' : 'Guardar cambios'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
