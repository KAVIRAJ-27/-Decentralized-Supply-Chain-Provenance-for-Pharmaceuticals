import React from 'react';

export interface VerificationResultData {
  verified: boolean;
  batchId?: string;
  drugName?: string;
  genericName?: string;
  dosage?: string;
  strength?: string;
  packaging?: string;
  status?: string;
  manufacturer?: {
    name: string;
    address: string;
    verified: boolean;
  };
  manufacturingDate?: string;
  expiryDate?: string;
  isExpired?: boolean;
  isRecalled?: boolean;
  recallReason?: string;
  currentHandler?: {
    role: string;
    name: string;
    address: string;
  };
  provenanceHistory?: Array<{
    id: string;
    timestamp: string;
    action: string;
    status: string;
    actorRole: string;
    actorName: string;
    location: string;
    temperatureCelsius?: number;
    notes?: string;
    blockchainTxHash?: string;
  }>;
  blockchainVerification?: {
    onChain: boolean;
    contractAddress: string;
    txHash?: string;
    blockNumber?: number;
    integrityCheck: string;
    onChainStatus?: string;
  };
  scanTelemetry?: {
    suspiciousScanAlert: boolean;
    recentScanCount: number;
    totalScanCount: number;
    message?: string;
  };
  warnings?: string[];
  incompleteRecord?: boolean;
  verifiedAt?: string;
  // Non-200 / Error states
  isNotFound?: boolean;
  isConnectionError?: boolean;
  errorMessage?: string;
}

interface Props {
  data: VerificationResultData;
  onReset: () => void;
  onBackToHome: () => void;
}

