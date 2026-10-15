import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { MedicineBatch, UserSession } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface Props {
  session: UserSession | null;
  onOpenLogin: () => void;
}

export const PharmacyPage: React.FC<Props> = ({ session, onOpenLogin }) => {
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [loading, setLoading] = useState(false);

  // Dispense modal
  const [dispenseBatchId, setDispenseBatchId] = useState<string | null>(null);
  const [dispenseQty, setDispenseQty] = useState(10);
  const [rxReference, setRxReference] = useState('RX-2026-99214');
  const [dispenseNotes, setDispenseNotes] = useState('Prescription filled for outpatient care');

  const loadBatches = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const list = await api.getBatches(session.token);
      setBatches(list);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [session]);

  const handleReceiveStock = async (batchId: string) => {
    if (!session) return;
    try {
      await api.updateStatus(session.token, batchId, {
        newStatus: 'RECEIVED_BY_PHARMACY',
        location: `${session.user.organizationName} - Main Pharmacy Vault`,
        temperatureCelsius: 20.8,
        notes: 'Stock received, barcode verified on blockchain ledger, safely stored in dispensary',
      });
      alert(`Batch ${batchId} safely received into Pharmacy inventory!`);
      loadBatches();
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

      alert(`Successfully dispensed ${dispenseQty} units! Remaining: ${res.remainingQuantity}`);
      setDispenseBatchId(null);
      loadBatches();
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
    (b) => b.currentStatus === 'RECEIVED_BY_PHARMACY' || b.currentStatus === 'DISPENSED'
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.8rem' }}>Pharmacy &amp; Hospital Dispensary Console</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {session.user.organizationName} &bull; License: {session.user.licenseNumber}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* In Transit from Distributor */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem' }}>Incoming Deliveries</h2>
            <span className="badge badge-transit">{inTransitBatches.length} En Route</span>
          </div>

          {inTransitBatches.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>No incoming shipments currently in transit.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                    onClick={() => handleReceiveStock(b.batchId)}
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
              {pharmacyStock.map((b) => (
                <div
                  key={b.batchId}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
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
                    </div>
                    <StatusBadge status={b.currentStatus} />
                  </div>

                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    {b.remainingQuantity > 0 && !b.isRecalled && (
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
              ))}
            </div>
          )}
        </div>
      </div>

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
