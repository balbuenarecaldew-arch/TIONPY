import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Package, CheckCircle, Clock, Truck, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const STEPS = [
  { key: 'pendiente',  label: 'Pedido recibido',     icon: Clock },
  { key: 'confirmado', label: 'Confirmado',           icon: CheckCircle },
  { key: 'preparando', label: 'Preparando paquete',   icon: Package },
  { key: 'en_camino',  label: 'En camino',            icon: Truck },
  { key: 'entregado',  label: 'Entregado',            icon: CheckCircle },
];

const STATUS_LABEL = {
  pendiente: 'Pendiente', confirmado: 'Confirmado', preparando: 'Preparando',
  en_camino: 'En camino', entregado: 'Entregado',   cancelado: 'Cancelado',
};

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order,   setOrder]   = useState(null);
  const [items,   setItems]   = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchOrder(); }, [id]);

  async function fetchOrder() {
    const [{ data: ord }, { data: itms }, { data: hist }] = await Promise.all([
      supabase.from('orders').select('*').eq('id', id).eq('firebase_uid', user.uid).single(),
      supabase.from('order_items').select('*').eq('order_id', id),
      supabase.from('order_status_history').select('*').eq('order_id', id).order('created_at'),
    ]);
    setOrder(ord);
    setItems(itms || []);
    setHistory(hist || []);
    setLoading(false);
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!order)  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <div className="empty-state"><div className="icon">😕</div><h3>Pedido no encontrado</h3></div>
    </div>
  );

  const addr       = order.address_snapshot;
  const isCanceled = order.status === 'cancelado';
  const activeStep = isCanceled ? -1 : STEPS.findIndex(s => s.key === order.status);

  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      <Link to="/mis-pedidos" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--txt-muted)', fontSize: 14, textDecoration: 'none', marginBottom: '1.5rem',
      }}>
        <ArrowLeft size={16} /> Mis pedidos
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20 }}>{order.order_number}</h1>
        <span className={`badge status-${order.status}`} style={{ fontSize: 13 }}>
          {STATUS_LABEL[order.status]}
        </span>
        <span style={{ fontSize: 13, color: 'var(--txt-muted)', marginLeft: 'auto' }}>
          {new Date(order.created_at).toLocaleDateString('es-PY', {
            day: '2-digit', month: 'long', year: 'numeric',
          })}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Timeline */}
          {!isCanceled ? (
            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: '1.25rem' }}>Estado del pedido</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {STEPS.map((step, i) => {
                  const done    = i <= activeStep;
                  const current = i === activeStep;
                  const Icon    = step.icon;
                  return (
                    <div key={step.key} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                      {i < STEPS.length - 1 && (
                        <div style={{
                          position: 'absolute', left: 14, top: 30,
                          width: 2, height: 'calc(100% - 8px)',
                          background: i < activeStep ? 'var(--blue)' : 'var(--border)',
                        }} />
                      )}
                      <div style={{
                        width: 30, height: 30, borderRadius: 99, flexShrink: 0,
                        background: done ? 'var(--blue)' : 'var(--bg)',
                        border: `2px solid ${done ? 'var(--blue)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                      }}>
                        <Icon size={14} color={done ? '#fff' : 'var(--txt-muted)'} />
                      </div>
                      <div style={{ paddingBottom: i < STEPS.length - 1 ? 20 : 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: current ? 700 : 500,
                          color: done ? 'var(--txt)' : 'var(--txt-muted)', paddingTop: 6,
                        }}>{step.label}</div>
                        {history.find(h => h.status === step.key) && (
                          <div style={{ fontSize: 11, color: 'var(--txt-muted)', marginTop: 2 }}>
                            {new Date(history.find(h => h.status === step.key).created_at)
                              .toLocaleString('es-PY', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <XCircle size={28} style={{ color: 'var(--danger)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--danger)' }}>Pedido cancelado</div>
                {order.admin_notes && <div style={{ fontSize: 13, color: 'var(--txt-muted)', marginTop: 4 }}>{order.admin_notes}</div>}
              </div>
            </div>
          )}

          {/* Dirección */}
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={16} style={{ color: 'var(--blue)' }} /> Dirección de entrega
            </h3>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--txt-muted)' }}>
              <strong style={{ color: 'var(--txt)' }}>{addr.full_name}</strong><br />
              {addr.street}{addr.neighborhood ? `, ${addr.neighborhood}` : ''}, {addr.city}<br />
              {addr.reference && <><em>{addr.reference}</em><br /></>}
              📞 {addr.phone}
            </div>
          </div>

          {order.notes && (
            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: '.5rem' }}>Tu nota</h3>
              <p style={{ fontSize: 14, color: 'var(--txt-muted)' }}>{order.notes}</p>
            </div>
          )}
        </div>

        {/* Productos + total */}
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: '1rem' }}>Productos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 8,
                  background: '#F3F4F6', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>📦</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.product_snapshot.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>×{item.quantity}</div>
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--brand)' }}>
                  ₲ {(item.unit_price * item.quantity).toLocaleString('es-PY')}
                </div>
              </div>
            ))}
          </div>
          <div className="divider" style={{ margin: '1rem 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700 }}>Total</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--brand)' }}>
              ₲ {order.total.toLocaleString('es-PY')}
            </span>
          </div>
          <div style={{
            background: '#FFF7ED', borderRadius: 8, padding: '10px 12px',
            fontSize: 12, color: '#92400E', marginTop: '1rem',
          }}>
            💵 Pago contra entrega al momento de recibir el pedido.
          </div>
        </div>
      </div>
    </div>
  );
}
