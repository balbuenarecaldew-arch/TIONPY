import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Package, Plus, ShieldCheck, ShoppingCart, Truck, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { getCategoryLabel, storeConfig } from '../../config/store';

const EMOJI_MAP = {
  1: 'Cel',
  2: 'Aud',
  3: 'Game',
  4: 'Acc',
  5: 'Home',
  6: 'PC',
};

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, items, startDirectCheckout } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);

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

  useEffect(() => {
    if (!product) return;
    setQty((prev) => Math.max(1, Math.min(prev, product.stock || 1)));
  }, [product]);

  if (loading) {
    return <div className="page-loading"><div className="spinner" /></div>;
  }

  if (!product) {
    return (
      <div className="container page-pad">
        <div className="empty-state">
          <div className="icon">Item</div>
          <h3>Producto no encontrado</h3>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '0.75rem' }}>
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

  function changeQty(nextQty) {
    if (outOfStock) return;
    setQty(Math.max(1, Math.min(nextQty, product.stock)));
  }

  function handleAdd() {
    if (outOfStock) return;
    addItem(product, qty);
    toast.success(`Agregado x${qty} al carrito`);
  }

  function handleBuyNow() {
    if (outOfStock) return;

    startDirectCheckout(product, qty);

    if (!user) {
      toast.success('Continua al pago y activa tu descuento registrandote');
    }

    navigate('/checkout');
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
        Volver a la tienda
      </Link>

      <div className="product-detail-grid">
        <div
          style={{
            background: '#F3F4F6',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 320,
            fontSize: 72,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                borderRadius: 'var(--radius-lg)',
              }}
            />
          ) : (
            EMOJI_MAP[product.category_id] || 'Item'
          )}

          {discount && (
            <span className="promo-pill" style={{ top: 16, right: 16, background: 'var(--danger)', color: '#fff' }}>
              -{discount}% OFF
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
              {product.brand} - {getCategoryLabel(product.categories)}
            </div>
            <h1 style={{ fontSize: 28, marginBottom: 8 }}>{product.name}</h1>
            {product.description && (
              <p style={{ fontSize: 14, color: 'var(--txt-muted)', lineHeight: 1.75 }}>
                {product.description}
              </p>
            )}
          </div>

          <div className="card" style={{ background: 'var(--bg)', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: 'var(--brand)', fontFamily: "'Space Grotesk', sans-serif" }}>
                Gs. {product.price.toLocaleString('es-PY')}
              </span>
              {product.old_price && (
                <span style={{ fontSize: 16, color: 'var(--txt-muted)', textDecoration: 'line-through' }}>
                  Gs. {product.old_price.toLocaleString('es-PY')}
                </span>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 14, color: 'var(--success)', fontWeight: 700 }}>
              Descuento del {storeConfig.discounts.memberPercent}% sobre el total del pedido
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--txt-muted)' }}>
              {user
                ? 'Tu ahorro se descuenta del total final al pagar.'
                : 'Registrate y el descuento se aplica al total al momento de pagar.'}
            </div>
          </div>

          <div
            style={{
              fontSize: 14,
              color: outOfStock ? 'var(--danger)' : 'var(--success)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Package size={16} />
            {outOfStock ? 'Sin stock' : `Stock disponible: ${product.stock}`}
          </div>

          <div
            className="card"
            style={{
              background: 'var(--bg)',
              padding: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Cantidad a comprar</div>
              <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>
                Ajusta con menos o mas antes de agregar o comprar.
              </div>
            </div>
            <div className="quantity-stepper">
              <button
                type="button"
                className="qty-btn"
                onClick={() => changeQty(qty - 1)}
                disabled={outOfStock || qty <= 1}
                aria-label="Disminuir cantidad"
              >
                <Minus size={12} />
              </button>
              <span className="qty-value">{qty}</span>
              <button
                type="button"
                className="qty-btn"
                onClick={() => changeQty(qty + 1)}
                disabled={outOfStock || qty >= product.stock}
                aria-label="Aumentar cantidad"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          <div className="detail-action-grid">
            <button onClick={handleAdd} disabled={outOfStock} className="btn btn-blue btn-lg btn-full">
              <ShoppingCart size={18} />
              {outOfStock ? 'Sin stock' : inCart ? `Agregar x${qty} (${inCart.qty} en carrito)` : `Agregar x${qty}`}
            </button>

            <button onClick={handleBuyNow} disabled={outOfStock} className="btn btn-primary btn-lg btn-full">
              <Zap size={18} />
              Comprar x{qty}
            </button>
          </div>

          <Link to="/carrito" className="btn btn-outline btn-lg btn-full">
            Ver carrito
          </Link>

          <div className="card" style={{ padding: 0 }}>
            {[
              { icon: <Truck size={16} />, title: 'Entrega local', desc: storeConfig.city },
              { icon: <ShieldCheck size={16} />, title: 'Beneficio por cuenta', desc: `${storeConfig.discounts.memberPercent}% OFF sobre el total para clientes registrados` },
              { icon: 'Pago', title: 'Formas de pago', desc: `${storeConfig.payments.primary} o ${storeConfig.payments.secondary}` },
            ].map((item, index) => (
              <div
                key={item.title}
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
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</div>
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
