import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Gift, Loader2, MapPin, Plus, Save, User, Wallet, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import AddressModal from '../Addresses/AddressModal';
import { fetchUserAddresses, saveUserAddress } from '../../lib/addresses';
import { storeConfig } from '../../config/store';
import { PROMO_CONFIG } from '../../config/promotions';
import { fetchReferralSummary, formatGs, normalizePromotionProfile } from '../../lib/promotions';

export default function ProfilePage() {
  const { user, profile, updateProfileData } = useAuth();
  const normalizedProfile = useMemo(() => normalizePromotionProfile(profile), [profile]);
  const [form, setForm] = useState({
    full_name: normalizedProfile?.full_name || '',
    phone: normalizedProfile?.phone || '',
  });
  const [loading, setLoading] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [addrLoading, setAddrLoading] = useState(true);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [referralSummary, setReferralSummary] = useState({
    loading: true,
    registeredCount: 0,
    rewardedCount: 0,
    referrals: [],
  });

  useEffect(() => {
    setForm({
      full_name: normalizedProfile?.full_name || '',
      phone: normalizedProfile?.phone || '',
    });
  }, [normalizedProfile]);

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

  useEffect(() => {
    let cancelled = false;

    async function loadReferralSummary() {
      if (!normalizedProfile?.id) {
        setReferralSummary({
          loading: false,
          registeredCount: 0,
          rewardedCount: 0,
          referrals: [],
        });
        return;
      }

      setReferralSummary((prev) => ({ ...prev, loading: true }));

      try {
        const data = await fetchReferralSummary(normalizedProfile.id);
        if (!cancelled) {
          setReferralSummary({
            loading: false,
            ...data,
          });
        }
      } catch (error) {
        console.error('loadReferralSummary error:', error);
        if (!cancelled) {
          setReferralSummary((prev) => ({ ...prev, loading: false }));
        }
      }
    }

    loadReferralSummary();

    return () => {
      cancelled = true;
    };
  }, [normalizedProfile?.id]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!form.full_name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setLoading(true);
    try {
      await updateProfileData(form);
      toast.success('Perfil actualizado');
    } catch (error) {
      toast.error(error?.message || 'Error al guardar');
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

  async function copyReferralCode() {
    if (!normalizedProfile.referral_code) {
      toast.error('Tu codigo todavia no esta listo');
      return;
    }

    try {
      await navigator.clipboard.writeText(normalizedProfile.referral_code);
      toast.success('Codigo copiado');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo copiar. Puedes usar el codigo que ves en pantalla.');
    }
  }

  const rewardedSlotsLeft = Math.max(PROMO_CONFIG.maxRewardedReferrals - referralSummary.rewardedCount, 0);
  const recentCreditHistory = normalizedProfile.credit_history.slice(0, 5);

  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem', maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, marginBottom: '1.5rem' }}>Mi cuenta</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: '1rem' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FFFBEB 100%)', borderColor: '#FED7AA' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={iconWrap('#F97316', '#FFF7ED')}>
              <Wallet size={18} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#9A3412', textTransform: 'uppercase', letterSpacing: 0.6 }}>Saldo disponible</div>
              <strong style={{ fontSize: 24, color: '#7C2D12', fontFamily: "'Space Grotesk', sans-serif" }}>
                {formatGs(normalizedProfile.credit_balance)}
              </strong>
            </div>
          </div>

          <p style={{ fontSize: 14, color: '#9A3412', lineHeight: 1.7, marginBottom: 8 }}>
            Usa tus creditos desde {formatGs(PROMO_CONFIG.minimumOrderSubtotalForCredits)} en productos.
            El sistema aplica hasta {formatGs(PROMO_CONFIG.maxCreditPerOrder)} por pedido.
          </p>
          <p style={{ fontSize: 12, color: '#9A3412', margin: 0 }}>
            Bono de bienvenida: {formatGs(PROMO_CONFIG.welcomeBonusAmount)}.
          </p>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #172554 0%, #1E293B 100%)', color: '#fff', borderColor: '#1E3A8A' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={iconWrap('#BFDBFE', 'rgba(255,255,255,0.12)')}>
              <Users size={18} />
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 0.6 }}>Referidos</div>
              <strong style={{ fontSize: 20 }}>Invita y gana hasta {formatGs(PROMO_CONFIG.referralRewardAmount * PROMO_CONFIG.maxRewardedReferrals)}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ fontSize: 14, opacity: 0.82 }}>Codigo:</div>
            <code style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', fontWeight: 700 }}>
              {normalizedProfile.referral_code || 'Generando...'}
            </code>
            <button type="button" className="btn btn-outline btn-sm" onClick={copyReferralCode} style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.24)' }}>
              <Copy size={14} />
              Copiar
            </button>
          </div>

          <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, opacity: 0.88 }}>
            Tus amigos deben registrarse con tu codigo y completar una compra valida.
            Llevas {referralSummary.rewardedCount} de {PROMO_CONFIG.maxRewardedReferrals} referidos premiados.
            Te quedan {rewardedSlotsLeft} cupo{rewardedSlotsLeft !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 99,
              background: 'var(--blue-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={26} style={{ color: 'var(--blue)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{normalizedProfile?.full_name || user.email}</div>
            <div style={{ fontSize: 13, color: 'var(--txt-muted)' }}>{user.email}</div>
          </div>
          <div style={{ minWidth: 220 }}>
            <div style={{ fontSize: 12, color: 'var(--txt-muted)', marginBottom: 4 }}>Progreso de referidos</div>
            <div style={{ height: 10, borderRadius: 999, background: 'var(--bg)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min((referralSummary.rewardedCount / PROMO_CONFIG.maxRewardedReferrals) * 100, 100)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #F97316 0%, #FB923C 100%)',
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt-muted)', marginTop: 6 }}>
              Registrados: {referralSummary.registeredCount} - Premiados: {referralSummary.rewardedCount}
            </div>
          </div>
        </div>

        <div className="divider" />

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: '1.25rem' }}>
          <div className="field">
            <label>Nombre completo</label>
            <input className="input" value={form.full_name} onChange={(event) => setField('full_name', event.target.value)} />
          </div>

          <div className="field">
            <label>Telefono / WhatsApp</label>
            <input className="input" value={form.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="0981 000 000" autoComplete="tel" inputMode="tel" />
          </div>

          <div className="field">
            <label>Email</label>
            <input className="input" value={user.email} disabled autoComplete="email" style={{ background: 'var(--bg)', cursor: 'not-allowed' }} />
            <small>El email no se puede cambiar desde aqui.</small>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading
              ? <><Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> Guardando...</>
              : <><Save size={16} /> Guardar cambios</>}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Movimientos de creditos</h2>
            <p style={{ fontSize: 13, color: 'var(--txt-muted)' }}>
              Historial basico de bonos, referidos, usos y reintegros.
            </p>
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt-muted)' }}>
            Maximo {PROMO_CONFIG.maxRewardedReferrals} amigos premiados
          </div>
        </div>

        <div className="divider" style={{ marginTop: '1rem', marginBottom: '1rem' }} />

        {recentCreditHistory.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentCreditHistory.map((entry) => {
              const positive = Number(entry.amount || 0) > 0;

              return (
                <div key={entry.id || `${entry.kind}-${entry.created_at}`} className="address-card" style={{ background: '#fff', alignItems: 'center' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      background: positive ? 'var(--success-bg)' : '#FEF2F2',
                      color: positive ? 'var(--success)' : 'var(--danger)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Gift size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{creditEntryTitle(entry)}</div>
                    <div style={{ fontSize: 13, color: 'var(--txt-muted)', lineHeight: 1.6 }}>
                      {entry.reason}
                      {entry.order_id ? ` - Pedido ${String(entry.order_id).slice(0, 8)}` : ''}
                      <br />
                      {new Date(entry.created_at).toLocaleString('es-PY', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: positive ? 'var(--success)' : 'var(--danger)' }}>
                    {positive ? '+' : '-'} {formatGs(Math.abs(Number(entry.amount || 0)))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '1rem 0' }}>
            <div className="icon">Creditos</div>
            <h3>Aun no hay movimientos</h3>
            <p>Tus bonos y usos van a aparecer aqui en cuanto empieces a comprar o referir.</p>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Mis direcciones</h2>
            <p style={{ fontSize: 13, color: 'var(--txt-muted)' }}>
              Guarda tus zonas una sola vez y luego elige rapido al confirmar.
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
                    {address.label} {address.is_default ? '- Principal' : ''}
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
            <p>Agrega una y tus pedidos nocturnos van a salir mucho mas rapido.</p>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Amigos vinculados</h2>
            <p style={{ fontSize: 13, color: 'var(--txt-muted)' }}>
              Seguimiento basico de quienes ya se registraron con tu codigo.
            </p>
          </div>
          {referralSummary.loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt-muted)', fontSize: 13 }}>
              <div className="spinner" style={{ width: 16, height: 16 }} />
              Cargando...
            </div>
          )}
        </div>

        <div className="divider" style={{ marginTop: '1rem', marginBottom: '1rem' }} />

        {referralSummary.referrals.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {referralSummary.referrals.map((item) => (
              <div key={item.id} className="address-card" style={{ background: '#fff', alignItems: 'center' }}>
                <div style={iconWrap(item.referral_reward_granted ? 'var(--success)' : '#F97316', item.referral_reward_granted ? 'var(--success-bg)' : '#FFF7ED')}>
                  <Users size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{item.full_name || item.email}</div>
                  <div style={{ fontSize: 13, color: 'var(--txt-muted)' }}>
                    {item.email}
                  </div>
                </div>
                <span className={`badge ${item.referral_reward_granted ? 'badge-success' : ''}`}>
                  {item.referral_reward_granted ? 'Premiado' : 'Pendiente de compra valida'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '1rem 0' }}>
            <div className="icon">Referidos</div>
            <h3>Aun no hay amigos vinculados</h3>
            <p>Comparte tu codigo y tus proximos registros van a aparecer aqui.</p>
          </div>
        )}
      </div>

      {addressModalOpen && (
        <AddressModal
          title="Agregar direccion"
          description="La dejamos guardada para usarla en futuros pedidos."
          initialValues={{
            label: 'Casa',
            full_name: form.full_name || normalizedProfile?.full_name || '',
            phone: form.phone || normalizedProfile?.phone || '',
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

function creditEntryTitle(entry) {
  if (entry.kind === 'welcome_bonus') return 'Bono de bienvenida';
  if (entry.kind === 'referral_reward') return 'Premio por referido';
  if (entry.kind === 'credit_usage') return 'Credito usado';
  if (entry.kind === 'credit_refund') return 'Reintegro de credito';
  return 'Movimiento de credito';
}

function iconWrap(color, background) {
  return {
    width: 40,
    height: 40,
    borderRadius: 999,
    background,
    color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
}
