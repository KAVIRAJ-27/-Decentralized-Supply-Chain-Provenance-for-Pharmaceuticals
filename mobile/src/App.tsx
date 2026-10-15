import React, { useState, useEffect } from 'react';
import { HomeScreen, ScanHistoryItem } from './components/HomeScreen';
import { Scanner } from './components/Scanner';
import { MedicineCard, VerificationResultData } from './components/MedicineCard';
import { NetworkSettingsModal } from './components/NetworkSettingsModal';

type AppView = 'home' | 'scanner' | 'result';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [scannedData, setScannedData] = useState<VerificationResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Configured API Base URL (defaults to /api)
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(() => {
    return localStorage.getItem('meditrace_api_url') || '/api';
  });

  // Persistent Scan History
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('meditrace_scan_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveScanHistory = (newItem: ScanHistoryItem) => {
    setScanHistory((prev) => {
      // Remove duplicate if already in history
      const filtered = prev.filter((item) => item.batchId !== newItem.batchId);
      const updated = [newItem, ...filtered].slice(0, 15); // keep last 15
      try {
        localStorage.setItem('meditrace_scan_history', JSON.stringify(updated));
      } catch (e) {
        console.warn('Could not save scan history to localStorage', e);
      }
      return updated;
    });
  };

  const clearScanHistory = () => {
    setScanHistory([]);
    try {
      localStorage.removeItem('meditrace_scan_history');
    } catch (e) {
      console.warn('Could not clear scan history in localStorage', e);
    }
  };

  const handleSaveApiUrl = (newUrl: string) => {
    setApiBaseUrl(newUrl);
    try {
      localStorage.setItem('meditrace_api_url', newUrl);
    } catch (e) {
      console.warn('Could not save API URL to localStorage', e);
    }
  };

  // Inspect URL parameters (?batch= or ?verify=) on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const batch = params.get('batch') || params.get('verify');
    if (batch) {
      handleVerifyBatch(batch.trim().toUpperCase());
    }
  }, []);

  const handleVerifyBatch = async (batchId: string) => {
    setLoading(true);
    setCurrentView('result');

    try {
      const cleanBase = apiBaseUrl.replace(/\/+$/, '');
      const primaryUrl = cleanBase.endsWith('/api')
        ? `${cleanBase}/public/verify/${encodeURIComponent(batchId)}`
        : `${cleanBase}/api/public/verify/${encodeURIComponent(batchId)}`;

      let res = await fetch(primaryUrl).catch(() => null);

      // Fallback alias endpoint if primary fails
      if (!res || !res.ok) {
        const aliasUrl = cleanBase.endsWith('/api')
          ? `${cleanBase}/verify/${encodeURIComponent(batchId)}`
          : `${cleanBase}/api/verify/${encodeURIComponent(batchId)}`;
        const aliasRes = await fetch(aliasUrl).catch(() => null);
        if (aliasRes) {
          res = aliasRes;
        }
      }

      if (!res) {
        // Network connection error
        const errorResult: VerificationResultData = {
          verified: false,
          batchId,
          isConnectionError: true,
          errorMessage: `Cannot reach MediTrace backend at ${cleanBase}. Ensure backend is running.`,
        };
        setScannedData(errorResult);
        return;
      }

      if (res.status === 404) {
        // Record Not Found / Counterfeit Alert
        const errJson = await res.json().catch(() => ({}));
        const notFoundResult: VerificationResultData = {
          verified: false,
          batchId,
          isNotFound: true,
          errorMessage:
            errJson.error ||
            `Batch '${batchId}' is not registered in the MediTrace blockchain provenance registry.`,
        };
        setScannedData(notFoundResult);
        saveScanHistory({
          batchId,
          drugName: 'Unregistered Product',
          status: 'UNREGISTERED',
          verified: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Verification failed with HTTP ${res.status}`);
      }

      const json = await res.json();
      setScannedData(json);

      // Save to recent scan history
      saveScanHistory({
        batchId: json.batchId || batchId,
        drugName: json.drugName || 'Verified Pharmaceutical',
        status: json.status || (json.isRecalled ? 'RECALLED' : json.isExpired ? 'EXPIRED' : 'VERIFIED'),
        isRecalled: json.isRecalled,
        isExpired: json.isExpired,
        verified: json.verified,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      setScannedData({
        verified: false,
        batchId,
        isConnectionError: true,
        errorMessage: err.message || 'An unexpected error occurred during verification.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHistoryItem = (item: ScanHistoryItem) => {
    handleVerifyBatch(item.batchId);
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
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          onClick={() => setCurrentView('home')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #00d2b4 0%, #0284c7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '0.85rem',
              color: '#070a12',
            }}
          >
            M
          </div>
          <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em', color: '#f8fafc' }}>
            Medi<span style={{ color: '#00d2b4' }}>Trace</span> Mobile
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '0.68rem',
              padding: '3px 8px',
              borderRadius: '9999px',
              background: 'rgba(0, 210, 180, 0.15)',
              color: '#00d2b4',
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}
          >
            PUBLIC VERIFY
          </span>

          <button
            onClick={() => setShowSettings(true)}
            title="Network & Host Settings"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '6px',
              color: '#94a3b8',
              padding: '4px 8px',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            ⚙️
          </button>
        </div>
      </nav>

      {/* Main Viewport Area */}
      <main style={{ flex: 1, paddingBottom: '32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                border: '4px solid rgba(0, 210, 180, 0.2)',
                borderTopColor: '#00d2b4',
                borderRadius: '50%',
                margin: '0 auto 16px',
                animation: 'spin 1s linear infinite',
              }}
            />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              Verifying Provenance Record...
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>
              Querying cryptographic supply chain ledger &amp; recall registry
            </p>
          </div>
        ) : currentView === 'scanner' ? (
          <Scanner
            onScan={(batchId) => handleVerifyBatch(batchId)}
            onCancel={() => setCurrentView('home')}
            loading={loading}
          />
        ) : currentView === 'result' && scannedData ? (
          <MedicineCard
            data={scannedData}
            onReset={() => setCurrentView('scanner')}
            onBackToHome={() => setCurrentView('home')}
          />
        ) : (
          <HomeScreen
            onStartScan={() => setCurrentView('scanner')}
            onManualVerify={(batchId) => handleVerifyBatch(batchId)}
            onSelectHistoryItem={handleSelectHistoryItem}
            scanHistory={scanHistory}
            onClearHistory={clearScanHistory}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
      </main>

      {/* Network Settings Modal */}
      {showSettings && (
        <NetworkSettingsModal
          currentApiUrl={apiBaseUrl}
          onSave={handleSaveApiUrl}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};
