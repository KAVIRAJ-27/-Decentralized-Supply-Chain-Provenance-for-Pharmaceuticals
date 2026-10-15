import React, { useState, useEffect } from 'react';
import { Scanner } from './components/Scanner';
import { MedicineCard } from './components/MedicineCard';

export const App: React.FC = () => {
  const [scannedData, setScannedData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check URL params for scanned batch
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const batch = params.get('batch') || params.get('verify');
    if (batch) {
      handleScan(batch);
    }
  }, []);

  const handleScan = async (batchId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(batchId)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Batch ${batchId} not recognized`);
      }
      const json = await res.json();
      setScannedData(json);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setScannedData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Mobile Bar */}
      <nav
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(7, 10, 18, 0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: '#00d2b4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.8rem',
              color: '#070a12',
            }}
          >
            M
          </div>
          <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em' }}>
            Medi<span style={{ color: '#00d2b4' }}>Trace</span> Mobile
          </span>
        </div>
        <span
          style={{
            fontSize: '0.68rem',
            padding: '2px 8px',
            borderRadius: '9999px',
            background: 'rgba(0, 210, 180, 0.15)',
            color: '#00d2b4',
            fontWeight: 700,
          }}
        >
          PUBLIC VERIFY
        </span>
      </nav>

      {/* Main Content Area */}
      <main style={{ flex: 1, paddingBottom: '24px' }}>
        {error && (
          <div
            style={{
              margin: '16px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '0.85rem',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        {scannedData ? (
          <MedicineCard data={scannedData} onReset={() => setScannedData(null)} />
        ) : (
          <Scanner onScan={handleScan} loading={loading} />
        )}
      </main>
    </div>
  );
};
