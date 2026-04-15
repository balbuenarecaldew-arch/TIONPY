import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { storeConfig } from '../../config/store';
import {
  getCategoryLabel,
  getCategoryMeta,
  getProductCategorySlug,
  getProductNotices,
  isComboProduct,
} from '../../config/catalog';
import { getProductImages } from '../../lib/productImages';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, items, startDirectCheckout } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('products')
      .select('*, categories(name, slug, emoji)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setProduct(data);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!product) return;
    setQty((prev) => Math.max(1, Math.min(prev, product.stock || 1)));
  }, [product]);

  const productImages = useMemo(
    () => getProductImages(product),
    [product]
  );

  const categoryLabel = getCategoryLabel(product?.categories || getProductCategorySlug(product));
  const categoryMeta = getCategoryMeta(product?.categories || getProductCategorySlug(product));
  const notices = getProductNotices(product);
  const isCombo = isComboProduct(product);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [product?.id]);

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
            Volver a la bodega
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
  const activeImage = productImages[activeImageIndex] || '';

  function changeQty(nextQty) {
    if (outOfStock) return;
    setQty(Math.max(1, Math.min(nextQty, product.stock)));
  }

  function goToAdjacentImage(direction) {
    if (productImages.length <= 1) return;

    setActiveImageIndex((prev) => {
      const next = prev + direction;
      if (next < 0) return productImages.length - 1;
      if (next >= productImages.length) return 0;
      return next;
    });
  }

  function handleAdd() {
    if (outOfStock) return;
    addItem(product, qty);
    toast.success(inCart ? `Tu pedido se actualizo (+${qty})` : `Agregado x${qty} a tu pedido`);
  }

  function handleBuyNow() {
    if (outOfStock) return;

    startDirectCheckout(product, qty);

    if (!user) {
      toast.success('Continua al checkout y guarda tus datos al confirmar');
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
        Volver a la bodega
      </Link>

      <div className="product-detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              background: activeImage ? '#F3F4F6' : categoryMeta?.gradient || 'linear-gradient(135deg, #111827 0%, #9A3412 100%)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 320,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {activeImage ? (
              <img
                src={activeImage}
                alt={product.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-lg)',
                }}
              />
            ) : (
              <div className="product-media-fallback product-media-fallback-detail">
                <span className="product-media-tag">{categoryMeta?.badge || 'CAT'}</span>
                <strong>{product.name}</strong>
                <span>{categoryMeta?.shortLabel || 'pedido rapido'}</span>
              </div>
            )}

            {discount && (
              <span className="promo-pill" style={{ top: 16, right: 16, background: 'var(--danger)', color: '#fff' }}>
                -{discount}% OFF
              </span>
            )}

            {isCombo && (
              <span className="promo-pill" style={{ top: 16, left: 16, background: '#111827', color: '#fff' }}>
                Combo listo
              </span>
            )}

            {productImages.length > 1 && (
              <>
                <button
                  type="button"
                  className="product-photo-nav-btn product-photo-nav-left"
                  onClick={() => goToAdjacentImage(-1)}
                  aria-label="Foto anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="product-photo-nav-btn product-photo-nav-right"
                  onClick={() => goToAdjacentImage(1)}
                  aria-label="Siguiente foto"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>

          {productImages.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>
                Foto {activeImageIndex + 1} de {productImages.length}
              </div>
              <div className="product-gallery-strip">
                {productImages.map((imageUrl, index) => (
                  <button
                    key={`${imageUrl}-${index}`}
                    type="button"
                    className={`product-gallery-thumb ${index === activeImageIndex ? 'active' : ''}`}
                    onClick={() => setActiveImageIndex(index)}
                  >
                    <img src={imageUrl} alt={`${product.name} ${index + 1}`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {notices.length > 0 && (
            <div className="notice-card-grid" style={{ marginBottom: 0 }}>
              {notices.map((notice) => (
                <div key={notice} className="notice-card" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <ShieldCheck size={16} style={{ color: '#B45309', flexShrink: 0, marginTop: 2 }} />
                    <p style={{ margin: 0 }}>{notice}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: categoryMeta?.accent || 'var(--brand)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {categoryLabel}
              </span>
              {product.brand && (
                <span style={{ fontSize: 12, color: 'var(--txt-muted)' }}>
                  {product.brand}
                </span>
              )}
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
              {user
                ? 'Tu ahorro por cuenta se descuenta del total al confirmar.'
                : `Registrate y ahorra ${storeConfig.discounts.memberPercent}% sobre el total del pedido.`}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--txt-muted)' }}>
              Delivery {storeConfig.service.eta}. Atendemos de {storeConfig.service.hours}.
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
            {outOfStock ? 'Sin stock en este momento' : `Stock disponible: ${product.stock}`}
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
              <div style={{ fontSize: 13, fontWeight: 700 }}>Cantidad</div>
              <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>
                Ajusta y confirma en pocos toques.
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
            <button type="button" onClick={handleAdd} disabled={outOfStock} className="btn btn-blue btn-lg btn-full">
              <ShoppingCart size={18} />
              {outOfStock ? 'Sin stock' : 'Agregar al pedido'}
            </button>

            <button type="button" onClick={handleBuyNow} disabled={outOfStock} className="btn btn-primary btn-lg btn-full">
              <Zap size={18} />
              Pedir ahora
            </button>
          </div>

          {inCart && (
            <div style={{ fontSize: 13, color: 'var(--txt-muted)', marginTop: -4 }}>
              Ya tienes {inCart.qty} unidad{inCart.qty !== 1 ? 'es' : ''} de este producto en tu pedido.
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            {[
              { icon: <Truck size={16} />, title: 'Entrega express', desc: storeConfig.service.eta },
              { icon: <Clock size={16} />, title: 'Horario', desc: `Atendemos de ${storeConfig.service.hours}` },
              { icon: <MapPin size={16} />, title: 'Cobertura', desc: storeConfig.service.coverage },
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
                <span style={{ color: categoryMeta?.accent || 'var(--brand)', flexShrink: 0 }}>{item.icon}</span>
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
