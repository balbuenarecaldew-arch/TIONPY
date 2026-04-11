import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ArrowLeft, ShoppingBag } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';
import AuthModal from '../Auth/AuthModal';

const EMOJI_MAP = { 1:'📱', 2:'🎧', 3:'🎮', 4:'🔌', 5:'🏠', 6:'💻' };

export default function CartPage() {
  const { items, total, removeItem, setQty } = useCart();
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);

  function handleCheckout() {
    if (!user) { setAuthOpen(true); return; }
    navigate('/checkout');
  }

  if (items.length === 0) return (
    <div className="container" style={{ paddingTop: '3rem' }}>
      <div className="empty-state">
        <div className="icon">🛒</div>
        <h3>Tu carrito está vacío</h3>
        <p>Explorá nuestros productos y encontrá lo que buscás</p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '.75rem' }}>
          <ShoppingBag size={16} /> Ir a la tienda
        </Link>
      </div>
    </div>
  );

  const shipping = total >= 300000 ? 0 : 25000;

  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      <Link to="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--txt-muted)', fontSize: 14, textDecoration: 'none', marginBottom: '1.5rem',
      }}>
        <ArrowLeft size={16} /> Seguir comprando
      </Link>

      <h1 style={{ fontSize: 22, marginBottom: '1.5rem' }}>Mi carrito</h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 24, alignItems: 'start',
      }}>
        {/* Lista de items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => (
            <div key={item.id} className="card" style={{ display: 'flex', gap: 14 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 10,
                background: '#F3F4F6', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
              }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10 }} />
                  : EMOJI_MAP[item.category_id] || '📦'
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: .5 }}>
                  {item.brand}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, margin: '3px 0 8px', lineHeight: 1.4 }}>
                  {item.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => setQty(item.id, item.qty - 1)}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        border: '1.5px solid var(--border)',
                        background: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    ><Minus size={12} /></button>
                    <span style={{ fontWeight: 700, fontSize: 15, minWidth: 24, textAlign: 'center' }}>
                      {item.qty}
                    </span>
                    <button
                      onClick={() => setQty(item.id, item.qty + 1)}
                      disabled={item.qty >= item.stock}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        border: '1.5px solid var(--border)',
                        background: item.qty >= item.stock ? 'var(--bg)' : '#fff',
                        cursor: item.qty >= item.stock ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: item.qty >= item.stock ? 0.5 : 1,
                      }}
                    ><Plus size={12} /></button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700, fontSize: 15, color: 'var(--brand)',
                    }}>
                      ₲ {(item.price * item.qty).toLocaleString('es-PY')}
                    </span>
                    <button
                      onClick={() => removeItem(item.id)}
                      style={{
                        background: 'none', border: 'none',
                        color: 'var(--danger)', cursor: 'pointer', padding: 4,
                      }}
                      title="Eliminar"
                    ><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Resumen */}
        <div className="card" style={{ position: 'sticky', top: 80 }}>
          <h3 style={{ fontSize: 17, marginBottom: '1rem' }}>Resumen del pedido</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1rem' }}>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--txt-muted)' }}>{item.name} × {item.qty}</span>
                <span>₲ {(item.price * item.qty).toLocaleString('es-PY')}</span>
              </div>
            ))}
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--txt-muted)' }}>Envío</span>
              <span style={{ color: shipping === 0 ? 'var(--success)' : 'inherit' }}>
                {shipping === 0 ? 'GRATIS 🎉' : `₲ ${shipping.toLocaleString('es-PY')}`}
              </span>
            </div>
            {shipping > 0 && (
              <div style={{ fontSize: 12, color: 'var(--txt-muted)', fontStyle: 'italic' }}>
                Comprá ₲ {(300000 - total).toLocaleString('es-PY')} más para envío gratis
              </div>
            )}
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700, fontSize: 20, color: 'var(--brand)',
              }}>₲ {(total + shipping).toLocaleString('es-PY')}</span>
            </div>
          </div>

          <div style={{
            background: '#FFF7ED', borderRadius: 8, padding: '10px 12px',
            fontSize: 12, color: '#92400E', marginBottom: '1rem', display: 'flex', gap: 8,
          }}>
            💳 <span><strong>Pago contra entrega.</strong> Pagás cuando recibís tu pedido en casa.</span>
          </div>

          <button onClick={handleCheckout} className="btn btn-primary btn-full btn-lg">
            Finalizar compra
          </button>
        </div>
      </div>

      {authOpen && <AuthModal initialMode="login" onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
