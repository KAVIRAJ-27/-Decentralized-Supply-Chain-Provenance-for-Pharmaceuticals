import React from 'react';

interface Props {
  data: any;
  onReset: () => void;
}

export const MedicineCard: React.FC<Props> = ({ data, onReset }) => {
  const isRecalled = data.isRecalled;
  const isExpired = data.isExpired;

  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto' }}>
      {/* Safety Alert Header */}
      {isRecalled ? (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem' }}>🛑</div>
          <div style={{ fontWeight: 800, color: '#f87171', fontSize: '1rem', marginTop: '4px' }}>
            CRITICAL RECALL NOTICE
          </div>
          <div style={{ fontSize: '0.8rem', color: '#fca5a5', marginTop: '4px' }}>
            {data.recallReason || 'Do not dispense or consume this batch.'}
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '12px',
            padding: '14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#070a12',
              fontWeight: 800,
            }}
          >
            ✓
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.95rem' }}>
              Authentic Medicine Verified
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Cryptographically verified on Ethereum smart contract
            </div>
          </div>
        </div>
      )}

      {/* Main Medicine Card */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '20px',
        }}
      >
        <div className="mono" style={{ fontSize: '0.8rem', color: '#00d2b4', fontWeight: 700 }}>
          {data.batchId}
        </div>
        <h2 style={{ fontSize: '1.4rem', color: '#f8fafc', marginTop: '4px' }}>{data.drugName}</h2>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>
          {data.genericName} &bull; <strong style={{ color: '#f8fafc' }}>{data.dosage}</strong>
        </div>

        {/* Permitted Details Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            margin: '18px 0',
            padding: '12px 0',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Manufacturer</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '2px' }}>{data.manufacturer?.name}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Current Custody</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '2px' }}>{data.currentHandler?.name}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Mfg Date</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '2px' }}>
              {new Date(data.manufacturingDate).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Expiry Date</div>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                marginTop: '2px',
                color: isExpired ? '#f87171' : '#f8fafc',
              }}
            >
              {new Date(data.expiryDate).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Provenance Steps Summary */}
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Provenance Trail ({data.provenanceHistory?.length || 0} Events)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.provenanceHistory?.map((evt: any, i: number) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>{evt.action.replace(/_/g, ' ')}</span>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{evt.actorName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    {new Date(evt.timestamp).toLocaleDateString()}
                  </div>
                  {evt.temperatureCelsius !== undefined && (
                    <div style={{ color: '#34d399', fontSize: '0.7rem', fontWeight: 600 }}>
                      {evt.temperatureCelsius}°C
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onReset}
          style={{
            marginTop: '20px',
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #00d2b4 0%, #0284c7 100%)',
            border: 'none',
            color: '#070a12',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          📷 Scan Another Medicine QR
        </button>
      </div>
    </div>
  );
};
