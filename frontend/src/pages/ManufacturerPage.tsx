import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { MedicineBatch, UserSession } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { QrModal } from '../components/QrModal';

interface Props {
  session: UserSession | null;
  onOpenLogin: () => void;
}

export const ManufacturerPage: React.FC<Props> = ({ session, onOpenLogin }) => {
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBatchForQr, setSelectedBatchForQr] = useState<MedicineBatch | null>(null);

  // Form State
  const [drugName, setDrugName] = useState('Paracetamol Infusion USP');
  const [genericName, setGenericName] = useState('Paracetamol / Acetaminophen');
  const [dosage, setDosage] = useState('1000mg/100mL IV');
  const [quantity, setQuantity] = useState(2500);
  const [location, setLocation] = useState('Apex Plant 1, Cleanroom Suite C');
  const [mfgDate, setMfgDate] = useState(new Date().toISOString().split('T')[0]);
  const [expDate, setExpDate] = useState(
    new Date(Date.now() + 2 * 365 * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Dispatch modal state
  const [dispatchBatchId, setDispatchBatchId] = useState<string | null>(null);
  const [dispatchLocation, setDispatchLocation] = useState('Outbound Logistics Gate 1');
  const [dispatchTemp, setDispatchTemp] = useState(4.5);
  const [dispatchNotes, setDispatchNotes] = useState('Packed in dry-ice / insulated containers');

  const generateAutoBatchId = () => {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `MED-${dateStr}-${rand}`;
  };

  const [batchId, setBatchId] = useState(generateAutoBatchId());

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

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      onOpenLogin();
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.createBatch(session.token, {
        batchId,
        drugName,
        genericName,
        dosage,
        quantity: Number(quantity),
        manufacturingDate: new Date(mfgDate).toISOString(),
        expiryDate: new Date(expDate).toISOString(),
        location,
      });

      setFeedback({
        type: 'success',
        message: `Batch ${batchId} successfully minted and anchored to blockchain! (Tx: ${res.txHash.slice(0, 16)}...)`,
      });
      setBatchId(generateAutoBatchId());
      loadBatches();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create batch' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatch = async (bId: string) => {
    if (!session) return;
    try {
      await api.updateStatus(session.token, bId, {
        newStatus: 'IN_TRANSIT_TO_DISTRIBUTOR',
        location: dispatchLocation,
        temperatureCelsius: Number(dispatchTemp),
        notes: dispatchNotes,
        targetRecipientAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Global Health Logistics
      });
      setDispatchBatchId(null);
      loadBatches();
      alert(`Batch ${bId} successfully dispatched to distributor!`);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch');
    }
  };

  if (!session) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', textAlign: 'center', padding: '32px' }} className="glass-panel">
        <h2 style={{ fontSize: '1.6rem', marginBottom: '12px' }}>Manufacturer Operations Portal</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          Please sign in with a registered Manufacturer account to synthesize and mint new medicine batches.
        </p>
        <button className="btn btn-primary" onClick={onOpenLogin}>
          Sign In as Manufacturer
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Manufacturer Production Console</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {session.user.organizationName} &bull; License: {session.user.licenseNumber}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => setBatchId(generateAutoBatchId())}>
          🎲 New Batch ID
        </button>
      </div>

      {feedback && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            color: feedback.type === 'success' ? '#34d399' : '#f87171',
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* Main Grid: Form on Left, Current Batches on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Create Batch Card */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Formulate &amp; Mint New Batch</h2>
          <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Batch ID (Unified Standard)
              </label>
              <input
                type="text"
                className="input-field mono"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Drug Trade Name
              </label>
              <input
                type="text"
                className="input-field"
                value={drugName}
                onChange={(e) => setDrugName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Generic Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Dosage / Strength
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Units Formulated
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  min={1}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Facility Location
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Mfg Date
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={mfgDate}
                  onChange={(e) => setMfgDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Exp Date
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: '8px' }}>
              {submitting ? 'Registering on Blockchain...' : '✓ Mint Batch & Register Ledger'}
            </button>
          </form>
        </div>

        {/* Existing Batches List */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Registered Medicine Batches</h2>
          {loading ? (
            <p style={{ color: 'var(--text-dim)' }}>Loading batches from ledger...</p>
          ) : batches.length === 0 ? (
            <p style={{ color: 'var(--text-dim)' }}>No batches registered yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {batches.map((b) => (
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
                      <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#00d2b4' }}>
                        {b.batchId}
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                        {b.drugName}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        Dosage: {b.dosage} &bull; Qty: {b.remainingQuantity} / {b.quantity}
                      </div>
                    </div>
                    <StatusBadge status={b.currentStatus} />
                  </div>

                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                      onClick={() => setSelectedBatchForQr(b)}
                    >
                      📱 View QR Code
                    </button>

                    {b.currentStatus === 'MANUFACTURED' && (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                        onClick={() => setDispatchBatchId(b.batchId)}
                      >
                        🚚 Dispatch to Distributor
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dispatch Modal */}
      {dispatchBatchId && (
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
            <h3 style={{ fontSize: '1.2rem', marginBottom: '12px' }}>Dispatch Batch: {dispatchBatchId}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Dispatch Location</label>
                <input
                  type="text"
                  className="input-field"
                  value={dispatchLocation}
                  onChange={(e) => setDispatchLocation(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Departure Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input-field"
                  value={dispatchTemp}
                  onChange={(e) => setDispatchTemp(Number(e.target.value))}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Transit Notes / Courier</label>
                <input
                  type="text"
                  className="input-field"
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => handleDispatch(dispatchBatchId)}
                >
                  Confirm Dispatch
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setDispatchBatchId(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {selectedBatchForQr && (
        <QrModal batch={selectedBatchForQr} onClose={() => setSelectedBatchForQr(null)} />
      )}
    </div>
  );
};
