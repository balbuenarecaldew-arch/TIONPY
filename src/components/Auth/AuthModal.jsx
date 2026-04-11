import React, { useState } from 'react';
import { X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function AuthModal({ initialMode = 'login', onClose }) {
  const { login, register, resetPassword } = useAuth();
  const [mode, setMode]   = useState(initialMode); // 'login' | 'register' | 'reset'
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors]   = useState({});

  const [form, setForm] = useState({
    email: '', password: '', fullName: '', phone: '', confirmPassword: '',
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); }

  function validate() {
    const e = {};
    if (!form.email) e.email = 'Requerido';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email inválido';

    if (mode !== 'reset') {
      if (!form.password) e.password = 'Requerido';
      else if (form.password.length < 6) e.password = 'Mínimo 6 caracteres';
    }
    if (mode === 'register') {
      if (!form.fullName) e.fullName = 'Requerido';
      if (!form.phone) e.phone = 'Requerido';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
        toast.success('¡Bienvenido de vuelta!');
        onClose();
      } else if (mode === 'register') {
        await register({
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          phone: form.phone,
        });
        toast.success('¡Cuenta creada! Bienvenido a TechShop 🎉');
        onClose();
      } else if (mode === 'reset') {
        await resetPassword(form.email);
        toast.success('Correo de recuperación enviado');
        setMode('login');
      }
    } catch (err) {
      const msg = firebaseError(err.code);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 style={{ fontSize: 18 }}>
            {mode === 'login'    ? 'Iniciar sesión' :
             mode === 'register' ? 'Crear cuenta'  : 'Recuperar contraseña'}
          </h2>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {mode === 'register' && (
              <>
                <div className="field">
                  <label>Nombre completo</label>
                  <input
                    className={`input ${errors.fullName ? 'error' : ''}`}
                    placeholder="Juan Pérez"
                    value={form.fullName}
                    onChange={e => set('fullName', e.target.value)}
                  />
                  {errors.fullName && <span className="error-msg">{errors.fullName}</span>}
                </div>
                <div className="field">
                  <label>Teléfono / WhatsApp</label>
                  <input
                    className={`input ${errors.phone ? 'error' : ''}`}
                    placeholder="0981 123 456"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                  />
                  {errors.phone && <span className="error-msg">{errors.phone}</span>}
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
                onChange={e => set('email', e.target.value)}
                autoComplete="email"
              />
              {errors.email && <span className="error-msg">{errors.email}</span>}
            </div>

            {mode !== 'reset' && (
              <div className="field">
                <label>Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className={`input ${errors.password ? 'error' : ''}`}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--txt-muted)', cursor: 'pointer',
                    }}
                  >{showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
                {errors.password && <span className="error-msg">{errors.password}</span>}
              </div>
            )}

            {mode === 'register' && (
              <div className="field">
                <label>Confirmar contraseña</label>
                <input
                  type="password"
                  className={`input ${errors.confirmPassword ? 'error' : ''}`}
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
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
                >¿Olvidaste tu contraseña?</button>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? <Loader2 size={18} className="spin" style={{ animation: 'spin .7s linear infinite' }} /> :
                mode === 'login'    ? 'Ingresar'            :
                mode === 'register' ? 'Crear mi cuenta'     : 'Enviar correo'}
            </button>
          </div>
        </form>

        <div className="modal-footer" style={{ textAlign: 'center', fontSize: 14 }}>
          {mode === 'login' ? (
            <>¿No tenés cuenta?{' '}
              <button
                onClick={() => setMode('register')}
                style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
              >Registrate gratis</button>
            </>
          ) : (
            <>¿Ya tenés cuenta?{' '}
              <button
                onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
              >Iniciar sesión</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function firebaseError(code) {
  const map = {
    'auth/user-not-found':      'No existe una cuenta con ese email',
    'auth/wrong-password':      'Contraseña incorrecta',
    'auth/email-already-in-use':'Ese email ya está registrado',
    'auth/invalid-email':       'Email inválido',
    'auth/too-many-requests':   'Demasiados intentos. Intentá más tarde',
    'auth/network-request-failed': 'Sin conexión a internet',
  };
  return map[code] || 'Ocurrió un error. Intentá de nuevo.';
}
