import React, { useEffect, useState } from 'react';
import { User, Save, Loader2, MapPin, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import AddressModal from '../Addresses/AddressModal';
import { fetchUserAddresses, saveUserAddress } from '../../lib/addresses';
import { storeConfig } from '../../config/store';

export default function ProfilePage() {
  const { user, profile, updateProfileData } = useAuth();
  const [form, setForm]       = useState({ full_name: profile?.full_name || '', phone: profile?.phone || '' });
  const [loading, setLoading] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [addrLoading, setAddrLoading] = useState(true);
  const [addressModalOpen, setAddressModalOpen] = useState(false);

  useEffect(() => {
    setForm({
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
    });
  }, [profile]);

  useEffect(() => {
    let cancelled = false;

    async function loadAddresses() {
      if (!user) {
        setAddresses([]);
        setAddrLoading(false);
        return;
      }

      setAddrLoading(true);

      try {
        const data = await fetchUserAddresses(user.uid);
        if (!cancelled) {
          setAddresses(data);
        }
      } catch (error) {
        console.error('loadAddresses error:', error);
        if (!cancelled) {
          toast.error('No se pudieron cargar tus direcciones');
        }
      } finally {
        if (!cancelled) {
          setAddrLoading(false);
        }
      }
    }

    loadAddresses();

    return () => {
      cancelled = true;
    };
  }, [user]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error('El nombre es requerido'); return; }
    setLoading(true);
    try {
      await updateProfileData(form);
      toast.success('Perfil actualizado');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAddress(values) {
    const data = await saveUserAddress({
      firebaseUid: user.uid,
      values,
      isDefault: addresses.length === 0,
    });

    setAddresses((prev) => [data, ...prev]);
    toast.success('Direccion guardada');
  }

  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem', maxWidth: 520 }}>
      <h1 style={{ fontSize: 22, marginBottom: '1.5rem' }}>Mi cuenta</h1>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '1.5rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 99,
            background: 'var(--blue-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <User size={26} style={{ color: 'var(--blue)' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{profile?.full_name || user.email}</div>
            <div style={{ fontSize: 13, color: 'var(--txt-muted)' }}>{user.email}</div>
          </div>
        </div>
        <div className="divider" />
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: '1.25rem' }}>
          <div className="field">
            <label>Nombre completo</label>
            <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
          </div>
          <div className="field">
            <label>Teléfono / WhatsApp</label>
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0981 000 000" autoComplete="tel" inputMode="tel" />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" value={user.email} disabled autoComplete="email" style={{ background: 'var(--bg)', cursor: 'not-allowed' }} />
            <small>El email no se puede cambiar desde aquí</small>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading
              ? <><Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> Guardando...</>
              : <><Save size={16} /> Guardar cambios</>}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Mis direcciones</h2>
            <p style={{ fontSize: 13, color: 'var(--txt-muted)' }}>
              Guarda tus direcciones una vez y luego solo las eliges al pedir.
            </p>
          </div>
          <button type="button" className="btn btn-outline" onClick={() => setAddressModalOpen(true)}>
            <Plus size={16} />
            Agregar direccion
          </button>
        </div>

        <div className="divider" style={{ marginTop: '1rem', marginBottom: '1rem' }} />

        {addrLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt-muted)' }}>
            <div className="spinner" style={{ width: 18, height: 18 }} />
            Cargando direcciones...
          </div>
        ) : addresses.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {addresses.map((address) => (
              <div key={address.id} className="address-card" style={{ background: '#fff' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: 'var(--blue-light)',
                    color: 'var(--blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={18} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {address.label} {address.is_default ? '• Principal' : ''}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--txt-muted)', lineHeight: 1.6 }}>
                    {address.full_name}
                    <br />
                    {address.street}
                    {address.neighborhood ? `, ${address.neighborhood}` : ''}
                    {address.city ? `, ${address.city}` : ''}
                    <br />
                    {address.phone}
                    {address.reference ? ` - ${address.reference}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '1rem 0' }}>
            <div className="icon">Direccion</div>
            <h3>Aun no guardaste direcciones</h3>
            <p>Agrega una y tu checkout va a salir mucho mas rapido.</p>
          </div>
        )}
      </div>

      {addressModalOpen && (
        <AddressModal
          title="Agregar direccion"
          description="La dejamos guardada para usarla en futuros pedidos."
          initialValues={{
            label: 'Casa',
            full_name: form.full_name || profile?.full_name || '',
            phone: form.phone || profile?.phone || '',
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
