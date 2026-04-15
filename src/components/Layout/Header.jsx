import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Store,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import AuthModal from '../Auth/AuthModal';
import { storeConfig } from '../../config/store';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAdmin, logout } = useAuth();
  const { count } = useCart();

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    setUserMenuOpen(false);
    toast.success('Sesion cerrada');
    navigate('/');
  }

  function openLogin() {
    setAuthMode('login');
    setAuthOpen(true);
  }

  function openRegister() {
    setAuthMode('register');
    setAuthOpen(true);
  }

  const mobileNavItems = [
    { to: '/', label: 'Bodega', icon: Store, show: true },
    { to: '/carrito', label: 'Pedido', icon: ShoppingCart, show: true, badge: count },
    { to: user ? '/mis-pedidos' : '/', label: 'Pedidos', icon: Package, show: Boolean(user) },
    { to: user ? '/mi-cuenta' : '/', label: 'Cuenta', icon: User, show: true },
    { to: '/admin', label: 'Admin', icon: LayoutDashboard, show: Boolean(isAdmin) },
  ].filter((item) => item.show);

  return (
    <>
      <header
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #7C2D12 100%)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 18px rgba(17, 24, 39, 0.2)',
        }}
      >
        <div className="container header-shell">
          <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 20,
                  color: '#fff',
                  letterSpacing: '-0.5px',
                }}
              >
                {storeConfig.name}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.76)' }} className="hide-mobile">
                {storeConfig.tagline}
              </span>
            </div>
          </Link>

          <nav className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <HeaderLink to="/">Catalogo nocturno</HeaderLink>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <Link to="/carrito" className="icon-link" style={{ position: 'relative' }}>
              <ShoppingCart size={18} />
              {count > 0 && <span className="count-badge">{count}</span>}
            </Link>

            {user ? (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="header-account-btn"
                >
                  <User size={16} />
                  <span className="hide-mobile">{profile?.full_name?.split(' ')[0] || 'Mi cuenta'}</span>
                </button>

                {userMenuOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setUserMenuOpen(false)} />
                    <div className="user-menu">
                      <div className="user-menu-head">
                        <div style={{ fontWeight: 700 }}>{profile?.full_name || 'Mi cuenta'}</div>
                        <div style={{ color: 'var(--txt-muted)', fontSize: 12 }}>{user.email}</div>
                      </div>
                      <DropItem label="Mis pedidos" onClick={() => { navigate('/mis-pedidos'); setUserMenuOpen(false); }} />
                      <DropItem label="Mi cuenta" onClick={() => { navigate('/mi-cuenta'); setUserMenuOpen(false); }} />
                      {isAdmin && (
                        <DropItem label="Panel admin" onClick={() => { navigate('/admin'); setUserMenuOpen(false); }} />
                      )}
                      <DropItem label="Cerrar sesion" onClick={handleLogout} danger />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={openLogin} className="btn btn-outline header-ghost-btn">
                  Ingresar
                </button>
                <button type="button" onClick={openRegister} className="btn btn-accent btn-sm hide-mobile">
                  Crear cuenta
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="mobile-bottom-nav">
        {mobileNavItems.map((item) => {
          const isActive = item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to);
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (!user && item.label === 'Cuenta') {
                  openLogin();
                  return;
                }
                navigate(item.to);
              }}
              className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
            >
              <span style={{ position: 'relative' }}>
                <Icon size={18} />
                {item.badge > 0 && <span className="count-badge mobile-badge">{item.badge}</span>}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {authOpen && (
        <AuthModal
          initialMode={authMode}
          onClose={() => setAuthOpen(false)}
        />
      )}
    </>
  );
}

function HeaderLink({ to, children }) {
  return (
    <Link
      to={to}
      style={{
        color: 'rgba(255,255,255,.82)',
        fontSize: 14,
        fontWeight: 600,
        padding: '6px 12px',
        borderRadius: 8,
        textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  );
}

function DropItem({ label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        background: 'none',
        border: 'none',
        textAlign: 'left',
        padding: '10px 14px',
        fontSize: 13,
        fontWeight: 600,
        color: danger ? 'var(--danger)' : 'var(--txt)',
      }}
    >
      {label}
    </button>
  );
}
