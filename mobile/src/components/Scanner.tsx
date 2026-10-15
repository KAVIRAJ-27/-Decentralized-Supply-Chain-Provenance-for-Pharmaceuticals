import React, { useState } from 'react';

interface Props {
  onScan: (batchId: string) => void;
  loading: boolean;
}

export const Scanner: React.FC<Props> = ({ onScan, loading }) => {
  const [manualCode, setManualCode] = useState('');

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim().toUpperCase());
    }
  };

  return (
    <div style={{ padding: '20px 16px', maxWidth: '440px', margin: '0 auto', textAlign: 'center' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>MediTrace Mobile</h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Point camera at pharmaceutical batch QR code
        </p>
      </div>

      {/* Simulated / Camera Viewfinder */}
      <div className="viewfinder">
        <div className="corner top-left" />
        <div className="corner top-right" />
        <div className="corner bottom-left" />
        <div className="corner bottom-right" />
        <div className="scanner-laser" />

        {/* Center Guide Graphics */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.2)',
            fontSize: '0.75rem',
            padding: '20px',
          }}
        >
          {loading ? 'Decrypting QR...' : 'Align QR code inside box'}
        </div>
      </div>

      {/* Quick Demo Scan Buttons */}
      <div style={{ margin: '16px 0' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
          Simulate Camera QR Detection:
        </div>
        <button
          onClick={() => onScan('MED-20261015-A8F2K')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: 'rgba(0, 210, 180, 0.15)',
            border: '1px solid rgba(0, 210, 180, 0.4)',
            color: '#00d2b4',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          📱 Scan Batch: MED-20261015-A8F2K
        </button>
      </div>

      {/* Manual Input Alternative */}
      <form onSubmit={handleManualSubmit} style={{ marginTop: '20px' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '6px' }}>
          Or enter Batch ID manually:
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="mono"
            placeholder="MED-YYYYMMDD-XXXXX"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#f8fafc',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: '#00d2b4',
              border: 'none',
              color: '#070a12',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {loading ? '...' : 'Verify'}
          </button>
        </div>
      </form>
    </div>
  );
};
