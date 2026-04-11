import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Plus, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import toast from 'react-hot-toast';
import { storeConfig } from '../../config/store';

export default function CheckoutPage() {
  const { user, profile } = useAuth();
  const { items, total, clearCart } = useCart();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddr, setSelectedAddr] = useState(null);
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [addrLoading, setAddrLoading] = useState(true);

  const [addrForm, setAddrForm] = useState({
    label: 'Casa', full_name: profile?.full_name || '',
    phone: profile?.phone || '', street: '',
    neighborhood: '', city: 'Asunción', reference: '',
  });
  const [addrErrors, setAddrErrors] = useState({});

  useEffect(() => { fetchAddresses(); }, []);

  async function fetchAddresses() {
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('firebase_uid', user.uid)
      .order('is_default', { ascending: false });
    setAddresses(data || []);
    if (data?.length > 0) setSelectedAddr(data.find(a => a.is_default) || data[0]);
    else setShowAddrForm(true);
    setAddrLoading(false);
  }

  function setField(k, v) {
    setAddrForm(f => ({ ...f, [k]: v }));
    setAddrErrors(e => ({ ...e, [k]: '' }));
  }

  function validateAddr() {
    const e = {};
    if (!addrForm.full_name) e.full_name = 'Requerido';
    if (!addrForm.phone)     e.phone     = 'Requerido';
    if (!addrForm.street)    e.street    = 'Requerido';
    setAddrErrors(e);
    return Object.keys(e).length === 0;
  }

  async function saveAddress() {
    if (!validateAddr()) return;
    const isFirst = addresses.length === 0;
    const { data, error } = await supabase
      .from('addresses')
      .insert({ ...addrForm, firebase_uid: user.uid, is_default: isFirst })
      .select().single();
    if (error) { toast.error('Error al guardar la dirección'); return; }
    setAddresses(prev => [data, ...prev]);
    setSelectedAddr(data);
    setShowAddrForm(false);
    toast.success('Dirección guardada');
  }

  async function placeOrder() {
    if (!selectedAddr) { toast.error('Seleccioná una dirección de entrega'); return; }
    if (items.length === 0) { navigate('/'); return; }

    setLoading(true);
    try {
      const shipping = total >= storeConfig.shipping.freeFrom ? 0 : storeConfig.shipping.cost;
      const orderTotal = total + shipping;

      // 1. Crear el pedido
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          firebase_uid:   user.uid,
          customer_email: user.email,
          customer_name:  profile?.full_name || user.email,
          address_snapshot: {
            label:        selectedAddr.label,
            full_name:    selectedAddr.full_name,
            phone:        selectedAddr.phone,
            street:       selectedAddr.street,
            neighborhood: selectedAddr.neighborhood,
            city:         selectedAddr.city,
            reference:    selectedAddr.reference,
          },
          total:  orderTotal,
          notes,
          status: 'pendiente',
        })
        .select().single();

      if (orderErr) throw orderErr;

      // 2. Insertar items
      const orderItems = items.map(item => ({
        order_id:   order.id,
        product_id: item.id,
        product_snapshot: {
          id:    item.id,
          name:  item.name,
          brand: item.brand,
          image_url: item.image_url || '',
        },
        quantity:   item.qty,
        unit_price: item.price,
      }));

      const { error: itemsErr } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsErr) throw itemsErr;

      // 3. Registrar estado inicial en historial
      await supabase.from('order_status_history').insert({
        order_id: order.id, status: 'pendiente', note: 'Pedido recibido',
      });

      clearCart();
      toast.success('¡Pedido realizado con éxito! 🎉');
      navigate(`/mis-pedidos/${order.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Error al procesar el pedido. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  const shipping = total >= storeConfig.shipping.freeFrom ? 0 : storeConfig.shipping.cost;

  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      <h1 style={{ fontSize: 22, marginBottom: '1.5rem' }}>Finalizar compra</h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 24, alignItems: 'start',
      }}>
        {/* Dirección */}
        <div>
          <h2 style={{ fontSize: 16, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={18} style={{ color: 'var(--blue)' }} /> Dirección de entrega
          </h2>

          {addrLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt-muted)', fontSize: 14 }}>
              <div className="spinner" style={{ width: 18, height: 18 }} /> Cargando direcciones...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {addresses.map(addr => (
                <div
                  key={addr.id}
                  onClick={() => setSelectedAddr(addr)}
                  style={{
                    border: `2px solid ${selectedAddr?.id === addr.id ? 'var(--blue)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    padding: '14px',
                    cursor: 'pointer',
                    background: selectedAddr?.id === addr.id ? 'var(--blue-light)' : '#fff',
                    transition: 'border-color .15s',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 99,
                    border: `2px solid ${selectedAddr?.id === addr.id ? 'var(--blue)' : 'var(--border)'}`,
                    background: selectedAddr?.id === addr.id ? 'var(--blue)' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 2,
                  }}>
                    {selectedAddr?.id === addr.id && <Check size={12} color="#fff" />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {addr.label} — {addr.full_name}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--txt-muted)', lineHeight: 1.6 }}>
                      {addr.street}, {addr.neighborhood && `${addr.neighborhood}, `}{addr.city}
                      {addr.reference && <><br /><em>{addr.reference}</em></>}
                      <br />📞 {addr.phone}
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setShowAddrForm(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'none', border: '1.5px dashed var(--border)',
                  borderRadius: 'var(--radius)', padding: '12px 16px',
                  fontSize: 13, fontWeight: 600, color: 'var(--blue)', cursor: 'pointer',
                  fontFamily: "'Sora', sans-serif",
                }}
              >
                {showAddrForm ? <ChevronUp size={16} /> : <Plus size={16} />}
                {showAddrForm ? 'Cancelar' : 'Agregar nueva dirección'}
              </button>

              {showAddrForm && (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="field" style={{ gridColumn: '1/-1' }}>
                      <label>Etiqueta</label>
                      <select className="input" value={addrForm.label} onChange={e => setField('label', e.target.value)}>
                        <option>Casa</option><option>Trabajo</option><option>Otro</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Nombre completo *</label>
                      <input className={`input ${addrErrors.full_name ? 'error' : ''}`}
                        value={addrForm.full_name} onChange={e => setField('full_name', e.target.value)} />
                      {addrErrors.full_name && <span className="error-msg">{addrErrors.full_name}</span>}
                    </div>
                    <div className="field">
                      <label>Teléfono *</label>
                      <input className={`input ${addrErrors.phone ? 'error' : ''}`}
                        value={addrForm.phone} onChange={e => setField('phone', e.target.value)}
                        placeholder="0981 000 000" />
                      {addrErrors.phone && <span className="error-msg">{addrErrors.phone}</span>}
                    </div>
                    <div className="field" style={{ gridColumn: '1/-1' }}>
                      <label>Calle y número *</label>
                      <input className={`input ${addrErrors.street ? 'error' : ''}`}
                        value={addrForm.street} onChange={e => setField('street', e.target.value)}
                        placeholder="Ej: Av. Mcal. López 1234" />
                      {addrErrors.street && <span className="error-msg">{addrErrors.street}</span>}
                    </div>
                    <div className="field">
                      <label>Barrio</label>
                      <input className="input" value={addrForm.neighborhood}
                        onChange={e => setField('neighborhood', e.target.value)}
                        placeholder="Ej: Villa Morra" />
                    </div>
                    <div className="field">
                      <label>Ciudad</label>
                      <input className="input" value={addrForm.city}
                        onChange={e => setField('city', e.target.value)} />
                    </div>
                    <div className="field" style={{ gridColumn: '1/-1' }}>
                      <label>Referencia adicional</label>
                      <input className="input" value={addrForm.reference}
                        onChange={e => setField('reference', e.target.value)}
                        placeholder="Ej: Casa blanca, portón azul" />
                    </div>
                  </div>
                  <button onClick={saveAddress} className="btn btn-blue btn-full">
                    <Check size={16} /> Guardar dirección
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Nota del cliente */}
          <div className="field" style={{ marginTop: '1.5rem' }}>
            <label>Nota para el repartidor (opcional)</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Ej: Dejar con el portero, llamar antes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Resumen */}
        <div className="card" style={{ position: 'sticky', top: 80 }}>
          <h3 style={{ fontSize: 17, marginBottom: '1rem' }}>Tu pedido</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
            {items.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--txt-muted)' }}>{i.name} × {i.qty}</span>
                <span>₲ {(i.price * i.qty).toLocaleString('es-PY')}</span>
              </div>
            ))}
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--txt-muted)' }}>Envío</span>
              <span style={{ color: shipping === 0 ? 'var(--success)' : 'inherit' }}>
                {shipping === 0 ? 'GRATIS' : `₲ ${shipping.toLocaleString('es-PY')}`}
              </span>
            </div>
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700 }}>Total a pagar</span>
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700, fontSize: 20, color: 'var(--brand)',
              }}>₲ {(total + shipping).toLocaleString('es-PY')}</span>
            </div>
          </div>

          <div style={{
            background: '#F0FDF4', borderRadius: 8, padding: '12px',
            fontSize: 13, color: '#166534', marginBottom: '1rem',
          }}>
            💵 <strong>Pago contra entrega.</strong> Tenés el efectivo listo cuando llegue el repartidor.
          </div>

          <button
            onClick={placeOrder}
            disabled={loading || !selectedAddr}
            className="btn btn-primary btn-full btn-lg"
          >
            {loading
              ? <><Loader2 size={18} style={{ animation: 'spin .7s linear infinite' }} /> Procesando...</>
              : '✅ Confirmar pedido'
            }
          </button>
          {!selectedAddr && (
            <p style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center', marginTop: 8 }}>
              Seleccioná o agregá una dirección de entrega
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
