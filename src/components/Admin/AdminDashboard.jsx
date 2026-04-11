import { useState, useEffect } from 'react';
import { ShoppingBag, Users, Package, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

const STATUS_LABEL = {
  pendiente: 'Pendiente', confirmado: 'Confirmado', preparando: 'Preparando',
  en_camino: 'En camino', entregado: 'Entregado',   cancelado: 'Cancelado',
};

export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { count: totalOrders },
        { count: totalUsers  },
        { count: totalProds  },
        { data: recentOrders },
        { data: revenue      },
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_admin', false),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('orders').select('total').neq('status', 'cancelado'),
      ]);
      setStats({
        orders:  totalOrders || 0,
        users:   totalUsers  || 0,
        prods:   totalProds  || 0,
        revenue: (revenue || []).reduce((s, o) => s + o.total, 0),
      });
      setRecent(recentOrders || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const CARDS = [
    { label: 'Pedidos totales',   value: stats.orders, icon: ShoppingBag, color: 'var(--blue)',    bg: 'var(--blue-light)' },
    { label: 'Clientes',          value: stats.users,  icon: Users,       color: 'var(--success)', bg: 'var(--success-bg)' },
    { label: 'Productos activos', value: stats.prods,  icon: Package,     color: 'var(--accent)',  bg: '#FFFBEB' },
    { label: 'Ingresos totales',  value: `₲ ${stats.revenue.toLocaleString('es-PY')}`, icon: TrendingUp, color: 'var(--brand)', bg: '#EEF2FF' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: '1.5rem' }}>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: '2rem' }}>
        {CARDS.map(c => (
          <div key={c.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: c.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <c.icon size={20} style={{ color: c.color }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--txt-muted)', marginBottom: 2 }}>{c.label}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--brand)' }}>{c.value}</div>
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
          <p style={{ color: 'var(--txt-muted)', fontSize: 14 }}>No hay pedidos aún</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recent.map((o, i) => (
              <div key={o.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{o.order_number}</div>
                  <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>{o.customer_name}</div>
                </div>
                <span className={`badge status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--brand)', minWidth: 110, textAlign: 'right' }}>
                  ₲ {o.total.toLocaleString('es-PY')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
