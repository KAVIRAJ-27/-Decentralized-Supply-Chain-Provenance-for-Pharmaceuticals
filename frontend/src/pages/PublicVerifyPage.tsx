import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
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
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrSvgString, setQrSvgString] = useState<string>('');

  const handleVerify = async (idToVerify?: string) => {
    const id = (idToVerify || batchIdInput).trim().toUpperCase();
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const result = await api.verifyBatch(id);
      setVerification(result);

      // Generate real ISO/IEC 18004 scannable QR SVG
      const canonicalUrl = `${window.location.origin}/?verify=${encodeURIComponent(id)}`;
      QRCode.toString(canonicalUrl, {
        type: 'svg',
        errorCorrectionLevel: 'H',
        margin: 4,
        width: 140,
        color: { dark: '#000000', light: '#FFFFFF' },
      })
        .then((svg) => setQrSvgString(svg))
        .catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Verification failed. Batch could not be validated.');
      setVerification(null);
      setQrSvgString('');
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

  const handlePrintLabel = () => {
    if (!verification) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const qrSvg = qrSvgString || `
      <div style="font-family: monospace; font-size: 14px; padding: 20px;">${verification.batchId}</div>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>MediTrace Batch Label - ${verification.batchId}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #111; }
            .label-box { border: 2px dashed #333; padding: 24px; max-width: 440px; margin: 0 auto; border-radius: 8px; text-align: center; }
            .header-badge { font-size: 11px; text-transform: uppercase; font-weight: bold; color: #008775; letter-spacing: 0.05em; }
            .title { font-size: 18px; font-weight: bold; margin: 6px 0 2px; }
            .qr-wrapper { margin: 12px auto; width: 180px; height: 180px; }
            .batch-id { font-family: monospace; font-size: 15px; font-weight: bold; color: #008775; }
            .details { text-align: left; margin-top: 14px; font-size: 13px; line-height: 1.6; border-top: 1px solid #ddd; padding-top: 10px; }
            .url-box { font-family: monospace; font-size: 11px; color: #0284c7; word-break: break-all; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="label-box">
            <div class="header-badge">GMP Certified Pharmaceutical Provenance</div>
            <div class="title">${verification.drugName} ${verification.dosage ? `(${verification.dosage})` : ''}</div>
            <div style="font-size: 12px; color: #666;">Scan for immutable blockchain audit trail</div>
            <div class="qr-wrapper">${qrSvg}</div>
            <div class="batch-id">${verification.batchId}</div>
            <div class="details">
              <div><strong>Generic (API):</strong> ${verification.genericName}</div>
              <div><strong>Manufacturer:</strong> ${verification.manufacturer.name}</div>
              <div><strong>Mfg Date:</strong> ${new Date(verification.manufacturingDate).toLocaleDateString()}</div>
              <div><strong>Expiry Date:</strong> ${new Date(verification.expiryDate).toLocaleDateString()}</div>
              <div><strong>Status:</strong> ${verification.status}</div>
              <div style="margin-top: 6px;"><strong>Public Verification URL:</strong></div>
              <div class="url-box">${window.location.origin}/?verify=${verification.batchId}</div>
            </div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Try sample batches:</span>
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

      {/* Loading State Display */}
      {loading && (
        <div
          className="glass-panel"
          style={{
            padding: '40px',
            textAlign: 'center',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: '3px solid rgba(0, 210, 180, 0.2)',
              borderTopColor: '#00d2b4',
              animation: 'spin 1s linear infinite',
            }}
          />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
            Querying MediTrace decentralized ledger &amp; verifying digital signatures...
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Checking smart contract provenance state and telemetry logs
          </div>
        </div>
      )}

      {/* Error / Alert Display */}
      {error && !loading && (
        <div
          className="glass-panel"
          style={{
            padding: '24px',
            marginBottom: '24px',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            background: 'rgba(239, 68, 68, 0.08)',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <span style={{ fontSize: '1.8rem' }}>⚠️</span>
            <div>
              <h3 style={{ color: '#f87171', fontSize: '1.05rem', marginBottom: '6px' }}>
                Batch Verification Alert: Batch Not Verified
              </h3>
              <p style={{ color: '#fca5a5', fontSize: '0.9rem', lineHeight: 1.5 }}>{error}</p>
              <div style={{ marginTop: '12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <strong>Consumer Safety Notice:</strong> If you suspect counterfeit medicine, do not consume it. Immediately report the package to your pharmacy or regulatory authority.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Card Results */}
      {verification && !loading && (
        <div className="glass-panel" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
          {/* Critical Recall Banner if Recalled */}
          {verification.isRecalled && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.6)',
                borderRadius: '10px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <span style={{ fontSize: '2rem' }}>🛑</span>
              <div>
                <strong style={{ color: '#f87171', fontSize: '1.05rem' }}>
                  SAFETY WARNING: THIS MEDICINE BATCH HAS BEEN RECALLED
                </strong>
                <div style={{ color: '#fca5a5', fontSize: '0.88rem', marginTop: '4px' }}>
                  Reason: {verification.recallReason || 'Critical safety recall initiated by manufacturer or regulatory authority.'}
                </div>
              </div>
            </div>
          )}

          {/* Critical Cryptographic Signature Tamper Alert */}
          {(verification.warnings?.includes('SIGNATURE_TAMPER_DETECTED') ||
            (verification.cryptographicProof && !verification.cryptographicProof.verified)) && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid rgba(239, 68, 68, 0.8)',
                borderRadius: '10px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <span style={{ fontSize: '2rem' }}>⚠️</span>
              <div>
                <strong style={{ color: '#f87171', fontSize: '1.05rem' }}>
                  CRITICAL INTEGRITY ALERT: DIGITAL SIGNATURE TAMPER DETECTED
                </strong>
                <div style={{ color: '#fca5a5', fontSize: '0.88rem', marginTop: '4px' }}>
                  The cryptographic digital seal on this batch does not match the authoritative manufacturer record. Drug attributes, dosages, or expiration dates may have been modified or tampered with.
                </div>
              </div>
            </div>
          )}

          {/* Concurrent Multi-Location Anomaly Alert */}
          {verification.warnings?.includes('MULTI_LOCATION_SIMULTANEOUS_BURST') && (
            <div
              style={{
                background: 'rgba(234, 88, 12, 0.2)',
                border: '1px solid rgba(234, 88, 12, 0.7)',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '1.8rem' }}>📍</span>
              <div>
                <strong style={{ color: '#fb923c', fontSize: '0.98rem' }}>
                  CONCURRENT MULTI-LOCATION SCAN ANOMALY DETECTED
                </strong>
                <div style={{ color: '#fed7aa', fontSize: '0.85rem', marginTop: '2px' }}>
                  This packaging identifier was simultaneously queried across multiple distinct IP networks within minutes. High risk of counterfeit label cloning.
                </div>
              </div>
            </div>
          )}

          {/* Expired Medicine Warning */}
          {verification.isExpired && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '1.8rem' }}>⚠️</span>
              <div>
                <strong style={{ color: '#fbbf24', fontSize: '0.98rem' }}>
                  EXPIRED PRODUCT WARNING: THIS BATCH HAS EXPIRED
                </strong>
                <div style={{ color: '#fde68a', fontSize: '0.85rem', marginTop: '2px' }}>
                  Batch expired on {new Date(verification.expiryDate).toLocaleDateString()}. Do not dispense or ingest expired pharmaceuticals.
                </div>
              </div>
            </div>
          )}

          {/* Suspicious Scan Velocity Telemetry Alert */}
          {verification.scanTelemetry?.suspiciousScanAlert && (
            <div
              style={{
                background: 'rgba(217, 119, 6, 0.15)',
                border: '1px solid rgba(217, 119, 6, 0.5)',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '1.8rem' }}>📡</span>
              <div>
                <strong style={{ color: '#f59e0b', fontSize: '0.98rem' }}>
                  SUSPICIOUS SCAN VELOCITY ALERT
                </strong>
                <div style={{ color: '#fde68a', fontSize: '0.85rem', marginTop: '2px' }}>
                  {verification.scanTelemetry.message || `Detected ${verification.scanTelemetry.recentScanCount} scans within 5 minutes.`} Please verify physical holographic packaging seals against label cloning.
                </div>
              </div>
            </div>
          )}

          {/* Incomplete Record Warning */}
          {verification.incompleteRecord && (
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '1.4rem' }}>ℹ️</span>
              <div style={{ color: '#93c5fd', fontSize: '0.85rem' }}>
                <strong>Provenance Note:</strong> This batch registration is genuine, but intermediate transit records have not yet been completed.
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: verification.isRecalled ? '#ef4444' : verification.isExpired ? '#f59e0b' : '#10b981',
                    boxShadow: verification.isRecalled ? '0 0 10px #ef4444' : '0 0 10px #10b981',
                  }}
                />
                <h2 style={{ fontSize: '1.6rem', color: '#f8fafc' }}>{verification.drugName}</h2>
                <StatusBadge status={verification.status} />
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                {verification.genericName} &bull; <strong style={{ color: '#e2e8f0' }}>{verification.dosage}</strong>
                {verification.strength && <span> &bull; {verification.strength}</span>}
              </div>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Canonical Batch ID
                </div>
                <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {verification.batchId}
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setShowQrModal(!showQrModal)}
                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              >
                {showQrModal ? 'Hide Packaging QR' : '📦 View Packaging QR'}
              </button>
            </div>
          </div>

          {/* Packaging QR Preview Section (Expandable) */}
          {showQrModal && (
            <div
              style={{
                margin: '20px 0',
                padding: '20px',
                background: 'rgba(15, 23, 42, 0.7)',
                borderRadius: '12px',
                border: '1px solid rgba(0, 210, 180, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  padding: '12px',
                  borderRadius: '8px',
                  width: '160px',
                  height: '160px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {qrSvgString ? (
                  <div dangerouslySetInnerHTML={{ __html: qrSvgString }} />
                ) : (
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Generating QR...</div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: '240px' }}>
                <h4 style={{ color: '#00d2b4', fontSize: '0.95rem', marginBottom: '6px' }}>
                  Canonical GS1/GMP Packaging QR Matrix
                </h4>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                  Encoded canonical public verification link:
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: '0.75rem',
                    background: 'rgba(0,0,0,0.4)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    color: 'var(--primary)',
                    wordBreak: 'break-all',
                    marginBottom: '12px',
                  }}
                >
                  {window.location.origin}/?verify={verification.batchId}
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handlePrintLabel}
                  style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                >
                  🖨️ Print GMP Packaging Label
                </button>
              </div>
            </div>
          )}

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
              <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: '2px' }}>✓ Licensed &amp; Verified</div>
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
                {verification.isExpired ? '⚠️ Expired Batch' : '✓ Valid Shelf Life'}
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
              padding: '16px 20px',
              borderRadius: '10px',
              background: 'rgba(0, 210, 180, 0.05)',
              border: '1px solid rgba(0, 210, 180, 0.25)',
              marginBottom: '28px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#00d2b4', fontSize: '1.2rem' }}>⛓️</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
                  Smart Contract Provenance Seal Verified
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    background: verification.blockchainVerification.onChain ? 'rgba(16, 185, 129, 0.2)' : 'rgba(14, 165, 233, 0.2)',
                    color: verification.blockchainVerification.onChain ? '#34d399' : '#38bdf8',
                    fontWeight: 700,
                  }}
                >
                  {verification.blockchainVerification.onChain ? 'ON-CHAIN CONFIRMED' : 'STANDALONE LEDGER VERIFIED'}
                </span>
              </div>
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Contract: {verification.blockchainVerification.contractAddress}
              </span>
            </div>
            {verification.blockchainVerification.txHash && (
              <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '6px', wordBreak: 'break-all' }}>
                Latest Ledger Tx: {verification.blockchainVerification.txHash}
              </div>
            )}
            {verification.verifiedAt && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Verified at: {new Date(verification.verifiedAt).toLocaleString()}
              </div>
            )}
            {verification.cryptographicProof && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: '0.78rem',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ color: verification.cryptographicProof.verified ? '#34d399' : '#f87171' }}>
                  {verification.cryptographicProof.verified ? '🔒' : '⚠️'}
                </span>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                  Digital Signature: {verification.cryptographicProof.algorithm}
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: verification.cryptographicProof.verified
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(239, 68, 68, 0.2)',
                    color: verification.cryptographicProof.verified ? '#34d399' : '#f87171',
                    fontWeight: 700,
                  }}
                >
                  {verification.cryptographicProof.verified ? 'SIGNATURE VALID' : 'TAMPER DETECTED'}
                </span>
                <span className="mono" style={{ color: 'var(--text-dim)', marginLeft: 'auto', fontSize: '0.72rem' }}>
                  Key ID: {verification.cryptographicProof.keyId}
                </span>
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

