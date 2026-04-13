import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, ShoppingCart, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { getMemberPrice } from '../../lib/commerce';
import { storeConfig } from '../../config/store';

const EMOJI_MAP = { 1: 'Cel', 2: 'Aud', 3: 'Game', 4: 'Acc', 5: 'Home', 6: 'PC' };

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, startDirectCheckout } = useCart();

  const discount = product.old_price
    ? Math.round((1 - product.price / product.old_price) * 100)
    : null;
  const outOfStock = product.stock <= 0;
  const memberPrice = getMemberPrice(product.price, storeConfig);

  function handleAdd(event) {
    event.preventDefault();
    if (outOfStock) return;
    addItem(product);
    toast.success(`${product.name} agregado al carrito`);
  }

  function handleBuyNow(event) {
    event.preventDefault();
    if (outOfStock) return;

    startDirectCheckout(product);

    if (!user) {
      toast.success('Continua al pago y activa tu descuento registrandote');
    }

    navigate('/checkout');
  }

  return (
    <div
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          transition: 'border-color .15s, box-shadow .15s',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.borderColor = '#93C5FD';
          event.currentTarget.style.boxShadow = 'var(--shadow)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.borderColor = 'var(--border)';
          event.currentTarget.style.boxShadow = 'none';
        }}
      >
        <Link to={`/producto/${product.id}`} style={{ display: 'block', textDecoration: 'none' }}>
          <div
            style={{
              background: '#F3F4F6',
              height: 148,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 42,
              position: 'relative',
              userSelect: 'none',
            }}
          >
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              EMOJI_MAP[product.category_id] || 'Item'
            )}

            {discount && (
              <span className="promo-pill" style={{ top: 10, right: 10, background: 'var(--danger)', color: '#fff' }}>
                -{discount}%
              </span>
            )}

            {!product.old_price && product.created_at > new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString() && (
              <span className="promo-pill" style={{ top: 10, left: 10, background: 'var(--success)', color: '#fff' }}>
                Nuevo
              </span>
            )}

            {outOfStock && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(255,255,255,.75)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span className="promo-pill" style={{ background: '#374151', color: '#fff' }}>
                  Sin stock
                </span>
              </div>
            )}
          </div>
        </Link>

        <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>
            {product.brand}
          </div>

          <Link to={`/producto/${product.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.45, marginBottom: 8, color: 'var(--txt)' }}>
              {product.name}
            </div>
          </Link>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--brand)' }}>
                Gs. {product.price.toLocaleString('es-PY')}
              </span>
              {product.old_price && (
                <span style={{ fontSize: 12, color: 'var(--txt-muted)', textDecoration: 'line-through' }}>
                  Gs. {product.old_price.toLocaleString('es-PY')}
                </span>
              )}
            </div>

            <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
              Registrado pagas Gs. {memberPrice.toLocaleString('es-PY')}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 8, marginBottom: 8 }}>
            <Link
              to={`/producto/${product.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: '1.5px solid var(--border)',
                color: 'var(--txt-muted)',
                textDecoration: 'none',
              }}
              title="Ver detalle"
            >
              <Eye size={16} />
            </Link>

            <button
              onClick={handleAdd}
              disabled={outOfStock}
              className="btn btn-blue"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <ShoppingCart size={14} />
              {outOfStock ? 'Sin stock' : 'Agregar'}
            </button>
          </div>

          <button
            onClick={handleBuyNow}
            disabled={outOfStock}
            className="btn btn-primary btn-full"
          >
            <Zap size={14} />
            Comprar ahora
          </button>
        </div>
    </div>
  );
}
