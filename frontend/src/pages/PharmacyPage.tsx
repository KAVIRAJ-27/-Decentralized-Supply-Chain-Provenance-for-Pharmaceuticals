import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { MedicineBatch, UserSession, Delivery, CustodyEvent } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { QrModal } from '../components/QrModal';
import { Timeline } from '../components/Timeline';

interface Props {
  session: UserSession | null;
  onOpenLogin: () => void;
}

type PharmacySubTab = 'inventory' | 'deliveries' | 'history' | 'traceability';

export const PharmacyPage: React.FC<Props> = ({ session, onOpenLogin }) => {
  const [activeTab, setActiveTab] = useState<PharmacySubTab>('inventory');
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [inboundDeliveries, setInboundDeliveries] = useState<Delivery[]>([]);
  const [allDeliveries, setAllDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'EXPIRING' | 'RECALLED'>('ALL');
  const [sortBy, setSortBy] = useState<'EXPIRY_ASC' | 'QTY_DESC' | 'NAME_ASC' | 'BATCH_ID'>('EXPIRY_ASC');

  // Receipt confirmation modal state
  const [confirmDelivery, setConfirmDelivery] = useState<Delivery | null>(null);
  const [receiptQty, setReceiptQty] = useState<number>(0);
  const [hasDiscrepancy, setHasDiscrepancy] = useState(false);
  const [discrepancyReason, setDiscrepancyReason] = useState('DAMAGED_PACKAGING');
  const [discrepancyNotes, setDiscrepancyNotes] = useState('');
  const [receiptLocation, setReceiptLocation] = useState('Main Pharmacy Dispensary Vault');
  const [receiptTemp, setReceiptTemp] = useState<number>(20.5);
  const [receiptRemarks, setReceiptRemarks] = useState('Packaging intact, tamper seals verified, cold chain compliant');
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);

  // Dispense modal state
  const [dispenseBatch, setDispenseBatch] = useState<MedicineBatch | null>(null);
  const [dispenseQty, setDispenseQty] = useState<number>(10);
  const [rxReference, setRxReference] = useState('RX-2026-');
  const [dispenseNotes, setDispenseNotes] = useState('Prescription filled for outpatient dispensary patient');
  const [dispenseSubmitting, setDispenseSubmitting] = useState(false);

  // Provenance / Traceability modal state
  const [selectedBatchForAudit, setSelectedBatchForAudit] = useState<MedicineBatch | null>(null);
  const [auditHistory, setAuditHistory] = useState<CustodyEvent[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // QR Modal inspection state
  const [selectedBatchForQr, setSelectedBatchForQr] = useState<MedicineBatch | null>(null);

  // Local dispensary transaction log for session history
  const [dispenseHistory, setDispenseHistory] = useState<Array<{
    batchId: string;
    drugName: string;
    quantity: number;
    rxRef: string;
    timestamp: string;
    notes: string;
  }>>([]);

  const loadData = async () => {
    if (!session?.token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [batchList, deliveryList] = await Promise.all([
        api.getBatches(session.token).catch(() => []),
        api.getDeliveries(session.token, { direction: 'inbound' }).catch(() => []),
      ]);
      setBatches(batchList);
      setAllDeliveries(deliveryList);
      setInboundDeliveries(deliveryList.filter((d) => d.status === 'IN_TRANSIT' || d.status === 'PENDING'));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load pharmacy dispensary data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session]);

  // Derived stock
  const pharmacyStock = useMemo(() => {
    return batches.filter(
      (b) =>
        b.currentStatus === 'RECEIVED_BY_PHARMACY' ||
        b.currentStatus === 'DISPENSED' ||
        b.currentOwnerRole === 'PHARMACY' ||
        (session?.user?.organizationName && b.currentOwnerName === session.user.organizationName)
    );
  }, [batches, session]);

  // Metric counts
  const totalStockUnits = useMemo(() => {
    return pharmacyStock.reduce((acc, b) => acc + (b.remainingQuantity || 0), 0);
  }, [pharmacyStock]);

  const lowStockCount = useMemo(() => {
    return pharmacyStock.filter((b) => b.remainingQuantity > 0 && b.remainingQuantity <= 100).length;
  }, [pharmacyStock]);

  const recalledCount = useMemo(() => {
    return pharmacyStock.filter((b) => b.isRecalled).length;
  }, [pharmacyStock]);

  const expiredCount = useMemo(() => {
    const now = Date.now();
    return pharmacyStock.filter((b) => new Date(b.expiryDate).getTime() < now).length;
  }, [pharmacyStock]);

  // Filtered & Sorted stock
  const filteredStock = useMemo(() => {
    return pharmacyStock
      .filter((b) => {
        // Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchId = b.batchId.toLowerCase().includes(q);
          const matchDrug = b.drugName.toLowerCase().includes(q);
          const matchGeneric = b.genericName?.toLowerCase().includes(q);
          const matchMfr = b.manufacturerName?.toLowerCase().includes(q);
          if (!matchId && !matchDrug && !matchGeneric && !matchMfr) return false;
        }

        // Category Filter
        const isExpired = new Date(b.expiryDate).getTime() < Date.now();
        if (filterCategory === 'IN_STOCK') return b.remainingQuantity > 0 && !b.isRecalled && !isExpired;
        if (filterCategory === 'LOW_STOCK') return b.remainingQuantity > 0 && b.remainingQuantity <= 100;
        if (filterCategory === 'EXPIRING') return isExpired || (new Date(b.expiryDate).getTime() - Date.now() < 30 * 24 * 3600 * 1000);
        if (filterCategory === 'RECALLED') return b.isRecalled;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'EXPIRY_ASC') return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        if (sortBy === 'QTY_DESC') return b.remainingQuantity - a.remainingQuantity;
        if (sortBy === 'NAME_ASC') return a.drugName.localeCompare(b.drugName);
        if (sortBy === 'BATCH_ID') return a.batchId.localeCompare(b.batchId);
        return 0;
      });
  }, [pharmacyStock, searchQuery, filterCategory, sortBy]);

  // Load audit history when a batch is clicked
  const handleOpenAuditModal = async (batch: MedicineBatch) => {
    if (!session?.token) return;
    setSelectedBatchForAudit(batch);
    setLoadingAudit(true);
    try {
      const details = await api.getBatchDetails(session.token, batch.batchId);
      setAuditHistory(details.history || []);
    } catch {
      try {
        const pub = await api.verifyBatch(batch.batchId);
        setAuditHistory((pub.provenanceHistory as any) || []);
      } catch {
        setAuditHistory([]);
      }
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleOpenConfirmModal = (delivery: Delivery) => {
    setConfirmDelivery(delivery);
    setReceiptQty(delivery.quantity);
    setHasDiscrepancy(false);
    setDiscrepancyReason('DAMAGED_PACKAGING');
    setDiscrepancyNotes('');
  };

  const handleConfirmReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !confirmDelivery) return;

    if (receiptQty <= 0 || receiptQty > confirmDelivery.quantity) {
      setErrorMsg(`Received quantity must be between 1 and dispatched quantity (${confirmDelivery.quantity}).`);
      return;
    }

    setReceiptSubmitting(true);
    setErrorMsg(null);
    try {
      const finalRemarks = hasDiscrepancy
        ? `${receiptRemarks} [DISCREPANCY: ${discrepancyReason} - ${discrepancyNotes || 'Reported on receipt'}]`
        : receiptRemarks;

      await api.confirmDeliveryReceipt(session.token, confirmDelivery.deliveryId, {
        receivedQuantity: Number(receiptQty),
        remarks: finalRemarks,
        location: receiptLocation,
        temperatureCelsius: Number(receiptTemp),
      });

      setSuccessMsg(`Delivery ${confirmDelivery.deliveryId} confirmed! ${receiptQty} units added to dispensary stock.`);
      setConfirmDelivery(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to confirm delivery receipt');
    } finally {
      setReceiptSubmitting(false);
    }
  };

  const handleOpenDispenseModal = (batch: MedicineBatch) => {
    setDispenseBatch(batch);
    setDispenseQty(Math.min(10, batch.remainingQuantity));
    setRxReference(`RX-${Date.now().toString().slice(-6)}`);
    setDispenseNotes('Dispensed to patient as prescribed');
  };

  const handleConfirmDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !dispenseBatch) return;

    if (dispenseQty <= 0 || dispenseQty > dispenseBatch.remainingQuantity) {
      setErrorMsg(`Dispense units must be between 1 and available stock (${dispenseBatch.remainingQuantity}).`);
      return;
    }

    setDispenseSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await api.dispense(session.token, dispenseBatch.batchId, {
        quantityToDispense: Number(dispenseQty),
        patientReference: rxReference,
        notes: dispenseNotes,
      });

      setDispenseHistory((prev) => [
        {
          batchId: dispenseBatch.batchId,
          drugName: dispenseBatch.drugName,
          quantity: Number(dispenseQty),
          rxRef: rxReference,
          timestamp: new Date().toLocaleTimeString(),
          notes: dispenseNotes,
        },
        ...prev,
      ]);

      setSuccessMsg(`Successfully dispensed ${dispenseQty} units of ${dispenseBatch.drugName}! Remaining stock: ${res.remainingQuantity}`);
      setDispenseBatch(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispense medicine');
    } finally {
      setDispenseSubmitting(false);
    }
  };

  if (!session) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', textAlign: 'center', padding: '32px' }} className="glass-panel">
        <h2 style={{ fontSize: '1.6rem', marginBottom: '12px' }}>Pharmacy Dispensary Portal</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          Please sign in with a registered Pharmacy account to manage dispensary stock, verify inbound batches, and record patient dispensing.
        </p>
        <button className="btn btn-primary" onClick={onOpenLogin}>
          Sign In as Pharmacy
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 16px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '2rem' }}>💊</span>
            <div>
              <h1 style={{ fontSize: '1.8rem', lineHeight: 1.2 }}>Pharmacy Dispensary Operations</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                {session.user.organizationName} &bull; Pharmacy License: <span className="mono">{session.user.licenseNumber || 'LIC-PHARM-2026'}</span>
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            {loading ? 'Refreshing...' : '🔄 Sync Dispensary'}
          </button>
        </div>
      </div>

      {/* Alert Notices */}
      {errorMsg && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '10px', color: '#f87171', marginBottom: '20px' }}>
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '10px', color: '#34d399', marginBottom: '20px' }}>
          ✅ {successMsg}
        </div>
      )}

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Dispensary Stock</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
            {totalStockUnits.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-dim)' }}>units</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Across {pharmacyStock.length} registered batches
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Inbound Deliveries</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>
            {inboundDeliveries.length} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-dim)' }}>pending</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Awaiting inspection &amp; confirmation
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Low Stock Warning</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: lowStockCount > 0 ? '#f59e0b' : '#94a3b8', marginTop: '4px' }}>
            {lowStockCount} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-dim)' }}>batches</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Remaining quantity &le; 100 units
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Recall &amp; Expired Alerts</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: recalledCount + expiredCount > 0 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
            {recalledCount + expiredCount} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-dim)' }}>alerts</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            {recalledCount} recalled, {expiredCount} expired
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Dispensary Vault Temp</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
            20.5°C
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
            ❄️ Storage climate verified
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'inventory' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'inventory' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          📦 Dispensary Stock ({filteredStock.length})
        </button>
        <button
          onClick={() => setActiveTab('deliveries')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'deliveries' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'deliveries' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          🚚 Inbound Deliveries
          {inboundDeliveries.length > 0 && (
            <span style={{ background: '#f59e0b', color: '#070a12', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
              {inboundDeliveries.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          📋 Receipt &amp; Dispense Logs
        </button>
      </div>

      {/* TAB 1: DISPENSARY STOCK */}
      {activeTab === 'inventory' && (
        <div>
          {/* Search, Filter Pills & Sorter Controls */}
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <input
                  type="text"
                  placeholder="🔍 Search by medicine name, batch ID, generic name..."
                  className="input-field"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Status Filter Buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(['ALL', 'IN_STOCK', 'LOW_STOCK', 'EXPIRING', 'RECALLED'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      background: filterCategory === cat ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                      color: filterCategory === cat ? '#070a12' : 'var(--text-main)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {cat.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {/* Sorter Dropdown */}
              <div>
                <select
                  className="select-field"
                  style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                >
                  <option value="EXPIRY_ASC">Sort: Expiry (Soonest First)</option>
                  <option value="QTY_DESC">Sort: Quantity (Highest First)</option>
                  <option value="NAME_ASC">Sort: Medicine Name (A-Z)</option>
                  <option value="BATCH_ID">Sort: Batch ID</option>
                </select>
              </div>
            </div>
          </div>

          {/* Stock Card Grid */}
          {filteredStock.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📦</div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No medicines found</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                {searchQuery || filterCategory !== 'ALL'
                  ? 'Try adjusting your search query or filter category.'
                  : 'Your dispensary inventory is empty. Confirm incoming deliveries to populate stock.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
              {filteredStock.map((b) => {
                const isExpired = new Date(b.expiryDate).getTime() < Date.now();
                const isLowStock = b.remainingQuantity > 0 && b.remainingQuantity <= 100;
                const isOutOfStock = b.remainingQuantity === 0;

                return (
                  <div
                    key={b.batchId}
                    className="glass-panel"
                    style={{
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: b.isRecalled
                        ? '1px solid #ef4444'
                        : isExpired
                        ? '1px solid #f59e0b'
                        : isLowStock
                        ? '1px solid rgba(245, 158, 11, 0.4)'
                        : '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      {/* Batch Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {b.batchId}
                          </div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '2px' }}>{b.drugName}</div>
                          {b.genericName && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                              ({b.genericName})
                            </div>
                          )}
                        </div>
                        <StatusBadge status={b.currentStatus} />
                      </div>

                      {/* Medicine Specifications */}
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', margin: '12px 0' }}>
                        <div>Dosage: <strong style={{ color: 'var(--text-main)' }}>{b.dosage}</strong></div>
                        <div>Manufacturer: <strong style={{ color: 'var(--text-main)' }}>{b.manufacturerName}</strong></div>
                        <div>Mfg Date: <span className="mono">{b.manufacturingDate}</span></div>
                        <div>Expiry Date: <span className="mono" style={{ color: isExpired ? '#f87171' : 'inherit' }}>{b.expiryDate}</span></div>
                      </div>

                      {/* Stock Level Bar */}
                      <div style={{ margin: '14px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                          <span>Dispensary Stock:</span>
                          <strong>
                            <span style={{ color: isOutOfStock ? '#ef4444' : isLowStock ? '#f59e0b' : '#10b981', fontSize: '1rem' }}>
                              {b.remainingQuantity}
                            </span>{' '}
                            / {b.quantity} units
                          </strong>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, (b.remainingQuantity / b.quantity) * 100)}%`,
                              height: '100%',
                              background: b.isRecalled
                                ? '#ef4444'
                                : isExpired
                                ? '#f59e0b'
                                : isLowStock
                                ? '#f59e0b'
                                : '#10b981',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>

                      {/* Safety Alerts */}
                      {b.isRecalled && (
                        <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#f87171', fontSize: '0.8rem', marginBottom: '12px' }}>
                          ⛔ <strong>CRITICAL RECALL:</strong> {b.recallReason || 'Do not dispense. Quarantine immediately.'}
                        </div>
                      )}

                      {isExpired && !b.isRecalled && (
                        <div style={{ padding: '8px 12px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', borderRadius: '8px', color: '#fbbf24', fontSize: '0.8rem', marginBottom: '12px' }}>
                          ⚠️ <strong>EXPIRED:</strong> Batch reached expiry on {b.expiryDate}. Dispensation prohibited.
                        </div>
                      )}

                      {isLowStock && !isExpired && !b.isRecalled && (
                        <div style={{ padding: '6px 10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', color: '#f59e0b', fontSize: '0.75rem', marginBottom: '12px' }}>
                          ⚡ <strong>LOW STOCK ALERT:</strong> Reorder recommended.
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                      <button
                        className="btn btn-primary"
                        style={{
                          flex: 1,
                          fontSize: '0.8rem',
                          background: isOutOfStock || b.isRecalled || isExpired
                            ? 'rgba(255,255,255,0.05)'
                            : 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
                          opacity: isOutOfStock || b.isRecalled || isExpired ? 0.5 : 1,
                          cursor: isOutOfStock || b.isRecalled || isExpired ? 'not-allowed' : 'pointer',
                        }}
                        disabled={isOutOfStock || b.isRecalled || isExpired}
                        onClick={() => handleOpenDispenseModal(b)}
                      >
                        💊 Dispense to Patient
                      </button>

                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                        title="View Packaging QR Code"
                        onClick={() => setSelectedBatchForQr(b)}
                      >
                        📱 QR
                      </button>

                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                        title="Inspect Supply Chain Timeline"
                        onClick={() => handleOpenAuditModal(b)}
                      >
                        🕒 Provenance
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INBOUND DELIVERIES */}
      {activeTab === 'deliveries' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>Incoming Shipments Awaiting Receipt</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                Verify incoming deliveries from authorized distributors and manufacturers. Confirming receipt adds the accepted quantity to dispensary inventory.
              </p>
            </div>
            <span className="badge badge-transit">{inboundDeliveries.length} En Route</span>
          </div>

          {inboundDeliveries.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🚚</div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No shipments currently in transit</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                All pending deliveries have been received and verified into dispensary stock.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {inboundDeliveries.map((delivery) => (
                <div key={delivery.deliveryId} className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="mono" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>
                          {delivery.deliveryId}
                        </span>
                        <span className="badge badge-transit">IN TRANSIT</span>
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '4px' }}>{delivery.drugName}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Batch ID: <span className="mono" style={{ color: 'var(--text-main)', fontWeight: 600 }}>{delivery.batchId}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#10b981' }}>
                        {delivery.quantity} units
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Dispatched Quantity</div>
                    </div>
                  </div>

                  {/* Delivery Route & Logistics Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', margin: '14px 0', border: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Sender / Dispatcher</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{delivery.fromOrganizationName}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Dispatch Date</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }} className="mono">
                        {new Date(delivery.dispatchDate).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Carrier / Transit Route</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{delivery.location}</div>
                    </div>
                    {delivery.temperatureCelsius !== undefined && (
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>In-Transit Temperature</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#38bdf8' }}>
                          ❄️ {delivery.temperatureCelsius}°C (Sensor OK)
                        </div>
                      </div>
                    )}
                  </div>

                  {delivery.notes && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '14px', fontStyle: 'italic' }}>
                      Logistics Notes: {delivery.notes}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary"
                      style={{
                        padding: '10px 20px',
                        background: 'linear-gradient(135deg, #0284c7 0%, #10b981 100%)',
                      }}
                      onClick={() => handleOpenConfirmModal(delivery)}
                    >
                      📦 Inspect &amp; Confirm Delivery Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RECEIPT & DISPENSE LOGS */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Confirmed Delivery Receipts */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>Audited Delivery Receipts</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Historical deliveries received and verified into this pharmacy's vault with non-repudiation timestamps.
            </p>

            {allDeliveries.filter((d) => d.status === 'DELIVERED').length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>No historical delivered shipments recorded yet.</p>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Delivery ID</th>
                      <th>Batch ID</th>
                      <th>Medicine</th>
                      <th>Dispatched Qty</th>
                      <th>Sender</th>
                      <th>Delivered Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDeliveries
                      .filter((d) => d.status === 'DELIVERED')
                      .map((d) => (
                        <tr key={d.deliveryId}>
                          <td className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{d.deliveryId}</td>
                          <td className="mono">{d.batchId}</td>
                          <td><strong>{d.drugName}</strong></td>
                          <td>{d.quantity} units</td>
                          <td>{d.fromOrganizationName}</td>
                          <td className="mono" style={{ fontSize: '0.8rem' }}>
                            {new Date(d.updatedAt || d.dispatchDate).toLocaleDateString()}
                          </td>
                          <td>
                            <span className="badge badge-received">DELIVERED</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Session Patient Dispensing Log */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>Patient Dispensing Log (Current Session)</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Medication dispenses fulfilled against valid doctor prescriptions.
            </p>

            {dispenseHistory.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                No patient dispenses performed in this session yet. Use "Dispense to Patient" in the Stock tab.
              </p>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Prescription Ref</th>
                      <th>Medicine</th>
                      <th>Batch ID</th>
                      <th>Units Dispensed</th>
                      <th>Clinical Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispenseHistory.map((item, idx) => (
                      <tr key={idx}>
                        <td className="mono" style={{ fontSize: '0.8rem' }}>{item.timestamp}</td>
                        <td className="mono" style={{ color: '#38bdf8', fontWeight: 600 }}>{item.rxRef}</td>
                        <td><strong>{item.drugName}</strong></td>
                        <td className="mono">{item.batchId}</td>
                        <td style={{ color: '#10b981', fontWeight: 700 }}>{item.quantity} units</td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM DELIVERY RECEIPT MODAL */}
      {confirmDelivery && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div className="glass-panel" style={{ maxWidth: '520px', width: '100%', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.3rem' }}>Inspect &amp; Confirm Delivery Receipt</h3>
              <button
                onClick={() => setConfirmDelivery(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', marginBottom: '18px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Shipment Reference:</div>
              <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)' }}>
                {confirmDelivery.deliveryId}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '6px' }}>{confirmDelivery.drugName}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Batch: <span className="mono">{confirmDelivery.batchId}</span> &bull; Dispatched: <strong>{confirmDelivery.quantity} units</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                From: {confirmDelivery.fromOrganizationName}
              </div>
            </div>

            <form onSubmit={handleConfirmReceipt} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Accepted Quantity (Units)
                </label>
                <input
                  type="number"
                  min={1}
                  max={confirmDelivery.quantity}
                  className="input-field"
                  value={receiptQty}
                  onChange={(e) => setReceiptQty(Number(e.target.value))}
                  required
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Max allowed: {confirmDelivery.quantity} units
                </div>
              </div>

              {/* Discrepancy Recording Checkbox */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={hasDiscrepancy}
                    onChange={(e) => setHasDiscrepancy(e.target.checked)}
                  />
                  <span>Report Shipment Discrepancy (Damaged/Missing/Temp Excursion)</span>
                </label>

                {hasDiscrepancy && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <select
                      className="select-field"
                      value={discrepancyReason}
                      onChange={(e) => setDiscrepancyReason(e.target.value)}
                    >
                      <option value="DAMAGED_PACKAGING">Damaged Outer Packaging</option>
                      <option value="QUANTITY_SHORTFALL">Quantity Shortfall / Units Missing</option>
                      <option value="TEMPERATURE_EXCURSION">Cold Chain Temperature Deviation</option>
                      <option value="TAMPER_SEAL_BROKEN">Broken Tamper Evident Seal</option>
                    </select>

                    <input
                      type="text"
                      className="input-field"
                      placeholder="Discrepancy description for regulatory audit..."
                      value={discrepancyNotes}
                      onChange={(e) => setDiscrepancyNotes(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Storage Location Vault
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={receiptLocation}
                  onChange={(e) => setReceiptLocation(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Inspected Temp (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    value={receiptTemp}
                    onChange={(e) => setReceiptTemp(Number(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Tamper Verification
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value="PASSED"
                    readOnly
                    style={{ opacity: 0.8 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Inspection Remarks
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={receiptRemarks}
                  onChange={(e) => setReceiptRemarks(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={receiptSubmitting}
                >
                  {receiptSubmitting ? 'Confirming...' : '✅ Confirm Receipt & Add to Stock'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setConfirmDelivery(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISPENSE MEDICATION MODAL */}
      {dispenseBatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.3rem' }}>Dispense to Patient</h3>
              <button
                onClick={() => setDispenseBatch(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{dispenseBatch.drugName}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Batch: <span className="mono">{dispenseBatch.batchId}</span> &bull; Available: <strong>{dispenseBatch.remainingQuantity} units</strong>
              </div>
            </div>

            <form onSubmit={handleConfirmDispense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Units to Dispense
                </label>
                <input
                  type="number"
                  min={1}
                  max={dispenseBatch.remainingQuantity}
                  className="input-field"
                  value={dispenseQty}
                  onChange={(e) => setDispenseQty(Number(e.target.value))}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Prescription / Patient Reference ID
                </label>
                <input
                  type="text"
                  className="input-field mono"
                  placeholder="e.g. RX-2026-99214"
                  value={rxReference}
                  onChange={(e) => setRxReference(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Clinical Dispensing Notes
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Dosage instructions, patient consultation..."
                  value={dispenseNotes}
                  onChange={(e) => setDispenseNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
                  }}
                  disabled={dispenseSubmitting}
                >
                  {dispenseSubmitting ? 'Dispensing...' : '💊 Confirm Dispensation'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setDispenseBatch(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROVENANCE TIMELINE AUDIT MODAL */}
      {selectedBatchForAudit && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div className="glass-panel" style={{ maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem' }}>Supply Chain Provenance Audit</h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  Custody trail: Manufacturer &rarr; Distributor &rarr; Pharmacy
                </p>
              </div>
              <button
                onClick={() => setSelectedBatchForAudit(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedBatchForAudit.drugName}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Batch ID: <span className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{selectedBatchForAudit.batchId}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Manufacturer: {selectedBatchForAudit.manufacturerName} &bull; Expiry: {selectedBatchForAudit.expiryDate}
              </div>
            </div>

            {loadingAudit ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                Loading custody timeline from cryptographic ledger...
              </div>
            ) : (
              <Timeline events={auditHistory} />
            )}

            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '20px' }}
              onClick={() => setSelectedBatchForAudit(null)}
            >
              Close Provenance Audit
            </button>
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {selectedBatchForQr && (
        <QrModal
          batch={selectedBatchForQr}
          onClose={() => setSelectedBatchForQr(null)}
          token={session.token}
        />
      )}
    </div>
  );
};
