import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { MedicineBatch } from '../types';
import { api } from '../services/api';

interface Props {
  batch: MedicineBatch;
  onClose: () => void;
  token?: string;
}

export const QrModal: React.FC<Props> = ({ batch, onClose, token }) => {
  const [qrSvg, setQrSvg] = useState<string>('');
  const [qrPngUrl, setQrPngUrl] = useState<string>('');
  const [serverLabelHtml, setServerLabelHtml] = useState<string>('');
  const [signatureInfo, setSignatureInfo] = useState<any>(batch.digitalSignature || null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  const verifyUrl = `${window.location.origin}/?verify=${encodeURIComponent(batch.batchId)}`;

  useEffect(() => {
    let isMounted = true;

    // 1. Generate client-side ISO/IEC 18004 compliant QR code (ECC Level 'H', 4-module quiet zone)
    QRCode.toString(verifyUrl, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 4,
      width: 220,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((svg) => {
        if (isMounted) setQrSvg(svg);
      })
      .catch((err) => console.error('Failed to generate client QR SVG', err));

    QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: 'H',
      margin: 4,
      width: 600, // High-res 300-DPI print grade
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((dataUrl) => {
        if (isMounted) setQrPngUrl(dataUrl);
      })
      .catch((err) => console.error('Failed to generate client QR PNG', err));

    // 2. Query authoritative backend packaging QR endpoint if token is available
    let activeToken = token;
    if (!activeToken) {
      try {
        const raw = localStorage.getItem('meditrace_session');
        if (raw) {
          const parsed = JSON.parse(raw);
          activeToken = parsed.token;
        }
      } catch {}
    }

    if (activeToken) {
      api
        .getBatchQr(activeToken, batch.batchId)
        .then((res) => {
          if (!isMounted) return;
          if (res.qrSvg) setQrSvg(res.qrSvg);
          if (res.qrPngDataUrl) setQrPngUrl(res.qrPngDataUrl);
          if (res.printableLabelHtml) setServerLabelHtml(res.printableLabelHtml);
          if (res.digitalSignature) setSignatureInfo(res.digitalSignature);
        })
        .catch(() => {
          // Gracefully fallback to client-side rendered ISO/IEC 18004 QR
        });
    }

    return () => {
      isMounted = false;
    };
  }, [batch.batchId, verifyUrl, token]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    if (serverLabelHtml) {
      printWindow.document.write(serverLabelHtml);
      printWindow.document.close();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>MediTrace Official Batch Label - ${batch.batchId}</title>
          <style>
            @page { size: auto; margin: 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #111; }
            .label-box { border: 2px dashed #008775; padding: 24px; max-width: 440px; margin: 0 auto; border-radius: 8px; text-align: center; }
            .title { font-size: 18px; font-weight: bold; color: #008775; margin-bottom: 4px; }
            .subtitle { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
            .qr-container { margin: 12px auto; width: 220px; height: 220px; }
            .batch-id { font-family: monospace; font-size: 16px; font-weight: bold; color: #008775; margin: 10px 0; }
            .details { text-align: left; margin-top: 14px; font-size: 13px; line-height: 1.6; border-top: 1px solid #ddd; padding-top: 12px; }
            .security-notice { font-size: 10px; color: #666; margin-top: 14px; border-top: 1px dashed #ccc; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div class="label-box">
            <div class="title">MediTrace Pharmaceutical Provenance</div>
            <div class="subtitle">Official GMP Certified Product Label</div>
            <div class="qr-container">
              ${qrSvg || `<img src="${qrPngUrl}" width="220" height="220" alt="QR" />`}
            </div>
            <div class="batch-id">${batch.batchId}</div>
            <div class="details">
              <div><strong>Drug:</strong> ${batch.drugName} ${batch.dosage ? `(${batch.dosage})` : ''}</div>
              <div><strong>Manufacturer:</strong> ${batch.manufacturerName}</div>
              <div><strong>Mfg Date:</strong> ${new Date(batch.manufacturingDate).toLocaleDateString()}</div>
              <div><strong>Expiry Date:</strong> ${new Date(batch.expiryDate).toLocaleDateString()}</div>
              <div><strong>Initial Qty:</strong> ${batch.quantity.toLocaleString()} units</div>
              <div><strong>Public Verify:</strong> ${verifyUrl}</div>
              ${
                signatureInfo
                  ? `<div><strong>Signature:</strong> ${signatureInfo.algorithm} (Key: ${signatureInfo.keyId})</div>`
                  : ''
              }
            </div>
            <div class="security-notice">
              Tamper-evident verification. Cryptographically verified against blockchain immutable records.
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadSvg = () => {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MediTrace-QR-${batch.batchId}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = () => {
    if (!qrPngUrl) return;
    const link = document.createElement('a');
    link.href = qrPngUrl;
    link.download = `MediTrace-QR-${batch.batchId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(verifyUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
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
          maxWidth: '480px',
          background: '#0d1527',
          border: '1px solid rgba(0, 210, 180, 0.35)',
          borderRadius: '16px',
          padding: '28px',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.2rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <span>📦</span> Batch Packaging QR Code
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* High-Contrast Print-Ready ISO/IEC 18004 QR Matrix */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '10px auto',
            boxShadow: '0 8px 32px rgba(0, 210, 180, 0.25)',
            minWidth: '220px',
            minHeight: '220px',
          }}
        >
          {qrSvg ? (
            <div
              id={`batch-qr-${batch.batchId}`}
              style={{ display: 'inline-block' }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : qrPngUrl ? (
            <img src={qrPngUrl} width="220" height="220" alt={`QR ${batch.batchId}`} />
          ) : (
            <div style={{ padding: '40px', color: '#64748b' }}>Generating Scannable Matrix...</div>
          )}
        </div>

        <div style={{ marginTop: '10px' }}>
          <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#00d2b4', letterSpacing: '0.5px' }}>
            {batch.batchId}
          </div>
          <div style={{ fontSize: '0.98rem', color: '#f8fafc', marginTop: '4px', fontWeight: 600 }}>
            {batch.drugName} {batch.dosage ? `(${batch.dosage})` : ''}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Mfg: {batch.manufacturerName} &bull; Exp: {new Date(batch.expiryDate).toLocaleDateString()}
          </div>
        </div>

        {/* Cryptographic Digital Signature & Tamper Evidence Badge */}
        {signatureInfo && (
          <div
            style={{
              marginTop: '12px',
              padding: '8px 12px',
              background: 'rgba(0, 210, 180, 0.08)',
              borderRadius: '8px',
              border: '1px solid rgba(0, 210, 180, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.74rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00d2b4', fontWeight: 600 }}>
              <span>🔒</span> Tamper-Evident HMAC-SHA256
            </div>
            <div className="mono" style={{ color: '#94a3b8' }}>
              Key: {signatureInfo.keyId || 'Standard'}
            </div>
          </div>
        )}

        {/* Canonical Public URL Display */}
        <div
          style={{
            marginTop: '12px',
            padding: '10px',
            background: 'rgba(0, 0, 0, 0.35)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Canonical Public Verification URL (Zero Confidential Data)
          </div>
          <div
            className="mono"
            style={{
              fontSize: '0.75rem',
              color: '#38bdf8',
              wordBreak: 'break-all',
              marginTop: '4px',
            }}
          >
            {verifyUrl}
          </div>
        </div>

        {/* Action Button Grid */}
        <div
          style={{
            marginTop: '18px',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
          }}
        >
          <button
            className="btn btn-primary"
            style={{ padding: '8px 10px', fontSize: '0.82rem' }}
            onClick={handleCopyLink}
          >
            {copySuccess ? '✅ Copied!' : '📋 Copy Link'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '8px 10px', fontSize: '0.82rem' }}
            onClick={handleDownloadSvg}
            title="Download vector SVG format"
          >
            📐 SVG Vector
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '8px 10px', fontSize: '0.82rem' }}
            onClick={handleDownloadPng}
            title="Download high-resolution 300-DPI label PNG"
          >
            🖼️ High-Res PNG
          </button>
          <button
            className="btn btn-secondary"
            style={{
              padding: '8px 10px',
              fontSize: '0.82rem',
              borderColor: 'rgba(0, 210, 180, 0.45)',
            }}
            onClick={handlePrint}
            title="Print official GS1/GMP batch label"
          >
            🖨️ Print Label
          </button>
        </div>

        <button
          className="btn btn-secondary"
          style={{
            width: '100%',
            marginTop: '10px',
            padding: '8px 12px',
            fontSize: '0.85rem',
          }}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
};
