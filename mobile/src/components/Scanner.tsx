import React, { useState, useEffect, useRef } from 'react';

interface Props {
  onScan: (batchId: string) => void;
  onCancel: () => void;
  loading: boolean;
}

export const BATCH_ID_REGEX = /^MED-\d{8}-[A-Z0-9]{4,8}$/;

/**
 * Safely extracts and validates a batch ID from scanned QR content.
 * Prevents scanner from blindly following arbitrary or malicious URLs.
 */
export function parseScannedContent(scannedText: string): { valid: boolean; batchId?: string; error?: string } {
  if (!scannedText || typeof scannedText !== 'string') {
    return { valid: false, error: 'Empty or invalid QR content' };
  }

  const trimmed = scannedText.trim();

  // 1. Direct Batch Identifier
  if (BATCH_ID_REGEX.test(trimmed.toUpperCase())) {
    return { valid: true, batchId: trimmed.toUpperCase() };
  }

  // 2. Safe URL Parsing (?verify= or /verify/)
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://dummy.org/${trimmed.replace(/^\/+/, '')}`);
    const verifyParam = url.searchParams.get('verify') || url.searchParams.get('batch');
    if (verifyParam && BATCH_ID_REGEX.test(verifyParam.trim().toUpperCase())) {
      return { valid: true, batchId: verifyParam.trim().toUpperCase() };
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    for (const part of pathParts) {
      if (BATCH_ID_REGEX.test(part.trim().toUpperCase())) {
        return { valid: true, batchId: part.trim().toUpperCase() };
      }
    }
  } catch {
    // Malformed URL
  }

  return {
    valid: false,
    error: 'Rejected QR code: Does not contain a genuine MediTrace batch identifier (Expected: MED-YYYYMMDD-XXXXX)',
  };
}

export const Scanner: React.FC<Props> = ({ onScan, onCancel, loading }) => {
  const [manualCode, setManualCode] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>('prompt');
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isLockedRef = useRef(false); // Prevents duplicate scans while processing

  const startCamera = async () => {
    setCameraError(null);
    setValidationError(null);
    isLockedRef.current = false;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermission('unavailable');
      setCameraError('Camera access is not supported on this device or insecure context (HTTPS required on mobile).');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
      setCameraPermission('granted');
    } catch (err: any) {
      console.warn('Camera request error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraPermission('denied');
        setCameraError('Camera permission was denied. Please allow camera access in your browser or device settings.');
      } else {
        setCameraPermission('unavailable');
        setCameraError(err.message || 'Camera hardware unavailable or in use by another app.');
      }
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    // Automatically attempt camera start when entering scanner
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const handleScannedString = (rawContent: string) => {
    if (isLockedRef.current || loading) return;

    setValidationError(null);
    const parsed = parseScannedContent(rawContent);

    if (parsed.valid && parsed.batchId) {
      isLockedRef.current = true; // Lock to prevent duplicate navigation
      stopCamera();
      onScan(parsed.batchId);
    } else {
      setValidationError(parsed.error || 'Invalid QR code content');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedRef.current || loading) return;

    setValidationError(null);
    const raw = manualCode.trim();
    if (!raw) return;

    const parsed = parseScannedContent(raw);
    if (parsed.valid && parsed.batchId) {
      isLockedRef.current = true;
      stopCamera();
      onScan(parsed.batchId);
    } else {
      setValidationError(parsed.error || 'Invalid batch format. Standard format is MED-YYYYMMDD-XXXXX');
    }
  };

  return (
    <div style={{ padding: '16px', maxWidth: '440px', margin: '0 auto', textAlign: 'center' }}>
      {/* Top Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <button
          onClick={() => {
            stopCamera();
            onCancel();
          }}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: '#f8fafc',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          ← Back to Home
        </button>
        <span style={{ fontSize: '0.75rem', color: '#00d2b4', fontWeight: 700 }}>
          {isCameraActive ? 'LIVE CAMERA ACTIVE' : 'CAMERA STANDBY'}
        </span>
      </div>

      <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Scan Medicine QR</h1>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Align the QR code on the pharmaceutical package inside the viewfinder
      </p>

      {/* Validation or Camera Error Banner */}
      {validationError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '16px',
            color: '#f87171',
            fontSize: '0.8rem',
            textAlign: 'left',
          }}
        >
          <strong>⚠️ Rejected:</strong> {validationError}
        </div>
      )}

      {/* Camera Permission Denied View */}
      {cameraPermission === 'denied' && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '24px 20px',
            marginBottom: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🚫</div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f87171', marginBottom: '6px' }}>
            Camera Permission Required
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#fca5a5', lineHeight: 1.5, marginBottom: '14px' }}>
            {cameraError || 'Access to your camera was blocked. To scan packaging QR codes, allow camera permissions in your browser or device settings.'}
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              onClick={startCamera}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: '#00d2b4',
                border: 'none',
                color: '#070a12',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              🔄 Retry Permission
            </button>
          </div>
        </div>
      )}

      {/* Camera Unavailable View */}
      {cameraPermission === 'unavailable' && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '16px',
            padding: '24px 20px',
            marginBottom: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📷</div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fbbf24', marginBottom: '6px' }}>
            Camera Unavailable
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#fde68a', lineHeight: 1.5, marginBottom: '14px' }}>
            {cameraError || 'No video camera detected or running on an insecure HTTP origin. You can still verify batches manually below or use the simulation triggers.'}
          </p>
        </div>
      )}

      {/* Camera / Simulated Viewfinder */}
      {cameraPermission !== 'denied' && (
        <div className="viewfinder" style={{ position: 'relative' }}>
          {isCameraActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : null}

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
              color: 'rgba(255,255,255,0.7)',
              fontSize: '0.78rem',
              padding: '20px',
              pointerEvents: 'none',
              background: isCameraActive ? 'transparent' : 'rgba(7, 10, 18, 0.65)',
            }}
          >
            {loading ? 'Decrypting QR...' : isCameraActive ? 'Align QR inside box' : 'Camera Idle'}
          </div>
        </div>
      )}

      {/* Camera Controls */}
      <div style={{ margin: '14px 0' }}>
        {isCameraActive ? (
          <button
            onClick={stopCamera}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⏹️ Pause Camera
          </button>
        ) : cameraPermission !== 'denied' ? (
          <button
            onClick={startCamera}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'rgba(0, 210, 180, 0.15)',
              border: '1px solid rgba(0, 210, 180, 0.4)',
              color: '#00d2b4',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📷 Resume Camera
          </button>
        ) : null}
      </div>

      {/* Manual Input Alternative */}
      <form onSubmit={handleManualSubmit} style={{ marginTop: '16px' }}>
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

      {/* Simulator triggers */}
      <div style={{ marginTop: '20px', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
          Simulate Camera QR Detection:
        </div>
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleScannedString('http://localhost:5173/?verify=MED-20261015-A8F2K')}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'rgba(0, 210, 180, 0.12)',
              border: '1px solid rgba(0, 210, 180, 0.35)',
              color: '#00d2b4',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✓ Authentic
          </button>
          <button
            onClick={() => handleScannedString('https://localhost:5173/verify/MED-20261015-EXP01')}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              color: '#fbbf24',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⚠️ Expired
          </button>
          <button
            onClick={() => handleScannedString('https://localhost:5173/verify/MED-20261015-REC02')}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🛑 Recalled
          </button>
          <button
            onClick={() => handleScannedString('https://phishing-site.com/fake-login')}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🚫 Untrusted Malicious QR
          </button>
        </div>
      </div>
    </div>
  );
};
