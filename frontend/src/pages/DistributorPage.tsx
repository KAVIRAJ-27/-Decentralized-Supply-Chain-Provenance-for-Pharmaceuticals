import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { MedicineBatch, UserSession, Delivery, Organization } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface Props {
  session: UserSession | null;
  onOpenLogin: () => void;
}

export const DistributorPage: React.FC<Props> = ({ session, onOpenLogin }) => {
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [pharmacies, setPharmacies] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [warehouseLocation, setWarehouseLocation] = useState('Global Logistics Hub Vault 3');
  const [tempReading, setTempReading] = useState(4.2);
  const [transferNotes, setTransferNotes] = useState('Inspected container seals; temperature logs normal');

  // Dispatch modal state
  const [dispatchBatch, setDispatchBatch] = useState<MedicineBatch | null>(null);
  const [targetOrgId, setTargetOrgId] = useState('');
  const [dispatchQty, setDispatchQty] = useState<number>(100);
  const [dispatchLocation, setDispatchLocation] = useState('Refrigerated Transport Fleet #18');
  const [dispatchNotes, setDispatchNotes] = useState('Cold chain transport dispatched');
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);

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
      alert(`Delivery ${deliveryId} successfully received and verified!`);
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

  // Filter batches and deliveries
  const inboundDeliveries = deliveries.filter(
    (d) => d.toOrganizationId === session.user.organizationId && d.status === 'IN_TRANSIT'
  );
  const outboundDeliveries = deliveries.filter(
    (d) => d.fromOrganizationId === session.user.organizationId
  );
  const inboundBatches = batches.filter((b) => b.currentStatus === 'IN_TRANSIT_TO_DISTRIBUTOR');
  const inventoryBatches = batches.filter((b) => b.currentStatus === 'RECEIVED_BY_DISTRIBUTOR');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Logistics &amp; Distributor Console</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {session.user.organizationName} &bull; Cold-Chain Surveillance Network
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Refresh Data'}
        </button>
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

      {/* Inbound Shipments Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Inbound Deliveries & Batches */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem' }}>Inbound From Manufacturers</h2>
            <span className="badge badge-transit">{inboundDeliveries.length + inboundBatches.length} Pending Arrival</span>
          </div>

          {inboundDeliveries.length === 0 && inboundBatches.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>No pending shipments in transit.</p>
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
                      {d.deliveryId} &bull; {d.batchId}
                    </div>
                    <span className="badge badge-transit">IN TRANSIT</span>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '4px' }}>{d.drugName}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    From: {d.fromOrganizationName} &bull; Qty: <strong>{d.quantity}</strong> units
                  </div>
                  {d.temperatureCelsius !== undefined && (
                    <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '4px' }}>
                      ❄️ Recorded Temp: {d.temperatureCelsius}°C &bull; {d.location}
                    </div>
                  )}
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '12px', width: '100%', fontSize: '0.8rem' }}
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
                        Available Quantity: <strong>{b.remainingQuantity}</strong> / {b.quantity} units
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
                    onClick={() => handleOpenDispatchModal(b)}
                    disabled={b.remainingQuantity <= 0 || b.isRecalled}
                  >
                    🏥 Dispatch Outbound to Pharmacy / Hospital
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Outbound Dispatches Tracking Table */}
      {outboundDeliveries.length > 0 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem' }}>Outbound Dispatch Records</h2>
            <span className="badge badge-info">{outboundDeliveries.length} Dispatched</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-dim)' }}>
                  <th style={{ padding: '10px 8px' }}>Delivery ID</th>
                  <th style={{ padding: '10px 8px' }}>Batch</th>
                  <th style={{ padding: '10px 8px' }}>Medicine</th>
                  <th style={{ padding: '10px 8px' }}>Recipient</th>
                  <th style={{ padding: '10px 8px' }}>Quantity</th>
                  <th style={{ padding: '10px 8px' }}>Dispatch Date</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {outboundDeliveries.map((d) => (
                  <tr key={d.deliveryId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td className="mono" style={{ padding: '10px 8px', color: 'var(--primary)' }}>{d.deliveryId}</td>
                    <td className="mono" style={{ padding: '10px 8px' }}>{d.batchId}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{d.drugName}</td>
                    <td style={{ padding: '10px 8px' }}>{d.toOrganizationName}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 700 }}>{d.quantity}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-dim)' }}>
                      {new Date(d.dispatchDate).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span className={`badge ${d.status === 'DELIVERED' ? 'badge-received' : d.status === 'CANCELLED' ? 'badge-recalled' : 'badge-transit'}`}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Create Dispatch Delivery</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Batch: <span className="mono" style={{ color: '#38bdf8' }}>{dispatchBatch.batchId}</span> ({dispatchBatch.drugName})
              <br />
              Available Stock: <strong>{dispatchBatch.remainingQuantity}</strong> units
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
    </div>
  );
};
