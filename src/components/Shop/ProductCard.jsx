import { Link } from 'react-router-dom';
import { ShoppingCart, Eye } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import toast from 'react-hot-toast';

const EMOJI_MAP = { 1:'📱', 2:'🎧', 3:'🎮', 4:'🔌', 5:'🏠', 6:'💻' };

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const discount = product.old_price
    ? Math.round((1 - product.price / product.old_price) * 100)
    : null;

  const outOfStock = product.stock <= 0;

  function handleAdd(e) {
    e.preventDefault();
    if (outOfStock) return;
    addItem(product);
    toast.success(`${product.name} agregado al carrito`);
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      transition: 'border-color .15s, box-shadow .15s',
      display: 'flex', flexDirection: 'column',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#93C5FD';
        e.currentTarget.style.boxShadow = 'var(--shadow)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Imagen */}
      <Link to={`/producto/${product.id}`} style={{ display: 'block', textDecoration: 'none' }}>
        <div style={{
          background: '#F3F4F6', height: 140,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 52, position: 'relative',
          userSelect: 'none',
        }}>
          {product.image_url
            ? <img src={product.image_url} alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : EMOJI_MAP[product.category_id] || '📦'
          }
          {discount && (
            <span style={{
              position: 'absolute', top: 8, right: 8,
              background: 'var(--danger)', color: '#fff',
              fontSize: 11, fontWeight: 700,
              borderRadius: 99, padding: '2px 8px',
            }}>-{discount}%</span>
          )}
          {!product.old_price && product.created_at > new Date(Date.now() - 7*24*3600*1000).toISOString() && (
            <span style={{
              position: 'absolute', top: 8, left: 8,
              background: 'var(--success)', color: '#fff',
              fontSize: 11, fontWeight: 700,
              borderRadius: 99, padding: '2px 8px',
            }}>Nuevo</span>
          )}
          {outOfStock && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(255,255,255,.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                background: '#374151', color: '#fff',
                fontSize: 11, fontWeight: 700,
                borderRadius: 99, padding: '4px 12px',
              }}>Sin stock</span>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>
          {product.brand}
        </div>
        <Link to={`/producto/${product.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, marginBottom: 8, color: 'var(--txt)' }}>
            {product.name}
          </div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 16, fontWeight: 700, color: 'var(--brand)',
          }}>₲ {product.price.toLocaleString('es-PY')}</span>
          {product.old_price && (
            <span style={{ fontSize: 11, color: 'var(--txt-muted)', textDecoration: 'line-through' }}>
              ₲ {product.old_price.toLocaleString('es-PY')}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to={`/producto/${product.id}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 8,
              border: '1.5px solid var(--border)',
              color: 'var(--txt-muted)', flexShrink: 0,
              transition: 'border-color .15s, color .15s',
              textDecoration: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--txt-muted)'; }}
            title="Ver detalle"
          >
            <Eye size={16} />
          </Link>
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            style={{
              flex: 1, height: 36, borderRadius: 8, border: 'none',
              background: outOfStock ? 'var(--border)' : 'var(--blue)',
              color: outOfStock ? 'var(--txt-muted)' : '#fff',
              fontSize: 12, fontWeight: 600,
              cursor: outOfStock ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: "'Sora', sans-serif",
              transition: 'background .15s',
            }}
            onMouseEnter={e => { if (!outOfStock) e.currentTarget.style.background = '#1D4ED8'; }}
            onMouseLeave={e => { if (!outOfStock) e.currentTarget.style.background = 'var(--blue)'; }}
          >
            <ShoppingCart size={14} />
            {outOfStock ? 'Sin stock' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}
