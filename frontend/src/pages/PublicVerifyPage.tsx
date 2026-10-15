import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { PublicVerificationResponse } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';

interface Props {
  initialBatchId?: string;
}

export const PublicVerifyPage: React.FC<Props> = ({ initialBatchId }) => {
  const [batchIdInput, setBatchIdInput] = useState(initialBatchId || 'MED-20261015-A8F2K');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<PublicVerificationResponse | null>(null);

  const handleVerify = async (idToVerify?: string) => {
    const id = (idToVerify || batchIdInput).trim();
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const result = await api.verifyBatch(id);
      setVerification(result);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Batch could not be validated.');
      setVerification(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialBatchId) {
      setBatchIdInput(initialBatchId);
      handleVerify(initialBatchId);
    } else {
      // Auto-load sample batch for immediate demonstration
      handleVerify('MED-20261015-A8F2K');
    }
  }, [initialBatchId]);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 16px' }}>
      {/* Hero Search Section */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: 'rgba(0, 210, 180, 0.1)',
            border: '1px solid rgba(0, 210, 180, 0.25)',
            color: 'var(--primary)',
            fontSize: '0.8rem',
            fontWeight: 700,
            marginBottom: '16px',
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00d2b4' }} />
          Zero-Trust Public Pharmaceutical Verification Network
        </div>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '12px', lineHeight: 1.2 }}>
          Verify Medicine Authenticity <br />
          <span className="gradient-text">Directly On The Blockchain</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '640px', margin: '0 auto' }}>
          Instantly audit drug provenance, tamper-evident custody transfers, cold-chain temperature compliance, and real-time recall notices with no account needed.
        </p>

        {/* Search Bar */}
        <div
          style={{
            marginTop: '28px',
            display: 'flex',
            gap: '10px',
            maxWidth: '620px',
            margin: '28px auto 0',
          }}
        >
          <input
            type="text"
            className="input-field mono"
            placeholder="Enter Batch ID (e.g., MED-20261015-A8F2K)"
            value={batchIdInput}
            onChange={(e) => setBatchIdInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            style={{ fontSize: '1rem', letterSpacing: '0.05em' }}
          />
          <button
            className="btn btn-primary"
            onClick={() => handleVerify()}
            disabled={loading}
            style={{ minWidth: '140px' }}
          >
            {loading ? 'Verifying...' : 'Verify Now'}
          </button>
        </div>

        {/* Demo Quick Select Buttons */}
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Try sample batch:</span>
          <button
            onClick={() => {
              setBatchIdInput('MED-20261015-A8F2K');
              handleVerify('MED-20261015-A8F2K');
            }}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.72rem' }}
          >
            MED-20261015-A8F2K
          </button>
        </div>
      </div>

      {/* Error / Alert Display */}
      {error && (
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            marginBottom: '24px',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            background: 'rgba(239, 68, 68, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ fontSize: '1.6rem' }}>⚠️</span>
            <div>
              <h3 style={{ color: '#f87171', fontSize: '1rem', marginBottom: '4px' }}>
                Batch Verification Alert
              </h3>
              <p style={{ color: '#fca5a5', fontSize: '0.88rem' }}>{error}</p>
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Warning: If you suspect counterfeit medicine, do not consume it. Immediately report the package to your pharmacy or regulatory authority.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Card Results */}
      {verification && (
        <div className="glass-panel" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
          {/* Recall Banner if Recalled */}
          {verification.isRecalled && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '1.8rem' }}>🛑</span>
              <div>
                <strong style={{ color: '#f87171', fontSize: '1rem' }}>
                  SAFETY WARNING: THIS MEDICINE BATCH HAS BEEN RECALLED
                </strong>
                <div style={{ color: '#fca5a5', fontSize: '0.85rem', marginTop: '2px' }}>
                  Reason: {verification.recallReason || 'Critical safety recall initiated by manufacturer/regulator'}
                </div>
              </div>
            </div>
          )}

          {/* Verification Status Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '16px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '20px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: verification.isRecalled ? '#ef4444' : '#10b981',
                    boxShadow: verification.isRecalled ? '0 0 10px #ef4444' : '0 0 10px #10b981',
                  }}
                />
                <h2 style={{ fontSize: '1.6rem', color: '#f8fafc' }}>{verification.drugName}</h2>
                <StatusBadge status={verification.status} />
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                {verification.genericName} &bull; <strong style={{ color: '#e2e8f0' }}>{verification.dosage}</strong>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Unified Batch ID
              </div>
              <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
                {verification.batchId}
              </div>
            </div>
          </div>

          {/* Key Facts Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              margin: '24px 0',
            }}
          >
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Manufacturer</div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', marginTop: '4px' }}>{verification.manufacturer.name}</div>
              <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: '2px' }}>✓ Licensed & Verified</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Manufacturing Date</div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', marginTop: '4px' }}>
                {new Date(verification.manufacturingDate).toLocaleDateString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Original Factory Release</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Expiry Date</div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  marginTop: '4px',
                  color: verification.isExpired ? '#f87171' : '#f8fafc',
                }}
              >
                {new Date(verification.expiryDate).toLocaleDateString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: verification.isExpired ? '#f87171' : '#34d399', marginTop: '2px' }}>
                {verification.isExpired ? '⚠️ Expired Batch' : '✓ Good Shelf Life'}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Current Custody</div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', marginTop: '4px' }}>{verification.currentHandler.name}</div>
              <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '2px' }}>Role: {verification.currentHandler.role}</div>
            </div>
          </div>

          {/* Blockchain Cryptographic Proof Badge */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '10px',
              background: 'rgba(0, 210, 180, 0.05)',
              border: '1px solid rgba(0, 210, 180, 0.2)',
              marginBottom: '28px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#00d2b4', fontSize: '1.2rem' }}>⛓️</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                  Smart Contract Provenance Seal Verified
                </span>
              </div>
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Contract: {verification.blockchainVerification.contractAddress}
              </span>
            </div>
            {verification.blockchainVerification.txHash && (
              <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--primary)', marginTop: '4px', wordBreak: 'break-all' }}>
                Latest Ledger Tx: {verification.blockchainVerification.txHash}
              </div>
            )}
          </div>

          {/* Custody Timeline */}
          <div>
            <h3 style={{ fontSize: '1.15rem', color: '#f8fafc', marginBottom: '8px' }}>
              Full Custody &amp; Environmental Journey
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '16px' }}>
              Immutable audit trail stamped by certified supply chain actors with temperature recordings.
            </p>
            <Timeline events={verification.provenanceHistory} />
          </div>
        </div>
      )}
    </div>
  );
};
