import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Package, ShoppingBag, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/productos', icon: Package, label: 'Productos' },
  { to: '/admin/pedidos', icon: ShoppingBag, label: 'Pedidos' },
  { to: '/admin/delivery', icon: Truck, label: 'Delivery' },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    toast.success('Sesion cerrada');
    navigate('/');
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div style={{ padding: '0 1.25rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.55 }}>
            Panel admin
          </div>
        </div>

        <nav className="admin-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <button type="button" onClick={handleLogout} className="admin-logout-btn">
            <LogOut size={17} />
            Cerrar sesion
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-mobile-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-mobile-tab ${isActive ? 'active' : ''}`}
            >
              <item.icon size={15} />
              {item.label}
            </NavLink>
          ))}
        </div>
        <Outlet />
      </main>
    </div>
  );
}
