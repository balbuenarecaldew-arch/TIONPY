import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Crosshair, Loader2, MapPin, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createAddressDraft, validateAddressForm } from '../../lib/addresses';
import { parseCoordinatesFromMapInput } from '../../lib/delivery';
import OpenStreetMapPicker from './OpenStreetMapPicker';

export default function AddressModal({
  title = 'Guardar direccion',
  description = 'Deja tus datos listos para pedir mas rapido.',
  initialValues,
  submitLabel = 'Guardar direccion',
  cancelLabel = 'Cancelar',
  skipLabel = 'Ahora no',
  allowSkip = false,
  onSubmit,
  onClose,
  onSkip,
}) {
  const [form, setForm] = useState(() => createAddressDraft(initialValues));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showLocationFields, setShowLocationFields] = useState(Boolean(initialValues?.maps_link));
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    setForm(createAddressDraft(initialValues));
    setErrors({});
    setShowLocationFields(Boolean(initialValues?.maps_link));
    setLocationError('');
    setShowMapPicker(Boolean(initialValues?.maps_link));
  }, [initialValues]);

  const parsedLocation = useMemo(
    () => parseCoordinatesFromMapInput(form.maps_link),
    [form.maps_link]
  );

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
    if (key === 'maps_link') {
      setLocationError('');
    }
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no permite usar la ubicacion del telefono.');
      return;
    }

    setDetectingLocation(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextValue = `${position.coords.latitude},${position.coords.longitude}`;
        setField('maps_link', nextValue);
        setDetectingLocation(false);
        toast.success('Ubicacion exacta cargada desde tu telefono');
      },
      (error) => {
        const messages = {
          1: 'Necesitamos permiso para leer la ubicacion del telefono.',
          2: 'No se pudo obtener tu ubicacion actual.',
          3: 'La ubicacion tardo demasiado. Intenta otra vez.',
        };

        setDetectingLocation(false);
        setLocationError(messages[error.code] || 'No se pudo leer la ubicacion exacta.');
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validateAddressForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error('Completa los datos obligatorios de la direccion');
      return;
    }

    setLoading(true);

    try {
      await onSubmit(form);
      onClose();
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la direccion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            <p style={{ marginTop: 6, fontSize: 13, color: 'var(--txt-muted)' }}>{description}</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="responsive-form-grid">
              <div className="field">
                <label>Etiqueta</label>
                <select
                  className="input"
                  value={form.label}
                  onChange={(event) => setField('label', event.target.value)}
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
                  className={`input ${errors.full_name ? 'error' : ''}`}
                  value={form.full_name}
                  onChange={(event) => setField('full_name', event.target.value)}
                  autoComplete="name"
                />
                {errors.full_name && <span className="error-msg">{errors.full_name}</span>}
              </div>

              <div className="field">
                <label>Telefono *</label>
                <input
                  className={`input ${errors.phone ? 'error' : ''}`}
                  value={form.phone}
                  onChange={(event) => setField('phone', event.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="0981 000 000"
                />
                {errors.phone && <span className="error-msg">{errors.phone}</span>}
              </div>

              <div className="field full-span">
                <label>Calle y numero *</label>
                <input
                  className={`input ${errors.street ? 'error' : ''}`}
                  value={form.street}
                  onChange={(event) => setField('street', event.target.value)}
                  autoComplete="street-address"
                  placeholder="Av. principal 123"
                />
                {errors.street && <span className="error-msg">{errors.street}</span>}
              </div>

              <div className="field">
                <label>Barrio</label>
                <input
                  className="input"
                  value={form.neighborhood}
                  onChange={(event) => setField('neighborhood', event.target.value)}
                  autoComplete="address-level2"
                />
              </div>

              <div className="field">
                <label>Ciudad</label>
                <input
                  className="input"
                  value={form.city}
                  onChange={(event) => setField('city', event.target.value)}
                  autoComplete="address-level2"
                />
              </div>

              <div className="field full-span">
                <label>Referencia</label>
                <input
                  className="input"
                  value={form.reference}
                  onChange={(event) => setField('reference', event.target.value)}
                  autoComplete="off"
                  placeholder="Casa azul, frente a la plaza..."
                />
              </div>
            </div>

            <div
              style={{
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius)',
                padding: '0.85rem',
                background: 'var(--bg)',
              }}
            >
              <button
                type="button"
                className="btn btn-outline btn-full"
                onClick={() => setShowLocationFields((prev) => !prev)}
              >
                {showLocationFields ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {showLocationFields ? 'Ocultar ubicacion exacta' : 'Agregar ubicacion exacta (opcional)'}
              </button>

              {showLocationFields && (
                <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="location-action-grid">
                    <button
                      type="button"
                      className="btn btn-primary btn-full"
                      onClick={handleUseCurrentLocation}
                      disabled={detectingLocation}
                    >
                      {detectingLocation ? (
                        <>
                          <Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} />
                          Leyendo ubicacion...
                        </>
                      ) : (
                        <>
                          <Crosshair size={16} />
                          Usar mi ubicacion actual
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline btn-full"
                      onClick={() => setShowMapPicker((prev) => !prev)}
                    >
                      <MapPin size={16} />
                      {showMapPicker ? 'Ocultar mapa' : 'Marcar en el mapa'}
                    </button>
                  </div>

                  <div
                    style={{
                      borderRadius: 10,
                      padding: '10px 12px',
                      background: parsedLocation ? '#EFF6FF' : '#F8FAFC',
                      color: parsedLocation ? '#1D4ED8' : 'var(--txt-muted)',
                      fontSize: 13,
                    }}
                  >
                    {parsedLocation
                      ? 'La ubicacion exacta ya quedo cargada.'
                      : 'Puedes usar el GPS del telefono o marcar el punto en el mapa.'}
                  </div>

                  {showMapPicker && (
                    <OpenStreetMapPicker
                      value={form.maps_link}
                      onChange={(nextValue) => setField('maps_link', nextValue)}
                    />
                  )}

                  <div className="field">
                    <label>Ubicacion exacta</label>
                    <input
                      className={`input ${form.maps_link && !parsedLocation ? 'error' : ''}`}
                      value={form.maps_link}
                      onChange={(event) => setField('maps_link', event.target.value)}
                      autoComplete="off"
                      placeholder="Se completa con GPS, mapa o coordenadas"
                    />
                    <small>
                      {parsedLocation
                        ? `Coordenadas detectadas: ${parsedLocation.lat.toFixed(6)}, ${parsedLocation.lng.toFixed(6)}`
                        : 'Es opcional. Sirve para calcular mejor el delivery.'}
                    </small>
                    {locationError && <span className="error-msg">{locationError}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {allowSkip && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    onSkip?.();
                    onClose();
                  }}
                >
                  {skipLabel}
                </button>
              )}

              {!allowSkip && (
                <button type="button" className="btn btn-outline" onClick={onClose}>
                  {cancelLabel}
                </button>
              )}
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                  Guardando...
                </>
              ) : (
                <>
                  <Check size={16} />
                  {submitLabel}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
