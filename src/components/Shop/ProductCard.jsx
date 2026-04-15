import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Trash2, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { storeConfig } from '../../config/store';
import {
  getCategoryLabel,
  getCategoryMeta,
  getProductCategorySlug,
  getProductNotices,
  isComboProduct,
} from '../../config/catalog';
import { getPrimaryProductImage, getProductImages } from '../../lib/productImages';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, items, removeItem, setQty, startDirectCheckout } = useCart();

  const discount = product.old_price
    ? Math.round((1 - product.price / product.old_price) * 100)
    : null;
  const outOfStock = product.stock <= 0;
  const inCart = items.find((item) => item.id === product.id);
  const lineTotal = inCart ? inCart.price * inCart.qty : product.price;
  const primaryImage = getPrimaryProductImage(product);
  const productImages = getProductImages(product);
  const categoryLabel = getCategoryLabel(product.categories || getProductCategorySlug(product));
  const categoryMeta = getCategoryMeta(product.categories || getProductCategorySlug(product));
  const notices = getProductNotices(product);
  const isCombo = isComboProduct(product);

  function handleAdd(event) {
    event.preventDefault();
    if (outOfStock) return;
    addItem(product, 1);
    toast.success(`${product.name} se sumo a tu pedido`);
  }

  function handleBuyNow(event) {
    event.preventDefault();
    if (outOfStock) return;

    startDirectCheckout(product, inCart?.qty || 1);

    if (!user) {
      toast.success('Puedes seguir al checkout y guardar tus datos al final');
    }

    navigate('/checkout');
  }

  return (
    <div
      className="product-card"
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        transition: 'border-color .15s, box-shadow .15s, transform .15s',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.borderColor = categoryMeta?.accent || 'var(--brand)';
        event.currentTarget.style.boxShadow = 'var(--shadow)';
        event.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.borderColor = 'var(--border)';
        event.currentTarget.style.boxShadow = 'none';
        event.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <Link to={`/producto/${product.id}`} style={{ display: 'block', textDecoration: 'none' }}>
        <div
          className="product-card-media"
          style={{
            height: 158,
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'center',
            position: 'relative',
            userSelect: 'none',
            overflow: 'hidden',
            background: primaryImage ? '#F3F4F6' : categoryMeta?.gradient || 'linear-gradient(135deg, #1F2937 0%, #9A3412 100%)',
          }}
        >
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div className="product-media-fallback">
              <span className="product-media-tag">{categoryMeta?.badge || 'CAT'}</span>
              <strong>{product.name}</strong>
              <span>{categoryMeta?.shortLabel || 'pedido rapido'}</span>
            </div>
          )}

          {discount && (
            <span className="promo-pill" style={{ top: 10, right: 10, background: 'var(--danger)', color: '#fff' }}>
              -{discount}%
            </span>
          )}

          {isCombo && (
            <span className="promo-pill" style={{ top: 10, left: 10, background: '#111827', color: '#fff' }}>
              Combo
            </span>
          )}

          {!isCombo && !product.old_price && product.created_at > new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString() && (
            <span className="promo-pill" style={{ top: 10, left: 10, background: 'var(--success)', color: '#fff' }}>
              Nuevo
            </span>
          )}

          {productImages.length > 1 && (
            <span className="promo-pill" style={{ bottom: 10, left: 10, background: 'rgba(17, 24, 39, 0.82)', color: '#fff' }}>
              {productImages.length} fotos
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

      <div className="product-card-body" style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: categoryMeta?.accent || 'var(--brand)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {categoryLabel}
          </span>
          {product.brand && (
            <span style={{ fontSize: 11, color: 'var(--txt-muted)' }}>
              {product.brand}
            </span>
          )}
        </div>

        <Link to={`/producto/${product.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
          <div className="product-card-title" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.45, marginBottom: 6, color: 'var(--txt)' }}>
            {product.name}
          </div>
          <div className="product-card-description" style={{ fontSize: 13, color: 'var(--txt-muted)', lineHeight: 1.6, marginBottom: 10 }}>
            {product.description || 'Compra rapida para sumar a tu pedido nocturno.'}
          </div>
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--brand)' }}>
              Gs. {product.price.toLocaleString('es-PY')}
            </span>
            {product.old_price && (
              <span style={{ fontSize: 12, color: 'var(--txt-muted)', textDecoration: 'line-through' }}>
                Gs. {product.old_price.toLocaleString('es-PY')}
              </span>
            )}
          </div>

          <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>
            Delivery {storeConfig.service.eta}
          </div>

          {notices[0] && (
            <div style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>
              {notices[0]}
            </div>
          )}

          {!notices[0] && (
            <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
              {user
                ? 'Tu ahorro por cuenta se aplica al total del pedido.'
                : `Registrate y ahorra ${storeConfig.discounts.memberPercent}% sobre el total.`}
            </div>
          )}
        </div>

        {!inCart && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock}
            className="btn btn-blue btn-full"
            style={{ marginBottom: 8, justifyContent: 'center' }}
          >
            <ShoppingCart size={14} />
            {outOfStock ? 'Sin stock' : 'Agregar'}
          </button>
        )}

        {inCart && (
          <div className="product-card-cart-box">
            <div className="product-card-cart-stepper">
              <button
                type="button"
                className="qty-btn product-card-cart-btn"
                onClick={(event) => {
                  event.preventDefault();
                  setQty(product.id, inCart.qty - 1);
                }}
                aria-label="Disminuir cantidad"
              >
                <Minus size={12} />
              </button>
              <span className="product-card-cart-qty">{inCart.qty}</span>
              <button
                type="button"
                className="qty-btn product-card-cart-btn"
                onClick={(event) => {
                  event.preventDefault();
                  setQty(product.id, inCart.qty + 1);
                }}
                disabled={inCart.qty >= product.stock}
                aria-label="Aumentar cantidad"
              >
                <Plus size={12} />
              </button>
            </div>

            <div className="product-card-cart-summary">
              <span className="product-card-cart-price">
                Gs. {lineTotal.toLocaleString('es-PY')}
              </span>
              <button
                type="button"
                className="product-card-remove-btn"
                onClick={(event) => {
                  event.preventDefault();
                  removeItem(product.id);
                }}
                title="Quitar del pedido"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleBuyNow}
          disabled={outOfStock}
          className="btn btn-primary btn-full"
        >
          <Zap size={14} />
          Pedir ahora
        </button>
      </div>
    </div>
  );
}
