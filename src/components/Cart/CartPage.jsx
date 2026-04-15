import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Minus, Plus, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import AuthModal from '../Auth/AuthModal';
import { buildCheckoutSummary } from '../../lib/commerce';
import { storeConfig } from '../../config/store';
import { getCategoryMeta, getProductCategorySlug } from '../../config/catalog';

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

  if (items.length === 0) {
    return (
      <div className="container page-pad">
        <div className="empty-state">
          <div className="icon">Pedido</div>
          <h3>Tu pedido esta vacio</h3>
          <p>Agrega bebidas, hielo, snacks, farmacia basica o un combo para arrancar.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '0.75rem' }}>
            <ShoppingBag size={16} />
            Ir a la bodega
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
        Agregar mas productos
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
                <h1 style={{ fontSize: 24, marginBottom: 4 }}>Tu pedido</h1>
                <p style={{ fontSize: 14, color: 'var(--txt-muted)' }}>
                  {items.length} producto{items.length !== 1 ? 's' : ''} listos para confirmar.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item) => {
              const categoryMeta = getCategoryMeta(item.categories || getProductCategorySlug(item));

              return (
                <div key={item.id} className="card cart-item-card">
                  <div
                    className="cart-thumb"
                    style={{
                      background: item.image_url ? '#F3F4F6' : categoryMeta?.gradient || '#1F2937',
                      color: '#fff',
                    }}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', padding: 10 }}>
                        <div style={{ fontSize: 10, opacity: 0.82, marginBottom: 4 }}>{categoryMeta?.badge || 'CAT'}</div>
                        <strong style={{ fontSize: 12 }}>{item.name}</strong>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: categoryMeta?.accent || 'var(--brand)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      {categoryMeta?.name || 'Pedido rapido'}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, margin: '4px 0 8px', lineHeight: 1.4 }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>
                      Delivery {storeConfig.service.eta}
                    </div>
                  </div>

                  <div className="cart-item-actions">
                    <div className="cart-item-qty-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

                    <div className="cart-item-price-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontWeight: 700, color: 'var(--brand)', fontFamily: "'Space Grotesk', sans-serif" }}>
                        Gs. {(item.price * item.qty).toLocaleString('es-PY')}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', padding: 4 }}
                        title="Quitar del pedido"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="cart-sidebar">
          <div className="card checkout-summary-card">
            <h3 style={{ fontSize: 18, marginBottom: '1rem' }}>Resumen rapido</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
              <SummaryRow label="Subtotal" value={`Gs. ${summary.subtotal.toLocaleString('es-PY')}`} />
              <SummaryRow
                label={`Ahorro por cuenta (${storeConfig.discounts.memberPercent}%)`}
                value={
                  user
                    ? `- Gs. ${summary.discount.toLocaleString('es-PY')}`
                    : `Ahorra Gs. ${Math.round((summary.subtotal * storeConfig.discounts.memberPercent) / 100).toLocaleString('es-PY')}`
                }
                highlight
              />
              <SummaryRow label="Costo de delivery" value="Se calcula por zona en checkout" />
            </div>

            <div className="divider" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700 }}>Total parcial</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand)', fontFamily: "'Space Grotesk', sans-serif" }}>
                Gs. {summary.subtotalAfterDiscount.toLocaleString('es-PY')}
              </span>
            </div>

            <div className="cart-info-stack">
              <div className="cart-info-item">
                <Clock size={15} />
                <span>Entrega estimada: {storeConfig.service.eta}</span>
              </div>
              <div className="cart-info-item">
                <Truck size={15} />
                <span>Horario: {storeConfig.service.hours}</span>
              </div>
            </div>

            <button onClick={() => navigate('/checkout')} className="btn btn-primary btn-full btn-lg" style={{ marginTop: '1rem' }}>
              {user ? 'Confirmar pedido' : 'Continuar con mi pedido'}
            </button>

            {!user && (
              <button onClick={() => setAuthOpen(true)} className="btn btn-outline btn-full" style={{ marginTop: '0.75rem' }}>
                Crear cuenta y guardar mis datos
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
