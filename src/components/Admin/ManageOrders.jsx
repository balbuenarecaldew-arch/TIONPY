import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, MessageCircle, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { DEFAULT_PAYMENT_SETTINGS, fetchPaymentSettings } from '../../lib/storeSettings';
import { shareOrderPaymentRequest } from '../../lib/orderShare';
import { COMMITTED_ORDER_STATUSES } from '../../config/promotions';
import { formatGs, reconcileOrderPromotions } from '../../lib/promotions';

const STATUS_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'preparando', label: 'Preparando' },
  { value: 'en_camino', label: 'En camino' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const ORDER_FILTERS = [
  { value: 'activos', label: 'Activos' },
  { value: 'entregados', label: 'Entregados' },
  { value: 'cancelados', label: 'Cancelados' },
  { value: 'todos', label: 'Todos' },
];

const STOCK_COMMITTED_STATUSES = COMMITTED_ORDER_STATUSES;

function normalizeWhatsappPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('595')) return digits;
  if (digits.startsWith('0')) return `595${digits.slice(1)}`;
  if (digits.length === 9) return `595${digits}`;
  return digits;
}

function canUseNativeShare() {
  return Boolean(
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  );
}

export default function ManageOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [itemsByOrderId, setItemsByOrderId] = useState({});
  const [paymentSettings, setPaymentSettings] = useState(DEFAULT_PAYMENT_SETTINGS);
  const [filter, setFilter] = useState('activos');
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharingOrderId, setSharingOrderId] = useState(null);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);

    try {
      const [ordersResult, payment] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false }),
        fetchPaymentSettings(),
      ]);

      if (ordersResult.error) {
        throw ordersResult.error;
      }

      setOrders(ordersResult.data || []);
      setPaymentSettings(payment);
      void syncPromotionState(ordersResult.data || [], { silent: true });
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  }

  async function syncPromotionState(orderList, options = {}) {
    const { silent = false } = options;
    const candidates = (orderList || [])
      .filter((order) => STOCK_COMMITTED_STATUSES.has(order.status) || order.status === 'cancelado')
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());

    let rewarded = 0;
    let refunded = 0;

    for (const order of candidates) {
      try {
        const result = await reconcileOrderPromotions(order);
        if (result.rewarded) rewarded += 1;
        if (result.refunded) refunded += 1;
      } catch (error) {
        console.error(`No se pudo sincronizar promociones para ${order.order_number}`, error);
      }
    }

    if (!silent && (rewarded || refunded)) {
      const messages = [];
      if (rewarded) messages.push(`${rewarded} premio${rewarded !== 1 ? 's' : ''} por referido acreditado${rewarded !== 1 ? 's' : ''}`);
      if (refunded) messages.push(`${refunded} reintegro${refunded !== 1 ? 's' : ''} de credito procesado${refunded !== 1 ? 's' : ''}`);
      toast.success(messages.join(' - '));
    }
  }

  const loadOrderItems = useCallback(async (orderId, options = {}) => {
    const { force = false } = options;

    if (!force && itemsByOrderId[orderId]) {
      return itemsByOrderId[orderId];
    }

    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('id', { ascending: true });

    if (error) {
      throw error;
    }

    const nextItems = data || [];
    setItemsByOrderId((prev) => ({
      ...prev,
      [orderId]: nextItems,
    }));

    return nextItems;
  }, [itemsByOrderId]);

  async function openDetail(order) {
    setSelected(order);

    try {
      const items = await loadOrderItems(order.id);
      setOrderItems(items);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar los productos del pedido');
      setOrderItems([]);
    }
  }

  async function syncStockForStatusChange(order, newStatus) {
    const wasCommitted = STOCK_COMMITTED_STATUSES.has(order.status);
    const willBeCommitted = STOCK_COMMITTED_STATUSES.has(newStatus);

    if (wasCommitted === willBeCommitted) {
      return null;
    }

    const items = await loadOrderItems(order.id, { force: true });
    const validItems = (items || []).filter((item) => item.product_id);
    if (!validItems.length) return null;

    const quantitiesByProduct = new Map();
    for (const item of validItems) {
      const currentQty = quantitiesByProduct.get(item.product_id) || 0;
      quantitiesByProduct.set(item.product_id, currentQty + (Number(item.quantity) || 0));
    }

    const productIds = [...quantitiesByProduct.keys()];
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, stock')
      .in('id', productIds);

    if (productsError) throw productsError;

    const productsById = new Map((products || []).map((product) => [product.id, product]));
    const adjustments = [];

    for (const [productId, quantity] of quantitiesByProduct.entries()) {
      const product = productsById.get(productId);
      const fallbackItem = validItems.find((item) => item.product_id === productId);
      const productName = fallbackItem?.product_snapshot?.name || product?.name || 'Producto';

      if (!product) {
        throw new Error(`No se encontro el producto "${productName}" para actualizar stock.`);
      }

      if (quantity <= 0) continue;

      const nextStock = willBeCommitted
        ? product.stock - quantity
        : product.stock + quantity;

      if (willBeCommitted && nextStock < 0) {
        throw new Error(`No hay stock suficiente para confirmar "${productName}".`);
      }

      adjustments.push({
        productId,
        previousStock: product.stock,
        nextStock,
      });
    }

    const appliedAdjustments = [];

    try {
      for (const adjustment of adjustments) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock: adjustment.nextStock })
          .eq('id', adjustment.productId);

        if (updateError) throw updateError;
        appliedAdjustments.push(adjustment);
      }
    } catch (error) {
      for (const adjustment of appliedAdjustments.reverse()) {
        await supabase
          .from('products')
          .update({ stock: adjustment.previousStock })
          .eq('id', adjustment.productId);
      }
      throw error;
    }

    return async function undoStockSync() {
      for (const adjustment of adjustments) {
        await supabase
          .from('products')
          .update({ stock: adjustment.previousStock })
          .eq('id', adjustment.productId);
      }
    };
  }

  async function updateStatus(orderId, newStatus, adminNote = '') {
    setUpdating(true);

    const currentOrder = orders.find((order) => order.id === orderId) || selected;
    if (!currentOrder) {
      toast.error('No se encontro el pedido');
      setUpdating(false);
      return;
    }

    if (currentOrder.status === newStatus && currentOrder.admin_notes === adminNote) {
      setUpdating(false);
      return;
    }

    let undoStockSync = null;

    try {
      undoStockSync = await syncStockForStatusChange(currentOrder, newStatus);

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, admin_notes: adminNote })
        .eq('id', orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? { ...order, status: newStatus, admin_notes: adminNote }
            : order
        )
      );

      setSelected((prev) =>
        prev?.id === orderId
          ? { ...prev, status: newStatus, admin_notes: adminNote }
          : prev
      );

      const nextOrder = {
        ...currentOrder,
        status: newStatus,
        admin_notes: adminNote,
      };

      await syncPromotionState([nextOrder]);

      toast.success(`Estado actualizado a ${STATUS_OPTIONS.find((item) => item.value === newStatus)?.label}`);
    } catch (error) {
      if (undoStockSync) {
        try {
          await undoStockSync();
        } catch (rollbackError) {
          console.error('No se pudo revertir el stock tras un fallo de estado', rollbackError);
        }
      }

      console.error(error);
      toast.error(error?.message || 'No se pudo actualizar el pedido');
    } finally {
      setUpdating(false);
    }
  }

  async function deleteOrder(order) {
    const canDelete = order.status === 'entregado' || order.status === 'cancelado';
    if (!canDelete) {
      toast.error('Solo puedes borrar pedidos entregados o cancelados');
      return;
    }

    const confirmed = window.confirm(`Eliminar ${order.order_number}? Esta accion limpia el panel y no se puede deshacer.`);
    if (!confirmed) return;

    setDeleting(true);
    const { error } = await supabase.from('orders').delete().eq('id', order.id);

    if (error) {
      toast.error('No se pudo eliminar el pedido');
      setDeleting(false);
      return;
    }

    setOrders((prev) => prev.filter((item) => item.id !== order.id));
    setSelected((prev) => (prev?.id === order.id ? null : prev));
    setOrderItems((prev) => (selected?.id === order.id ? [] : prev));
    toast.success('Pedido eliminado del panel');
    setDeleting(false);
  }

  async function openWhatsapp(order) {
    const phone = normalizeWhatsappPhone(order?.address_snapshot?.phone);

    if (!phone) {
      toast.error('Este pedido no tiene un telefono valido para WhatsApp');
      return;
    }

    const popupWindow = canUseNativeShare()
      ? null
      : window.open('', '_blank');

    setSharingOrderId(order.id);

    try {
      const items = await loadOrderItems(order.id);
      if (selected?.id === order.id) {
        setOrderItems(items);
      }

      const result = await shareOrderPaymentRequest({
        order,
        items,
        phone,
        paymentSettings,
        popupWindow,
      });

      if (result.method === 'share') {
        toast.success('Resumen listo para compartir por WhatsApp');
      } else {
        toast.success('Abrimos WhatsApp y bajamos el resumen para adjuntarlo');
      }
    } catch (error) {
      if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
      }

      if (error?.name === 'AbortError') {
        toast('Se cancelo el compartir');
        return;
      }

      console.error(error);
      toast.error(error?.message || 'No se pudo preparar el mensaje de cobro');
    } finally {
      setSharingOrderId(null);
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'entregados') return orders.filter((order) => order.status === 'entregado');
    if (filter === 'cancelados') return orders.filter((order) => order.status === 'cancelado');
    if (filter === 'todos') return orders;
    return orders.filter((order) => !['entregado', 'cancelado'].includes(order.status));
  }, [filter, orders]);

  if (loading) {
    return <div className="page-loading"><div className="spinner" /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Pedidos</h1>
          <p style={{ fontSize: 14, color: 'var(--txt-muted)' }}>
            Mostrando {filtered.length} pedido{filtered.length !== 1 ? 's' : ''} para despacho nocturno.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
        {ORDER_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={filter === item.value ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 ? (
          <div className="card">
            <p style={{ color: 'var(--txt-muted)' }}>No hay pedidos en este filtro.</p>
          </div>
        ) : (
          filtered.map((order) => {
            const deliveryCode = order.address_snapshot?.delivery_code;
            const canDelete = order.status === 'entregado' || order.status === 'cancelado';
            const isSharing = sharingOrderId === order.id;
            const creditApplied = Number(order.address_snapshot?.pricing?.credit_applied || 0);

            return (
              <div key={order.id} className="card">
                <div className="admin-order-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <strong>{order.order_number}</strong>
                      <span className={`badge status-${order.status}`}>
                        {STATUS_OPTIONS.find((item) => item.value === order.status)?.label}
                      </span>
                      {deliveryCode && (
                        <span className="badge badge-success">Codigo {deliveryCode}</span>
                      )}
                      {creditApplied > 0 && (
                        <span className="badge">Credito {formatGs(creditApplied)}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{order.customer_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--txt-muted)' }}>{order.customer_email}</div>
                    {order.address_snapshot?.phone && (
                      <div style={{ fontSize: 13, color: 'var(--txt-muted)', marginTop: 2 }}>
                        {order.address_snapshot.phone}
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: 'var(--txt-muted)', marginTop: 4 }}>
                      {new Date(order.created_at).toLocaleDateString('es-PY', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>

                  <div className="admin-order-side">
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--brand)' }}>
                      Gs. {Number(order.total || 0).toLocaleString('es-PY')}
                    </div>

                    <select
                      value={order.status}
                      onChange={(event) => updateStatus(order.id, event.target.value)}
                      disabled={updating}
                      className="input"
                      style={{ width: 170 }}
                    >
                      {STATUS_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button onClick={() => openWhatsapp(order)} className="btn btn-outline btn-sm" disabled={isSharing}>
                        {isSharing ? <Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} /> : <MessageCircle size={14} />}
                        Cobrar por WhatsApp
                      </button>
                      <button onClick={() => openDetail(order)} className="btn btn-outline btn-sm">
                        <Eye size={14} />
                        Ver detalle
                      </button>
                      {canDelete && (
                        <button onClick={() => deleteOrder(order)} className="btn btn-danger btn-sm" disabled={deleting}>
                          {deleting ? <Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} /> : <Trash2 size={14} />}
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selected && (
        <div className="overlay" onClick={(event) => event.target === event.currentTarget && setSelected(null)}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <h2>{selected.order_number}</h2>
              <button className="close-btn" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="checkout-highlight-card">
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>Codigo de entrega</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {selected.address_snapshot?.delivery_code || 'Sin codigo'}
                  </div>
                </div>
              </div>

              <div className="responsive-form-grid">
                <div className="field">
                  <label>Cliente</label>
                  <div className="card" style={{ padding: '0.875rem', background: 'var(--bg)' }}>
                    <strong>{selected.customer_name}</strong>
                    <div style={{ fontSize: 13, color: 'var(--txt-muted)' }}>{selected.customer_email}</div>
                    {selected.address_snapshot?.phone && (
                      <div style={{ fontSize: 13, color: 'var(--txt-muted)', marginTop: 4 }}>
                        {selected.address_snapshot.phone}
                      </div>
                    )}
                  </div>
                </div>

                <div className="field">
                  <label>Estado</label>
                  <select
                    value={selected.status}
                    onChange={(event) => updateStatus(selected.id, event.target.value, selected.admin_notes || '')}
                    disabled={updating}
                    className="input"
                  >
                    {STATUS_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => openWhatsapp(selected)}
                  className="btn btn-primary"
                  disabled={sharingOrderId === selected.id}
                >
                  {sharingOrderId === selected.id ? (
                    <Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} />
                  ) : (
                    <MessageCircle size={16} />
                  )}
                  Cobrar por WhatsApp
                </button>
              </div>

              <div className="field">
                <label>Direccion</label>
                <div className="card" style={{ background: 'var(--bg)', padding: '0.875rem', lineHeight: 1.7 }}>
                  <strong>{selected.address_snapshot?.full_name}</strong>
                  <br />
                  {selected.address_snapshot?.street}
                  {selected.address_snapshot?.neighborhood ? `, ${selected.address_snapshot.neighborhood}` : ''}
                  {selected.address_snapshot?.city ? `, ${selected.address_snapshot.city}` : ''}
                  <br />
                  {selected.address_snapshot?.phone}
                  {selected.address_snapshot?.reference ? ` - ${selected.address_snapshot.reference}` : ''}
                </div>
              </div>

              {selected.notes && (
                <div className="field">
                  <label>Nota del cliente</label>
                  <div className="card" style={{ background: 'var(--bg)', padding: '0.875rem' }}>
                    {selected.notes}
                  </div>
                </div>
              )}

              <div className="field">
                <label>Productos</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {orderItems.map((item) => (
                    <div key={item.id} className="card" style={{ padding: '0.875rem', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <strong>{item.product_snapshot.name}</strong>
                        <div style={{ fontSize: 13, color: 'var(--txt-muted)' }}>Cantidad: {item.quantity}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--brand)' }}>
                        Gs. {(Number(item.unit_price || 0) * Number(item.quantity || 0)).toLocaleString('es-PY')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {(selected.address_snapshot?.pricing?.credit_applied || 0) > 0 && (
                <div className="field">
                  <label>Promocion aplicada</label>
                  <div className="card" style={{ background: 'var(--bg)', padding: '0.875rem', lineHeight: 1.8 }}>
                    <div>Creditos usados: <strong>{formatGs(selected.address_snapshot.pricing.credit_applied || 0)}</strong></div>
                    <div>Total antes del credito: <strong>{formatGs(selected.address_snapshot.pricing.total_before_credits || selected.total)}</strong></div>
                    {selected.address_snapshot?.pricing?.credit_refund_processed && (
                      <div style={{ color: 'var(--success)' }}>Credito reintegrado al cliente por cancelacion.</div>
                    )}
                  </div>
                </div>
              )}

              {(selected.address_snapshot?.pricing?.delivery_adjusted_distance_km !== null && selected.address_snapshot?.pricing?.delivery_adjusted_distance_km !== undefined) && (
                <div className="field">
                  <label>Delivery</label>
                  <div className="card" style={{ background: 'var(--bg)', padding: '0.875rem', lineHeight: 1.8 }}>
                    <div>Distancia: <strong>{selected.address_snapshot.pricing.delivery_adjusted_distance_km} km</strong></div>
                    <div>Envio: <strong>{selected.address_snapshot.pricing.shipping === 0 ? 'GRATIS' : `Gs. ${selected.address_snapshot.pricing.shipping.toLocaleString('es-PY')}`}</strong></div>
                  </div>
                </div>
              )}

              <div className="field">
                <label>Nota interna</label>
                <textarea
                  className="input"
                  rows={3}
                  defaultValue={selected.admin_notes}
                  onBlur={(event) => {
                    if (event.target.value !== selected.admin_notes) {
                      updateStatus(selected.id, selected.status, event.target.value);
                    }
                  }}
                  placeholder="Solo visible para admin"
                />
              </div>
            </div>

            {(selected.status === 'entregado' || selected.status === 'cancelado') && (
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => deleteOrder(selected)} className="btn btn-danger" disabled={deleting}>
                  {deleting ? <Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} /> : <Trash2 size={14} />}
                  Eliminar del panel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
