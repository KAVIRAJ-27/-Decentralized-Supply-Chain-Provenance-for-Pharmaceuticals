import React from 'react';
import { MedicineBatch } from '../types';

interface Props {
  batch: MedicineBatch;
  onClose: () => void;
}

export const QrModal: React.FC<Props> = ({ batch, onClose }) => {
  const verifyUrl = `${window.location.origin}/?verify=${encodeURIComponent(batch.batchId)}`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#0d1527',
          border: '1px solid rgba(0, 210, 180, 0.3)',
          padding: '28px',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>Batch Verification QR</h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '1.5rem',
              cursor: 'pointer',
            }}
          >
            &times;
          </button>
        </div>

        {/* QR Code Graphic (High Fidelity SVG QR Representation) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '20px',
            display: 'inline-block',
            margin: '12px auto',
            boxShadow: '0 8px 30px rgba(0, 210, 180, 0.25)',
          }}
        >
          <svg width="200" height="200" viewBox="0 0 200 200" fill="#000000">
            {/* Corner Markers */}
            {/* Top-left */}
            <rect x="10" y="10" width="50" height="50" fill="#070a12" rx="4" />
            <rect x="20" y="20" width="30" height="30" fill="#ffffff" rx="2" />
            <rect x="27" y="27" width="16" height="16" fill="#00d2b4" rx="2" />

            {/* Top-right */}
            <rect x="140" y="10" width="50" height="50" fill="#070a12" rx="4" />
            <rect x="150" y="20" width="30" height="30" fill="#ffffff" rx="2" />
            <rect x="157" y="27" width="16" height="16" fill="#00d2b4" rx="2" />

            {/* Bottom-left */}
            <rect x="10" y="140" width="50" height="50" fill="#070a12" rx="4" />
            <rect x="20" y="150" width="30" height="30" fill="#ffffff" rx="2" />
            <rect x="27" y="157" width="16" height="16" fill="#00d2b4" rx="2" />

            {/* Simulated Data Matrix Pixels */}
            <rect x="70" y="15" width="12" height="12" fill="#070a12" />
            <rect x="90" y="15" width="12" height="12" fill="#070a12" />
            <rect x="115" y="15" width="12" height="12" fill="#070a12" />
            <rect x="70" y="35" width="12" height="12" fill="#070a12" />
            <rect x="105" y="35" width="12" height="12" fill="#070a12" />

            <rect x="15" y="75" width="12" height="12" fill="#070a12" />
            <rect x="35" y="75" width="12" height="12" fill="#070a12" />
            <rect x="75" y="75" width="14" height="14" fill="#00b89e" />
            <rect x="95" y="75" width="12" height="12" fill="#070a12" />
            <rect x="115" y="75" width="12" height="12" fill="#070a12" />
            <rect x="145" y="75" width="12" height="12" fill="#070a12" />
            <rect x="170" y="75" width="12" height="12" fill="#070a12" />

            {/* Center Cadence Pattern */}
            <rect x="75" y="95" width="12" height="12" fill="#070a12" />
            <rect x="95" y="95" width="14" height="14" fill="#00d2b4" rx="2" />
            <rect x="115" y="95" width="12" height="12" fill="#070a12" />
            <rect x="135" y="95" width="12" height="12" fill="#070a12" />

            <rect x="75" y="115" width="12" height="12" fill="#070a12" />
            <rect x="95" y="115" width="12" height="12" fill="#070a12" />
            <rect x="115" y="115" width="12" height="12" fill="#070a12" />

            <rect x="140" y="140" width="12" height="12" fill="#070a12" />
            <rect x="160" y="140" width="12" height="12" fill="#070a12" />
            <rect x="140" y="160" width="12" height="12" fill="#070a12" />
            <rect x="175" y="160" width="12" height="12" fill="#070a12" />
            <rect x="155" y="175" width="14" height="14" fill="#00d2b4" />
          </svg>
        </div>

        <div style={{ marginTop: '12px' }}>
          <div className="mono" style={{ fontSize: '1rem', fontWeight: 700, color: '#00d2b4' }}>
            {batch.batchId}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#f8fafc', marginTop: '4px' }}>
            {batch.drugName} ({batch.dosage})
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Mfg: {batch.manufacturerName} &bull; Exp: {new Date(batch.expiryDate).toLocaleDateString()}
          </div>
        </div>

        <div
          style={{
            marginTop: '16px',
            padding: '10px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Public Verification URL (No Login Needed)
          </div>
          <div className="mono" style={{ fontSize: '0.75rem', color: '#38bdf8', wordBreak: 'break-all', marginTop: '4px' }}>
            {verifyUrl}
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => {
              navigator.clipboard?.writeText(verifyUrl);
              alert('Copied verification link to clipboard!');
            }}
          >
            Copy Verify Link
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
