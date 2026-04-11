import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_LABEL = {
  pendiente:  'Pendiente',
  confirmado: 'Confirmado',
  preparando: 'Preparando',
  en_camino:  'En camino',
  entregado:  'Entregado',
  cancelado:  'Cancelado',
};

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('orders')
      .select('*, order_items(id)')
      .eq('firebase_uid', user.uid)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setOrders(data || []); setLoading(false); });
  }, [user.uid]);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      <h1 style={{ fontSize: 22, marginBottom: '1.5rem' }}>Mis pedidos</h1>

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📦</div>
          <h3>Todavía no hiciste ningún pedido</h3>
          <p>Explorá la tienda y realizá tu primera compra</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '.75rem' }}>
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map(order => (
            <Link
              key={order.id}
              to={`/mis-pedidos/${order.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="card" style={{
                display: 'flex', alignItems: 'center', gap: 16,
                cursor: 'pointer', transition: 'border-color .15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#93C5FD'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'var(--blue-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Package size={20} style={{ color: 'var(--blue)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>
                      {order.order_number}
                    </span>
                    <span className={`badge status-${order.status}`}>
                      {STATUS_LABEL[order.status]}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--txt-muted)', marginTop: 4 }}>
                    {order.order_items.length} producto{order.order_items.length !== 1 ? 's' : ''}
                    {' · '}
                    {new Date(order.created_at).toLocaleDateString('es-PY', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700, fontSize: 16, color: 'var(--brand)',
                  }}>
                    ₲ {order.total.toLocaleString('es-PY')}
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--txt-muted)', marginTop: 4 }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