export const MedicineCard: React.FC<Props> = ({ data, onReset, onBackToHome }) => {
  // STATE 1: Record Not Found (Counterfeit / Unregistered Warning)
  if (data.isNotFound) {
    return (
      <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.3) 100%)',
            border: '2px solid #ef4444',
            borderRadius: '16px',
            padding: '24px 20px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(239, 68, 68, 0.25)',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>❌</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f87171', letterSpacing: '-0.02em' }}>
            UNREGISTERED PHARMACEUTICAL
          </h2>
          <div className="mono" style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fca5a5', margin: '8px 0' }}>
            {data.batchId}
          </div>
          <p style={{ fontSize: '0.82rem', color: '#fecaca', lineHeight: 1.5, marginBottom: '16px' }}>
            {data.errorMessage ||
              'This batch identifier is NOT registered in the official MediTrace national pharmaceutical registry. The product may be counterfeit, unapproved, or tampered.'}
          </p>

          <div
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '10px',
              padding: '12px',
              fontSize: '0.75rem',
              color: '#f87171',
              textAlign: 'left',
              lineHeight: 1.4,
            }}
          >
            <strong>⚠️ Required Action:</strong>
            <ul style={{ paddingLeft: '18px', marginTop: '6px' }}>
              <li>Do NOT dispense or consume this product.</li>
              <li>Quarantine the package immediately.</li>
              <li>Report the serial and vendor to regulatory health authorities.</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              onClick={onReset}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                background: '#00d2b4',
                border: 'none',
                color: '#070a12',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              📷 Scan Another QR
            </button>
            <button
              onClick={onBackToHome}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STATE 2: Connection / Verification Unavailable Error
  if (data.isConnectionError) {
    return (
      <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto' }}>
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '24px 20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📡</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
            Verification Service Unavailable
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '10px 0 16px', lineHeight: 1.5 }}>
            {data.errorMessage ||
              'Unable to reach the MediTrace verification network. Check your device Wi-Fi, ensure the backend API is active, or configure your host IP.'}
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onReset}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                background: '#00d2b4',
                border: 'none',
                color: '#070a12',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              🔄 Try Again
            </button>
            <button
              onClick={onBackToHome}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STATE 3: Record Found (Authentic or with Safety Warnings)
  const isRecalled = data.isRecalled;
  const isExpired = data.isExpired;
  const isSuspiciousVelocity = data.scanTelemetry?.suspiciousScanAlert;
  const hasIncompleteHistory = data.incompleteRecord;

  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto' }}>
      {/* Safety Alert Header: Recall Notice */}
      {isRecalled && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.35) 100%)',
            border: '2px solid #ef4444',
            borderRadius: '14px',
            padding: '16px',
            marginBottom: '16px',
            textAlign: 'center',
            boxShadow: '0 6px 20px rgba(239, 68, 68, 0.3)',
          }}
        >
          <div style={{ fontSize: '2.2rem' }}>🛑</div>
          <div style={{ fontWeight: 800, color: '#f87171', fontSize: '1.05rem', marginTop: '4px' }}>
            CRITICAL REGULATORY RECALL
          </div>
          <div style={{ fontSize: '0.82rem', color: '#fca5a5', marginTop: '4px', fontWeight: 600 }}>
            {data.recallReason || 'Emergency Recall: Do not dispense or consume this batch.'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#fecaca', marginTop: '6px' }}>
            Quarantine batch immediately and contact the manufacturer.
          </div>
        </div>
      )}

      {/* Safety Alert Header: Expired Notice */}
      {isExpired && !isRecalled && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(180, 83, 9, 0.35) 100%)',
            border: '2px solid #f59e0b',
            borderRadius: '14px',
            padding: '16px',
            marginBottom: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '1rem', marginTop: '2px' }}>
            EXPIRED PHARMACEUTICAL BATCH
          </div>
          <div style={{ fontSize: '0.82rem', color: '#fde68a', marginTop: '4px' }}>
            This batch expired on {data.expiryDate ? new Date(data.expiryDate).toLocaleDateString() : 'past date'}. Dispensation and consumption are strictly prohibited.
          </div>
        </div>
      )}

      {/* Verified Authentic Banner */}
      {!isRecalled && !isExpired && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '14px',
            padding: '14px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#070a12',
              fontWeight: 900,
              fontSize: '1.2rem',
              flexShrink: 0,
            }}
          >
            ✓
          </div>
          <div>
            <div style={{ fontWeight: 800, color: '#34d399', fontSize: '1rem' }}>
              Authentic Record Verified
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
              Cryptographically registered on MediTrace decentralized ledger
            </div>
          </div>
        </div>
      )}

      {/* High Velocity Warning Banner */}
      {isSuspiciousVelocity && (
        <div
          style={{
            background: 'rgba(217, 119, 6, 0.18)',
            border: '1px solid rgba(217, 119, 6, 0.5)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '16px',
            color: '#fde68a',
            fontSize: '0.8rem',
            textAlign: 'left',
          }}
        >
          <strong>⚠️ Suspicious High Scan Velocity ({data.scanTelemetry?.recentScanCount} scans in 5 mins):</strong>
          <br />
          This QR code has been scanned repeatedly in a short period. Check physical holographic packaging seals to ensure this is not a duplicated or cloned label.
        </div>
      )}

      {/* Incomplete Record Warning */}
      {hasIncompleteHistory && (
        <div
          style={{
            background: 'rgba(147, 51, 234, 0.15)',
            border: '1px solid rgba(147, 51, 234, 0.4)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '16px',
            color: '#d8b4fe',
            fontSize: '0.8rem',
            textAlign: 'left',
          }}
        >
          <strong>ℹ️ Incomplete Provenance Record:</strong> Supply chain custody milestones are partially recorded. Proceed with caution.
        </div>
      )}

      {/* Main Medicine Card */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '18px',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="mono" style={{ fontSize: '0.85rem', color: '#00d2b4', fontWeight: 800 }}>
              {data.batchId}
            </div>
            <h2 style={{ fontSize: '1.4rem', color: '#f8fafc', marginTop: '4px', fontWeight: 800 }}>
              {data.drugName}
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>
              {data.genericName} &bull; <strong style={{ color: '#f8fafc' }}>{data.dosage}</strong>
            </div>
          </div>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '9999px',
              background: isRecalled
                ? 'rgba(239, 68, 68, 0.2)'
                : isExpired
                ? 'rgba(245, 158, 11, 0.2)'
                : 'rgba(16, 185, 129, 0.2)',
              color: isRecalled ? '#f87171' : isExpired ? '#fbbf24' : '#34d399',
            }}
          >
            {data.status || 'ACTIVE'}
          </span>
        </div>

        {/* Permitted Details Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            margin: '18px 0',
            padding: '14px 0',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Manufacturer</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '2px' }}>
              {data.manufacturer?.name || 'Licensed Manufacturer'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#34d399' }}>✓ Verified Origin</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Current Custody</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '2px' }}>
              {data.currentHandler?.name || 'Supply Chain Custodian'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
              {data.currentHandler?.role || 'DISTRIBUTOR'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Mfg Date</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '2px' }}>
              {data.manufacturingDate ? new Date(data.manufacturingDate).toLocaleDateString() : 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Expiry Date</div>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                marginTop: '2px',
                color: isExpired ? '#f87171' : '#f8fafc',
              }}
            >
              {data.expiryDate ? new Date(data.expiryDate).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        </div>

        {/* Blockchain Verification Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(2, 132, 199, 0.1)',
            border: '1px solid rgba(2, 132, 199, 0.25)',
            borderRadius: '10px',
            padding: '10px 12px',
            marginBottom: '16px',
            fontSize: '0.78rem',
          }}
        >
          <div>
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>⛓️ Smart Contract State:</span>
            <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '2px' }}>
              {data.blockchainVerification?.onChain ? 'Confirmed on Ethereum Localnet' : 'Decentralized Standalone Verified'}
            </div>
          </div>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              background: data.blockchainVerification?.onChain ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
              color: data.blockchainVerification?.onChain ? '#34d399' : '#38bdf8',
              fontWeight: 700,
              fontSize: '0.7rem',
            }}
          >
            {data.blockchainVerification?.onChain ? 'ON-CHAIN' : 'VERIFIED'}
          </span>
        </div>

        {/* Provenance Steps Summary */}
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Provenance Trail ({data.provenanceHistory?.length || 0} Milestones)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.provenanceHistory?.map((evt, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: '#f8fafc' }}>{evt.action.replace(/_/g, ' ')}</span>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    {evt.actorName} &bull; {evt.location}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    {new Date(evt.timestamp).toLocaleDateString()}
                  </div>
                  {evt.temperatureCelsius !== undefined && (
                    <div style={{ color: '#38bdf8', fontSize: '0.7rem', fontWeight: 700 }}>
                      ❄️ {evt.temperatureCelsius}°C
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Advisory Disclaimer */}
        <div
          style={{
            marginTop: '16px',
            padding: '10px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            fontSize: '0.7rem',
            color: '#64748b',
            lineHeight: 1.4,
            textAlign: 'center',
          }}
        >
          * Notice: Verification confirms ledger records and custody handoffs. Always inspect packaging seals. If seals appear tampered, consult a licensed healthcare professional.
        </div>

        {/* Navigation Actions */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button
            onClick={onReset}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #00d2b4 0%, #0284c7 100%)',
              border: 'none',
              color: '#070a12',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            📷 Scan Another QR
          </button>
          <button
            onClick={onBackToHome}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
};
