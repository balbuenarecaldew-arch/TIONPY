import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, ShieldCheck, ShoppingBag, Sparkles, Trash2 } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import AuthModal from '../Auth/AuthModal';
import { buildCheckoutSummary } from '../../lib/commerce';
import { storeConfig } from '../../config/store';

const EMOJI_MAP = { 1: 'Cel', 2: 'Aud', 3: 'Game', 4: 'Acc', 5: 'Home', 6: 'PC' };

export default function CartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, removeItem, setQty, clearDirectCheckout } = useCart();
  const [authOpen, setAuthOpen] = useState(false);

  const summary = buildCheckoutSummary(items, Boolean(user), storeConfig, { shippingOverride: 0 });

  useEffect(() => {
    clearDirectCheckout();
    // Entrar al carrito desactiva el modo "comprar ahora".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openRegister() {
    setAuthOpen(true);
  }

  function handleCheckout() {
    navigate('/checkout');
  }

  if (items.length === 0) {
    return (
      <div className="container page-pad">
        <div className="empty-state">
          <div className="icon">Carrito</div>
          <h3>Tu carrito esta vacio</h3>
          <p>Explora la tienda y agrega algo que valga la pena.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '0.75rem' }}>
            <ShoppingBag size={16} />
            Ir a la tienda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-pad">
      <Link
        to="/"
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
        Seguir comprando
      </Link>

      <div className="cart-shell">
        <div className="cart-main">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h1 style={{ fontSize: 24, marginBottom: 4 }}>Mi carrito</h1>
                <p style={{ fontSize: 14, color: 'var(--txt-muted)' }}>
                  {items.length} producto{items.length !== 1 ? 's' : ''} listos para pagar.
                </p>
              </div>
              <div className="highlight-chip">
                <Sparkles size={14} />
                Registrados: {storeConfig.discounts.memberPercent}% OFF en el total
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item) => (
              <div key={item.id} className="card cart-item-card">
                <div className="cart-thumb">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    EMOJI_MAP[item.category_id] || 'Item'
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {item.brand}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, margin: '4px 0 8px', lineHeight: 1.4 }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                    El descuento se calcula sobre el total del pedido.
                  </div>
                </div>

                <div className="cart-item-actions">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" className="qty-btn" onClick={() => setQty(item.id, item.qty - 1)}>
                      <Minus size={12} />
                    </button>
                    <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{item.qty}</span>
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => setQty(item.id, item.qty + 1)}
                      disabled={item.qty >= item.stock}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontWeight: 700, color: 'var(--brand)', fontFamily: "'Space Grotesk', sans-serif" }}>
                      Gs. {(item.price * item.qty).toLocaleString('es-PY')}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', padding: 4 }}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="cart-sidebar">
          <div className="card checkout-summary-card">
            <h3 style={{ fontSize: 18, marginBottom: '1rem' }}>Resumen del pago</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
              <SummaryRow label="Subtotal" value={`Gs. ${summary.subtotal.toLocaleString('es-PY')}`} />
              <SummaryRow
                label={`Descuento total por registro (${storeConfig.discounts.memberPercent}%)`}
                value={
                  user
                    ? `- Gs. ${summary.discount.toLocaleString('es-PY')}`
                    : 'Se activa al registrarte'
                }
                highlight={Boolean(user)}
              />
              <SummaryRow label="Delivery" value="Se calcula con Maps en checkout" />
            </div>

            <div className="divider" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700 }}>Total sin delivery</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand)', fontFamily: "'Space Grotesk', sans-serif" }}>
                Gs. {summary.subtotalAfterDiscount.toLocaleString('es-PY')}
              </span>
            </div>

            {!user && (
              <div className="checkout-highlight-card" style={{ marginTop: '1rem' }}>
                <ShieldCheck size={18} />
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>Activa el descuento ahora</div>
                  <div style={{ fontSize: 13 }}>
                    Registrate y ahorra Gs. {Math.round((summary.subtotal * storeConfig.discounts.memberPercent) / 100).toLocaleString('es-PY')} en el total de este pedido.
                  </div>
                </div>
              </div>
            )}

            {user && summary.discount > 0 && (
              <div className="checkout-highlight-card" style={{ marginTop: '1rem' }}>
                <ShieldCheck size={18} />
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>Descuento total aplicado</div>
                  <div style={{ fontSize: 13 }}>
                    Estas ahorrando Gs. {summary.discount.toLocaleString('es-PY')} en esta compra.
                  </div>
                </div>
              </div>
            )}

            <button onClick={handleCheckout} className="btn btn-primary btn-full btn-lg" style={{ marginTop: '1rem' }}>
              {user ? 'Ir al pago' : 'Ir al pago y activar descuento'}
            </button>

            {!user && (
              <button onClick={openRegister} className="btn btn-outline btn-full" style={{ marginTop: '0.75rem' }}>
                Registrarme ahora
              </button>
            )}
          </div>
        </aside>
      </div>

      {authOpen && (
        <AuthModal
          initialMode="register"
          onClose={() => setAuthOpen(false)}
        />
      )}
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
