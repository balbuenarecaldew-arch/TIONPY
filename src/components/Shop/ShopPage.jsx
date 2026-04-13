import React, { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ProductCard from './ProductCard';
import { getCategoryLabel, storeConfig } from '../../config/store';

export default function ShopPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState(null);
  const [sortBy, setSortBy] = useState('default');

  useEffect(() => {
    Promise.all([fetchProducts(), fetchCategories()]);
  }, []);

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('*, categories(name, slug)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    setProducts(data || []);
    setLoading(false);
  }

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
  }

  const filtered = useMemo(() => {
    let list = [...products];

    if (activeCat) {
      list = list.filter((product) => product.category_id === activeCat);
    }

    if (search) {
      const term = search.toLowerCase();
      list = list.filter((product) =>
        product.name.toLowerCase().includes(term) ||
        product.brand.toLowerCase().includes(term)
      );
    }

    if (sortBy === 'price_asc') list.sort((a, b) => a.price - b.price);
    if (sortBy === 'price_desc') list.sort((a, b) => b.price - a.price);
    if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [products, activeCat, search, sortBy]);

  const offers = products.filter((product) => product.old_price);

  return (
    <div className="container page-pad">
      <div className="hero-banner">
        <div>
          <div className="highlight-chip" style={{ marginBottom: 10, display: 'inline-flex' }}>
            <Sparkles size={14} />
            Clientes registrados ahorran {storeConfig.discounts.memberPercent}% en el total
          </div>
          <h2 style={{ fontSize: 28, marginBottom: 6 }}>{storeConfig.slogan}</h2>
          <p style={{ fontSize: 14, opacity: 0.92, maxWidth: 620 }}>
            Compra directo desde tu celular, registrate para activar descuento en el pago y recibe tu codigo de entrega automatico.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="hero-metric-card">
            <strong>{offers.length}</strong>
            <span>ofertas activas</span>
          </div>
          <div className="hero-metric-card">
            <strong>{storeConfig.discounts.memberPercent}%</strong>
            <span>off en el total</span>
          </div>
        </div>
      </div>

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
              placeholder="Buscar productos..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ paddingLeft: 38 }}
            />
          </div>
          <select className="input shop-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="default">Mas recientes</option>
            <option value="price_asc">Precio menor</option>
            <option value="price_desc">Precio mayor</option>
            <option value="name">A - Z</option>
          </select>
        </div>
      </div>

      <div className="category-row">
        <CatPill active={!activeCat} onClick={() => setActiveCat(null)}>
          Todos
        </CatPill>
        {categories.map((category) => (
          <CatPill
            key={category.id}
            active={activeCat === category.id}
            onClick={() => setActiveCat(category.id)}
          >
            {category.emoji} {getCategoryLabel(category)}
          </CatPill>
        ))}
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">Buscar</div>
          <h3>Sin resultados</h3>
          <p>Prueba otra busqueda o cambia de categoria.</p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--txt-muted)', marginBottom: '0.75rem' }}>
            {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
          </div>
          <div className="product-grid">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CatPill({ children, active, onClick }) {
  return (
    <button
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
      }}
    >
      {children}
    </button>
  );
}
