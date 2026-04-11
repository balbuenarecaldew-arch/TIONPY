import React from 'react';

export default function SetupRequired({ missingEnvVars }) {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: '2rem 1rem',
      background: 'linear-gradient(135deg, #0F172A 0%, #172554 100%)',
      color: '#E2E8F0',
    }}>
      <section style={{
        width: 'min(760px, 100%)',
        background: 'rgba(15, 23, 42, 0.82)',
        border: '1px solid rgba(148, 163, 184, 0.22)',
        borderRadius: 24,
        padding: '2rem',
        boxShadow: '0 24px 80px rgba(15, 23, 42, 0.35)',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(251, 191, 36, 0.14)',
          color: '#FCD34D',
          borderRadius: 999,
          padding: '0.35rem 0.8rem',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '.04em',
          textTransform: 'uppercase',
        }}>
          Configuracion pendiente
        </div>

        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          lineHeight: 1.05,
          margin: '1rem 0 0.75rem',
          color: '#F8FAFC',
        }}>
          La tienda ya se puede desplegar, pero todavia no esta conectada.
        </h1>

        <p style={{
          margin: 0,
          color: '#CBD5E1',
          fontSize: 16,
          lineHeight: 1.6,
        }}>
          Faltan variables de entorno de Firebase y Supabase. Sin esas claves la app no
          puede autenticar usuarios, leer productos ni guardar pedidos.
        </p>

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem 1.1rem',
          background: 'rgba(30, 41, 59, 0.78)',
          borderRadius: 18,
          border: '1px solid rgba(148, 163, 184, 0.18)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 10, color: '#F8FAFC' }}>
            Variables faltantes
          </div>
          <ul style={{
            margin: 0,
            paddingLeft: '1.2rem',
            color: '#E2E8F0',
            lineHeight: 1.8,
            columnCount: missingEnvVars.length > 4 ? 2 : 1,
            columnGap: '2rem',
          }}>
            {missingEnvVars.map((key) => (
              <li key={key} style={{ breakInside: 'avoid' }}>{key}</li>
            ))}
          </ul>
        </div>

        <div style={{
          display: 'grid',
          gap: 12,
          marginTop: '1.5rem',
          color: '#CBD5E1',
        }}>
          <div>1. Copia <code>.env.example</code> como <code>.env</code>.</div>
          <div>2. Completa las claves <code>VITE_*</code> con tus datos reales.</div>
          <div>3. En Vercel o Netlify, carga esas mismas variables en el panel del proyecto.</div>
        </div>

        <div style={{
          marginTop: '1.5rem',
          padding: '0.95rem 1rem',
          background: 'rgba(59, 130, 246, 0.14)',
          border: '1px solid rgba(96, 165, 250, 0.3)',
          borderRadius: 16,
          color: '#DBEAFE',
          lineHeight: 1.6,
        }}>
          Este repositorio usa React + Vite y las rutas del frontend ya quedaron preparadas
          para despliegue tipo SPA.
        </div>
      </section>
    </main>
  );
}
