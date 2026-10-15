import React from 'react';
import { UserRole } from '../types';

interface Props {
  userRole: UserRole;
  requiredRole: string;
  onNavigateHome: () => void;
  onLogout: () => void;
}

export const AccessDenied: React.FC<Props> = ({
  userRole,
  requiredRole,
  onNavigateHome,
  onLogout,
}) => {
  return (
    <div
      style={{
        minHeight: 'calc(100vh - 160px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '520px',
          width: '100%',
          padding: '40px 32px',
          textAlign: 'center',
          borderRadius: '16px',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          background: 'rgba(15, 10, 20, 0.95)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.1)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid rgba(239, 68, 68, 0.4)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            margin: '0 auto 20px',
          }}
        >
          🛡️
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f87171', marginBottom: '8px' }}>
          Access Denied &bull; 403 Forbidden
        </h1>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
          Your authenticated institutional role (<strong>{userRole}</strong>) does not have authorization to view or execute operations on this module.
        </p>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '28px',
            fontSize: '0.82rem',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-dim)' }}>Your Active Role:</span>
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{userRole}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-dim)' }}>Required Role:</span>
            <span style={{ fontWeight: 700, color: '#fbbf24' }}>{requiredRole}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)' }}>Enforcement Layer:</span>
            <span style={{ color: 'var(--text-muted)' }}>Backend RBAC Middleware</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={onNavigateHome}
            className="btn btn-primary"
            style={{ padding: '10px 20px', fontSize: '0.85rem' }}
          >
            Go to Your Authorized Portal
          </button>
          <button
            onClick={onLogout}
            className="btn btn-secondary"
            style={{ padding: '10px 16px', fontSize: '0.85rem' }}
          >
            Switch Account
          </button>
        </div>
      </div>
    </div>
  );
};
