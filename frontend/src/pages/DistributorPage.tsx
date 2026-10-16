import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { MedicineBatch, UserSession, Delivery, Organization, CustodyEvent } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { QrModal } from '../components/QrModal';
import { Timeline } from '../components/Timeline';

interface Props {
  session: UserSession | null;
  onOpenLogin: () => void;
}

type DistributorSubTab = 'inventory' | 'inbound' | 'outbound' | 'traceability';

export const DistributorPage: React.FC<Props> = ({ session, onOpenLogin }) => {
  const [activeSubTab, setActiveSubTab] = useState<DistributorSubTab>('inventory');
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [pharmacies, setPharmacies] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'EXPIRING' | 'RECALLED'>('ALL');
  const [sortBy, setSortBy] = useState<'EXPIRY_ASC' | 'QTY_DESC' | 'NAME_ASC' | 'BATCH_ID'>('EXPIRY_ASC');

  // Warehouse sensors & intake presets
  const [warehouseLocation, setWarehouseLocation] = useState('Global Logistics Hub Vault 3');
  const [tempReading, setTempReading] = useState(4.2);
  const [transferNotes, setTransferNotes] = useState('Inspected container seals; cold chain sensor logs verified');

  // Dispatch modal state
  const [dispatchBatch, setDispatchBatch] = useState<MedicineBatch | null>(null);
  const [targetOrgId, setTargetOrgId] = useState('');
  const [dispatchQty, setDispatchQty] = useState<number>(100);
  const [dispatchLocation, setDispatchLocation] = useState('Refrigerated Transport Fleet #18');
  const [dispatchNotes, setDispatchNotes] = useState('Cold chain transport dispatched');
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);

  // Provenance audit inspection modal
  const [selectedBatchForAudit, setSelectedBatchForAudit] = useState<MedicineBatch | null>(null);
  const [auditHistory, setAuditHistory] = useState<CustodyEvent[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // QR Modal inspection
  const [selectedBatchForQr, setSelectedBatchForQr] = useState<MedicineBatch | null>(null);

  const loadData = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [batchList, deliveryList, orgs] = await Promise.all([
        api.getBatches(session.token).catch(() => []),
        api.getDeliveries(session.token).catch(() => []),
        api.getOrganizations(session.token).catch(() => []),
      ]);
      setBatches(batchList);
      setDeliveries(deliveryList);
      const recipientCandidates = orgs.filter(
        (o) => (o.type === 'PHARMACY' || o.type === 'HOSPITAL') && o.status === 'ACTIVE'
      );
      setPharmacies(recipientCandidates);
      if (recipientCandidates.length > 0 && !targetOrgId) {
        setTargetOrgId(recipientCandidates[0].organizationId);
      }
    } catch (err: any) {
      console.error('Error loading distributor data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session]);

  const handleReceiveShipment = async (batchId: string) => {
    if (!session) return;
    try {
      await api.updateStatus(session.token, batchId, {
        newStatus: 'RECEIVED_BY_DISTRIBUTOR',
        location: warehouseLocation,
        temperatureCelsius: Number(tempReading),
        notes: `Shipment received and verified at ${warehouseLocation}. ${transferNotes}`,
      });
      alert(`Batch ${batchId} custody successfully confirmed at distributor warehouse!`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update custody');
    }
  };

  const handleConfirmInboundDelivery = async (deliveryId: string, quantity: number) => {
    if (!session) return;
    try {
      await api.confirmDeliveryReceipt(session.token, deliveryId, {
        receivedQuantity: quantity,
        location: warehouseLocation,
        temperatureCelsius: Number(tempReading),
        remarks: `Confirmed intake at ${warehouseLocation}. ${transferNotes}`,
      });
      alert(`Delivery ${deliveryId} successfully received and verified into distributor stock!`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm delivery receipt');
    }
  };

  const handleOpenDispatchModal = (batch: MedicineBatch) => {
    setDispatchBatch(batch);
    setDispatchQty(Math.min(batch.remainingQuantity, 500));
  };

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !dispatchBatch) return;

    if (!targetOrgId) {
      alert('Please select a destination Pharmacy or Hospital');
      return;
    }

    if (dispatchQty <= 0 || dispatchQty > dispatchBatch.remainingQuantity) {
      alert(`Dispatch quantity must be between 1 and ${dispatchBatch.remainingQuantity}`);
      return;
    }

    setDispatchSubmitting(true);
    try {
      const res = await api.createDelivery(session.token, {
        batchId: dispatchBatch.batchId,
        toOrganizationId: targetOrgId,
        quantity: Number(dispatchQty),
        location: dispatchLocation,
        temperatureCelsius: Number(tempReading),
        notes: dispatchNotes,
      });

      alert(`Delivery ${res.delivery.deliveryId} created! Dispatched ${dispatchQty} units.`);
      setDispatchBatch(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create dispatch delivery');
    } finally {
      setDispatchSubmitting(false);
    }
  };

  const handleCancelDelivery = async (deliveryId: string) => {
    if (!session) return;
    if (!window.confirm(`Are you sure you want to cancel delivery ${deliveryId}? Allocated stock will be restored to warehouse inventory.`)) {
      return;
    }
    try {
      await api.cancelDelivery(session.token, deliveryId);
      alert(`Delivery ${deliveryId} has been cancelled and stock restored.`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel delivery');
    }
  };

  const handleOpenAudit = async (batch: MedicineBatch) => {
    setSelectedBatchForAudit(batch);
    setLoadingAudit(true);
    try {
      if (session?.token) {
        const details = await api.getBatchDetails(session.token, batch.batchId);
        setAuditHistory(details.history || []);
      }
    } catch (err) {
      console.error('Failed to load audit history', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  if (!session) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', textAlign: 'center', padding: '32px' }} className="glass-panel">
        <h2 style={{ fontSize: '1.6rem', marginBottom: '12px' }}>Distributor Operations Portal</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          Please sign in with a verified Distributor account to manage inbound cold chain shipments and dispatches.
        </p>
        <button className="btn btn-primary" onClick={onOpenLogin}>
          Sign In as Distributor
        </button>
      </div>
    );
  }

  // Segment batches and deliveries
  const inboundDeliveries = deliveries.filter(
    (d) => d.toOrganizationId === session.user.organizationId && d.status === 'IN_TRANSIT'
  );
  const outboundDeliveries = deliveries.filter(
    (d) => d.fromOrganizationId === session.user.organizationId
  );
  const inboundBatches = batches.filter((b) => b.currentStatus === 'IN_TRANSIT_TO_DISTRIBUTOR');
  const warehouseBatches = batches.filter((b) => b.currentStatus === 'RECEIVED_BY_DISTRIBUTOR');

  // KPI calculations
  const totalStockUnits = warehouseBatches.reduce((acc, b) => acc + (b.remainingQuantity || 0), 0);
  const totalInboundCount = inboundDeliveries.length + inboundBatches.length;
  const recalledBatchesCount = batches.filter((b) => b.isRecalled).length;

  // Filtered warehouse stock
  const filteredBatches = useMemo(() => {
    let result = [...warehouseBatches];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.batchId.toLowerCase().includes(q) ||
          b.drugName.toLowerCase().includes(q) ||
          (b.genericName && b.genericName.toLowerCase().includes(q)) ||
          b.manufacturerName.toLowerCase().includes(q)
      );
    }

    if (filterCategory === 'IN_STOCK') {
      result = result.filter((b) => b.remainingQuantity > 0 && !b.isRecalled);
    } else if (filterCategory === 'LOW_STOCK') {
      result = result.filter((b) => b.remainingQuantity > 0 && b.remainingQuantity < 100);
    } else if (filterCategory === 'EXPIRING') {
      const sixMonthsFromNow = Date.now() + 1000 * 60 * 60 * 24 * 180;
      result = result.filter(
        (b) => new Date(b.expiryDate).getTime() < sixMonthsFromNow && new Date(b.expiryDate).getTime() > Date.now()
      );
    } else if (filterCategory === 'RECALLED') {
      result = result.filter((b) => b.isRecalled);
    }

    result.sort((a, b) => {
      if (sortBy === 'EXPIRY_ASC') return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      if (sortBy === 'QTY_DESC') return b.remainingQuantity - a.remainingQuantity;
      if (sortBy === 'NAME_ASC') return a.drugName.localeCompare(b.drugName);
      if (sortBy === 'BATCH_ID') return a.batchId.localeCompare(b.batchId);
      return 0;
    });

    return result;
  }, [warehouseBatches, searchQuery, filterCategory, sortBy]);

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🚚</span> Logistics &amp; Distributor Console
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            {session.user.organizationName} &bull; Cold-Chain Surveillance Network &bull; Node: {session.user.walletAddress?.substring(0, 10)}...
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            {loading ? 'Refreshing...' : '🔄 Refresh Data'}
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Warehouse Units In Stock</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#00d2b4', marginTop: '4px' }}>
            {totalStockUnits.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Across {warehouseBatches.length} batch lots</div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Inbound Pending Arrival</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
            {totalInboundCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>En route from manufacturers</div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Outbound Shipments</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#a78bfa', marginTop: '4px' }}>
            {outboundDeliveries.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Destined for Pharmacies/Hospitals</div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Cold Chain Temperature</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: tempReading <= 8 && tempReading >= 2 ? '#34d399' : '#f87171', marginTop: '4px' }}>
            {tempReading.toFixed(1)}°C
          </div>
          <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '2px' }}>❄️ Sensor Nominal (2°C - 8°C)</div>
        </div>

        {recalledBatchesCount > 0 && (
          <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', border: '1px solid #ef4444' }}>
            <div style={{ fontSize: '0.72rem', color: '#f87171', textTransform: 'uppercase', fontWeight: 700 }}>Recall Warning</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
              {recalledBatchesCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '2px' }}>Batches quarantined</div>
          </div>
        )}
      </div>

      {/* Sub-Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary"
          style={{
            background: activeSubTab === 'inventory' ? 'rgba(0, 210, 180, 0.15)' : 'transparent',
            borderColor: activeSubTab === 'inventory' ? 'var(--primary)' : 'transparent',
            color: activeSubTab === 'inventory' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
          }}
          onClick={() => setActiveSubTab('inventory')}
        >
          📦 Warehouse Stock ({warehouseBatches.length})
        </button>
        <button
          className="btn btn-secondary"
          style={{
            background: activeSubTab === 'inbound' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            borderColor: activeSubTab === 'inbound' ? '#38bdf8' : 'transparent',
            color: activeSubTab === 'inbound' ? '#38bdf8' : 'var(--text-muted)',
            fontWeight: 600,
          }}
          onClick={() => setActiveSubTab('inbound')}
        >
          📥 Inbound Shipments ({totalInboundCount})
        </button>
        <button
          className="btn btn-secondary"
          style={{
            background: activeSubTab === 'outbound' ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
            borderColor: activeSubTab === 'outbound' ? '#a78bfa' : 'transparent',
            color: activeSubTab === 'outbound' ? '#a78bfa' : 'var(--text-muted)',
            fontWeight: 600,
          }}
          onClick={() => setActiveSubTab('outbound')}
        >
          🚚 Outbound Dispatches ({outboundDeliveries.length})
        </button>
      </div>

      {/* Environmental Verification Preset Drawer */}
      <div className="glass-panel" style={{ padding: '18px 20px', marginBottom: '24px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '0.95rem', margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>❄️</span> Cold Chain IoT Telemetry &amp; Depot Checkpoint Defaults
          </h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Applied to all intake and handoff transactions</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Intake Warehouse Facility
            </label>
            <input
              type="text"
              className="input-field"
              value={warehouseLocation}
              onChange={(e) => setWarehouseLocation(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Cold Chain Sensor Reading (°C)
            </label>
            <input
              type="number"
              step="0.1"
              className="input-field"
              value={tempReading}
              onChange={(e) => setTempReading(Number(e.target.value))}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Custody Audit Verification Note
            </label>
            <input
              type="text"
              className="input-field"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* TAB 1: WAREHOUSE STOCK */}
      {activeSubTab === 'inventory' && (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Warehouse Inventory &amp; Distribution</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: '2px' }}>
                Batches in active warehouse custody eligible for dispatch to Pharmacies and Hospitals
              </p>
            </div>
            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['ALL', 'IN_STOCK', 'LOW_STOCK', 'EXPIRING', 'RECALLED'] as const).map((cat) => (
                <button
                  key={cat}
                  className="btn btn-secondary"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.72rem',
                    background: filterCategory === cat ? 'rgba(0, 210, 180, 0.2)' : 'transparent',
                    borderColor: filterCategory === cat ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                    color: filterCategory === cat ? 'var(--primary)' : 'var(--text-dim)',
                  }}
                  onClick={() => setFilterCategory(cat)}
                >
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar & Sorter */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search by Batch ID, Drug Name, or Manufacturer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: '240px' }}
            />
            <select
              className="input-field"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{ width: '190px' }}
            >
              <option value="EXPIRY_ASC">Expiry: Earliest First</option>
              <option value="QTY_DESC">Quantity: Highest First</option>
              <option value="NAME_ASC">Drug Name: A-Z</option>
              <option value="BATCH_ID">Batch ID</option>
            </select>
          </div>

          {filteredBatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📦</div>
              <p style={{ fontSize: '0.95rem' }}>No warehouse inventory matched your current filter criteria.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
              {filteredBatches.map((b) => {
                const isExpired = new Date(b.expiryDate).getTime() < Date.now();
                return (
                  <div
                    key={b.batchId}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: b.isRecalled
                        ? '1px solid rgba(239, 68, 68, 0.5)'
                        : isExpired
                        ? '1px solid rgba(245, 158, 11, 0.5)'
                        : '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div className="mono" style={{ fontSize: '0.92rem', fontWeight: 700, color: '#38bdf8' }}>
                            {b.batchId}
                          </div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '2px', color: '#f8fafc' }}>
                            {b.drugName} {b.dosage ? `(${b.dosage})` : ''}
                          </div>
                        </div>
                        <StatusBadge status={b.currentStatus} />
                      </div>

                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '8px', lineHeight: 1.5 }}>
                        <div><strong>Manufacturer:</strong> {b.manufacturerName}</div>
                        <div><strong>Mfg Date:</strong> {new Date(b.manufacturingDate).toLocaleDateString()}</div>
                        <div>
                          <strong>Expiry Date:</strong>{' '}
                          <span style={{ color: isExpired ? '#f87171' : 'inherit', fontWeight: isExpired ? 700 : 400 }}>
                            {new Date(b.expiryDate).toLocaleDateString()} {isExpired && '(EXPIRED)'}
                          </span>
                        </div>
                        <div style={{ marginTop: '4px' }}>
                          Available: <strong style={{ color: '#00d2b4', fontSize: '0.95rem' }}>{b.remainingQuantity.toLocaleString()}</strong> / {b.quantity.toLocaleString()} units
                        </div>
                      </div>

                      {/* Recalled Notice */}
                      {b.isRecalled && (
                        <div style={{ marginTop: '10px', padding: '6px 10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '6px', fontSize: '0.74rem', color: '#f87171' }}>
                          🛑 RECALLED BATCH: {b.recallReason || 'Do not dispatch. Quarantine immediately.'}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-primary"
                        style={{
                          flex: 1,
                          fontSize: '0.78rem',
                          background: 'linear-gradient(135deg, #0284c7 0%, #00d2b4 100%)',
                        }}
                        onClick={() => handleOpenDispatchModal(b)}
                        disabled={b.remainingQuantity <= 0 || b.isRecalled || isExpired}
                      >
                        🚚 Dispatch Outbound
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                        onClick={() => handleOpenAudit(b)}
                        title="View audit provenance journey"
                      >
                        🔗 Audit
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                        onClick={() => setSelectedBatchForQr(b)}
                        title="View packaging QR matrix"
                      >
                        📱 QR
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INBOUND SHIPMENTS */}
      {activeSubTab === 'inbound' && (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Inbound Shipments From Manufacturers</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: '2px' }}>
                Inspect physical container seals, temperature indicators, and confirm receipt into inventory
              </p>
            </div>
            <span className="badge badge-transit">{totalInboundCount} Pending Intake</span>
          </div>

          {totalInboundCount === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🚚</div>
              <p style={{ fontSize: '0.95rem' }}>No incoming shipments are currently en route to your depot.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
              {/* Formal Deliveries */}
              {inboundDeliveries.map((d) => (
                <div
                  key={d.deliveryId}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '18px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                      {d.deliveryId} &bull; {d.batchId}
                    </div>
                    <span className="badge badge-transit">IN TRANSIT</span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px', color: '#f8fafc' }}>
                    {d.drugName}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px', lineHeight: 1.5 }}>
                    <div><strong>Origin:</strong> {d.fromOrganizationName}</div>
                    <div><strong>Dispatched Quantity:</strong> <strong style={{ color: '#00d2b4' }}>{d.quantity.toLocaleString()}</strong> units</div>
                    <div><strong>Dispatch Date:</strong> {new Date(d.dispatchDate).toLocaleDateString()}</div>
                    {d.temperatureCelsius !== undefined && (
                      <div style={{ color: '#38bdf8' }}>❄️ In-Transit Cold Chain: {d.temperatureCelsius}°C &bull; {d.location}</div>
                    )}
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '14px', width: '100%', fontSize: '0.82rem' }}
                    onClick={() => handleConfirmInboundDelivery(d.deliveryId, d.quantity)}
                  >
                    📥 Verify &amp; Confirm Delivery Receipt
                  </button>
                </div>
              ))}

              {/* Direct Batch Custody Fallback */}
              {inboundBatches.map((b) => (
                <div
                  key={b.batchId}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '18px',
                  }}
                >
                  <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                    {b.batchId}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px', color: '#f8fafc' }}>
                    {b.drugName}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px', lineHeight: 1.5 }}>
                    <div><strong>Manufacturer:</strong> {b.manufacturerName}</div>
                    <div><strong>Batch Volume:</strong> {b.quantity.toLocaleString()} units</div>
                    <div><strong>Expiry Date:</strong> {new Date(b.expiryDate).toLocaleDateString()}</div>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '14px', width: '100%', fontSize: '0.82rem' }}
                    onClick={() => handleReceiveShipment(b.batchId)}
                  >
                    📥 Acknowledge &amp; Receive In Warehouse
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OUTBOUND DISPATCHES */}
      {activeSubTab === 'outbound' && (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Outbound Dispatch Records</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: '2px' }}>
                Historical and active deliveries created by this distributor for Pharmacy and Hospital facilities
              </p>
            </div>
            <span className="badge badge-info">{outboundDeliveries.length} Total Dispatched</span>
          </div>

          {outboundDeliveries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🚚</div>
              <p style={{ fontSize: '0.95rem' }}>No outbound deliveries have been dispatched yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-dim)' }}>
                    <th style={{ padding: '10px 8px' }}>Delivery ID</th>
                    <th style={{ padding: '10px 8px' }}>Batch ID</th>
                    <th style={{ padding: '10px 8px' }}>Medicine</th>
                    <th style={{ padding: '10px 8px' }}>Recipient Org</th>
                    <th style={{ padding: '10px 8px' }}>Units</th>
                    <th style={{ padding: '10px 8px' }}>Dispatch Date</th>
                    <th style={{ padding: '10px 8px' }}>Status</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {outboundDeliveries.map((d) => (
                    <tr key={d.deliveryId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td className="mono" style={{ padding: '10px 8px', color: 'var(--primary)' }}>{d.deliveryId}</td>
                      <td className="mono" style={{ padding: '10px 8px' }}>{d.batchId}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 600 }}>{d.drugName}</td>
                      <td style={{ padding: '10px 8px' }}>{d.toOrganizationName}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 700, color: '#38bdf8' }}>{d.quantity.toLocaleString()}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-dim)' }}>
                        {new Date(d.dispatchDate).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span className={`badge ${d.status === 'DELIVERED' ? 'badge-received' : d.status === 'CANCELLED' ? 'badge-recalled' : 'badge-transit'}`}>
                          {d.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        {d.status === 'IN_TRANSIT' && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.72rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                            onClick={() => handleCancelDelivery(d.deliveryId)}
                            title="Abort and restore stock"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchBatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', padding: '24px', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Create Dispatch Delivery</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Batch: <span className="mono" style={{ color: '#38bdf8' }}>{dispatchBatch.batchId}</span> ({dispatchBatch.drugName})
              <br />
              Available Warehouse Stock: <strong style={{ color: '#00d2b4' }}>{dispatchBatch.remainingQuantity.toLocaleString()}</strong> units
            </p>

            <form onSubmit={handleCreateDelivery} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Destination Organization (Pharmacy / Hospital)
                </label>
                <select
                  className="input-field"
                  value={targetOrgId}
                  onChange={(e) => setTargetOrgId(e.target.value)}
                  required
                >
                  {pharmacies.length === 0 ? (
                    <option value="ORG-PHARM-01">City Care Pharmacy &amp; Hospital</option>
                  ) : (
                    pharmacies.map((org) => (
                      <option key={org.organizationId} value={org.organizationId}>
                        {org.name} ({org.type})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Dispatch Quantity (Units)
                </label>
                <input
                  type="number"
                  min={1}
                  max={dispatchBatch.remainingQuantity}
                  className="input-field"
                  value={dispatchQty}
                  onChange={(e) => setDispatchQty(Number(e.target.value))}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Transport Carrier / Vehicle
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={dispatchLocation}
                  onChange={(e) => setDispatchLocation(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Logistics Notes
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={dispatchSubmitting}
                >
                  {dispatchSubmitting ? 'Dispatching...' : 'Confirm Dispatch'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setDispatchBatch(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Provenance Audit Modal */}
      {selectedBatchForAudit && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setSelectedBatchForAudit(null)}
        >
          <div
            className="glass-panel"
            style={{ maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '28px', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', margin: 0, color: '#f8fafc' }}>
                  🔗 Supply Chain Custody Journey
                </h3>
                <div className="mono" style={{ fontSize: '0.85rem', color: '#00d2b4', marginTop: '2px' }}>
                  {selectedBatchForAudit.batchId} &bull; {selectedBatchForAudit.drugName}
                </div>
              </div>
              <button
                onClick={() => setSelectedBatchForAudit(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {loadingAudit ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#00d2b4' }}>Loading ledger audit trail...</div>
            ) : auditHistory.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', padding: '20px' }}>No custody events recorded for this batch.</p>
            ) : (
              <Timeline events={auditHistory} />
            )}

            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '16px' }}
              onClick={() => setSelectedBatchForAudit(null)}
            >
              Close Audit View
            </button>
          </div>
        </div>
      )}

      {/* QR Packaging Modal */}
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
