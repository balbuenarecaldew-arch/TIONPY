import React, { useEffect, useState } from 'react';
import { ShoppingBag, Users, Package, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const STATUS_LABEL = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  preparando: 'Preparando',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { count: totalOrders },
        { count: totalUsers },
        { count: totalProducts },
        { data: recentOrders },
        { data: revenue },
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_admin', false),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('orders').select('total').neq('status', 'cancelado'),
      ]);

      setStats({
        orders: totalOrders || 0,
        users: totalUsers || 0,
        products: totalProducts || 0,
        revenue: (revenue || []).reduce((sum, item) => sum + item.total, 0),
      });
      setRecent(recentOrders || []);
      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return <div className="page-loading"><div className="spinner" /></div>;
  }

  const cards = [
    { label: 'Pedidos totales', value: stats.orders, icon: ShoppingBag, color: 'var(--brand)', bg: '#FFF7ED' },
    { label: 'Clientes', value: stats.users, icon: Users, color: 'var(--success)', bg: 'var(--success-bg)' },
    { label: 'Productos activos', value: stats.products, icon: Package, color: 'var(--accent)', bg: '#FFFBEB' },
    { label: 'Ventas acumuladas', value: `Gs. ${stats.revenue.toLocaleString('es-PY')}`, icon: TrendingUp, color: 'var(--brand)', bg: '#FFF4E6' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: '1.5rem' }}>Operacion nocturna</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: '2rem' }}>
        {cards.map((card) => (
          <div key={card.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: card.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <card.icon size={20} style={{ color: card.color }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--txt-muted)', marginBottom: 2 }}>{card.label}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--brand)' }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: 16 }}>Pedidos recientes</h2>
          <Link to="/admin/pedidos" style={{ fontSize: 13, color: 'var(--blue)' }}>Ver todos</Link>
        </div>

        {recent.length === 0 ? (
          <p style={{ color: 'var(--txt-muted)', fontSize: 14 }}>Todavia no entraron pedidos</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recent.map((order, index) => (
              <div
                key={order.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: index < recent.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{order.order_number}</div>
                  <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>{order.customer_name}</div>
                </div>
                <span className={`badge status-${order.status}`}>{STATUS_LABEL[order.status]}</span>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--brand)', minWidth: 110, textAlign: 'right' }}>
                  Gs. {order.total.toLocaleString('es-PY')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
