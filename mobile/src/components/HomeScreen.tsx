import React, { useState } from 'react';

export interface ScanHistoryItem {
  batchId: string;
  drugName?: string;
  status: string;
  isRecalled?: boolean;
  isExpired?: boolean;
  verified: boolean;
  timestamp: string;
}

interface Props {
  onStartScan: () => void;
  onManualVerify: (batchId: string) => void;
  onSelectHistoryItem: (item: ScanHistoryItem) => void;
  scanHistory: ScanHistoryItem[];
  onClearHistory: () => void;
  onOpenSettings: () => void;
}

export const HomeScreen: React.FC<Props> = ({
  onStartScan,
  onManualVerify,
  onSelectHistoryItem,
  scanHistory,
  onClearHistory,
  onOpenSettings,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const BATCH_ID_REGEX = /^MED-\d{8}-[A-Z0-9]{4,8}$/;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    const cleaned = manualCode.trim().toUpperCase();

    if (!cleaned) {
      setManualError('Please enter a Batch ID');
      return;
    }

    if (!BATCH_ID_REGEX.test(cleaned)) {
      setManualError('Invalid format. Standard format is MED-YYYYMMDD-XXXXX (e.g. MED-20261015-A8F2K)');
      return;
    }

    onManualVerify(cleaned);
  };

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px' }}>
      {/* Top Banner / Hero */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(0, 210, 180, 0.12) 0%, rgba(2, 132, 199, 0.15) 100%)',
          border: '1px solid rgba(0, 210, 180, 0.3)',
          borderRadius: '20px',
          padding: '24px 20px',
          textAlign: 'center',
          marginBottom: '20px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #00d2b4 0%, #0284c7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            margin: '0 auto 12px',
            boxShadow: '0 0 20px rgba(0, 210, 180, 0.4)',
          }}
        >
          🛡️
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
          Medi<span style={{ color: '#00d2b4' }}>Trace</span> Verify
        </h1>
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '6px', lineHeight: 1.4 }}>
          Public Decentralized Provenance for Pharmaceuticals
        </p>

        {/* Primary Action Button */}
        <button
          onClick={onStartScan}
          style={{
            marginTop: '20px',
            width: '100%',
            padding: '14px 20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #00d2b4 0%, #0284c7 100%)',
            border: 'none',
            color: '#070a12',
            fontWeight: 800,
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 4px 15px rgba(0, 210, 180, 0.35)',
            transition: 'transform 0.15s ease',
          }}
        >
          <span style={{ fontSize: '1.3rem' }}>📷</span> Scan Medicine QR
        </button>
      </div>

      {/* Manual Batch Lookup Card */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '18px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>⌨️ Manual Batch Lookup</h2>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            MED-YYYYMMDD-XXXXX
          </span>
        </div>

        <form onSubmit={handleManualSubmit}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="mono"
              placeholder="e.g. MED-20261015-A8F2K"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(2, 6, 23, 0.8)',
                border: manualError ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                color: '#f8fafc',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                background: 'rgba(0, 210, 180, 0.15)',
                border: '1px solid rgba(0, 210, 180, 0.4)',
                color: '#00d2b4',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              Verify
            </button>
          </div>

          {manualError && (
            <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '6px' }}>{manualError}</div>
          )}
        </form>
      </div>

      {/* Patient Safety & Regulatory Disclaimer */}
      <div
        style={{
          background: 'rgba(2, 132, 199, 0.08)',
          border: '1px solid rgba(2, 132, 199, 0.25)',
          borderRadius: '12px',
          padding: '14px',
          marginBottom: '20px',
          fontSize: '0.78rem',
          color: '#94a3b8',
          lineHeight: 1.5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: 700, marginBottom: '4px' }}>
          <span>ℹ️</span> Regulatory Patient Notice
        </div>
        Scanning confirms digitally recorded blockchain provenance, cold-chain custody, and regulatory recall alerts. It does not inspect chemical or physical package contents. Inspect tamper-evident holographic packaging seals before consuming.
      </div>

      {/* Recent Scan History */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '18px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
            🕒 Recent Scan History ({scanHistory.length})
          </h2>
          {scanHistory.length > 0 && (
            <button
              onClick={onClearHistory}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '0.72rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Clear
            </button>
          )}
        </div>

        {scanHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '0.8rem' }}>
            No recent scans on this device yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {scanHistory.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onSelectHistoryItem(item)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#00d2b4' }}>
                    {item.batchId}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#f8fafc', marginTop: '2px' }}>
                    {item.drugName || 'Verified Pharmaceutical'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      background: item.isRecalled
                        ? 'rgba(239, 68, 68, 0.2)'
                        : item.isExpired
                        ? 'rgba(245, 158, 11, 0.2)'
                        : !item.verified
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(16, 185, 129, 0.2)',
                      color: item.isRecalled
                        ? '#f87171'
                        : item.isExpired
                        ? '#fbbf24'
                        : !item.verified
                        ? '#f87171'
                        : '#34d399',
                    }}
                  >
                    {item.isRecalled
                      ? 'RECALLED'
                      : item.isExpired
                      ? 'EXPIRED'
                      : !item.verified
                      ? 'COUNTERFEIT'
                      : 'VERIFIED'}
                  </span>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '4px' }}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Test Scenarios */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '20px',
        }}
      >
        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, marginBottom: '10px' }}>
          🧪 Test &amp; Demonstration Scenarios:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            onClick={() => onManualVerify('MED-20261015-A8F2K')}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            ✓ Authentic Batch
          </button>
          <button
            onClick={() => onManualVerify('MED-20261015-EXP01')}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            ⚠️ Expired Batch
          </button>
          <button
            onClick={() => onManualVerify('MED-20261015-REC02')}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            🛑 Recalled Batch
          </button>
          <button
            onClick={() => onManualVerify('MED-20261015-FAKE9')}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            ❌ Unknown / Fake
          </button>
        </div>
      </div>

      {/* Network Setup Link */}
      <div style={{ textAlign: 'center', marginTop: '12px' }}>
        <button
          onClick={onOpenSettings}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            fontSize: '0.75rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ⚙️ Network &amp; Host Configuration
        </button>
      </div>
    </div>
  );
};
