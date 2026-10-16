import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';

interface Props {
  onScan: (batchId: string) => void;
  onCancel: () => void;
  loading: boolean;
}

export const BATCH_ID_REGEX = /^MED-\d{8}-[A-Z0-9]{4,8}$/;

/**
 * Regex to detect common virtual camera software drivers that cause prompts or lack physical hardware.
 * Examples: DroidCam, OBS Virtual Camera, ManyCam, Vysor, EpocCam, Iriun.
 */
const VIRTUAL_CAMERA_REGEX = /droidcam|obs[- ]?virtual|virtual[- ]?camera|vysor|manycam|epoccam|iriun|camo|splitcam/i;

export interface DetectedCamera {
  deviceId: string;
  label: string;
  isVirtual: boolean;
  facing?: 'environment' | 'user';
}

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
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);

  // Available camera devices list & current device selection
  const [availableCameras, setAvailableCameras] = useState<DetectedCamera[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [facingModePreference, setFacingModePreference] = useState<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isLockedRef = useRef(false); // Prevents duplicate scans while processing
  const scanRafRef = useRef<number | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const barcodeDetectorRef = useRef<any>(null);

  // Initialize native BarcodeDetector if supported by the browser
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        barcodeDetectorRef.current = null;
      }
    }
  }, []);

  /**
   * Enumerate available video devices and filter out virtual camera drivers like DroidCam.
   */
  const updateAvailableCameras = useCallback(async (): Promise<DetectedCamera[]> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');

      const mapped: DetectedCamera[] = videoDevices.map((d, index) => {
        const label = d.label || `Camera ${index + 1}`;
        const isVirtual = VIRTUAL_CAMERA_REGEX.test(label);
        const lowerLabel = label.toLowerCase();
        let facing: 'environment' | 'user' | undefined = undefined;

        if (lowerLabel.includes('back') || lowerLabel.includes('rear') || lowerLabel.includes('environment')) {
          facing = 'environment';
        } else if (lowerLabel.includes('front') || lowerLabel.includes('user') || lowerLabel.includes('facetime')) {
          facing = 'user';
        }

        return {
          deviceId: d.deviceId,
          label,
          isVirtual,
          facing,
        };
      });

      setAvailableCameras(mapped);
      return mapped;
    } catch (err) {
      console.warn('Failed to enumerate media devices:', err);
      return [];
    }
  }, []);

  /**
   * Stops the active media stream and cancels the frame scanning loop.
   */
  const stopCamera = useCallback(() => {
    if (scanRafRef.current) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
  }, []);

  /**
   * Safely process detected QR text.
   */
  const handleScannedString = useCallback((rawContent: string) => {
    if (isLockedRef.current || loading) return;

    setValidationError(null);
    const parsed = parseScannedContent(rawContent);

    if (parsed.valid && parsed.batchId) {
      isLockedRef.current = true; // Lock to prevent duplicate navigation

      // Haptic feedback on supported mobile devices
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([40, 30, 40]);
        } catch {}
      }

      stopCamera();
      onScan(parsed.batchId);
    } else {
      setValidationError(parsed.error || 'Invalid QR code content');
    }
  }, [loading, onScan, stopCamera]);

  /**
   * QR Frame Scanning Loop
   * Runs at ~10-12 scans/second to preserve CPU and battery on mobile.
   */
  const startScanLoop = useCallback(() => {
    const scanFrame = async () => {
      if (isLockedRef.current) return;

      const video = videoRef.current;
      if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
        const now = performance.now();
        // Throttle scans to every 100ms
        if (now - lastScanTimeRef.current >= 100) {
          lastScanTimeRef.current = now;

          // 1. Try Native BarcodeDetector (fastest on Android Chrome)
          if (barcodeDetectorRef.current) {
            try {
              const barcodes = await barcodeDetectorRef.current.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                handleScannedString(barcodes[0].rawValue);
                return;
              }
            } catch (detectorErr) {
              // Fallback to jsQR on error
            }
          }

          // 2. Universal Canvas + jsQR Fallback
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
              }

              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: 'dontInvert',
                });

                if (code && code.data) {
                  handleScannedString(code.data);
                  return;
                }
              } catch (canvasErr) {
                // Cross-origin or read issue
              }
            }
          }
        }
      }

      scanRafRef.current = requestAnimationFrame(scanFrame);
    };

    scanRafRef.current = requestAnimationFrame(scanFrame);
  }, [handleScannedString]);

  /**
   * Core camera startup method with smart hardware selection:
   * - Avoids virtual cameras like DroidCam
   * - Prefers mobile rear camera (environment) by default
   * - Falls back to physical integrated webcam
   */
  const startCamera = useCallback(async (targetDeviceId?: string, targetFacingMode?: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);
    setCameraNotice(null);
    setValidationError(null);
    isLockedRef.current = false;

    // 1. Verify Browser Support & Secure Context
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermission('unavailable');
      const isSecure = typeof window !== 'undefined' && window.isSecureContext;
      if (!isSecure && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setCameraError(
          'Camera access blocked by browser: Insecure context. Mobile browsers require HTTPS or localhost. If testing over local Wi-Fi, open in Chrome and enable chrome://flags/#unsafely-treat-insecure-origin-as-secure.'
        );
      } else {
        setCameraError('Camera access is not supported on this browser or platform.');
      }
      return;
    }

    const preferredFacing = targetFacingMode || facingModePreference;

    try {
      let stream: MediaStream | null = null;

      // 2a. User explicitly chose a specific camera device
      if (targetDeviceId) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: targetDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } else {
        // 2b. Initial Camera Enumeration Check (if permission already cached)
        const existingDevices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        const videoInputs = existingDevices.filter((d) => d.kind === 'videoinput');
        const physicalInputs = videoInputs.filter((d) => !VIRTUAL_CAMERA_REGEX.test(d.label));

        // If multiple cameras exist and DroidCam/virtual camera is present, avoid it explicitly
        const hasVirtualCamera = videoInputs.some((d) => VIRTUAL_CAMERA_REGEX.test(d.label));
        let chosenDeviceId: string | undefined = undefined;

        if (hasVirtualCamera && physicalInputs.length > 0) {
          // Find rear or integrated camera among physical devices
          const rearCam = physicalInputs.find((d) => /back|rear|environment/i.test(d.label));
          const integratedCam = physicalInputs.find((d) => /integrated|webcam|internal|front/i.test(d.label));
          const bestPhysical = rearCam || integratedCam || physicalInputs[0];
          if (bestPhysical && bestPhysical.deviceId) {
            chosenDeviceId = bestPhysical.deviceId;
          }
        }

        if (chosenDeviceId) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: chosenDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } else {
          // 2c. Mobile-first standard: prefer rear camera (facingMode: environment)
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: preferredFacing },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            });
          } catch (facingErr) {
            // Fallback: try user camera or plain video
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
              });
            } catch (userErr) {
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
              });
            }
          }
        }
      }

      if (!stream) {
        throw new Error('Unable to acquire camera stream.');
      }

      mediaStreamRef.current = stream;

      // 3. Post-Startup Hardware Validation: Check if browser picked a virtual camera
      const activeTrack = stream.getVideoTracks()[0];
      const activeLabel = activeTrack ? activeTrack.label : '';

      // Refresh camera list now that permission is granted and labels are accessible
      const updatedCameras = await updateAvailableCameras();

      // Check if the current stream is bound to a virtual camera (e.g. DroidCam) while a real physical camera exists
      if (VIRTUAL_CAMERA_REGEX.test(activeLabel)) {
        const physicalFallback = updatedCameras.find((c) => !c.isVirtual && c.deviceId);
        if (physicalFallback && (!targetDeviceId || targetDeviceId !== physicalFallback.deviceId)) {
          // Silently switch away from DroidCam to the real built-in hardware camera!
          console.info(`[MediTrace Camera] Virtual camera '${activeLabel}' detected. Switching to built-in '${physicalFallback.label}'.`);
          trackSwitchedStream(physicalFallback.deviceId);
          return;
        } else {
          setCameraNotice(
            `Note: Virtual camera '${activeLabel}' is active. If your device has a built-in webcam or rear camera, select it below.`
          );
        }
      }

      if (activeTrack) {
        const matchingDev = updatedCameras.find((c) => c.label === activeLabel);
        if (matchingDev) {
          setSelectedDeviceId(matchingDev.deviceId);
        }
      }

      // 4. Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play().catch(() => {});
      }

      setIsCameraActive(true);
      setCameraPermission('granted');

      // 5. Start Real-time QR Decoding Loop
      startScanLoop();
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      setIsCameraActive(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraPermission('denied');
        setCameraError('Camera permission was denied. Please allow camera access in your browser or device settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraPermission('unavailable');
        setCameraError('No camera hardware found on this device. You can verify batches manually below.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraPermission('unavailable');
        setCameraError('Camera is already in use by another application or video driver is locked.');
      } else if (err.name === 'OverconstrainedError') {
        // Retry with loose constraints
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          mediaStreamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.play().catch(() => {});
          }
          setIsCameraActive(true);
          setCameraPermission('granted');
          startScanLoop();
          return;
        } catch {
          setCameraPermission('unavailable');
          setCameraError('Selected camera does not satisfy requested video constraints.');
        }
      } else {
        setCameraPermission('unavailable');
        setCameraError(err.message || 'Camera hardware unavailable. You can enter the Batch ID manually below.');
      }
    }
  }, [facingModePreference, startScanLoop, stopCamera, updateAvailableCameras]);

  /**
   * Helper to switch stream to a specific camera device ID.
   */
  const trackSwitchedStream = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    startCamera(deviceId);
  };

  /**
   * Flip between Rear and Front camera (standard mobile action).
   */
  const handleFlipCamera = () => {
    const nextFacing = facingModePreference === 'environment' ? 'user' : 'environment';
    setFacingModePreference(nextFacing);

    // Look for matching camera in available cameras
    const target = availableCameras.find((c) => !c.isVirtual && c.facing === nextFacing);
    if (target) {
      setSelectedDeviceId(target.deviceId);
      startCamera(target.deviceId, nextFacing);
    } else {
      setSelectedDeviceId('');
      startCamera(undefined, nextFacing);
    }
  };

  /**
   * Start camera automatically on mount and clean up on unmount.
   */
  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

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
    <div style={{ padding: '16px', maxWidth: '460px', margin: '0 auto', textAlign: 'center' }}>
      {/* Hidden Offscreen Canvas for jsQR Frame Decoding */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Top Navigation */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '0.75rem',
              color: isCameraActive ? '#00d2b4' : '#94a3b8',
              fontWeight: 700,
            }}
          >
            {isCameraActive ? '● LIVE SCANNER' : '○ STANDBY'}
          </span>
        </div>
      </div>

      <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Scan Medicine QR</h1>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
        Point your camera at the packaging QR code to verify blockchain provenance
      </p>

      {/* Camera Software / Selection Notice */}
      {cameraNotice && (
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '14px',
            color: '#38bdf8',
            fontSize: '0.78rem',
            textAlign: 'left',
          }}
        >
          ℹ️ {cameraNotice}
        </div>
      )}

      {/* Validation Error Banner */}
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
            {cameraError || 'Access to your camera was blocked. Please allow camera permissions in your browser address bar or device settings.'}
          </p>
          <button
            onClick={() => startCamera()}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              background: '#00d2b4',
              border: 'none',
              color: '#070a12',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            🔄 Request Permission Again
          </button>
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
            Camera Not Accessible
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#fde68a', lineHeight: 1.5, marginBottom: '14px' }}>
            {cameraError || 'No video camera detected or context is insecure. You can still verify batches manually below.'}
          </p>
          <button
            onClick={() => startCamera()}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid #f59e0b',
              color: '#fbbf24',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            🔄 Retry Camera Initialization
          </button>
        </div>
      )}

      {/* Real Live Camera Viewfinder */}
      {cameraPermission !== 'denied' && cameraPermission !== 'unavailable' && (
        <div className="viewfinder" style={{ position: 'relative' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: isCameraActive ? 'block' : 'none',
            }}
          />

          <div className="corner top-left" />
          <div className="corner top-right" />
          <div className="corner bottom-left" />
          <div className="corner bottom-right" />
          <div className="scanner-laser" />

          {/* Viewfinder Status Overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.85)',
              fontSize: '0.78rem',
              padding: '20px',
              pointerEvents: 'none',
              background: isCameraActive ? 'transparent' : 'rgba(7, 10, 18, 0.75)',
            }}
          >
            {loading ? 'Verifying on Ledger...' : isCameraActive ? 'Align QR code within box' : 'Camera Initializing...'}
          </div>
        </div>
      )}

      {/* Camera Switcher & Controls */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', margin: '12px 0' }}>
        {/* Flip Camera Button (if multiple physical cameras detected or on mobile) */}
        {isCameraActive && (
          <button
            onClick={handleFlipCamera}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border)',
              color: 'var(--text-main)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Toggle between Rear and Front Camera"
          >
            🔄 Flip Camera ({facingModePreference === 'environment' ? 'Rear' : 'Front'})
          </button>
        )}

        {/* Camera Selector Dropdown (when multiple cameras are enumerated) */}
        {availableCameras.length > 1 && (
          <select
            value={selectedDeviceId}
            onChange={(e) => trackSwitchedStream(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid var(--border)',
              color: 'var(--text-main)',
              fontSize: '0.75rem',
              maxWidth: '220px',
              cursor: 'pointer',
            }}
          >
            {availableCameras.map((cam) => (
              <option key={cam.deviceId} value={cam.deviceId}>
                {cam.isVirtual ? `[Virtual] ${cam.label}` : cam.label}
              </option>
            ))}
          </select>
        )}

        {/* Pause/Resume Toggle */}
        {isCameraActive ? (
          <button
            onClick={stopCamera}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⏸️ Pause
          </button>
        ) : cameraPermission === 'granted' ? (
          <button
            onClick={() => startCamera(selectedDeviceId || undefined)}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              background: 'rgba(0, 210, 180, 0.15)',
              border: '1px solid rgba(0, 210, 180, 0.4)',
              color: '#00d2b4',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ▶️ Resume Camera
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

      {/* 1-Click Verification Test Scenarios */}
      <div style={{ marginTop: '20px', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
          Test Scenarios (Simulate QR Detection):
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
            🚫 Malicious QR
          </button>
        </div>
      </div>
    </div>
  );
};
