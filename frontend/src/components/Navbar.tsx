import React from 'react';
import { UserSession } from '../types';
import { RoleBadge } from './RoleBadge';

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  session: UserSession | null;
  onLogout: () => void;
  onOpenLoginModal: () => void;
}

export const Navbar: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  session,
  onLogout,
  onOpenLoginModal,
}) => {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(7, 10, 18, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-color)',
        padding: '14px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        {/* Brand */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          onClick={() => setActiveTab('verify')}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #00d2b4 0%, #0284c7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(0, 210, 180, 0.3)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#070a12" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                Medi<span className="gradient-text">Trace</span>
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(0, 210, 180, 0.1)',
                  color: '#00d2b4',
                  border: '1px solid rgba(0, 210, 180, 0.25)',
                  fontWeight: 700,
                }}
              >
                PROVENANCE v1.0
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              Decentralized Pharmaceutical Integrity
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setActiveTab('verify')}
            className="btn btn-secondary"
            style={{
              fontSize: '0.82rem',
              padding: '7px 14px',
              background: activeTab === 'verify' ? 'rgba(0, 210, 180, 0.15)' : 'transparent',
              borderColor: activeTab === 'verify' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'verify' ? 'var(--primary)' : 'var(--text-muted)',
            }}
          >
            🔍 Public Verify
          </button>

          <button
            onClick={() => setActiveTab('manufacturer')}
            className="btn btn-secondary"
            style={{
              fontSize: '0.82rem',
              padding: '7px 14px',
              background: activeTab === 'manufacturer' ? 'rgba(0, 210, 180, 0.15)' : 'transparent',
              borderColor: activeTab === 'manufacturer' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'manufacturer' ? 'var(--primary)' : 'var(--text-muted)',
            }}
          >
            🏭 Manufacturer
          </button>

          <button
            onClick={() => setActiveTab('distributor')}
            className="btn btn-secondary"
            style={{
              fontSize: '0.82rem',
              padding: '7px 14px',
              background: activeTab === 'distributor' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              borderColor: activeTab === 'distributor' ? 'var(--accent-blue)' : 'transparent',
              color: activeTab === 'distributor' ? 'var(--accent-blue)' : 'var(--text-muted)',
            }}
          >
            🚚 Distributor
          </button>

          <button
            onClick={() => setActiveTab('pharmacy')}
            className="btn btn-secondary"
            style={{
              fontSize: '0.82rem',
              padding: '7px 14px',
              background: activeTab === 'pharmacy' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              borderColor: activeTab === 'pharmacy' ? 'var(--accent-emerald)' : 'transparent',
              color: activeTab === 'pharmacy' ? 'var(--accent-emerald)' : 'var(--text-muted)',
            }}
          >
            🏥 Pharmacy / Hospital
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className="btn btn-secondary"
            style={{
              fontSize: '0.82rem',
              padding: '7px 14px',
              background: activeTab === 'admin' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              borderColor: activeTab === 'admin' ? 'var(--accent-amber)' : 'transparent',
              color: activeTab === 'admin' ? 'var(--accent-amber)' : 'var(--text-muted)',
            }}
          >
            ⚖️ Admin Console
          </button>
        </nav>

        {/* User Session / Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{session.user.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <RoleBadge role={session.user.role} />
                </div>
              </div>
              <button
                onClick={onLogout}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '6px 10px' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem', padding: '8px 16px' }}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
