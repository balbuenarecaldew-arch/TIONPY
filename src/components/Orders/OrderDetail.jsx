import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, MapPin, Package, ShieldCheck, Truck, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatGs } from '../../lib/promotions';

const STEPS = [
  { key: 'pendiente', label: 'Pedido recibido', icon: Clock },
  { key: 'confirmado', label: 'Confirmado', icon: CheckCircle },
  { key: 'preparando', label: 'Preparando pedido', icon: Package },
  { key: 'en_camino', label: 'En camino', icon: Truck },
  { key: 'entregado', label: 'Entregado', icon: CheckCircle },
];

const STATUS_LABEL = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  preparando: 'Preparando',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, [id]);

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

  if (!order) {
    return (
      <div className="container page-pad">
        <div className="empty-state">
          <div className="icon">Pedido</div>
          <h3>Pedido no encontrado</h3>
        </div>
      </div>
    );
  }

  const address = order.address_snapshot || {};
  const pricing = address.pricing || {};
  const isCanceled = order.status === 'cancelado';
  const activeStep = isCanceled ? -1 : STEPS.findIndex((step) => step.key === order.status);

  return (
    <div className="container page-pad">
      <Link
        to="/mis-pedidos"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--txt-muted)',
          fontSize: 14,
          textDecoration: 'none',
          marginBottom: '1rem',
        }}
      >
        <ArrowLeft size={16} />
        Mis pedidos
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: 24 }}>{order.order_number}</h1>
        <span className={`badge status-${order.status}`}>{STATUS_LABEL[order.status]}</span>
        <span style={{ color: 'var(--txt-muted)', fontSize: 13 }}>
          {new Date(order.created_at).toLocaleDateString('es-PY', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </div>

      {address.delivery_code && (
        <div className="checkout-highlight-card" style={{ marginBottom: '1rem' }}>
          <ShieldCheck size={18} />
          <div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Codigo de entrega</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>
              {address.delivery_code}
            </div>
          </div>
        </div>
      )}

      <div className="order-detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isCanceled ? (
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: '1rem' }}>Estado del pedido</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {STEPS.map((step, index) => {
                  const done = index <= activeStep;
                  const current = index === activeStep;
                  const Icon = step.icon;
                  const entry = history.find((item) => item.status === step.key);

                  return (
                    <div key={step.key} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                      {index < STEPS.length - 1 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 14,
                            top: 30,
                            width: 2,
                            height: 'calc(100% - 8px)',
                            background: index < activeStep ? 'var(--blue)' : 'var(--border)',
                          }}
                        />
                      )}
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 999,
                          flexShrink: 0,
                          background: done ? 'var(--blue)' : 'var(--bg)',
                          border: `2px solid ${done ? 'var(--blue)' : 'var(--border)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 1,
                        }}
                      >
                        <Icon size={14} color={done ? '#fff' : 'var(--txt-muted)'} />
                      </div>
                      <div style={{ paddingBottom: index < STEPS.length - 1 ? 20 : 0 }}>
                        <div style={{ fontSize: 13, fontWeight: current ? 700 : 500, color: done ? 'var(--txt)' : 'var(--txt-muted)', paddingTop: 6 }}>
                          {step.label}
                        </div>
                        {entry && (
                          <div style={{ fontSize: 11, color: 'var(--txt-muted)', marginTop: 2 }}>
                            {new Date(entry.created_at).toLocaleString('es-PY', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
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

          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={16} style={{ color: 'var(--blue)' }} />
              Direccion de entrega
            </h3>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--txt-muted)' }}>
              <strong style={{ color: 'var(--txt)' }}>{address.full_name}</strong>
              <br />
              {address.street}
              {address.neighborhood ? `, ${address.neighborhood}` : ''}
              {address.city ? `, ${address.city}` : ''}
              <br />
              {address.reference && (
                <>
                  <em>{address.reference}</em>
                  <br />
                </>
              )}
              {address.phone}
            </div>
          </div>

          {order.notes && (
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>Tu nota</h3>
              <p style={{ fontSize: 14, color: 'var(--txt-muted)' }}>{order.notes}</p>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: '1rem' }}>Productos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{item.product_snapshot.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>Cantidad: {item.quantity}</div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--brand)', fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>
                  Gs. {(item.unit_price * item.quantity).toLocaleString('es-PY')}
                </div>
              </div>
            ))}
          </div>

          <div className="divider" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
            <SummaryRow label="Subtotal" value={`Gs. ${(pricing.subtotal || order.total).toLocaleString('es-PY')}`} />
            {'discount' in pricing && (
              <SummaryRow label="Descuento total" value={`- Gs. ${(pricing.discount || 0).toLocaleString('es-PY')}`} highlight={(pricing.discount || 0) > 0} />
            )}
            {(pricing.credit_applied || 0) > 0 && (
              <SummaryRow label="Creditos aplicados" value={`- ${formatGs(pricing.credit_applied || 0)}`} highlight />
            )}
            {pricing.delivery_adjusted_distance_km !== null && pricing.delivery_adjusted_distance_km !== undefined && (
              <SummaryRow label="Distancia" value={`${pricing.delivery_adjusted_distance_km.toLocaleString('es-PY')} km`} />
            )}
            {'shipping' in pricing && (
              <SummaryRow label="Envio" value={pricing.shipping === 0 ? 'GRATIS' : `Gs. ${(pricing.shipping || 0).toLocaleString('es-PY')}`} highlight={pricing.shipping === 0} />
            )}
          </div>

          {pricing.credit_refund_processed && (
            <>
              <div className="divider" />
              <div style={{ fontSize: 13, color: 'var(--success)', lineHeight: 1.6 }}>
                El credito usado en este pedido fue reintegrado a tu cuenta.
              </div>
            </>
          )}

          <div className="divider" />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand)', fontFamily: "'Space Grotesk', sans-serif" }}>
              Gs. {order.total.toLocaleString('es-PY')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, highlight = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--txt-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: highlight ? 'var(--success)' : 'var(--txt)' }}>{value}</span>
    </div>
  );
}
