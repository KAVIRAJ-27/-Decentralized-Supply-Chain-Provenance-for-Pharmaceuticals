import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { PublicVerifyPage } from './pages/PublicVerifyPage';
import { ManufacturerPage } from './pages/ManufacturerPage';
import { DistributorPage } from './pages/DistributorPage';
import { PharmacyPage } from './pages/PharmacyPage';
import { AdminPage } from './pages/AdminPage';
import { UserSession } from './types';
import { api } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('verify');
  const [session, setSession] = useState<UserSession | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('manufacturer@apexpharma.com');
  const [loginPassword, setLoginPassword] = useState('mfg123');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [urlBatchId, setUrlBatchId] = useState<string | undefined>(undefined);

  // Check URL parameters for direct verification link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyParam = params.get('verify');
    if (verifyParam) {
      setUrlBatchId(verifyParam);
      setActiveTab('verify');
    }

    // Check localStorage session
    const saved = localStorage.getItem('meditrace_session');
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('meditrace_session');
      }
    }
  }, []);

  const handleLogin = async (emailToUse?: string, passToUse?: string) => {
    const e = emailToUse || loginEmail;
    const p = passToUse || loginPassword;
    setLoginLoading(true);
    setLoginError(null);

    try {
      const data = await api.login(e, p);
      setSession(data);
      localStorage.setItem('meditrace_session', JSON.stringify(data));
      setShowLoginModal(false);

      // Switch automatically to the matching portal
      switch (data.user.role) {
        case 'MANUFACTURER':
          setActiveTab('manufacturer');
          break;
        case 'DISTRIBUTOR':
          setActiveTab('distributor');
          break;
        case 'PHARMACY':
          setActiveTab('pharmacy');
          break;
        case 'ADMIN':
          setActiveTab('admin');
          break;
        default:
          setActiveTab('verify');
          break;
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('meditrace_session');
    setActiveTab('verify');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={session}
        onLogout={handleLogout}
        onOpenLoginModal={() => setShowLoginModal(true)}
      />

      <main style={{ flex: 1 }}>
        {activeTab === 'verify' && <PublicVerifyPage initialBatchId={urlBatchId} />}
        {activeTab === 'manufacturer' && (
          <ManufacturerPage session={session} onOpenLogin={() => setShowLoginModal(true)} />
        )}
        {activeTab === 'distributor' && (
          <DistributorPage session={session} onOpenLogin={() => setShowLoginModal(true)} />
        )}
        {activeTab === 'pharmacy' && (
          <PharmacyPage session={session} onOpenLogin={() => setShowLoginModal(true)} />
        )}
        {activeTab === 'admin' && (
          <AdminPage session={session} onOpenLogin={() => setShowLoginModal(true)} />
        )}
      </main>

      {/* Modern Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(7, 10, 18, 0.95)',
          padding: '24px',
          textAlign: 'center',
          marginTop: '40px',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
          <p>
            MediTrace &bull; Decentralized Pharmaceutical Supply Chain Provenance Platform
          </p>
          <p style={{ marginTop: '6px', fontSize: '0.75rem' }}>
            Built with Ethereum Smart Contracts, Vite + React, Node.js &amp; Mobile QR Scanning Engine.
          </p>
        </div>
      </footer>

      {/* Role Quick-Switch Login Modal */}
      {showLoginModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '460px',
              width: '100%',
              padding: '28px',
              background: '#0d1527',
              border: '1px solid rgba(0, 210, 180, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.3rem' }}>Participant Portal Sign In</h2>
              <button
                onClick={() => setShowLoginModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {loginError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '0.82rem',
                  marginBottom: '16px',
                }}
              >
                {loginError}
              </div>
            )}

            {/* Quick Demo Switcher */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Quick 1-Click Role Access (Development Demo)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '8px', justifyContent: 'flex-start' }}
                  onClick={() => handleLogin('manufacturer@apexpharma.com', 'mfg123')}
                >
                  🏭 Manufacturer
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '8px', justifyContent: 'flex-start' }}
                  onClick={() => handleLogin('distributor@ghlogistics.com', 'dist123')}
                >
                  🚚 Distributor
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '8px', justifyContent: 'flex-start' }}
                  onClick={() => handleLogin('pharmacy@citycare.org', 'pharm123')}
                >
                  🏥 Pharmacy
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '8px', justifyContent: 'flex-start' }}
                  onClick={() => handleLogin('admin@meditrace.org', 'admin123')}
                >
                  ⚖️ Admin Regulator
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'center', margin: '14px 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              &mdash; OR SIGN IN WITH CREDENTIALS &mdash;
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLogin();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Work Email</label>
                <input
                  type="email"
                  className="input-field"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Access Key / Password</label>
                <input
                  type="password"
                  className="input-field"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loginLoading} style={{ marginTop: '8px' }}>
                {loginLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
