import React, { useState } from 'react';

interface Props {
  currentApiUrl: string;
  onSave: (url: string) => void;
  onClose: () => void;
}

export const NetworkSettingsModal: React.FC<Props> = ({ currentApiUrl, onSave, onClose }) => {
  const [apiUrl, setApiUrl] = useState(currentApiUrl);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const testConnection = async () => {
    setTestStatus('testing');
    setStatusMessage('Pinging MediTrace backend...');
    try {
      const cleanBase = apiUrl.replace(/\/+$/, '');
      const testUrl = cleanBase.endsWith('/api') ? `${cleanBase}/health` : `${cleanBase}/api/health`;
      const res = await fetch(testUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setTestStatus('success');
      setStatusMessage(`Connected! Service: ${data.service || 'MediTrace API'} (v${data.version || '1.0'})`);
    } catch (err: any) {
      setTestStatus('failed');
      setStatusMessage(`Connection failed: ${err.message}. Ensure backend is running and reachable.`);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(apiUrl.trim());
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.82)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          maxWidth: '440px',
          width: '100%',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>⚙️ API &amp; Network Setup</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.2rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px', lineHeight: 1.5 }}>
          Configure where the mobile scanner fetches verification data. For physical phone testing, enter your computer&apos;s LAN IP address.
        </p>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
              Backend API Base URL
            </label>
            <input
              type="text"
              className="mono"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="/api or http://192.168.1.50:5000/api"
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(2, 6, 23, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                fontSize: '0.85rem',
                outline: 'none',
              }}
              required
            />
          </div>

          {/* Quick Presets */}
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '6px' }}>Quick Presets:</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setApiUrl('/api')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                /api (Proxy)
              </button>
              <button
                type="button"
                onClick={() => setApiUrl('http://localhost:5000/api')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                localhost:5000
              </button>
            </div>
          </div>

          {/* Connection Test Status */}
          {testStatus !== 'idle' && (
            <div
              style={{
                padding: '10px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                background:
                  testStatus === 'success'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : testStatus === 'failed'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(56, 189, 248, 0.15)',
                border:
                  testStatus === 'success'
                    ? '1px solid #10b981'
                    : testStatus === 'failed'
                    ? '1px solid #ef4444'
                    : '1px solid #38bdf8',
                color:
                  testStatus === 'success'
                    ? '#34d399'
                    : testStatus === 'failed'
                    ? '#f87171'
                    : '#38bdf8',
              }}
            >
              {statusMessage}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={testConnection}
              disabled={testStatus === 'testing'}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              {testStatus === 'testing' ? 'Testing...' : '📡 Test Ping'}
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                background: '#00d2b4',
                border: 'none',
                color: '#070a12',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
