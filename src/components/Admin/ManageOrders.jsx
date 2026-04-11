import { useState, useEffect } from 'react';
import { Eye, ChevronDown, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: 'pendiente',  label: 'Pendiente'  },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'preparando', label: 'Preparando' },
  { value: 'en_camino',  label: 'En camino'  },
  { value: 'entregado',  label: 'Entregado'  },
  { value: 'cancelado',  label: 'Cancelado'  },
];

export default function ManageOrders() {
  const [orders,     setOrders]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(null);  // order detail modal
  const [orderItems, setOrderItems] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [updating,   setUpdating]   = useState(false);

  useEffect(() => { fetchOrders(); }, []);

  async function fetchOrders() {
    const q = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    const { data } = await q;
    setOrders(data || []);
    setLoading(false);
  }

  async function openDetail(order) {
    setSelected(order);
    const { data } = await supabase.from('order_items').select('*').eq('order_id', order.id);
    setOrderItems(data || []);
  }

  async function updateStatus(orderId, newStatus, adminNote = '') {
    setUpdating(true);
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, admin_notes: adminNote })
      .eq('id', orderId);
    if (error) { toast.error('Error al actualizar'); setUpdating(false); return; }
    toast.success(`Estado actualizado: ${STATUS_OPTIONS.find(s => s.value === newStatus)?.label}`);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus, admin_notes: adminNote } : o));
    if (selected?.id === orderId) setSelected(prev => ({ ...prev, status: newStatus, admin_notes: adminNote }));
    setUpdating(false);
  }

  const filtered = filterStatus ? orders.filter(o => o.status === filterStatus) : orders;

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>Pedidos ({orders.length})</h1>
        <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 180 }}>
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Contadores por estado */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {STATUS_OPTIONS.map(s => {
          const count = orders.filter(o => o.status === s.value).length;
          if (count === 0) return null;
          return (
            <button
              key={s.value}
              onClick={() => setFilterStatus(filterStatus === s.value ? '' : s.value)}
              className={`badge status-${s.value}`}
              style={{
                cursor: 'pointer', border: filterStatus === s.value ? '2px solid currentColor' : '2px solid transparent',
                padding: '4px 12px', fontSize: 12,
              }}
            >{s.label}: {count}</button>
          );
        })}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              {['Pedido','Cliente','Fecha','Total','Estado','Cambiar estado',''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--txt-muted)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--txt-muted)' }}>No hay pedidos</td></tr>
            ) : filtered.map((o, i) => (
              <tr key={o.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>{o.order_number}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div>{o.customer_name}</div>
                  <div style={{ color: 'var(--txt-muted)', fontSize: 12 }}>{o.customer_email}</div>
                </td>
                <td style={{ padding: '10px 14px', color: 'var(--txt-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(o.created_at).toLocaleDateString('es-PY', { day:'2-digit', month:'short', year:'numeric' })}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--brand)' }}>
                  ₲ {o.total.toLocaleString('es-PY')}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span className={`badge status-${o.status}`}>
                    {STATUS_OPTIONS.find(s => s.value === o.status)?.label}
                  </span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <select
                    value={o.status}
                    onChange={e => updateStatus(o.id, e.target.value)}
                    disabled={updating}
                    className="input"
                    style={{ width: 140, height: 32, fontSize: 12 }}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <button onClick={() => openDetail(o)} className="btn btn-outline btn-sm" title="Ver detalle">
                    <Eye size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal detalle */}
      {selected && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2>Pedido {selected.order_number}</h2>
              <button className="close-btn" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Info cliente */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-muted)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Cliente</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{selected.customer_name}</div>
                  <div style={{ fontSize: 13, color: 'var(--txt-muted)' }}>{selected.customer_email}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-muted)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Estado</div>
                  <select
                    value={selected.status}
                    onChange={e => updateStatus(selected.id, e.target.value)}
                    disabled={updating}
                    className="input"
                    style={{ height: 36 }}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Dirección */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-muted)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>Dirección de entrega</div>
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', fontSize: 13, lineHeight: 1.8 }}>
                  <strong>{selected.address_snapshot.full_name}</strong><br />
                  {selected.address_snapshot.street}, {selected.address_snapshot.neighborhood && `${selected.address_snapshot.neighborhood}, `}{selected.address_snapshot.city}<br />
                  {selected.address_snapshot.reference && <><em>{selected.address_snapshot.reference}</em><br /></>}
                  📞 {selected.address_snapshot.phone}
                </div>
              </div>

              {/* Nota del cliente */}
              {selected.notes && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-muted)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Nota del cliente</div>
                  <div style={{ fontSize: 13, color: 'var(--txt-muted)', fontStyle: 'italic' }}>{selected.notes}</div>
                </div>
              )}

              {/* Items */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-muted)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Productos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {orderItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{item.product_snapshot.name} × {item.quantity}</span>
                      <span style={{ fontWeight: 700 }}>₲ {(item.unit_price * item.quantity).toLocaleString('es-PY')}</span>
                    </div>
                  ))}
                </div>
                <div className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--brand)', fontFamily: "'Space Grotesk', sans-serif" }}>
                    ₲ {selected.total.toLocaleString('es-PY')}
                  </span>
                </div>
              </div>

              {/* Nota interna */}
              <div className="field">
                <label>Nota interna del admin</label>
                <textarea
                  className="input"
                  rows={2}
                  defaultValue={selected.admin_notes}
                  onBlur={e => {
                    if (e.target.value !== selected.admin_notes)
                      updateStatus(selected.id, selected.status, e.target.value);
                  }}
                  placeholder="Nota visible solo para el admin..."
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
