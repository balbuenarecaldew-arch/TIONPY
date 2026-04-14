import React, { useEffect, useMemo, useState } from 'react';
import { Landmark, Loader2, MessageCircle, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DEFAULT_PAYMENT_SETTINGS,
  fetchPaymentSettings,
  normalizePaymentSettings,
  savePaymentSettings,
} from '../../lib/storeSettings';
import { buildPaymentRequestMessage } from '../../lib/orderShare';

const PREVIEW_ORDER = {
  order_number: 'TION-20260413-0007',
  customer_name: 'Cliente ejemplo',
  total: 84500,
  address_snapshot: {
    delivery_code: '42',
  },
};

export default function ManagePayments() {
  const [form, setForm] = useState(DEFAULT_PAYMENT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const settings = await fetchPaymentSettings();
      if (!cancelled) {
        setForm(settings);
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const previewMessage = useMemo(
    () => buildPaymentRequestMessage({
      order: PREVIEW_ORDER,
      paymentSettings: normalizePaymentSettings(form),
    }),
    [form]
  );

  function setTransferField(key, value) {
    setForm((prev) => ({
      ...prev,
      transfer: {
        ...prev.transfer,
        [key]: value,
      },
    }));
  }

  function setWhatsappField(key, value) {
    setForm((prev) => ({
      ...prev,
      whatsapp: {
        ...prev.whatsapp,
        [key]: value,
      },
    }));
  }

  async function handleSave() {
    setSaving(true);

    try {
      const saved = await savePaymentSettings(form);
      setForm(saved);
      toast.success('Configuracion de cobros guardada');
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'No se pudo guardar la configuracion de cobros');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="page-loading"><div className="spinner" /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Cobros</h1>
          <p style={{ fontSize: 14, color: 'var(--txt-muted)' }}>
            Estos datos se agregan solos al mensaje de WhatsApp y al resumen visual del pedido.
          </p>
        </div>

        <button type="button" onClick={handleSave} className="btn btn-primary" disabled={saving}>
          {saving ? <Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> : <Save size={16} />}
          Guardar datos
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Landmark size={18} style={{ color: 'var(--blue)' }} />
          <h2 style={{ fontSize: 17 }}>Cuenta para transferencias</h2>
        </div>

        <div className="responsive-form-grid">
          <div className="field">
            <label>Titular</label>
            <input
              className="input"
              value={form.transfer.owner}
              onChange={(event) => setTransferField('owner', event.target.value)}
              placeholder="Nombre del titular"
            />
          </div>

          <div className="field">
            <label>Banco</label>
            <input
              className="input"
              value={form.transfer.bank}
              onChange={(event) => setTransferField('bank', event.target.value)}
              placeholder="Banco o billetera"
            />
          </div>

          <div className="field full-span">
            <label>Cuenta / alias / numero</label>
            <input
              className="input"
              value={form.transfer.account}
              onChange={(event) => setTransferField('account', event.target.value)}
              placeholder="Cuenta, alias, C.I. o dato que el cliente debe usar"
            />
          </div>

          <div className="field full-span">
            <label>Instrucciones adicionales</label>
            <textarea
              className="input"
              rows={3}
              value={form.transfer.instructions}
              onChange={(event) => setTransferField('instructions', event.target.value)}
              placeholder="Ej: enviar comprobante por WhatsApp y escribir el numero de pedido"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <MessageCircle size={18} style={{ color: 'var(--blue)' }} />
          <h2 style={{ fontSize: 17 }}>Mensaje automatico</h2>
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>Texto extra opcional</label>
          <textarea
            className="input"
            rows={3}
            value={form.whatsapp.extraMessage}
            onChange={(event) => setWhatsappField('extraMessage', event.target.value)}
            placeholder="Ej: si prefieres otro medio de pago, respondeme por aqui y te ayudo"
          />
          <small>El sistema ya agrega numero de pedido, total, codigo de entrega y los datos de transferencia.</small>
        </div>

        <div
          style={{
            padding: '1rem',
            borderRadius: 16,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            whiteSpace: 'pre-line',
            lineHeight: 1.7,
            fontSize: 14,
          }}
        >
          {previewMessage}
        </div>
      </div>

      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,.08), rgba(16,185,129,.08))' }}>
        <strong style={{ display: 'block', marginBottom: 6 }}>Como funciona</strong>
        <p style={{ fontSize: 14, color: 'var(--txt-muted)', lineHeight: 1.7 }}>
          Desde cada pedido vas a poder tocar el boton de WhatsApp. La app prepara el texto de cobro y genera una imagen
          con el resumen del pedido para compartirla junto al mensaje.
        </p>
      </div>
    </div>
  );
}
