import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingBag, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/admin',           icon: LayoutDashboard, label: 'Dashboard',  end: true },
  { to: '/admin/productos', icon: Package,          label: 'Productos'            },
  { to: '/admin/pedidos',   icon: ShoppingBag,      label: 'Pedidos'              },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate   = useNavigate();

  async function handleLogout() {
    await logout();
    toast.success('Sesión cerrada');
    navigate('/');
  }

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 58px)' }}>
      <aside style={{
        width: 220, background: 'var(--brand)', color: '#fff',
        display: 'flex', flexDirection: 'column',
        padding: '1.5rem 0', flexShrink: 0,
        position: 'sticky', top: 58, height: 'calc(100vh - 58px)',
      }}>
        <div style={{ padding: '0 1.25rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, opacity: .5 }}>
            Panel admin
          </div>
        </div>
        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 1.25rem',
                fontSize: 14, fontWeight: 500,
                color: isActive ? '#fff' : 'rgba(255,255,255,.65)',
                background: isActive ? 'rgba(255,255,255,.12)' : 'transparent',
                textDecoration: 'none',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'all .15s',
              })}
            >
              <n.icon size={17} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'none', border: 'none', color: 'rgba(255,255,255,.65)',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              fontFamily: "'Sora', sans-serif", padding: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.65)'}
          >
            <LogOut size={17} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: '1.5rem 2rem', background: 'var(--bg)', overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
