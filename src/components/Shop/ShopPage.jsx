import React, { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ProductCard from './ProductCard';
import { storeConfig, getCategoryLabel } from '../../config/store';

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
      list = list.filter((product) =>
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.brand.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (sortBy === 'price_asc') list.sort((a, b) => a.price - b.price);
    if (sortBy === 'price_desc') list.sort((a, b) => b.price - a.price);
    if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [products, activeCat, search, sortBy]);

  const offers = products.filter((product) => product.old_price);
  const freeShippingFrom = storeConfig.shipping.freeFrom.toLocaleString('es-PY');
  const paymentSummary = `${storeConfig.payments.primary} o ${storeConfig.payments.secondary.toLowerCase()}`;

  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      {offers.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, var(--brand) 0%, var(--blue) 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.75rem',
          marginBottom: '1.5rem',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div>
            <h2 style={{ fontSize: 22, marginBottom: 4 }}>{storeConfig.slogan}</h2>
            <p style={{ fontSize: 13, opacity: 0.86 }}>
              Envio gratis desde Gs. {freeShippingFrom} · {paymentSummary}
            </p>
          </div>
          <div style={{
            background: 'var(--accent)',
            color: 'var(--brand)',
            borderRadius: 10,
            padding: '8px 18px',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 22,
            flexShrink: 0,
          }}>
            {storeConfig.name}
          </div>
        </div>
      )}

      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={16} style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--txt-muted)',
            pointerEvents: 'none',
          }} />
          <input
            className="input"
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>
        <select
          className="input"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ width: 190 }}
        >
          <option value="default">Mas recientes</option>
          <option value="price_asc">Precio: menor a mayor</option>
          <option value="price_desc">Precio: mayor a menor</option>
          <option value="name">A - Z</option>
        </select>
      </div>

      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: '1.5rem',
        overflowX: 'auto',
        paddingBottom: 4,
        scrollbarWidth: 'none',
      }}>
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
          <div className="icon">?</div>
          <h3>Sin resultados</h3>
          <p>Proba con otra busqueda o categoria.</p>
        </div>
      ) : (
        <>
          <div style={{
            fontSize: 13,
            color: 'var(--txt-muted)',
            marginBottom: '.75rem',
          }}>
            {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))',
            gap: 16,
          }}>
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
        borderRadius: 99,
        padding: '6px 16px',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: "'Sora', sans-serif",
        transition: 'all .15s',
      }}
    >
      {children}
    </button>
  );
}
