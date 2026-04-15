import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, MapPin, Search, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ProductCard from './ProductCard';
import { storeConfig } from '../../config/store';
import { PROMO_CONFIG } from '../../config/promotions';
import {
  CATEGORY_SEED,
  getCategoryLabel,
  getCategoryMeta,
  getMerchandisingSections,
  hasLegacyCatalog,
  isComboProduct,
  isQuickBuyProduct,
  sortCategoriesForStore,
} from '../../config/catalog';
import { formatGs, getProfileCreditBalance } from '../../lib/promotions';

const HOME_METRICS = [
  { icon: Clock, label: 'Entrega estimada', value: storeConfig.service.eta },
  { icon: Truck, label: 'Horario', value: storeConfig.service.hours },
  { icon: MapPin, label: 'Cobertura', value: storeConfig.service.coverage },
];

const NOTICE_CARDS = [
  { title: 'Alcohol', body: storeConfig.notices.alcohol },
  { title: 'Farmacia basica', body: storeConfig.notices.pharmacy },
];

function getDefaultRanking(product) {
  let score = 0;
  if (isComboProduct(product)) score += 3;
  if (product.old_price && product.old_price > product.price) score += 2;
  if (isQuickBuyProduct(product)) score += 1;
  return score;
}

export default function ShopPage() {
  const { profile } = useAuth();
  const catalogSectionRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState(null);
  const [sortBy, setSortBy] = useState('default');

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);

      const [productResult, categoryResult] = await Promise.all([
        supabase
          .from('products')
          .select('*, categories(name, slug, emoji)')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase.from('categories').select('*'),
      ]);

      if (cancelled) return;

      setProducts(productResult.data || []);
      setCategories(sortCategoriesForStore(categoryResult.data || []));
      setLoading(false);
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
  }, []);

  const visibleCategories = useMemo(
    () => sortCategoriesForStore(categories.length ? categories : CATEGORY_SEED),
    [categories]
  );

  const filtered = useMemo(() => {
    let list = [...products];

    if (activeCat) {
      list = list.filter((product) => product.category_id === activeCat);
    }

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((product) => {
        const categoryLabel = getCategoryLabel(product.categories).toLowerCase();
        return (
          String(product.name || '').toLowerCase().includes(term) ||
          String(product.brand || '').toLowerCase().includes(term) ||
          String(product.description || '').toLowerCase().includes(term) ||
          categoryLabel.includes(term)
        );
      });
    }

    if (sortBy === 'price_asc') list.sort((left, right) => left.price - right.price);
    if (sortBy === 'price_desc') list.sort((left, right) => right.price - left.price);
    if (sortBy === 'name') list.sort((left, right) => left.name.localeCompare(right.name));
    if (sortBy === 'default') {
      list.sort((left, right) => {
        const score = getDefaultRanking(right) - getDefaultRanking(left);
        if (score !== 0) return score;
        return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
      });
    }

    return list;
  }, [products, activeCat, search, sortBy]);

  const shelves = useMemo(() => getMerchandisingSections(products), [products]);
  const catalogNeedsMigration = useMemo(
    () => hasLegacyCatalog(categories, products),
    [categories, products]
  );
  const showShelves = !loading && !catalogNeedsMigration && !search.trim() && !activeCat;
  const userCreditBalance = getProfileCreditBalance(profile);
  const creditBlinkMessage = profile
    ? 'Gana 10.000 Gs por cada amigo que realice compras'
    : 'Gana 10.000 Gs al registrarte';
  const heroQuickStats = [
    { label: 'Combos', value: `${shelves.combos.length || 4}`, note: 'listos' },
    { label: 'Productos', value: `${products.length}`, note: 'activos' },
    { label: 'Ahorro', value: `${storeConfig.discounts.memberPercent}%`, note: 'con cuenta' },
  ];

  function scrollToCatalog() {
    if (typeof window === 'undefined') return;

    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      catalogSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  }

  function handleSpotlightCategoryClick(categoryId) {
    setActiveCat((current) => (current === categoryId ? null : categoryId));
    scrollToCatalog();
  }

  function handleCatalogCategoryClick(categoryId = null) {
    setActiveCat(categoryId);
    scrollToCatalog();
  }

  return (
    <div className="container page-pad">
      <section className="hero-banner hero-ribbon">
        <div className="hero-ribbon-top">
          <div className="hero-ribbon-copy">
            <div className="highlight-chip hero-ribbon-chip">
              <Sparkles size={14} />
              Pedidos rapidos de noche desde el celular
            </div>

            <div className="hero-ribbon-heading">
              <h1 className="hero-ribbon-title">{storeConfig.slogan}</h1>
              <p className="hero-ribbon-text">
                Bebidas, hielo, snacks, farmacia basica y delivery rapido.
              </p>
            </div>
          </div>
        </div>

        <div className="hero-ribbon-stats">
          {HOME_METRICS.map((item) => (
            <div key={item.label} className="hero-ribbon-pill">
              <item.icon size={16} style={{ color: '#FDE68A', flexShrink: 0 }} />
              <div>
                <div className="hero-ribbon-pill-label">{item.label}</div>
                <strong className="hero-ribbon-pill-value">{item.value}</strong>
              </div>
            </div>
          ))}

          {heroQuickStats.map((item) => (
            <div key={item.label} className="hero-ribbon-pill hero-ribbon-pill-strong">
              <div>
                <div className="hero-ribbon-pill-label">{item.label}</div>
                <strong className="hero-ribbon-pill-value">{item.value}</strong>
              </div>
              <span className="hero-ribbon-pill-note">{item.note}</span>
            </div>
          ))}
        </div>
      </section>

      <div
        className="card home-promo-card"
        style={{
          marginTop: '1rem',
          marginBottom: '1rem',
          background: 'linear-gradient(135deg, #172554 0%, #1E293B 100%)',
          color: '#fff',
          borderColor: '#1E3A8A',
        }}
      >
        <div className="promo-ribbon">
          <div className="promo-ribbon-left">
            <div className="promo-ribbon-head">
              <div className="blink-copy">
                {creditBlinkMessage}
              </div>
              <div
                className="highlight-chip promo-ribbon-chip"
                style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.12)', color: '#DBEAFE' }}
              >
                <Sparkles size={14} />
                Creditos y referidos activos
              </div>
            </div>

            <div className="promo-ribbon-copy">
              <h2 className="promo-ribbon-balance">
                {profile ? `Saldo: ${formatGs(userCreditBalance)}` : `Bienvenida: ${formatGs(PROMO_CONFIG.welcomeBonusAmount)}`}
              </h2>
              <p className="promo-ribbon-text">
                {profile
                  ? `Usa hasta ${formatGs(PROMO_CONFIG.maxCreditPerOrder)} por pedido desde ${formatGs(PROMO_CONFIG.minimumOrderSubtotalForCredits)} en productos e invita amigos para sumar mas saldo.`
                  : `Invita amigos y gana ${formatGs(PROMO_CONFIG.referralRewardAmount)} por cada uno cuando haga una compra valida. Maximo ${PROMO_CONFIG.maxRewardedReferrals} amigos premiados.`}
              </p>
            </div>
          </div>

          <div className="promo-ribbon-right">
            <div className="promo-ribbon-label">Compra rapida con beneficios</div>
            <strong className="promo-ribbon-value">
              {formatGs(PROMO_CONFIG.referralRewardAmount * PROMO_CONFIG.maxRewardedReferrals)}
            </strong>
            <div className="promo-ribbon-note">tope de premios por referidos</div>
          </div>
        </div>
      </div>

      {catalogNeedsMigration && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: '#FCD34D', background: '#FFF7ED' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <ShieldCheck size={20} style={{ color: '#B45309', flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ display: 'block', marginBottom: 4 }}>
                El catalogo actual todavia parece de electronica
              </strong>
              <p style={{ fontSize: 14, color: '#7C2D12' }}>
                La interfaz ya esta adaptada a bodega nocturna, pero para reemplazar los datos viejos abre
                el panel admin y usa la accion "Cargar catalogo nocturno".
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="category-spotlight-grid">
        {visibleCategories.map((category) => {
          const meta = getCategoryMeta(category);
          const isActive = activeCat === category.id;

          return (
            <button
              key={category.slug || category.name}
              type="button"
              onClick={() => handleSpotlightCategoryClick(category.id)}
              className={`category-spotlight-card ${isActive ? 'active' : ''}`}
              style={{
                borderColor: isActive ? meta?.accent || 'var(--brand)' : 'var(--border)',
                background: isActive ? meta?.surface || '#fff' : '#fff',
              }}
            >
              <span
                className="category-spotlight-tag"
                style={{ background: meta?.surface || '#F3F4F6', color: meta?.accent || 'var(--brand)' }}
              >
                {meta?.badge || 'CAT'}
              </span>
              <strong>{getCategoryLabel(category)}</strong>
              <span>{meta?.description || 'Catalogo listo para pedir.'}</span>
            </button>
          );
        })}
      </section>

      <section
        ref={catalogSectionRef}
        style={{ scrollMarginTop: 92, marginBottom: '0.75rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>Catalogo</h2>
            <p style={{ fontSize: 13, color: 'var(--txt-muted)', margin: 0 }}>
              Filtra rapido y pide en pocos toques.
            </p>
          </div>
          {activeCat && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleCatalogCategoryClick(null)}
            >
              Ver todo
            </button>
          )}
        </div>
      </section>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="shop-toolbar">
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--txt-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              className="input"
              placeholder="Buscar bebidas, combos, snacks o farmacia..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ paddingLeft: 38 }}
            />
          </div>
          <select className="input shop-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="default">Recomendados</option>
            <option value="price_asc">Precio menor</option>
            <option value="price_desc">Precio mayor</option>
            <option value="name">A - Z</option>
          </select>
        </div>
      </div>

      <div className="category-row">
        <CatPill active={!activeCat} onClick={() => handleCatalogCategoryClick(null)}>
          Todo el catalogo
        </CatPill>
        {visibleCategories.map((category) => (
          <CatPill
            key={category.id || category.slug || category.name}
            active={activeCat === category.id}
            onClick={() => handleCatalogCategoryClick(category.id || null)}
          >
            {getCategoryLabel(category)}
          </CatPill>
        ))}
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">Noche</div>
          <h3>No encontramos productos para ese filtro</h3>
          <p>Prueba otra busqueda o cambia de categoria para seguir armando tu pedido.</p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--txt-muted)', marginBottom: '0.75rem' }}>
            {filtered.length} producto{filtered.length !== 1 ? 's' : ''} listos para pedir
          </div>
          <div className="product-grid">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}

      {showShelves && (
        <>
          <Shelf
            title="Combos listos para la previa"
            description="Packs comprables como cualquier producto para salir rapido del paso."
            items={shelves.combos}
          />
          <Shelf
            title="Compra rapida"
            description="Lo que mas se pide de noche para resolver en pocos toques."
            items={shelves.quick}
          />
          <Shelf
            title="Farmacia basica"
            description="Productos OTC para urgencias nocturnas sin complicar el flujo."
            items={shelves.pharmacy}
          />
          <Shelf
            title="Lo mas pedido esta noche"
            description="Bebidas, snacks y destacados con mas salida en el catalogo."
            items={shelves.popular}
          />
        </>
      )}

      <section className="notice-card-grid">
        {NOTICE_CARDS.map((item) => (
          <div key={item.title} className="notice-card">
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
            <p>{item.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function Shelf({ title, description, items }) {
  if (!items.length) return null;

  return (
    <section className="collection-section">
      <div className="collection-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <div className="product-grid">
        {items.map((product) => (
          <ProductCard key={`${title}-${product.id}`} product={product} />
        ))}
      </div>
    </section>
  );
}

function CatPill({ children, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? 'none' : '1.5px solid var(--border)',
        background: active ? 'var(--brand)' : '#fff',
        color: active ? '#fff' : 'var(--txt)',
        borderRadius: 999,
        padding: '7px 16px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: "'Sora', sans-serif",
        boxShadow: active ? '0 10px 20px rgba(154, 52, 18, 0.16)' : 'none',
      }}
    >
      {children}
    </button>
  );
}
