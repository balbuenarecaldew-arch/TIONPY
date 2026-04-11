import React, { useState } from 'react';
import { User, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, profile, updateProfileData } = useAuth();
  const [form, setForm]       = useState({ full_name: profile?.full_name || '', phone: profile?.phone || '' });
  const [loading, setLoading] = useState(false);

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
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0981 000 000" />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" value={user.email} disabled style={{ background: 'var(--bg)', cursor: 'not-allowed' }} />
            <small>El email no se puede cambiar desde aquí</small>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading
              ? <><Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> Guardando...</>
              : <><Save size={16} /> Guardar cambios</>}
          </button>
        </form>
      </div>
    </div>
  );
}
