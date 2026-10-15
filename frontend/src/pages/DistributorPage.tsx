import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { MedicineBatch, UserSession } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface Props {
  session: UserSession | null;
  onOpenLogin: () => void;
}

export const DistributorPage: React.FC<Props> = ({ session, onOpenLogin }) => {
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [warehouseLocation, setWarehouseLocation] = useState('Global Logistics Hub Vault 3');
  const [tempReading, setTempReading] = useState(4.2);
  const [transferNotes, setTransferNotes] = useState('Inspected container seals; temperature logs normal');

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
      loadBatches();
    } catch (err: any) {
      alert(err.message || 'Failed to update custody');
    }
  };

  const handleDispatchToPharmacy = async (batchId: string) => {
    if (!session) return;
    try {
      await api.updateStatus(session.token, batchId, {
        newStatus: 'IN_TRANSIT_TO_PHARMACY',
        location: 'Refrigerated Transport Fleet #18',
        temperatureCelsius: 4.8,
        notes: 'Dispatched to City Care Hospital & Central Pharmacy',
        targetRecipientAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      });
      alert(`Batch ${batchId} dispatched to Pharmacy/Hospital!`);
      loadBatches();
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch to pharmacy');
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

  const inboundBatches = batches.filter((b) => b.currentStatus === 'IN_TRANSIT_TO_DISTRIBUTOR');
  const inventoryBatches = batches.filter((b) => b.currentStatus === 'RECEIVED_BY_DISTRIBUTOR');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.8rem' }}>Logistics &amp; Distributor Console</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {session.user.organizationName} &bull; Cold-Chain Surveillance Network
        </p>
      </div>

      {/* Environmental Verification Preset */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: '#38bdf8' }}>
          Warehouse Sensor &amp; Intake Defaults
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
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
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
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
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Audit Verification Note
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

      {/* Two columns: Inbound shipments & Active warehouse inventory */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Inbound Batches */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem' }}>Inbound From Manufacturers</h2>
            <span className="badge badge-transit">{inboundBatches.length} Pending Arrival</span>
          </div>

          {inboundBatches.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>No pending shipments in transit.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {inboundBatches.map((b) => (
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
                    Origin: {b.manufacturerName} &bull; Qty: {b.quantity}
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '12px', width: '100%', fontSize: '0.8rem' }}
                    onClick={() => handleReceiveShipment(b.batchId)}
                  >
                    📥 Acknowledge &amp; Receive In Warehouse
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Distributor Stock */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem' }}>Warehouse Stock &amp; Distribution</h2>
            <span className="badge badge-received">{inventoryBatches.length} In Stock</span>
          </div>

          {inventoryBatches.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>No batches currently held in warehouse stock.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {inventoryBatches.map((b) => (
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
                      <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8' }}>
                        {b.batchId}
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '2px' }}>{b.drugName}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        Quantity: {b.remainingQuantity} units
                      </div>
                    </div>
                    <StatusBadge status={b.currentStatus} />
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{
                      marginTop: '12px',
                      width: '100%',
                      fontSize: '0.8rem',
                      background: 'linear-gradient(135deg, #0284c7 0%, #00d2b4 100%)',
                    }}
                    onClick={() => handleDispatchToPharmacy(b.batchId)}
                  >
                    🏥 Dispatch Outbound to Pharmacy / Hospital
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
