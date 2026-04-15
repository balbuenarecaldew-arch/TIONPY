import React, { useState } from 'react';
import { X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import AddressModal from '../Addresses/AddressModal';
import { saveUserAddress } from '../../lib/addresses';

export default function AuthModal({ initialMode = 'login', onClose }) {
  const { login, register, resetPassword } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState({});
  const [pendingAddressSetup, setPendingAddressSetup] = useState(null);

  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    referralCode: '',
    confirmPassword: '',
  });

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  }

  function validate() {
    const nextErrors = {};

    if (!form.email) nextErrors.email = 'Requerido';
    else if (!/\S+@\S+\.\S+/.test(form.email)) nextErrors.email = 'Email invalido';

    if (mode !== 'reset') {
      if (!form.password) nextErrors.password = 'Requerido';
      else if (form.password.length < 6) nextErrors.password = 'Minimo 6 caracteres';
    }

    if (mode === 'register') {
      if (!form.fullName) nextErrors.fullName = 'Requerido';
      if (!form.phone) nextErrors.phone = 'Requerido';
      if (form.password !== form.confirmPassword) {
        nextErrors.confirmPassword = 'Las contrasenas no coinciden';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
        toast.success('Bienvenido de vuelta');
        onClose();
      } else if (mode === 'register') {
        const createdUser = await register({
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          phone: form.phone,
          referralCode: form.referralCode,
        });
        toast.success('Cuenta creada. Ya tienes Gs. 10.000 en creditos. Guardemos tu primera direccion');
        setPendingAddressSetup({
          firebaseUid: createdUser.uid,
          full_name: form.fullName,
          phone: form.phone,
        });
      } else {
        await resetPassword(form.email);
        toast.success('Correo de recuperacion enviado');
        setMode('login');
      }
    } catch (error) {
      console.error('Firebase auth error:', error);
      toast.error(firebaseError(error?.code, error?.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleFirstAddressSave(values) {
    await saveUserAddress({
      firebaseUid: pendingAddressSetup?.firebaseUid,
      values,
      isDefault: true,
    });

    toast.success('Cuenta y direccion listas');
  }

  if (pendingAddressSetup) {
    return (
      <AddressModal
        title="Guarda tu primera direccion"
        description="La dejamos lista para que tus proximos pedidos nocturnos salgan mucho mas rapido."
        initialValues={{
          label: 'Casa',
          full_name: pendingAddressSetup.full_name,
          phone: pendingAddressSetup.phone,
        }}
        submitLabel="Guardar y continuar"
        skipLabel="Despues"
        allowSkip
        onSubmit={handleFirstAddressSave}
        onSkip={() => toast.success('Tu cuenta ya quedo lista. Puedes cargar la direccion despues.')}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 style={{ fontSize: 18 }}>
            {mode === 'login' ? 'Iniciar sesion' : mode === 'register' ? 'Crear cuenta' : 'Recuperar contrasena'}
          </h2>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'register' && (
              <>
                <div
                  style={{
                    background: '#FFF7ED',
                    border: '1px solid #FED7AA',
                    color: '#9A3412',
                    borderRadius: 12,
                    padding: '0.875rem',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: 4 }}>Te llevas Gs. 10.000 al registrarte</strong>
                  Usa tus creditos desde Gs. 40.000 y gana otros Gs. 10.000 por cada amigo que compre con tu codigo.
                  Maximo 3 amigos premiados.
                </div>

                <div className="field">
                  <label>Nombre completo</label>
                  <input
                    className={`input ${errors.fullName ? 'error' : ''}`}
                    placeholder="Juan Perez"
                    value={form.fullName}
                    onChange={(event) => setField('fullName', event.target.value)}
                    autoComplete="name"
                  />
                  {errors.fullName && <span className="error-msg">{errors.fullName}</span>}
                </div>

                <div className="field">
                  <label>Telefono / WhatsApp</label>
                  <input
                    className={`input ${errors.phone ? 'error' : ''}`}
                    placeholder="0981 123 456"
                    value={form.phone}
                    onChange={(event) => setField('phone', event.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                  />
                  {errors.phone && <span className="error-msg">{errors.phone}</span>}
                </div>

                <div className="field">
                  <label>Codigo de referido (opcional)</label>
                  <input
                    className="input"
                    placeholder="Ej: LUNAX123"
                    value={form.referralCode}
                    onChange={(event) => setField('referralCode', event.target.value.toUpperCase())}
                    autoCapitalize="characters"
                    maxLength={12}
                  />
                  <small>Si un amigo te invito, cargalo ahora para dejar el vinculo fijo.</small>
                </div>
              </>
            )}

            <div className="field">
              <label>Email</label>
              <input
                type="email"
                className={`input ${errors.email ? 'error' : ''}`}
                placeholder="tu@email.com"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                inputMode="email"
              />
              {errors.email && <span className="error-msg">{errors.email}</span>}
            </div>

            {mode !== 'reset' && (
              <div className="field">
                <label>Contrasena</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className={`input ${errors.password ? 'error' : ''}`}
                    placeholder="********"
                    value={form.password}
                    onChange={(event) => setField('password', event.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((value) => !value)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--txt-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <span className="error-msg">{errors.password}</span>}
              </div>
            )}

            {mode === 'register' && (
              <div className="field">
                <label>Confirmar contrasena</label>
                <input
                  type="password"
                  className={`input ${errors.confirmPassword ? 'error' : ''}`}
                  placeholder="********"
                  value={form.confirmPassword}
                  onChange={(event) => setField('confirmPassword', event.target.value)}
                  autoComplete="new-password"
                />
                {errors.confirmPassword && <span className="error-msg">{errors.confirmPassword}</span>}
              </div>
            )}

            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginTop: -8 }}>
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13, cursor: 'pointer' }}
                >
                  Olvidaste tu contrasena?
                </button>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? (
                <Loader2 size={18} style={{ animation: 'spin .7s linear infinite' }} />
              ) : mode === 'login' ? (
                'Ingresar'
              ) : mode === 'register' ? (
                'Crear mi cuenta'
              ) : (
                'Enviar correo'
              )}
            </button>
          </div>
        </form>

        <div className="modal-footer" style={{ textAlign: 'center', fontSize: 14 }}>
          {mode === 'login' ? (
            <>
              No tenes cuenta?{' '}
              <button
                onClick={() => setMode('register')}
                style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
              >
                Registrate gratis
              </button>
            </>
          ) : (
            <>
              Ya tenes cuenta?{' '}
              <button
                onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
              >
                Iniciar sesion
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function firebaseError(code, fallbackMessage = '') {
  const map = {
    'auth/user-not-found': 'No existe una cuenta con ese email',
    'auth/wrong-password': 'Contrasena incorrecta',
    'auth/invalid-credential': 'Email o contrasena incorrectos',
    'auth/invalid-login-credentials': 'Email o contrasena incorrectos',
    'auth/email-already-in-use': 'Ese email ya esta registrado',
    'auth/invalid-email': 'Email invalido',
    'auth/user-disabled': 'Esta cuenta fue deshabilitada',
    'auth/operation-not-allowed': 'El acceso con email y contrasena no esta habilitado',
    'auth/too-many-requests': 'Demasiados intentos. Intenta mas tarde',
    'auth/network-request-failed': 'Sin conexion a internet',
  };

  if (map[code]) return map[code];
  if (fallbackMessage) return fallbackMessage;
  return `Ocurrio un error. Intenta de nuevo. ${code || ''}`.trim();
}
