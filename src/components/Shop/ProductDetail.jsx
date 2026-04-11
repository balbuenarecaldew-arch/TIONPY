import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Package, Truck, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../contexts/CartContext';
import toast from 'react-hot-toast';
import { getCategoryLabel, storeConfig } from '../../config/store';

const EMOJI_MAP = {
  1: '📱',
  2: '🎧',
  3: '🎮',
  4: '🔌',
  5: '🏠',
  6: '💻',
};

export default function ProductDetail() {
  const { id } = useParams();
  const { addItem, items } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('products')
      .select('*, categories(name, slug)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setProduct(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="page-loading"><div className="spinner" /></div>;
  }

  if (!product) {
    return (
      <div className="container" style={{ paddingTop: '2rem' }}>
        <div className="empty-state">
          <div className="icon">?</div>
          <h3>Producto no encontrado</h3>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '.5rem' }}>
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  const discount = product.old_price
    ? Math.round((1 - product.price / product.old_price) * 100)
    : null;
  const outOfStock = product.stock <= 0;
  const inCart = items.find((item) => item.id === product.id);

  function handleAdd() {
    if (outOfStock) return;
    addItem(product);
    toast.success('Agregado al carrito');
  }

  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--txt-muted)',
          fontSize: 14,
          textDecoration: 'none',
          marginBottom: '1.5rem',
        }}
      >
        <ArrowLeft size={16} /> Volver a la tienda
      </Link>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 32,
        }}
      >
        <div
          style={{
            background: '#F3F4F6',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 300,
            fontSize: 80,
            position: 'relative',
          }}
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              style={{
                maxWidth: '100%',
                maxHeight: 300,
                objectFit: 'contain',
                borderRadius: 'var(--radius-lg)',
              }}
            />
          ) : (
            EMOJI_MAP[product.category_id] || '📦'
          )}

          {discount && (
            <span
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'var(--danger)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 99,
                padding: '4px 12px',
              }}
            >
              -{discount}%
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--blue)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              {product.brand} · {getCategoryLabel(product.categories)}
            </div>
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>{product.name}</h1>
            {product.description && (
              <p style={{ fontSize: 14, color: 'var(--txt-muted)', lineHeight: 1.7 }}>
                {product.description}
              </p>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 28,
                  fontWeight: 700,
                  color: 'var(--brand)',
                }}
              >
                Gs. {product.price.toLocaleString('es-PY')}
              </span>
              {product.old_price && (
                <span
                  style={{
                    fontSize: 16,
                    color: 'var(--txt-muted)',
                    textDecoration: 'line-through',
                  }}
                >
                  Gs. {product.old_price.toLocaleString('es-PY')}
                </span>
              )}
            </div>
            {discount && (
              <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, marginTop: 4 }}>
                Ahorras Gs. {(product.old_price - product.price).toLocaleString('es-PY')} ({discount}% off)
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: 13,
              color: outOfStock ? 'var(--danger)' : 'var(--success)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Package size={14} />
            {outOfStock ? 'Sin stock' : `Stock disponible: ${product.stock} unidades`}
          </div>

          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className="btn btn-blue btn-lg btn-full"
          >
            <ShoppingCart size={18} />
            {outOfStock ? 'Sin stock' : inCart ? `Agregar otro (${inCart.qty} en carrito)` : 'Agregar al carrito'}
          </button>

          <Link to="/carrito" className="btn btn-outline btn-lg btn-full">
            Ver carrito
          </Link>

          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              marginTop: 4,
            }}
          >
            {[
              { icon: <Truck size={16} />, title: 'Entrega local', desc: storeConfig.city },
              { icon: <ShieldCheck size={16} />, title: 'Compra segura', desc: 'Confirmacion manual y seguimiento del pedido' },
              { icon: '💳', title: 'Formas de pago', desc: `${storeConfig.payments.primary} o ${storeConfig.payments.secondary}` },
            ].map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: index < 2 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span style={{ color: 'var(--blue)', flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
