import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, Plus, Save, Trash2, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DEFAULT_DELIVERY_SETTINGS,
  calculateDeliveryQuote,
  formatFactorRange,
  getAmountFactorRule,
  normalizeDeliverySettings,
  parseCoordinatesFromMapInput,
} from '../../lib/delivery';
import { fetchDeliverySettings, saveDeliverySettings } from '../../lib/storeSettings';

const PREVIEW_SUBTOTALS = [50000, 150000, 250000];

export default function ManageDelivery() {
  const [form, setForm] = useState(DEFAULT_DELIVERY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const settings = await fetchDeliverySettings();
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

  const parsedOrigin = useMemo(
    () => parseCoordinatesFromMapInput(form.origin.mapsLink),
    [form.origin.mapsLink]
  );

  const previewRules = useMemo(() => {
    const normalized = normalizeDeliverySettings(form);
    return PREVIEW_SUBTOTALS.map((subtotal) => {
      const factorRule = getAmountFactorRule(subtotal, normalized);
      const quote = calculateDeliveryQuote({
        subtotalAfterDiscount: subtotal,
        destinationLat: normalized.origin.latitude !== null ? Number(normalized.origin.latitude) + 0.08 : null,
        destinationLng: normalized.origin.longitude !== null ? Number(normalized.origin.longitude) + 0.08 : null,
        settings: normalized,
        fallbackCost: 0,
      });

      return {
        subtotal,
        factor: factorRule?.factor ?? 1,
        label: factorRule ? formatFactorRange(factorRule) : 'Sin regla',
        shipping: quote.shipping,
      };
    });
  }, [form]);

  function setOriginField(key, value) {
    setForm((prev) => ({
      ...prev,
      origin: {
        ...prev.origin,
        [key]: value,
      },
    }));
  }

  function setPricingField(key, value) {
    setForm((prev) => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        [key]: value,
      },
    }));
  }

  function updateFactorRule(index, key, value) {
    setForm((prev) => ({
      ...prev,
      amountFactors: prev.amountFactors.map((rule, ruleIndex) =>
        ruleIndex === index
          ? { ...rule, [key]: value }
          : rule
      ),
    }));
  }

  function addFactorRule() {
    setForm((prev) => ({
      ...prev,
      amountFactors: [
        ...prev.amountFactors,
        {
          minSubtotal: 0,
          maxSubtotal: null,
          factor: 1,
        },
      ],
    }));
  }

  function removeFactorRule(index) {
    setForm((prev) => ({
      ...prev,
      amountFactors: prev.amountFactors.filter((_, ruleIndex) => ruleIndex !== index),
    }));
  }

  function syncOriginCoordinates() {
    if (!form.origin.mapsLink.trim()) {
      return;
    }

    const coords = parseCoordinatesFromMapInput(form.origin.mapsLink);
    if (!coords) {
      toast.error('No pude leer coordenadas del enlace de Google Maps');
      return;
    }

    setForm((prev) => ({
      ...prev,
      origin: {
        ...prev.origin,
        latitude: coords.lat,
        longitude: coords.lng,
      },
    }));
    toast.success('Coordenadas de origen detectadas');
  }

  async function handleSave() {
    setSaving(true);

    try {
      const mapsCoords = form.origin.mapsLink.trim()
        ? parseCoordinatesFromMapInput(form.origin.mapsLink)
        : null;

      if (form.origin.mapsLink.trim() && !mapsCoords) {
        throw new Error('El enlace de Google Maps del origen no se pudo interpretar.');
      }

      const payload = normalizeDeliverySettings({
        ...form,
        origin: {
          ...form.origin,
          latitude: mapsCoords?.lat ?? form.origin.latitude,
          longitude: mapsCoords?.lng ?? form.origin.longitude,
        },
      });

      const saved = await saveDeliverySettings(payload);
      setForm(saved);
      toast.success('Configuracion de delivery guardada');
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'No se pudo guardar la configuracion');
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
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Delivery</h1>
          <p style={{ fontSize: 14, color: 'var(--txt-muted)' }}>
            Calcula por distancia, aplica factor por monto y deja lista la operacion nocturna.
          </p>
        </div>
        <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
          {saving ? <Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> : <Save size={16} />}
          Guardar reglas
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <MapPin size={18} style={{ color: 'var(--blue)' }} />
          <h2 style={{ fontSize: 17 }}>Origen del reparto</h2>
        </div>

        <div className="responsive-form-grid">
          <div className="field full-span">
            <label>Direccion base</label>
            <input
              className="input"
              value={form.origin.address}
              onChange={(event) => setOriginField('address', event.target.value)}
              placeholder="Ej: Ayolas centro, local principal"
            />
          </div>

          <div className="field full-span">
            <label>Link de Google Maps o coordenadas</label>
            <input
              className="input"
              value={form.origin.mapsLink}
              onChange={(event) => setOriginField('mapsLink', event.target.value)}
              onBlur={syncOriginCoordinates}
              placeholder="Pega el enlace compartido de Google Maps o lat,lng"
            />
            <small>
              {parsedOrigin
                ? `Detectado: ${parsedOrigin.lat.toFixed(6)}, ${parsedOrigin.lng.toFixed(6)}`
                : 'Usa un link compartido de Google Maps o escribe latitud,longitud.'}
            </small>
          </div>

          <div className="field">
            <label>Latitud</label>
            <input
              className="input"
              type="number"
              value={form.origin.latitude ?? ''}
              onChange={(event) => setOriginField('latitude', event.target.value)}
              placeholder="-27.367500"
            />
          </div>

          <div className="field">
            <label>Longitud</label>
            <input
              className="input"
              type="number"
              value={form.origin.longitude ?? ''}
              onChange={(event) => setOriginField('longitude', event.target.value)}
              placeholder="-56.900100"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Truck size={18} style={{ color: 'var(--blue)' }} />
          <h2 style={{ fontSize: 17 }}>Formula base</h2>
        </div>

        <div className="responsive-form-grid">
          <div className="field">
            <label>Precio por km (Gs.)</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.pricing.pricePerKm}
              onChange={(event) => setPricingField('pricePerKm', event.target.value)}
            />
          </div>

          <div className="field">
            <label>Multiplicador de distancia</label>
            <input
              className="input"
              type="number"
              min="0.1"
              step="0.1"
              value={form.pricing.distanceMultiplier}
              onChange={(event) => setPricingField('distanceMultiplier', event.target.value)}
            />
          </div>

          <div className="field">
            <label>Cargo minimo (Gs.)</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.pricing.minFee}
              onChange={(event) => setPricingField('minFee', event.target.value)}
            />
          </div>

          <div className="field">
            <label>Tope maximo (Gs.)</label>
            <input
              className="input"
              type="number"
              min="0"
              max="30000"
              value={form.pricing.maxFee}
              onChange={(event) => setPricingField('maxFee', event.target.value)}
            />
            <small>Siempre se limita a Gs. 30.000 como maximo.</small>
          </div>

          <div className="field">
            <label>Redondeo (Gs.)</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.pricing.roundingStep}
              onChange={(event) => setPricingField('roundingStep', event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 17 }}>Factores por monto</h2>
            <p style={{ fontSize: 13, color: 'var(--txt-muted)' }}>
              Ejemplo: de 0 a 100.000 factor 1, de 100.001 a 200.000 factor 0.5, y despues 0.
            </p>
          </div>
          <button onClick={addFactorRule} className="btn btn-outline btn-sm">
            <Plus size={14} />
            Agregar tramo
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {form.amountFactors.map((rule, index) => (
            <div key={`${index}-${rule.minSubtotal}-${rule.maxSubtotal ?? 'open'}`} className="responsive-form-grid" style={{ alignItems: 'end' }}>
              <div className="field">
                <label>Desde (Gs.)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={rule.minSubtotal}
                  onChange={(event) => updateFactorRule(index, 'minSubtotal', event.target.value)}
                />
              </div>

              <div className="field">
                <label>Hasta (Gs.)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={rule.maxSubtotal ?? ''}
                  onChange={(event) => updateFactorRule(index, 'maxSubtotal', event.target.value === '' ? null : event.target.value)}
                  placeholder="Sin limite"
                />
              </div>

              <div className="field">
                <label>Factor</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.1"
                  value={rule.factor}
                  onChange={(event) => updateFactorRule(index, 'factor', event.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={() => removeFactorRule(index)}
                className="btn btn-danger btn-sm"
                disabled={form.amountFactors.length === 1}
              >
                <Trash2 size={14} />
                Quitar
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 17, marginBottom: 12 }}>Vista rapida</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {previewRules.map((item) => (
            <div
              key={item.subtotal}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                padding: '12px 14px',
                borderRadius: 12,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>Compra de Gs. {item.subtotal.toLocaleString('es-PY')}</div>
                <div style={{ fontSize: 12, color: 'var(--txt-muted)', marginTop: 2 }}>Pedido nocturno</div>
                <div style={{ fontSize: 13, color: 'var(--txt-muted)' }}>
                  {item.label}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>Factor {item.factor}</div>
                <div style={{ fontSize: 13, color: 'var(--txt-muted)' }}>
                  Delivery preview: Gs. {item.shipping.toLocaleString('es-PY')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
