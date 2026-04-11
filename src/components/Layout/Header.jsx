import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, LogOut, Package, Settings, ChevronDown, Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import AuthModal  from '../Auth/AuthModal';
import toast from 'react-hot-toast';
import { storeConfig } from '../../config/store';

export default function Header() {
  const { user, profile, isAdmin, logout } = useAuth();
  const { count } = useCart();
  const navigate  = useNavigate();

  const [authOpen,    setAuthOpen]    = useState(false);
  const [authMode,    setAuthMode]    = useState('login'); // 'login' | 'register'
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    setUserMenuOpen(false);
    toast.success('Sesión cerrada');
    navigate('/');
  }

  function openLogin()    { setAuthMode('login');    setAuthOpen(true); }
  function openRegister() { setAuthMode('register'); setAuthOpen(true); }

  return (
    <>
      <header style={{
        background: 'var(--brand)',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,.2)',
      }}>
        <div className="container" style={{
          display: 'flex', alignItems: 'center',
          gap: 12, height: 58, position: 'relative',
        }}>
          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700, fontSize: 20,
              color: '#fff', letterSpacing: '-0.5px',
            }}>
              {storeConfig.name}
            </span>
          </Link>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Nav links — desktop */}
          <nav className="hide-mobile" style={{ display: 'flex', gap: 4 }}>
            <Link to="/" style={{
              color: 'rgba(255,255,255,.75)', fontSize: 14, fontWeight: 500,
              padding: '6px 12px', borderRadius: 6, textDecoration: 'none',
              transition: 'color .15s',
            }}
              onMouseEnter={e => e.target.style.color = '#fff'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,.75)'}
            >Tienda</Link>
          </nav>

          {/* Cart */}
          <Link to="/carrito" style={{ position: 'relative', textDecoration: 'none' }}>
            <button style={{
              background: 'rgba(255,255,255,.12)',
              border: 'none', borderRadius: 8, width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', cursor: 'pointer', transition: 'background .15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.12)'}
            >
              <ShoppingCart size={18} />
            </button>
            {count > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: 'var(--accent)', color: 'var(--brand)',
                borderRadius: 99, fontSize: 10, fontWeight: 700,
                minWidth: 18, height: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px',
              }}>{count}</span>
            )}
          </Link>

          {/* Auth / User menu */}
          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,.12)',
                  border: 'none', borderRadius: 8,
                  padding: '0 12px', height: 40, color: '#fff',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.12)'}
              >
                <User size={16} />
                <span className="hide-mobile">
                  {profile?.full_name?.split(' ')[0] || 'Mi cuenta'}
                </span>
                <ChevronDown size={14} />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div style={{
                    position: 'absolute', top: 48, right: 0,
                    background: '#fff', borderRadius: 10,
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow)',
                    minWidth: 200, zIndex: 11,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 13,
                    }}>
                      <div style={{ fontWeight: 600 }}>{profile?.full_name}</div>
                      <div style={{ color: 'var(--txt-muted)', fontSize: 12 }}>{user.email}</div>
                    </div>
                    <DropItem icon={<Package size={15} />} label="Mis pedidos"
                      onClick={() => { navigate('/mis-pedidos'); setUserMenuOpen(false); }} />
                    <DropItem icon={<User size={15} />} label="Mi cuenta"
                      onClick={() => { navigate('/mi-cuenta'); setUserMenuOpen(false); }} />
                    {isAdmin && (
                      <DropItem icon={<Settings size={15} />} label="Panel admin"
                        onClick={() => { navigate('/admin'); setUserMenuOpen(false); }} />
                    )}
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      <DropItem icon={<LogOut size={15} />} label="Cerrar sesión"
                        onClick={handleLogout} danger />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={openLogin}
                style={{
                  background: 'rgba(255,255,255,.12)',
                  border: 'none', borderRadius: 8,
                  padding: '0 14px', height: 40, color: '#fff',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.12)'}
              >Ingresar</button>
              <button
                onClick={openRegister}
                className="btn btn-accent btn-sm hide-mobile"
              >Registrarse</button>
            </div>
          )}
        </div>
      </header>

      {authOpen && (
        <AuthModal
          initialMode={authMode}
          onClose={() => setAuthOpen(false)}
        />
      )}
    </>
  );
}

function DropItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '10px 16px',
        background: 'none', border: 'none',
        fontSize: 13, fontWeight: 500,
        color: danger ? 'var(--danger)' : 'var(--txt)',
        cursor: 'pointer', textAlign: 'left',
        transition: 'background .12s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      {icon}
      {label}
    </button>
  );
}
