import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { MedicineBatch, UserSession, Delivery } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface Props {
  session: UserSession | null;
  onOpenLogin: () => void;
}

export const PharmacyPage: React.FC<Props> = ({ session, onOpenLogin }) => {
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [inboundDeliveries, setInboundDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);

  // Receipt confirmation modal
  const [confirmDelivery, setConfirmDelivery] = useState<Delivery | null>(null);
  const [receiptQty, setReceiptQty] = useState<number>(0);
  const [receiptRemarks, setReceiptRemarks] = useState('Stock inspected and cold-chain compliance verified');
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);

  // Dispense modal
  const [dispenseBatchId, setDispenseBatchId] = useState<string | null>(null);
  const [dispenseQty, setDispenseQty] = useState(10);
  const [rxReference, setRxReference] = useState('RX-2026-99214');
  const [dispenseNotes, setDispenseNotes] = useState('Prescription filled for outpatient care');

  const loadData = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [batchList, deliveryList] = await Promise.all([
        api.getBatches(session.token).catch(() => []),
        api.getDeliveries(session.token, { direction: 'inbound' }).catch(() => []),
      ]);
      setBatches(batchList);
      setInboundDeliveries(deliveryList.filter((d) => d.status === 'IN_TRANSIT'));
    } catch (err: any) {
      console.error('Error loading pharmacy data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session]);

  const handleOpenConfirmModal = (delivery: Delivery) => {
    setConfirmDelivery(delivery);
    setReceiptQty(delivery.quantity);
  };

  const handleConfirmReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !confirmDelivery) return;

    setReceiptSubmitting(true);
    try {
      await api.confirmDeliveryReceipt(session.token, confirmDelivery.deliveryId, {
        receivedQuantity: Number(receiptQty),
        remarks: receiptRemarks,
        location: `${session.user.organizationName} - Main Pharmacy Vault`,
        temperatureCelsius: 20.8,
      });

      alert(`Delivery ${confirmDelivery.deliveryId} confirmed! Stock safely added to dispensary inventory.`);
      setConfirmDelivery(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm receipt');
    } finally {
      setReceiptSubmitting(false);
    }
  };

  const handleReceiveStockLegacy = async (batchId: string) => {
    if (!session) return;
    try {
      await api.updateStatus(session.token, batchId, {
        newStatus: 'RECEIVED_BY_PHARMACY',
        location: `${session.user.organizationName} - Main Pharmacy Vault`,
        temperatureCelsius: 20.8,
        notes: 'Stock received, barcode verified on blockchain ledger, safely stored in dispensary',
      });
      alert(`Batch ${batchId} safely received into Pharmacy inventory!`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update custody');
    }
  };

  const handleDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !dispenseBatchId) return;

    try {
      const res = await api.dispense(session.token, dispenseBatchId, {
        quantityToDispense: Number(dispenseQty),
        patientReference: rxReference,
        notes: dispenseNotes,
      });

      alert(`Successfully dispensed ${dispenseQty} units! Remaining stock: ${res.remainingQuantity}`);
      setDispenseBatchId(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to dispense');
    }
  };

  if (!session) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', textAlign: 'center', padding: '32px' }} className="glass-panel">
        <h2 style={{ fontSize: '1.6rem', marginBottom: '12px' }}>Pharmacy &amp; Hospital Dispensary Portal</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          Please sign in with a registered Pharmacy/Hospital account to manage dispensary stock and record dispensing.
        </p>
        <button className="btn btn-primary" onClick={onOpenLogin}>
          Sign In as Pharmacy
        </button>
      </div>
    );
  }

  const inTransitBatches = batches.filter((b) => b.currentStatus === 'IN_TRANSIT_TO_PHARMACY');
  const pharmacyStock = batches.filter(
    (b) =>
      b.currentStatus === 'RECEIVED_BY_PHARMACY' ||
      b.currentStatus === 'DISPENSED'
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Pharmacy &amp; Hospital Dispensary Console</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {session.user.organizationName} &bull; License: {session.user.licenseNumber}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Refresh Data'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Incoming Deliveries */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem' }}>Incoming Deliveries</h2>
            <span className="badge badge-transit">{inboundDeliveries.length + inTransitBatches.length} En Route</span>
          </div>

          {inboundDeliveries.length === 0 && inTransitBatches.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>No incoming shipments currently in transit.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Formal Deliveries */}
              {inboundDeliveries.map((d) => (
                <div
                  key={d.deliveryId}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                      {d.deliveryId}
                    </div>
                    <span className="badge badge-transit">IN TRANSIT</span>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '4px' }}>{d.drugName}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    Batch: <span className="mono">{d.batchId}</span> &bull; Sender: {d.fromOrganizationName}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '4px', color: '#10b981' }}>
                    Quantity: {d.quantity} units
                  </div>
                  {d.temperatureCelsius !== undefined && (
                    <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '2px' }}>
                      ❄️ In-Transit Temp: {d.temperatureCelsius}°C
                    </div>
                  )}
                  <button
                    className="btn btn-primary"
                    style={{
                      marginTop: '12px',
                      width: '100%',
                      fontSize: '0.8rem',
                      background: 'linear-gradient(135deg, #0284c7 0%, #10b981 100%)',
                    }}
                    onClick={() => handleOpenConfirmModal(d)}
                  >
                    📦 Inspect &amp; Confirm Delivery Receipt
                  </button>
                </div>
              ))}

              {/* Direct Batch Custody Fallback */}
              {inTransitBatches.map((b) => (
                <div
                  key={b.batchId}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '16px',
                  }}
                >
                  <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                    {b.batchId}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '2px' }}>{b.drugName}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    Manufacturer: {b.manufacturerName} &bull; Qty: {b.quantity}
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '12px', width: '100%', fontSize: '0.8rem' }}
                    onClick={() => handleReceiveStockLegacy(b.batchId)}
                  >
                    📦 Accept Custody &amp; Add to Dispensary
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pharmacy Dispensary Stock */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem' }}>Dispensary Inventory</h2>
            <span className="badge badge-received">{pharmacyStock.length} Batches</span>
          </div>

          {pharmacyStock.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>No active pharmacy inventory available.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pharmacyStock.map((b) => {
                const isExpired = new Date(b.expiryDate).getTime() < Date.now();
                return (
                  <div
                    key={b.batchId}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: b.isRecalled
                        ? '1px solid rgba(239, 68, 68, 0.4)'
                        : isExpired
                        ? '1px solid rgba(245, 158, 11, 0.4)'
                        : '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>
                          {b.batchId}
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '2px' }}>{b.drugName}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Strength: {b.dosage} &bull; In Stock: <strong>{b.remainingQuantity}</strong> / {b.quantity}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                          Expiry: {new Date(b.expiryDate).toLocaleDateString()}
                        </div>
                      </div>
                      <StatusBadge status={b.currentStatus} />
                    </div>

                    {/* Expiry / Recall Alerts */}
                    {b.isRecalled && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '6px 10px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid #ef4444',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          color: '#f87171',
                        }}
                      >
                        ⚠️ RECALL ALERT: {b.recallReason || 'Do not dispense. Quarantine immediately.'}
                      </div>
                    )}

                    {isExpired && !b.isRecalled && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '6px 10px',
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid #f59e0b',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          color: '#fbbf24',
                        }}
                      >
                        ⚠️ EXPIRED: Batch expired on {b.expiryDate}. Dispensation prohibited.
                      </div>
                    )}

                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                      {b.remainingQuantity > 0 && !b.isRecalled && !isExpired && (
                        <button
                          className="btn btn-primary"
                          style={{
                            flex: 1,
                            fontSize: '0.8rem',
                            background: 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
                          }}
                          onClick={() => {
                            setDispenseBatchId(b.batchId);
                            setDispenseQty(Math.min(10, b.remainingQuantity));
                          }}
                        >
                          💊 Dispense to Patient
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Delivery Receipt Modal */}
      {confirmDelivery && (
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
          <div className="glass-panel" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Confirm Delivery Receipt</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '14px' }}>
              Delivery: <span className="mono" style={{ color: 'var(--primary)' }}>{confirmDelivery.deliveryId}</span>
              <br />
              Medicine: <strong>{confirmDelivery.drugName}</strong> ({confirmDelivery.batchId})
              <br />
              Dispatched Quantity: <strong>{confirmDelivery.quantity}</strong> units
            </p>

            <form onSubmit={handleConfirmReceipt} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Quantity Actually Received
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
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Inspection &amp; Verification Remarks
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={receiptRemarks}
                  onChange={(e) => setReceiptRemarks(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={receiptSubmitting}
                >
                  {receiptSubmitting ? 'Confirming...' : 'Confirm Receipt'}
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

      {/* Dispense Modal */}
      {dispenseBatchId && (
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
          <div className="glass-panel" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '12px' }}>Dispense Medicine: {dispenseBatchId}</h3>
            <form onSubmit={handleDispense} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Units to Dispense</label>
                <input
                  type="number"
                  min={1}
                  className="input-field"
                  value={dispenseQty}
                  onChange={(e) => setDispenseQty(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Prescription / Patient Ref ID</label>
                <input
                  type="text"
                  className="input-field mono"
                  value={rxReference}
                  onChange={(e) => setRxReference(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Clinical Dispensing Notes</label>
                <input
                  type="text"
                  className="input-field"
                  value={dispenseNotes}
                  onChange={(e) => setDispenseNotes(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Confirm Dispensation
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setDispenseBatchId(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
