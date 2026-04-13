import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Loader2,
  MapPin,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import AuthModal from '../Auth/AuthModal';
import AddressModal from '../Addresses/AddressModal';
import { storeConfig } from '../../config/store';
import { buildCheckoutSummary, generateDeliveryCode } from '../../lib/commerce';
import { calculateDeliveryQuote, formatFactorRange } from '../../lib/delivery';
import { fetchUserAddresses, saveUserAddress } from '../../lib/addresses';
import { fetchDeliverySettings } from '../../lib/storeSettings';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const {
    checkoutItems,
    hasDirectCheckout,
    clearCart,
    clearDirectCheckout,
  } = useCart();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddr, setSelectedAddr] = useState(null);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [addrLoading, setAddrLoading] = useState(Boolean(user));
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('register');
  const [deliverySettings, setDeliverySettings] = useState(null);

  const pricingBase = useMemo(
    () => buildCheckoutSummary(checkoutItems, Boolean(user), storeConfig, { shippingOverride: 0 }),
    [checkoutItems, user]
  );
  const deliveryQuote = useMemo(
    () =>
      calculateDeliveryQuote({
        subtotalAfterDiscount: pricingBase.subtotalAfterDiscount,
        destinationLat: selectedAddr?.latitude,
        destinationLng: selectedAddr?.longitude,
        settings: deliverySettings,
        fallbackCost: storeConfig.shipping.cost,
      }),
    [pricingBase.subtotalAfterDiscount, selectedAddr?.latitude, selectedAddr?.longitude, deliverySettings]
  );
  const summary = useMemo(
    () => buildCheckoutSummary(checkoutItems, Boolean(user), storeConfig, { shippingOverride: deliveryQuote.shipping }),
    [checkoutItems, user, deliveryQuote.shipping]
  );
  const guestDiscountPreview = Math.round((pricingBase.subtotal * pricingBase.memberDiscountRate) / 100);
  const deliveryRuleLabel = deliveryQuote.factorRule ? formatFactorRange(deliveryQuote.factorRule) : '';

  useEffect(() => {
    let cancelled = false;

    async function loadDeliverySettings() {
      const settings = await fetchDeliverySettings();
      if (!cancelled) {
        setDeliverySettings(settings);
      }
    }

    loadDeliverySettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setAddresses([]);
      setSelectedAddr(null);
      setAddressModalOpen(false);
      setAddrLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAddresses() {
      setAddrLoading(true);
      let data = [];

      try {
        data = await fetchUserAddresses(user.uid);
      } catch (error) {
        console.error('fetchAddresses error:', error);
      }

      if (cancelled) return;

      setAddresses(data);
      if (data.length) {
        setSelectedAddr(data.find((addr) => addr.is_default) || data[0]);
        setAddressModalOpen(false);
      } else if (!authOpen) {
        setAddressModalOpen(true);
      }
      setAddrLoading(false);
    }

    fetchAddresses();

    return () => {
      cancelled = true;
    };
  }, [user, authOpen]);

  async function handleSaveAddress(values) {
    if (!user) {
      throw new Error('Necesitas iniciar sesion para guardar direcciones');
    }

    const data = await saveUserAddress({
      firebaseUid: user.uid,
      values,
      isDefault: addresses.length === 0,
    });

    setAddresses((prev) => [data, ...prev]);
    setSelectedAddr(data);
    toast.success('Direccion guardada');
  }

  async function placeOrder() {
    if (!user) {
      setAuthMode('register');
      setAuthOpen(true);
      return;
    }

    if (!selectedAddr) {
      toast.error('Selecciona una direccion de entrega');
      return;
    }

    if (!checkoutItems.length) {
      navigate('/');
      return;
    }

    setLoading(true);

    try {
      const productIds = checkoutItems.map((item) => item.id);
      const { data: freshProducts, error: productsError } = await supabase
        .from('products')
        .select('id, name, stock, is_active')
        .in('id', productIds);

      if (productsError) throw productsError;

      const byId = new Map((freshProducts || []).map((product) => [product.id, product]));

      for (const item of checkoutItems) {
        const product = byId.get(item.id);
        if (!product || !product.is_active) {
          throw new Error(`"${item.name}" ya no esta disponible.`);
        }
        if (product.stock < item.qty) {
          throw new Error(`No hay stock suficiente para "${item.name}".`);
        }
      }

      const deliveryCode = generateDeliveryCode();
      const orderPricing = {
        subtotal: summary.subtotal,
        discount: summary.discount,
        shipping: summary.shipping,
        total: summary.total,
        member_discount_rate: summary.memberDiscountRate,
        delivery_mode: deliveryQuote.mode,
        delivery_factor: deliveryQuote.factor,
        delivery_rule_label: deliveryRuleLabel,
        delivery_distance_km: deliveryQuote.distanceKm ? Number(deliveryQuote.distanceKm.toFixed(2)) : null,
        delivery_adjusted_distance_km: deliveryQuote.adjustedDistanceKm ? Number(deliveryQuote.adjustedDistanceKm.toFixed(2)) : null,
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          firebase_uid: user.uid,
          customer_email: user.email,
          customer_name: profile?.full_name || user.email,
          address_snapshot: {
            label: selectedAddr.label,
            full_name: selectedAddr.full_name,
            phone: selectedAddr.phone,
            street: selectedAddr.street,
            neighborhood: selectedAddr.neighborhood,
            city: selectedAddr.city,
            reference: selectedAddr.reference,
            delivery_code: deliveryCode,
            maps_link: selectedAddr.maps_link || '',
            latitude: selectedAddr.latitude ?? null,
            longitude: selectedAddr.longitude ?? null,
            pricing: orderPricing,
          },
          total: summary.total,
          notes: notes.trim(),
          status: 'pendiente',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = checkoutItems.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        product_snapshot: {
          id: item.id,
          name: item.name,
          brand: item.brand,
          image_url: item.image_url || '',
        },
        quantity: item.qty,
        unit_price: item.price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      await supabase.from('order_status_history').insert({
        order_id: order.id,
        status: 'pendiente',
        note: `Pedido recibido. Codigo de entrega: ${deliveryCode}`,
      });

      if (hasDirectCheckout) {
        clearDirectCheckout();
      } else {
        clearCart();
      }

      toast.success(`Pedido recibido. Tu codigo de entrega es ${deliveryCode}`);
      navigate(`/mis-pedidos/${order.id}`);
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'No se pudo procesar el pedido');
    } finally {
      setLoading(false);
    }
  }

  function openRegister() {
    setAuthMode('register');
    setAuthOpen(true);
  }

  function openLogin() {
    setAuthMode('login');
    setAuthOpen(true);
  }

  if (!checkoutItems.length) {
    return (
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        <div className="empty-state">
          <div className="icon">Carrito</div>
          <h3>No hay productos para pagar</h3>
          <p>Agrega productos o usa "Comprar ahora" desde la tienda.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '0.75rem' }}>
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-pad">
      <Link
        to={hasDirectCheckout ? '/' : '/carrito'}
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
        {hasDirectCheckout ? 'Volver a la tienda' : 'Volver al carrito'}
      </Link>

      <div className="checkout-shell">
        <div className="checkout-main">
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
                <h1 style={{ fontSize: 24, marginBottom: 6 }}>Finalizar compra</h1>
                <p style={{ fontSize: 14, color: 'var(--txt-muted)' }}>
                  {hasDirectCheckout ? 'Estas comprando directo este producto.' : 'Revisa tus datos y confirma el pedido.'}
                </p>
              </div>
            </div>
          </div>

          {!user ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 style={{ fontSize: 18 }}>Ingresa para continuar</h2>
              <p style={{ fontSize: 14, color: 'var(--txt-muted)' }}>
                Si te registras ahora, este pedido se procesa con tu descuento y tus datos quedan guardados para la proxima compra.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={openRegister} className="btn btn-primary btn-full btn-lg">
                  Registrarme y continuar
                </button>
                <button onClick={openLogin} className="btn btn-outline btn-full btn-lg">
                  Ya tengo cuenta
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontSize: 17, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={18} style={{ color: 'var(--blue)' }} />
                  Direccion de entrega
                </h2>

                {addrLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt-muted)' }}>
                    <div className="spinner" style={{ width: 18, height: 18 }} />
                    Cargando direcciones...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {addresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => setSelectedAddr(addr)}
                        className="address-card"
                        style={{
                          borderColor: selectedAddr?.id === addr.id ? 'var(--blue)' : 'var(--border)',
                          background: selectedAddr?.id === addr.id ? 'var(--blue-light)' : '#fff',
                        }}
                      >
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            border: `2px solid ${selectedAddr?.id === addr.id ? 'var(--blue)' : 'var(--border)'}`,
                            background: selectedAddr?.id === addr.id ? 'var(--blue)' : '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: 2,
                          }}
                        >
                          {selectedAddr?.id === addr.id && <Check size={12} color="#fff" />}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>
                            {addr.label} - {addr.full_name}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--txt-muted)', lineHeight: 1.6 }}>
                            {addr.street}
                            {addr.neighborhood ? `, ${addr.neighborhood}` : ''}
                            {addr.city ? `, ${addr.city}` : ''}
                            <br />
                            {addr.phone}
                            {addr.reference ? ` - ${addr.reference}` : ''}
                          </div>
                        </div>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setAddressModalOpen(true)}
                      className="btn btn-outline"
                      style={{ justifyContent: 'center' }}
                    >
                      <Plus size={16} />
                      {addresses.length ? 'Agregar nueva direccion' : 'Guardar mi direccion'}
                    </button>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="field">
                  <label>Nota para el repartidor</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Ej: llamar antes de llegar, entregar a recepcion..."
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="checkout-sidebar">
          <div className="card checkout-summary-card">
            <h3 style={{ fontSize: 18, marginBottom: '1rem' }}>Tu pedido</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {checkoutItems.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                  <span style={{ color: 'var(--txt-muted)' }}>
                    {item.name} x {item.qty}
                  </span>
                  <strong>Gs. {(item.price * item.qty).toLocaleString('es-PY')}</strong>
                </div>
              ))}
            </div>

            <div className="divider" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
              <SummaryRow label="Subtotal" value={`Gs. ${summary.subtotal.toLocaleString('es-PY')}`} />
              <SummaryRow
                label={`Descuento total por registro (${summary.memberDiscountRate}%)`}
                value={
                  user
                    ? `- Gs. ${summary.discount.toLocaleString('es-PY')}`
                    : `Ahorra Gs. ${guestDiscountPreview.toLocaleString('es-PY')}`
                }
                highlight
              />
              <SummaryRow
                label="Delivery"
                value={summary.shipping === 0 ? 'GRATIS' : `Gs. ${summary.shipping.toLocaleString('es-PY')}`}
                highlight={summary.shipping === 0}
              />
            </div>

            <div className="divider" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand)', fontFamily: "'Space Grotesk', sans-serif" }}>
                Gs. {summary.total.toLocaleString('es-PY')}
              </span>
            </div>

            <div
              style={{
                background: '#FFF7ED',
                borderRadius: 10,
                padding: '12px',
                fontSize: 13,
                color: '#92400E',
                marginTop: '1rem',
              }}
            >
              Pago: <strong>{storeConfig.payments.primary}</strong> o <strong>{storeConfig.payments.secondary}</strong>
            </div>

            {user ? (
              <button
                onClick={placeOrder}
                disabled={loading || !selectedAddr}
                className="btn btn-primary btn-full btn-lg"
                style={{ marginTop: '1rem' }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin .7s linear infinite' }} />
                    Procesando...
                  </>
                ) : (
                  'Confirmar pedido'
                )}
              </button>
            ) : (
              <button onClick={openRegister} className="btn btn-primary btn-full btn-lg" style={{ marginTop: '1rem' }}>
                Registrarme y pagar con descuento
              </button>
            )}

            {!user && (
              <button onClick={openLogin} className="btn btn-outline btn-full" style={{ marginTop: '0.75rem' }}>
                Ya tengo cuenta
              </button>
            )}
          </div>
        </aside>
      </div>

      {authOpen && (
        <AuthModal
          initialMode={authMode}
          onClose={() => setAuthOpen(false)}
        />
      )}

      {user && addressModalOpen && (
        <AddressModal
          title={addresses.length ? 'Agregar nueva direccion' : 'Guarda tu direccion'}
          description={
            addresses.length
              ? 'Deja otra direccion lista para futuras entregas.'
              : 'Guardala ahora y tu checkout va a salir mucho mas rapido.'
          }
          initialValues={{
            label: 'Casa',
            full_name: profile?.full_name || '',
            phone: profile?.phone || '',
            city: storeConfig.city,
          }}
          submitLabel="Guardar direccion"
          onSubmit={handleSaveAddress}
          onClose={() => setAddressModalOpen(false)}
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
