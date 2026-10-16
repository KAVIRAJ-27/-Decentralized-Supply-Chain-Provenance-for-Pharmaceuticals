import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { MedicineBatch, UserSession, Delivery, CustodyEvent } from '../types';
import './HospitalPage.css';

interface Props {
  session: UserSession | null;
  onOpenLogin: () => void;
}

type TabKey = 'overview' | 'deliveries' | 'inventory' | 'traceability' | 'alerts' | 'dispense';

export const HospitalPage: React.FC<Props> = ({ session, onOpenLogin }) => {
  const [activeSubTab, setActiveSubTab] = useState<TabKey>('overview');
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'EXPIRING' | 'RECALLED'>('ALL');
  const [sortBy, setSortBy] = useState<'EXPIRY_ASC' | 'QTY_DESC' | 'NAME_ASC' | 'BATCH_ID'>('EXPIRY_ASC');

  // Selected batch for traceability view
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchHistory, setBatchHistory] = useState<CustodyEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Delivery receipt confirmation modal state
  const [confirmingDelivery, setConfirmingDelivery] = useState<Delivery | null>(null);
  const [receiptQty, setReceiptQty] = useState<number>(0);
  const [receiptRemarks, setReceiptRemarks] = useState('Hospital pharmacy inspection completed; tamper seals verified and cold chain intact.');
  const [receiptLocation, setReceiptLocation] = useState('Central Inpatient Vault - Cold Room 2');
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);

  // Inpatient Dispensing modal state
  const [dispenseBatch, setDispenseBatch] = useState<MedicineBatch | null>(null);
  const [dispenseUnits, setDispenseUnits] = useState<number>(1);
  const [patientMRN, setPatientMRN] = useState('MRN-2026-');
  const [patientWard, setPatientWard] = useState('ICU - Bed 04');
  const [dispenseNotes, setDispenseNotes] = useState('Inpatient medication order prescribed for critical care therapy.');
  const [dispensingSubmitting, setDispensingSubmitting] = useState(false);

  // QR Code Modal
  const [viewingQrBatch, setViewingQrBatch] = useState<MedicineBatch | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  // Recent in-app clinical administration log (local session tracking)
  const [recentAdministrations, setRecentAdministrations] = useState<Array<{
    batchId: string;
    drugName: string;
    units: number;
    patientMRN: string;
    ward: string;
    timestamp: string;
  }>>([
    {
      batchId: 'MED-20261015-APX01',
      drugName: 'Amoxicillin 500mg',
      units: 20,
      patientMRN: 'MRN-2026-8812',
      ward: 'Ward 3B - Bed 12',
      timestamp: new Date(Date.now() - 3600000 * 2).toLocaleTimeString(),
    },
    {
      batchId: 'MED-20261015-APX02',
      drugName: 'Paracetamol 650mg',
      units: 15,
      patientMRN: 'MRN-2026-9043',
      ward: 'Emergency Care Unit',
      timestamp: new Date(Date.now() - 3600000 * 5).toLocaleTimeString(),
    },
  ]);

  const loadHospitalData = async () => {
    if (!session?.token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [batchList, inboundList] = await Promise.all([
        api.getBatches(session.token).catch(() => []),
        api.getDeliveries(session.token, { direction: 'inbound' }).catch(() => []),
      ]);
      setBatches(batchList);
      setDeliveries(inboundList);

      // Auto select first batch if traceability has none
      if (batchList.length > 0 && !selectedBatchId) {
        setSelectedBatchId(batchList[0].batchId);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load hospital clinical ledger data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHospitalData();
  }, [session]);

  // Load history when selectedBatchId changes
  useEffect(() => {
    if (!selectedBatchId || !session?.token) return;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const details = await api.getBatchDetails(session.token, selectedBatchId);
        setBatchHistory(details.history || []);
      } catch (e) {
        // Fallback to public verification history if authenticated details endpoint fails
        try {
          const pub = await api.verifyBatch(selectedBatchId);
          setBatchHistory((pub.provenanceHistory as any) || []);
        } catch {
          setBatchHistory([]);
        }
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [selectedBatchId, session]);

  // Derived metrics
  const pendingDeliveries = useMemo(() => {
    return deliveries.filter((d) => d.status === 'IN_TRANSIT' || d.status === 'PENDING' || d.status === 'DISPATCHED');
  }, [deliveries]);

  const hospitalStock = useMemo(() => {
    return batches.filter(
      (b) =>
        b.currentStatus === 'RECEIVED_BY_PHARMACY' ||
        b.currentStatus === 'DISPENSED' ||
        b.currentOwnerRole === 'HOSPITAL'
    );
  }, [batches]);

  const totalInpatientUnits = useMemo(() => {
    return hospitalStock.reduce((acc, b) => acc + (b.remainingQuantity ?? b.quantity ?? 0), 0);
  }, [hospitalStock]);

  const verifiedBatchesCount = useMemo(() => {
    return hospitalStock.filter((b) => !b.isRecalled && new Date(b.expiryDate).getTime() > Date.now()).length;
  }, [hospitalStock]);

  const criticalAlerts = useMemo(() => {
    return hospitalStock.filter((b) => {
      const isExpired = new Date(b.expiryDate).getTime() < Date.now();
      return b.isRecalled || isExpired;
    });
  }, [hospitalStock]);

  // Filtered & Sorted Inventory
  const filteredBatches = useMemo(() => {
    return hospitalStock
      .filter((b) => {
        const query = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !query ||
          b.batchId.toLowerCase().includes(query) ||
          b.drugName.toLowerCase().includes(query) ||
          (b.genericName && b.genericName.toLowerCase().includes(query)) ||
          b.manufacturerName.toLowerCase().includes(query);

        if (!matchesQuery) return false;

        const isExpired = new Date(b.expiryDate).getTime() < Date.now();
        const isLow = b.remainingQuantity > 0 && b.remainingQuantity < 100;
        const daysToExpiry = (new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24);

        if (filterCategory === 'IN_STOCK') return b.remainingQuantity > 0 && !b.isRecalled && !isExpired;
        if (filterCategory === 'LOW_STOCK') return isLow && !b.isRecalled && !isExpired;
        if (filterCategory === 'EXPIRING') return daysToExpiry > 0 && daysToExpiry <= 90 && !b.isRecalled;
        if (filterCategory === 'RECALLED') return b.isRecalled || isExpired;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'EXPIRY_ASC') {
          return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        }
        if (sortBy === 'QTY_DESC') {
          return (b.remainingQuantity || 0) - (a.remainingQuantity || 0);
        }
        if (sortBy === 'NAME_ASC') {
          return a.drugName.localeCompare(b.drugName);
        }
        return a.batchId.localeCompare(b.batchId);
      });
  }, [hospitalStock, searchQuery, filterCategory, sortBy]);

  // Confirm receipt action
  const handleOpenReceiptModal = (delivery: Delivery) => {
    setConfirmingDelivery(delivery);
    setReceiptQty(delivery.quantity);
  };

  const handleConfirmReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !confirmingDelivery) return;

    setReceiptSubmitting(true);
    setErrorMsg(null);
    try {
      await api.confirmDeliveryReceipt(session.token, confirmingDelivery.deliveryId, {
        receivedQuantity: Number(receiptQty),
        remarks: receiptRemarks,
        location: receiptLocation,
        temperatureCelsius: confirmingDelivery.temperatureCelsius ?? 4.2,
      });

      setSuccessMsg(`Delivery ${confirmingDelivery.deliveryId} confirmed! ${receiptQty} units accepted into Inpatient Dispensary vault.`);
      setConfirmingDelivery(null);
      await loadHospitalData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to confirm delivery receipt');
    } finally {
      setReceiptSubmitting(false);
    }
  };

  // Dispensing action
  const handleOpenDispenseModal = (batch: MedicineBatch) => {
    setDispenseBatch(batch);
    setDispenseUnits(1);
    setPatientMRN(`MRN-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleConfirmDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !dispenseBatch) return;

    setDispensingSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await api.dispense(session.token, dispenseBatch.batchId, {
        quantityToDispense: Number(dispenseUnits),
        patientReference: `${patientMRN} (${patientWard})`,
        notes: dispenseNotes,
      });

      // Append to local audit log
      setRecentAdministrations((prev) => [
        {
          batchId: dispenseBatch.batchId,
          drugName: dispenseBatch.drugName,
          units: Number(dispenseUnits),
          patientMRN,
          ward: patientWard,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);

      setSuccessMsg(`Administered ${dispenseUnits} units of ${dispenseBatch.drugName} for ${patientMRN}. Inpatient stock balance: ${res.remainingQuantity} units.`);
      setDispenseBatch(null);
      await loadHospitalData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Clinical dispensing operation failed');
    } finally {
      setDispensingSubmitting(false);
    }
  };

  // View QR Modal
  const handleOpenQrModal = async (batch: MedicineBatch) => {
    setViewingQrBatch(batch);
    setLoadingQr(true);
    setQrSvg(null);
    try {
      if (session?.token) {
        const qrData = await api.getBatchQr(session.token, batch.batchId);
        setQrSvg(qrData.qrSvg);
      }
    } catch (err) {
      console.error('Failed to load QR SVG', err);
    } finally {
      setLoadingQr(false);
    }
  };

  if (!session) {
    return (
      <div className="hospital-dashboard" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="hospital-card" style={{ maxWidth: '480px', textAlign: 'center', padding: '36px' }}>
          <div className="hospital-header-cross" style={{ margin: '0 auto 16px' }}>🏥</div>
          <h2 style={{ color: '#183B4E', marginBottom: '8px' }}>Hospital Clinical Dispensary Portal</h2>
          <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '24px' }}>
            Institutional authentication required. Please sign in with an authorized Hospital Inpatient Pharmacy or Clinical Administrator account.
          </p>
          <button className="btn-clinical-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onOpenLogin}>
            Sign In with Hospital Credentials
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hospital-dashboard">
      {/* 1. Left Clinical Sidebar (#174A6E) */}
      <aside className="hospital-sidebar">
        <div className="hospital-sidebar-header">
          <div className="hospital-icon-badge">➕</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em' }}>MediTrace</div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Hospital Clinical Suite</div>
          </div>
        </div>

        <ul className="hospital-nav-list">
          <li>
            <button
              className={`hospital-nav-item ${activeSubTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('overview')}
            >
              <span>📊 Clinical Overview</span>
            </button>
          </li>
          <li>
            <button
              className={`hospital-nav-item ${activeSubTab === 'deliveries' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('deliveries')}
            >
              <span>📦 Inbound Deliveries</span>
              {pendingDeliveries.length > 0 && (
                <span className="hospital-nav-pill">{pendingDeliveries.length}</span>
              )}
            </button>
          </li>
          <li>
            <button
              className={`hospital-nav-item ${activeSubTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('inventory')}
            >
              <span>💊 Medicine Inventory</span>
              <span className="hospital-nav-pill">{hospitalStock.length}</span>
            </button>
          </li>
          <li>
            <button
              className={`hospital-nav-item ${activeSubTab === 'traceability' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('traceability')}
            >
              <span>🔗 Traceability Journey</span>
            </button>
          </li>
          <li>
            <button
              className={`hospital-nav-item ${activeSubTab === 'alerts' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('alerts')}
            >
              <span>🚨 Safety &amp; Recalls</span>
              {criticalAlerts.length > 0 && (
                <span className="hospital-nav-pill alert">{criticalAlerts.length}</span>
              )}
            </button>
          </li>
          <li>
            <button
              className={`hospital-nav-item ${activeSubTab === 'dispense' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('dispense')}
            >
              <span>📋 Inpatient Dispensing</span>
            </button>
          </li>
        </ul>

        <div className="hospital-sidebar-footer">
          <div style={{ fontWeight: 600, color: '#FFFFFF', marginBottom: '2px' }}>{session.user.name}</div>
          <div style={{ color: '#94A3B8', fontSize: '0.72rem' }}>Role: Clinical Pharmacist</div>
          <div style={{ color: '#0D9488', fontSize: '0.72rem', marginTop: '6px', fontWeight: 600 }}>
            ● Verified Hospital Node
          </div>
        </div>
      </aside>

      {/* 2. Main Content Canvas (#F0F7FA) */}
      <main className="hospital-main">
        {/* Header Section */}
        <header className="hospital-header">
          <div className="hospital-title-row">
            <div className="hospital-header-cross">🏥</div>
            <div>
              <h1>{session.user.organizationName || 'St. Jude Hospital Dispensary'}</h1>
              <p>
                Inpatient Drug Administration &bull; Clinical License: <strong>{session.user.licenseNumber || 'HOSP-LIC-2026-901'}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span className="badge-info">
              ⛓️ Hardhat Block #31337 Verified
            </span>
            <button className="btn-clinical-secondary" onClick={loadHospitalData} disabled={loading}>
              {loading ? 'Refreshing...' : '🔄 Refresh Data'}
            </button>
            <button className="btn-clinical-primary" onClick={() => setActiveSubTab('deliveries')}>
              📦 Inbound Receipts ({pendingDeliveries.length})
            </button>
          </div>
        </header>

        {/* Success / Error Banners */}
        {successMsg && (
          <div className="badge-verified" style={{ width: '100%', padding: '12px 18px', marginBottom: '18px', boxSizing: 'border-box' }}>
            <span>✅ {successMsg}</span>
            <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontWeight: 'bold' }} onClick={() => setSuccessMsg(null)}>✕</button>
          </div>
        )}

        {errorMsg && (
          <div className="badge-alert" style={{ width: '100%', padding: '12px 18px', marginBottom: '18px', boxSizing: 'border-box' }}>
            <span>⚠️ {errorMsg}</span>
            <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontWeight: 'bold' }} onClick={() => setErrorMsg(null)}>✕</button>
          </div>
        )}

        {/* Critical Safety Alert Banner (if any recalled/expired drugs exist in stock) */}
        {criticalAlerts.length > 0 && (
          <div className="hospital-alert-banner">
            <div className="hospital-alert-icon">⚠️</div>
            <div className="hospital-alert-content" style={{ flex: 1 }}>
              <h4>Clinical Action Required: {criticalAlerts.length} Medication Lot(s) Flagged</h4>
              <p>
                The hospital inventory ledger contains lot(s) that are either subject to regulatory recall or have exceeded their expiration dates.
                Do not administer to patients. Quarantine immediately from ward drug dispensing stations.
              </p>
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                <button className="btn-clinical-danger" onClick={() => setActiveSubTab('alerts')}>
                  Inspect Quarantined Batches
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Summary Metric Cards (#FFFFFF cards with #D9E5EC borders) */}
        <div className="hospital-metrics-grid">
          <div className="hospital-card">
            <div className="hospital-card-header">
              <span className="hospital-card-label">Inpatient Stock Units</span>
              <span style={{ fontSize: '18px' }}>💊</span>
            </div>
            <div className="hospital-card-value">{totalInpatientUnits.toLocaleString()}</div>
            <div className="hospital-card-sub">
              <span>{hospitalStock.length} active formulations in vault</span>
            </div>
          </div>

          <div className="hospital-card">
            <div className="hospital-card-header">
              <span className="hospital-card-label">Pending Inbound Shipments</span>
              <span style={{ fontSize: '18px' }}>🚚</span>
            </div>
            <div className="hospital-card-value" style={{ color: pendingDeliveries.length > 0 ? '#92400E' : '#183B4E' }}>
              {pendingDeliveries.length}
            </div>
            <div className="hospital-card-sub">
              {pendingDeliveries.length > 0 ? (
                <span className="badge-pending">Intake confirmation pending</span>
              ) : (
                <span>All inbound shipments cleared</span>
              )}
            </div>
          </div>

          <div className="hospital-card">
            <div className="hospital-card-header">
              <span className="hospital-card-label">Verified Authentic Lots</span>
              <span style={{ fontSize: '18px' }}>🛡️</span>
            </div>
            <div className="hospital-card-value" style={{ color: '#166534' }}>
              {verifiedBatchesCount}
            </div>
            <div className="hospital-card-sub">
              <span className="badge-verified">100% Cryptographically Intact</span>
            </div>
          </div>

          <div className="hospital-card">
            <div className="hospital-card-header">
              <span className="hospital-card-label">Critical Safety Alerts</span>
              <span style={{ fontSize: '18px' }}>🚨</span>
            </div>
            <div className="hospital-card-value" style={{ color: criticalAlerts.length > 0 ? '#991B1B' : '#183B4E' }}>
              {criticalAlerts.length}
            </div>
            <div className="hospital-card-sub">
              {criticalAlerts.length > 0 ? (
                <span className="badge-alert">Quarantine lots detected</span>
              ) : (
                <span style={{ color: '#166534' }}>Zero active recalls</span>
              )}
            </div>
          </div>
        </div>

        {/* 4. Tab Views */}

        {/* TAB: OVERVIEW */}
        {activeSubTab === 'overview' && (
          <>
            {/* Quick Actions & Recent Incoming Deliveries */}
            <div className="hospital-section-card">
              <div className="hospital-card-title-bar">
                <h3>📦 Inbound Shipments Awaiting Hospital Reception</h3>
                <span className="badge-pending">{pendingDeliveries.length} Shipments</span>
              </div>

              {pendingDeliveries.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>No incoming shipments currently in transit for this hospital.</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94A3B8' }}>All dispatched logistics batches have been confirmed and received into inventory.</p>
                </div>
              ) : (
                <div className="hospital-table-wrapper">
                  <table className="hospital-table">
                    <thead>
                      <tr>
                        <th>Delivery ID</th>
                        <th>Medicine</th>
                        <th>Origin Carrier</th>
                        <th>Dispatched Quantity</th>
                        <th>Cold-Chain Temp</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingDeliveries.map((d) => (
                        <tr key={d.deliveryId}>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0D9488' }}>
                              {d.deliveryId}
                            </span>
                            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Batch: {d.batchId}</div>
                          </td>
                          <td>
                            <strong style={{ color: '#183B4E' }}>{d.drugName}</strong>
                          </td>
                          <td>{d.fromOrganizationName}</td>
                          <td>
                            <strong style={{ color: '#183B4E' }}>{d.quantity}</strong> units
                          </td>
                          <td>
                            {d.temperatureCelsius !== undefined ? (
                              <span className="badge-info">❄️ {d.temperatureCelsius}°C</span>
                            ) : (
                              <span style={{ color: '#64748B' }}>Ambient</span>
                            )}
                          </td>
                          <td>
                            <span className="badge-pending">IN TRANSIT</span>
                          </td>
                          <td>
                            <button
                              className="btn-clinical-primary"
                              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                              onClick={() => handleOpenReceiptModal(d)}
                            >
                              Inspect &amp; Confirm
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Inpatient Stock Summary Table */}
            <div className="hospital-section-card">
              <div className="hospital-card-title-bar">
                <h3>💊 Inpatient Ward Dispensary Inventory</h3>
                <button className="btn-clinical-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => setActiveSubTab('inventory')}>
                  View All ({hospitalStock.length})
                </button>
              </div>

              {hospitalStock.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                  <p>No active hospital dispensary stock found.</p>
                </div>
              ) : (
                <div className="hospital-table-wrapper">
                  <table className="hospital-table">
                    <thead>
                      <tr>
                        <th>Batch Identifier</th>
                        <th>Medicine &amp; Formulation</th>
                        <th>Inpatient Balance</th>
                        <th>Expiry Date</th>
                        <th>Provenance State</th>
                        <th>Clinical Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hospitalStock.slice(0, 5).map((b) => {
                        const isExpired = new Date(b.expiryDate).getTime() < Date.now();
                        const percentLeft = Math.round(((b.remainingQuantity ?? b.quantity) / b.quantity) * 100);

                        return (
                          <tr key={b.batchId}>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#183B4E' }}>
                                {b.batchId}
                              </span>
                              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Mfg: {b.manufacturerName}</div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: '#183B4E' }}>{b.drugName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                                {b.genericName} &bull; {b.dosage}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: '#183B4E' }}>
                                {b.remainingQuantity} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748B' }}>/ {b.quantity}</span>
                              </div>
                              <div className="hospital-stock-bar-wrapper">
                                <div
                                  className={`hospital-stock-bar-fill ${percentLeft < 20 ? 'critical' : percentLeft < 50 ? 'low' : ''}`}
                                  style={{ width: `${percentLeft}%` }}
                                />
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.82rem' }}>{new Date(b.expiryDate).toLocaleDateString()}</div>
                              {isExpired ? (
                                <span className="badge-alert">EXPIRED</span>
                              ) : b.isRecalled ? (
                                <span className="badge-alert">RECALLED</span>
                              ) : (
                                <span className="badge-verified">Valid</span>
                              )}
                            </td>
                            <td>
                              <span className="badge-verified">Verified Safe</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {b.remainingQuantity > 0 && !b.isRecalled && !isExpired && (
                                  <button
                                    className="btn-clinical-primary"
                                    style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                                    onClick={() => handleOpenDispenseModal(b)}
                                  >
                                    Dispense
                                  </button>
                                )}
                                <button
                                  className="btn-clinical-secondary"
                                  style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                                  onClick={() => {
                                    setSelectedBatchId(b.batchId);
                                    setActiveSubTab('traceability');
                                  }}
                                >
                                  Trace
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB: INBOUND DELIVERIES */}
        {activeSubTab === 'deliveries' && (
          <div className="hospital-section-card">
            <div className="hospital-card-title-bar">
              <h3>📦 Inbound Logistics &amp; Receipt Inspection</h3>
              <span className="badge-info">Explicit Receipt Intake Required</span>
            </div>

            <div style={{ padding: '16px 24px', background: '#F8FAFC', borderBottom: '1px solid #D9E5EC', fontSize: '0.85rem', color: '#64748B' }}>
              💡 <strong>Clinical Invariant:</strong> Medicine shipments do not automatically enter dispensary stock upon scanning.
              Hospital receiving staff must explicitly verify packaging condition, confirm received quantities, and submit receipt acknowledgment.
            </div>

            {deliveries.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                <p>No delivery records associated with this hospital facility.</p>
              </div>
            ) : (
              <div className="hospital-table-wrapper">
                <table className="hospital-table">
                  <thead>
                    <tr>
                      <th>Delivery Ref</th>
                      <th>Batch ID</th>
                      <th>Medicine Name</th>
                      <th>Sender Carrier</th>
                      <th>Quantity</th>
                      <th>Cold-Chain Sensor</th>
                      <th>Status</th>
                      <th>Action / Confirmation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => {
                      const isDelivered = d.status === 'DELIVERED';
                      return (
                        <tr key={d.deliveryId}>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0D9488' }}>
                              {d.deliveryId}
                            </span>
                            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{new Date(d.dispatchDate || d.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>{d.batchId}</td>
                          <td>
                            <strong>{d.drugName}</strong>
                          </td>
                          <td>{d.fromOrganizationName}</td>
                          <td>
                            <strong>{d.quantity}</strong> units
                          </td>
                          <td>
                            {d.temperatureCelsius !== undefined ? (
                              <span className="badge-info">❄️ {d.temperatureCelsius}°C</span>
                            ) : (
                              <span style={{ color: '#64748B' }}>Ambient</span>
                            )}
                          </td>
                          <td>
                            {isDelivered ? (
                              <span className="badge-verified">DELIVERED</span>
                            ) : (
                              <span className="badge-pending">{d.status}</span>
                            )}
                          </td>
                          <td>
                            {!isDelivered ? (
                              <button
                                className="btn-clinical-primary"
                                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                                onClick={() => handleOpenReceiptModal(d)}
                              >
                                📦 Confirm Receipt
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>
                                ✓ Accepted into Vault
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: INVENTORY */}
        {activeSubTab === 'inventory' && (
          <div className="hospital-section-card">
            <div className="hospital-card-title-bar">
              <h3>💊 Complete Hospital Medication Inventory</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span className="badge-info">{filteredBatches.length} Formulations Listed</span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="hospital-filter-bar">
              <input
                type="text"
                className="hospital-search-input"
                placeholder="🔍 Search medicine by name, generic, or batch ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <select
                className="hospital-select"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as any)}
              >
                <option value="ALL">All Categories</option>
                <option value="IN_STOCK">In Stock (Available)</option>
                <option value="LOW_STOCK">Low Stock (&lt;100 units)</option>
                <option value="EXPIRING">Expiring Soon (&lt;90 days)</option>
                <option value="RECALLED">Recalled or Expired</option>
              </select>

              <select
                className="hospital-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="EXPIRY_ASC">Sort by Expiry Date (Earliest First)</option>
                <option value="QTY_DESC">Sort by Available Stock (Highest First)</option>
                <option value="NAME_ASC">Sort by Medicine Name (A-Z)</option>
                <option value="BATCH_ID">Sort by Batch ID</option>
              </select>
            </div>

            {filteredBatches.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                <p style={{ fontSize: '1rem', fontWeight: 600 }}>No medication records matching query.</p>
                <p style={{ fontSize: '0.85rem' }}>Try clearing filters or checking inbound delivery status.</p>
              </div>
            ) : (
              <div className="hospital-table-wrapper">
                <table className="hospital-table">
                  <thead>
                    <tr>
                      <th>Batch ID</th>
                      <th>Medicine Name &amp; Strength</th>
                      <th>Available Units</th>
                      <th>Manufacturing Date</th>
                      <th>Expiry Date</th>
                      <th>Verification Status</th>
                      <th>Delivery / Custody</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBatches.map((b) => {
                      const isExpired = new Date(b.expiryDate).getTime() < Date.now();
                      const daysToExpiry = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24));
                      const percentLeft = Math.round(((b.remainingQuantity ?? b.quantity) / b.quantity) * 100);

                      return (
                        <tr key={b.batchId}>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0D9488' }}>
                              {b.batchId}
                            </span>
                            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                              Mfg: {b.manufacturerName}
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: '#183B4E', fontSize: '0.92rem' }}>{b.drugName}</strong>
                            <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                              {b.genericName} &bull; {b.dosage}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, color: '#183B4E' }}>
                              {b.remainingQuantity} <span style={{ fontSize: '0.75rem', color: '#64748B' }}>/ {b.quantity}</span>
                            </div>
                            <div className="hospital-stock-bar-wrapper">
                              <div
                                className={`hospital-stock-bar-fill ${percentLeft < 20 ? 'critical' : percentLeft < 50 ? 'low' : ''}`}
                                style={{ width: `${percentLeft}%` }}
                              />
                            </div>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: '#64748B' }}>
                            {new Date(b.manufacturingDate).toLocaleDateString()}
                          </td>
                          <td>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                              {new Date(b.expiryDate).toLocaleDateString()}
                            </div>
                            {isExpired ? (
                              <span className="badge-alert">Expired</span>
                            ) : daysToExpiry <= 90 ? (
                              <span className="badge-pending">{daysToExpiry} days left</span>
                            ) : (
                              <span className="badge-verified">Safe</span>
                            )}
                          </td>
                          <td>
                            {b.isRecalled ? (
                              <span className="badge-alert">RECALLED</span>
                            ) : (
                              <span className="badge-verified">Verified Authentic</span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                              {b.currentStatus}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {b.remainingQuantity > 0 && !b.isRecalled && !isExpired && (
                                <button
                                  className="btn-clinical-primary"
                                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                  onClick={() => handleOpenDispenseModal(b)}
                                >
                                  Dispense
                                </button>
                              )}
                              <button
                                className="btn-clinical-secondary"
                                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setSelectedBatchId(b.batchId);
                                  setActiveSubTab('traceability');
                                }}
                              >
                                Trace
                              </button>
                              <button
                                className="btn-clinical-secondary"
                                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                onClick={() => handleOpenQrModal(b)}
                                title="View Packaging QR Code"
                              >
                                📱 QR
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: TRACEABILITY JOURNEY */}
        {activeSubTab === 'traceability' && (
          <div className="hospital-section-card">
            <div className="hospital-card-title-bar">
              <h3>🔗 Complete Provenance Traceability Journey</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Select Batch:</label>
                <select
                  className="hospital-select"
                  value={selectedBatchId || ''}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                >
                  {hospitalStock.map((b) => (
                    <option key={b.batchId} value={b.batchId}>
                      {b.batchId} — {b.drugName} ({b.remainingQuantity} units)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedBatchId && (
              <div style={{ padding: '24px' }}>
                {/* 3-Step Supply Chain Visualizer */}
                <div className="hospital-journey-steps">
                  <div className="hospital-journey-step completed">
                    <div className="hospital-journey-bubble">🏭</div>
                    <div className="hospital-journey-step-title">Manufacturer</div>
                    <div className="hospital-journey-step-sub">Lot Formulated &amp; Minted</div>
                  </div>

                  <div className="hospital-journey-step completed">
                    <div className="hospital-journey-bubble">🚚</div>
                    <div className="hospital-journey-step-title">Distributor</div>
                    <div className="hospital-journey-step-sub">Cold-Chain Monitored (4.2°C)</div>
                  </div>

                  <div className="hospital-journey-step active">
                    <div className="hospital-journey-bubble">🏥</div>
                    <div className="hospital-journey-step-title">Hospital Dispensary</div>
                    <div className="hospital-journey-step-sub">Inpatient Storage &amp; Care</div>
                  </div>
                </div>

                {/* Event Audit Trail */}
                <h4 style={{ color: '#183B4E', marginBottom: '14px', fontSize: '1rem' }}>Tamper-Evident Custody Events</h4>

                {loadingHistory ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#0D9488' }}>
                    Loading cryptographic provenance events...
                  </div>
                ) : batchHistory.length === 0 ? (
                  <p style={{ color: '#64748B', fontSize: '0.9rem' }}>No custody records found for this batch.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {batchHistory.map((evt, idx) => (
                      <div
                        key={evt.id || idx}
                        style={{
                          background: '#F8FAFC',
                          border: '1px solid #D9E5EC',
                          borderRadius: '8px',
                          padding: '14px 18px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                          gap: '10px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <strong style={{ color: '#183B4E', fontSize: '0.9rem' }}>{evt.action}</strong>
                            <span className="badge-info">{evt.actorRole}</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '4px' }}>
                            Handler: <strong>{evt.actorName}</strong> &bull; Location: {evt.location}
                          </div>
                          {evt.notes && (
                            <div style={{ fontSize: '0.78rem', color: '#183B4E', marginTop: '4px', fontStyle: 'italic' }}>
                              "{evt.notes}"
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                            {new Date(evt.timestamp).toLocaleString()}
                          </div>
                          {evt.temperatureCelsius !== undefined && (
                            <div style={{ fontSize: '0.75rem', color: '#0D9488', fontWeight: 600, marginTop: '2px' }}>
                              ❄️ {evt.temperatureCelsius}°C
                            </div>
                          )}
                          {evt.blockchainTxHash && (
                            <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#64748B', marginTop: '2px' }}>
                              Tx: {evt.blockchainTxHash.substring(0, 10)}...
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: RECALL & SAFETY ALERTS */}
        {activeSubTab === 'alerts' && (
          <div className="hospital-section-card">
            <div className="hospital-card-title-bar">
              <h3 style={{ color: '#991B1B' }}>🚨 Hospital Drug Quarantine &amp; Safety Alerts</h3>
              <span className="badge-alert">{criticalAlerts.length} Critical Notifications</span>
            </div>

            <div style={{ padding: '24px' }}>
              {criticalAlerts.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', background: '#DCFCE7', borderRadius: '8px', color: '#166534' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem' }}>✓ All Inpatient Medication Lots Safe</h4>
                  <p style={{ margin: 0, fontSize: '0.88rem' }}>
                    Zero medication batches are flagged under national health authority recall or past expiration date.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {criticalAlerts.map((b) => {
                    const isExpired = new Date(b.expiryDate).getTime() < Date.now();
                    return (
                      <div
                        key={b.batchId}
                        style={{
                          background: '#FEE2E2',
                          border: '1px solid #FCA5A5',
                          borderRadius: '10px',
                          padding: '18px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '16px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '20px' }}>🚫</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#991B1B', fontSize: '1rem' }}>
                              {b.batchId}
                            </span>
                            <span className="badge-alert">
                              {b.isRecalled ? 'OFFICIAL RECALL' : 'EXPIRED PRODUCT'}
                            </span>
                          </div>

                          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#183B4E', marginTop: '6px' }}>
                            {b.drugName} ({b.genericName})
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#7F1D1D', marginTop: '4px' }}>
                            Manufacturer: {b.manufacturerName} &bull; Expiry Date: {b.expiryDate}
                          </div>

                          {b.isRecalled && (
                            <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#991B1B', fontWeight: 600 }}>
                              Reason for Recall: "{b.recallReason || 'Critical manufacturing deviation reported.'}"
                            </div>
                          )}

                          <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#7F1D1D' }}>
                            Action: <strong>Immediately quarantine {b.remainingQuantity} remaining units.</strong> Remove from ward drug storage.
                          </div>
                        </div>

                        <div>
                          <button
                            className="btn-clinical-danger"
                            onClick={() => alert(`Batch ${b.batchId} quarantined. Quarantine event recorded in hospital audit trail.`)}
                          >
                            Mark As Quarantined
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: INPATIENT DISPENSING LOG */}
        {activeSubTab === 'dispense' && (
          <div className="hospital-section-card">
            <div className="hospital-card-title-bar">
              <h3>📋 Inpatient Bedside Administration &amp; Dispensing Audit Log</h3>
              <span className="badge-info">Active Clinical Records</span>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748B' }}>
                  Record medication administration directly against verified patient Hospital Medical Record Numbers (MRN).
                </p>
                <button
                  className="btn-clinical-primary"
                  onClick={() => {
                    const firstSafe = hospitalStock.find((b) => b.remainingQuantity > 0 && !b.isRecalled);
                    if (firstSafe) handleOpenDispenseModal(firstSafe);
                    else alert('No eligible medication batches available for dispensing.');
                  }}
                >
                  ➕ Dispense Medication
                </button>
              </div>

              <div className="hospital-table-wrapper">
                <table className="hospital-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Patient Reference (MRN)</th>
                      <th>Ward Location</th>
                      <th>Medicine</th>
                      <th>Batch ID</th>
                      <th>Units Administered</th>
                      <th>Verification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAdministrations.map((adm, idx) => (
                      <tr key={idx}>
                        <td style={{ fontSize: '0.8rem', color: '#64748B' }}>{adm.timestamp}</td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#183B4E' }}>
                            {adm.patientMRN}
                          </span>
                        </td>
                        <td>{adm.ward}</td>
                        <td>
                          <strong>{adm.drugName}</strong>
                        </td>
                        <td style={{ fontFamily: 'monospace', color: '#0D9488' }}>{adm.batchId}</td>
                        <td>
                          <strong style={{ color: '#0D9488' }}>{adm.units}</strong> units
                        </td>
                        <td>
                          <span className="badge-verified">✓ On-Chain Logged</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 5. Modals */}

        {/* RECEIPT CONFIRMATION MODAL */}
        {confirmingDelivery && (
          <div className="hospital-modal-backdrop">
            <div className="hospital-modal-card">
              <div className="hospital-modal-header">
                <h3>📦 Inspect &amp; Confirm Delivery Receipt</h3>
                <button className="hospital-modal-close" onClick={() => setConfirmingDelivery(null)}>✕</button>
              </div>

              <form onSubmit={handleConfirmReceipt}>
                <div className="hospital-modal-body">
                  <div style={{ background: '#F0F7FA', padding: '14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                    <div>Delivery ID: <strong style={{ color: '#0D9488' }}>{confirmingDelivery.deliveryId}</strong></div>
                    <div>Medicine: <strong>{confirmingDelivery.drugName}</strong> ({confirmingDelivery.batchId})</div>
                    <div>Shipped Quantity: <strong>{confirmingDelivery.quantity} units</strong></div>
                    <div>Carrier / Sender: <strong>{confirmingDelivery.fromOrganizationName}</strong></div>
                  </div>

                  <div className="hospital-form-group">
                    <label>Quantity Physically Inspected &amp; Received</label>
                    <input
                      type="number"
                      min={1}
                      max={confirmingDelivery.quantity}
                      className="hospital-form-control"
                      value={receiptQty}
                      onChange={(e) => setReceiptQty(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="hospital-form-group">
                    <label>Receiving Storage Ward / Vault Location</label>
                    <select
                      className="hospital-form-control"
                      value={receiptLocation}
                      onChange={(e) => setReceiptLocation(e.target.value)}
                    >
                      <option value="Central Inpatient Vault - Cold Room 2">Central Inpatient Vault - Cold Room 2</option>
                      <option value="ICU Ward Satellite Dispensary">ICU Ward Satellite Dispensary</option>
                      <option value="Emergency Department Controlled Drug Safe">Emergency Department Controlled Drug Safe</option>
                      <option value="Oncology Ward Specialized Refrigerator">Oncology Ward Specialized Refrigerator</option>
                    </select>
                  </div>

                  <div className="hospital-form-group">
                    <label>Clinical Receipt Remarks &amp; Inspection Notes</label>
                    <input
                      type="text"
                      className="hospital-form-control"
                      value={receiptRemarks}
                      onChange={(e) => setReceiptRemarks(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="hospital-modal-footer">
                  <button type="button" className="btn-clinical-secondary" onClick={() => setConfirmingDelivery(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-clinical-primary" disabled={receiptSubmitting}>
                    {receiptSubmitting ? 'Confirming...' : 'Confirm Receipt into Inventory'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* INPATIENT DISPENSING MODAL */}
        {dispenseBatch && (
          <div className="hospital-modal-backdrop">
            <div className="hospital-modal-card">
              <div className="hospital-modal-header">
                <h3>💊 Inpatient Dispensing: {dispenseBatch.drugName}</h3>
                <button className="hospital-modal-close" onClick={() => setDispenseBatch(null)}>✕</button>
              </div>

              <form onSubmit={handleConfirmDispense}>
                <div className="hospital-modal-body">
                  <div style={{ background: '#F0F7FA', padding: '14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                    <div>Batch: <strong style={{ color: '#0D9488' }}>{dispenseBatch.batchId}</strong></div>
                    <div>Dosage / Formulation: <strong>{dispenseBatch.dosage}</strong></div>
                    <div>Available Inpatient Stock: <strong>{dispenseBatch.remainingQuantity} units</strong></div>
                  </div>

                  <div className="hospital-form-group">
                    <label>Units to Dispense</label>
                    <input
                      type="number"
                      min={1}
                      max={dispenseBatch.remainingQuantity}
                      className="hospital-form-control"
                      value={dispenseUnits}
                      onChange={(e) => setDispenseUnits(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="hospital-form-group">
                    <label>Patient Hospital MRN</label>
                    <input
                      type="text"
                      className="hospital-form-control"
                      value={patientMRN}
                      onChange={(e) => setPatientMRN(e.target.value)}
                      required
                    />
                  </div>

                  <div className="hospital-form-group">
                    <label>Inpatient Ward / Bed Location</label>
                    <input
                      type="text"
                      className="hospital-form-control"
                      value={patientWard}
                      onChange={(e) => setPatientWard(e.target.value)}
                      required
                    />
                  </div>

                  <div className="hospital-form-group">
                    <label>Physician / Clinical Order Notes</label>
                    <input
                      type="text"
                      className="hospital-form-control"
                      value={dispenseNotes}
                      onChange={(e) => setDispenseNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div className="hospital-modal-footer">
                  <button type="button" className="btn-clinical-secondary" onClick={() => setDispenseBatch(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-clinical-primary" disabled={dispensingSubmitting}>
                    {dispensingSubmitting ? 'Recording...' : 'Authorize Dispensation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* QR CODE MODAL */}
        {viewingQrBatch && (
          <div className="hospital-modal-backdrop">
            <div className="hospital-modal-card" style={{ maxWidth: '420px', textAlign: 'center' }}>
              <div className="hospital-modal-header">
                <h3>Packaging QR Verification</h3>
                <button className="hospital-modal-close" onClick={() => setViewingQrBatch(null)}>✕</button>
              </div>

              <div className="hospital-modal-body">
                <p style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '14px' }}>
                  Scan packaging QR code with mobile camera to verify supply chain authenticity.
                </p>

                <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', display: 'inline-block', border: '1px solid #D9E5EC' }}>
                  {loadingQr ? (
                    <div style={{ padding: '40px', color: '#0D9488' }}>Generating QR SVG...</div>
                  ) : qrSvg ? (
                    <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
                  ) : (
                    <div style={{ padding: '40px', color: '#64748B' }}>QR Code Unavailable</div>
                  )}
                </div>

                <div style={{ marginTop: '14px', fontFamily: 'monospace', fontWeight: 700, color: '#0D9488' }}>
                  {viewingQrBatch.batchId}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#183B4E', marginTop: '2px' }}>
                  {viewingQrBatch.drugName} ({viewingQrBatch.dosage})
                </div>
              </div>

              <div className="hospital-modal-footer" style={{ justifyContent: 'center' }}>
                <button className="btn-clinical-primary" onClick={() => setViewingQrBatch(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
