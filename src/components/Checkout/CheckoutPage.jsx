import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronUp,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import AuthModal from '../Auth/AuthModal';
import { storeConfig } from '../../config/store';
import { buildCheckoutSummary, generateDeliveryCode } from '../../lib/commerce';
import { calculateDeliveryQuote, formatFactorRange, parseCoordinatesFromMapInput } from '../../lib/delivery';
import { fetchDeliverySettings } from '../../lib/storeSettings';

const EMPTY_ADDRESS = {
  label: 'Casa',
  full_name: '',
  phone: '',
  street: '',
  neighborhood: '',
  city: storeConfig.city,
  reference: '',
  maps_link: '',
};

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
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [addrLoading, setAddrLoading] = useState(Boolean(user));
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('register');
  const [addrErrors, setAddrErrors] = useState({});
  const [addrForm, setAddrForm] = useState(EMPTY_ADDRESS);
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
  const parsedAddressLocation = useMemo(
    () => parseCoordinatesFromMapInput(addrForm.maps_link),
    [addrForm.maps_link]
  );
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
      setShowAddrForm(false);
      setAddrLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAddresses() {
      setAddrLoading(true);
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('firebase_uid', user.uid)
        .order('is_default', { ascending: false });

      if (cancelled) return;

      setAddresses(data || []);
      if (data?.length) {
        setSelectedAddr(data.find((addr) => addr.is_default) || data[0]);
        setShowAddrForm(false);
      } else {
        setShowAddrForm(true);
      }
      setAddrLoading(false);
    }

    fetchAddresses();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    setAddrForm((prev) => ({
      ...prev,
      full_name: profile?.full_name || prev.full_name,
      phone: profile?.phone || prev.phone,
      city: prev.city || storeConfig.city,
    }));
  }, [profile]);

  function setAddrField(key, value) {
    setAddrForm((prev) => ({ ...prev, [key]: value }));
    setAddrErrors((prev) => ({ ...prev, [key]: '' }));
  }

  function validateAddress() {
    const nextErrors = {};

    if (!addrForm.full_name.trim()) nextErrors.full_name = 'Requerido';
    if (!addrForm.phone.trim()) nextErrors.phone = 'Requerido';
    if (!addrForm.street.trim()) nextErrors.street = 'Requerido';

    setAddrErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveAddress() {
    if (!user) {
      setAuthMode('register');
      setAuthOpen(true);
      return;
    }

    if (!validateAddress()) return;

    const isFirstAddress = addresses.length === 0;
    const parsedLocation = addrForm.maps_link.trim()
      ? parseCoordinatesFromMapInput(addrForm.maps_link)
      : null;

    if (addrForm.maps_link.trim() && !parsedLocation) {
      toast.error('No se pudo leer la ubicacion de Google Maps');
      return;
    }

    const payload = {
      ...addrForm,
      firebase_uid: user.uid,
      full_name: addrForm.full_name.trim(),
      phone: addrForm.phone.trim(),
      street: addrForm.street.trim(),
      neighborhood: addrForm.neighborhood.trim(),
      city: addrForm.city.trim(),
      reference: addrForm.reference.trim(),
      maps_link: addrForm.maps_link.trim(),
      latitude: parsedLocation?.lat ?? null,
      longitude: parsedLocation?.lng ?? null,
      is_default: isFirstAddress,
    };

    const { data, error } = await supabase
      .from('addresses')
      .insert(payload)
      .select()
      .single();

    if (error) {
      toast.error('No se pudo guardar la direccion');
      return;
    }

    setAddresses((prev) => [data, ...prev]);
    setSelectedAddr(data);
    setShowAddrForm(false);
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
                  {hasDirectCheckout ? 'Compra directa activada.' : 'Revisa tus datos y confirma el pedido.'}
                </p>
              </div>
              <div className="highlight-chip">
                <Sparkles size={14} />
                Registrados: {summary.memberDiscountRate}% menos en el total
              </div>
            </div>
          </div>

          {!user ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, var(--brand) 0%, var(--blue) 100%)',
                  color: '#fff',
                  borderRadius: 'var(--radius)',
                  padding: '1rem',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85, marginBottom: 4 }}>
                  DESCUENTO POR REGISTRO
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1, marginBottom: 6 }}>
                  Registrate y paga {summary.memberDiscountRate}% menos
                </div>
                <div style={{ fontSize: 14, opacity: 0.92 }}>
                  El descuento se aplica al total completo de la compra cuando tu cuenta esta activa.
                </div>
              </div>

              <div className="checkout-auth-grid">
                <div className="card" style={{ background: 'var(--bg)', borderStyle: 'dashed' }}>
                  <h3 style={{ fontSize: 16, marginBottom: 8 }}>Tu cuenta acelera todo</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: 'var(--txt-muted)' }}>
                    <div>Autocompletado de nombre y telefono.</div>
                    <div>Descuento sobre el total de este pedido.</div>
                    <div>Seguimiento con codigo de entrega.</div>
                    <div>Historial de compras y reordenes mas rapidas.</div>
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ fontSize: 16, marginBottom: 8 }}>Activa tu descuento ahora</h3>
                  <p style={{ fontSize: 14, color: 'var(--txt-muted)', marginBottom: 16 }}>
                    Si ya tienes cuenta, ingresa. Si no, registrate y el descuento total se aplicara al instante.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button onClick={openRegister} className="btn btn-primary btn-full btn-lg">
                      Registrarme y aplicar descuento
                    </button>
                    <button onClick={openLogin} className="btn btn-outline btn-full btn-lg">
                      Ya tengo cuenta
                    </button>
                  </div>
                </div>
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
                          {(addr.latitude !== null && addr.longitude !== null) && (
                            <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 700, marginTop: 6 }}>
                              Ubicacion de Maps cargada
                            </div>
                          )}
                        </div>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setShowAddrForm((prev) => !prev)}
                      className="btn btn-outline"
                      style={{ justifyContent: 'center' }}
                    >
                      {showAddrForm ? <ChevronUp size={16} /> : <Plus size={16} />}
                      {showAddrForm ? 'Ocultar formulario' : 'Agregar nueva direccion'}
                    </button>

                    {showAddrForm && (
                      <div className="card" style={{ background: 'var(--bg)', padding: '1rem' }}>
                        <div className="responsive-form-grid">
                          <div className="field">
                            <label>Etiqueta</label>
                            <select
                              className="input"
                              value={addrForm.label}
                              onChange={(event) => setAddrField('label', event.target.value)}
                              autoComplete="address-level1"
                            >
                              <option value="Casa">Casa</option>
                              <option value="Trabajo">Trabajo</option>
                              <option value="Otro">Otro</option>
                            </select>
                          </div>

                          <div className="field">
                            <label>Nombre completo *</label>
                            <input
                              className={`input ${addrErrors.full_name ? 'error' : ''}`}
                              value={addrForm.full_name}
                              onChange={(event) => setAddrField('full_name', event.target.value)}
                              autoComplete="name"
                            />
                            {addrErrors.full_name && <span className="error-msg">{addrErrors.full_name}</span>}
                          </div>

                          <div className="field">
                            <label>Telefono *</label>
                            <input
                              className={`input ${addrErrors.phone ? 'error' : ''}`}
                              value={addrForm.phone}
                              onChange={(event) => setAddrField('phone', event.target.value)}
                              autoComplete="tel"
                              inputMode="tel"
                              placeholder="0981 000 000"
                            />
                            {addrErrors.phone && <span className="error-msg">{addrErrors.phone}</span>}
                          </div>

                          <div className="field full-span">
                            <label>Calle y numero *</label>
                            <input
                              className={`input ${addrErrors.street ? 'error' : ''}`}
                              value={addrForm.street}
                              onChange={(event) => setAddrField('street', event.target.value)}
                              autoComplete="street-address"
                            />
                            {addrErrors.street && <span className="error-msg">{addrErrors.street}</span>}
                          </div>

                          <div className="field">
                            <label>Barrio</label>
                            <input
                              className="input"
                              value={addrForm.neighborhood}
                              onChange={(event) => setAddrField('neighborhood', event.target.value)}
                              autoComplete="address-level2"
                            />
                          </div>

                          <div className="field">
                            <label>Ciudad</label>
                            <input
                              className="input"
                              value={addrForm.city}
                              onChange={(event) => setAddrField('city', event.target.value)}
                              autoComplete="address-level2"
                            />
                          </div>

                          <div className="field full-span">
                            <label>Referencia</label>
                            <input
                              className="input"
                              value={addrForm.reference}
                              onChange={(event) => setAddrField('reference', event.target.value)}
                              autoComplete="off"
                              placeholder="Casa azul, frente a la plaza..."
                            />
                          </div>

                          <div className="field full-span">
                            <label>Ubicacion de Google Maps</label>
                            <input
                              className="input"
                              value={addrForm.maps_link}
                              onChange={(event) => setAddrField('maps_link', event.target.value)}
                              autoComplete="off"
                              placeholder="Pega el link compartido de Google Maps o lat,lng"
                            />
                            <small>
                              {parsedAddressLocation
                                ? `Coordenadas detectadas: ${parsedAddressLocation.lat.toFixed(6)}, ${parsedAddressLocation.lng.toFixed(6)}`
                                : 'Esto permite calcular el delivery segun la distancia real.'}
                            </small>
                          </div>
                        </div>

                        <button onClick={saveAddress} className="btn btn-primary btn-full" style={{ marginTop: '1rem' }}>
                          <Check size={16} />
                          Guardar direccion
                        </button>
                      </div>
                    )}
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
                    : 'Disponible al registrarte'
                }
                highlight={Boolean(user)}
              />
              <SummaryRow
                label={
                  deliveryQuote.mode === 'distance' && deliveryQuote.adjustedDistanceKm !== null
                    ? `Delivery (${deliveryQuote.adjustedDistanceKm.toFixed(1)} km)`
                    : 'Delivery provisional'
                }
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

            {!user && (
              <div className="checkout-highlight-card" style={{ marginTop: '1rem' }}>
                <ShieldCheck size={18} />
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>Tu descuento esta esperando</div>
                  <div style={{ fontSize: 13 }}>
                    Registrate ahora y ahorra Gs. {guestDiscountPreview.toLocaleString('es-PY')} en el total de esta compra.
                  </div>
                </div>
              </div>
            )}

            {user && summary.discount > 0 && (
              <div className="checkout-highlight-card" style={{ marginTop: '1rem' }}>
                <ShieldCheck size={18} />
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>Descuento total aplicado</div>
                  <div style={{ fontSize: 13 }}>
                    Ya se descontaron Gs. {summary.discount.toLocaleString('es-PY')} del total de tu compra.
                  </div>
                </div>
              </div>
            )}

            <div
              className="checkout-highlight-card"
              style={{
                marginTop: '1rem',
                background: deliveryQuote.mode === 'distance' || deliveryQuote.mode === 'free' ? '#EFF6FF' : '#FFFBEB',
                color: deliveryQuote.mode === 'distance' || deliveryQuote.mode === 'free' ? '#1D4ED8' : '#92400E',
              }}
            >
              <MapPin size={18} />
              <div>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>
                  {deliveryQuote.mode === 'distance' || deliveryQuote.mode === 'free'
                    ? 'Delivery calculado'
                    : 'Delivery provisional'}
                </div>
                <div style={{ fontSize: 13 }}>
                  {deliveryQuote.mode === 'distance' || deliveryQuote.mode === 'free'
                    ? `Factor ${deliveryQuote.factor} aplicado${deliveryRuleLabel ? ` para ${deliveryRuleLabel}` : ''}.`
                    : 'Pega la ubicacion de Google Maps de la direccion para calcular el costo exacto por distancia.'}
                </div>
              </div>
            </div>

            {user && (
              <div className="checkout-highlight-card" style={{ marginTop: '1rem' }}>
                <ShieldCheck size={18} />
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>Codigo de entrega automatico</div>
                  <div style={{ fontSize: 13 }}>
                    Apenas confirmes, el sistema te genera un codigo corto de 2 digitos para validar la entrega.
                  </div>
                </div>
              </div>
            )}

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
