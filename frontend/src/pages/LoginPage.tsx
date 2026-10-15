import React, { useState } from 'react';
import { api } from '../services/api';
import { UserSession } from '../types';

interface Props {
  onLoginSuccess: (session: UserSession) => void;
  onNavigateToVerify: () => void;
  redirectReason?: string | null;
}

export const LoginPage: React.FC<Props> = ({
  onLoginSuccess,
  onNavigateToVerify,
  redirectReason,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your work email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const session = await api.login(email.trim(), password);
      onLoginSuccess(session);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or credentials. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickCredentials = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 20px',
        position: 'relative',
      }}
    >
      {/* Background glow effects */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(0, 210, 180, 0.08) 0%, rgba(2, 132, 199, 0.04) 50%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div
        className="glass-panel"
        style={{
          maxWidth: '480px',
          width: '100%',
          padding: '36px',
          borderRadius: '16px',
          position: 'relative',
          zIndex: 1,
          border: '1px solid rgba(0, 210, 180, 0.25)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 210, 180, 0.1)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #00d2b4 0%, #0284c7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 24px rgba(0, 210, 180, 0.35)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#070a12" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
            Portal Sign In
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            MediTrace Decentralized Pharmaceutical Provenance
          </p>
        </div>

        {/* Redirect Notice */}
        {redirectReason && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontSize: '0.82rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>🔒</span>
            <span>{redirectReason}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: '0.82rem',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f87171',
                fontSize: '1.1rem',
                cursor: 'pointer',
              }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Quick Demo Switcher */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 700,
              marginBottom: '10px',
            }}
          >
            ⚡ Quick 1-Click Role Access (Evaluation Demo)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '8px 10px', justifyContent: 'flex-start' }}
              onClick={() => fillQuickCredentials('admin@meditrace.org', 'admin123')}
            >
              ⚖️ Regulator (Admin)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '8px 10px', justifyContent: 'flex-start' }}
              onClick={() => fillQuickCredentials('manufacturer@apexpharma.com', 'mfg123')}
            >
              🏭 Manufacturer
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '8px 10px', justifyContent: 'flex-start' }}
              onClick={() => fillQuickCredentials('distributor@ghlogistics.com', 'dist123')}
            >
              🚚 Distributor
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '8px 10px', justifyContent: 'flex-start' }}
              onClick={() => fillQuickCredentials('pharmacy@citycare.org', 'pharm123')}
            >
              🏥 Pharmacy / Hospital
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', margin: '18px 0', fontSize: '0.74rem', color: 'var(--text-dim)' }}>
          &mdash; OR ENTER CREDENTIALS &mdash;
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '6px' }}>
              Institutional Work Email
            </label>
            <input
              type="email"
              className="input-field"
              placeholder="user@organization.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Password / Security Key</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              className="input-field"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{
              padding: '12px',
              fontSize: '0.9rem',
              fontWeight: 700,
              marginTop: '8px',
              boxShadow: '0 4px 15px rgba(0, 210, 180, 0.3)',
            }}
          >
            {isLoading ? 'Verifying Credentials...' : 'Sign In to Portal'}
          </button>
        </form>

        {/* Public Access Link */}
        <div style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: 0 }}>
            Consumer or Patient checking drug safety?{' '}
            <button
              onClick={onNavigateToVerify}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Public Drug Verification (Zero Login)
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
