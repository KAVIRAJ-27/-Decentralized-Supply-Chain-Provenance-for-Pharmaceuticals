import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { MedicineBatch, UserSession } from '../types';
import { RoleBadge } from '../components/RoleBadge';

interface Props {
  session: UserSession | null;
  onOpenLogin: () => void;
}

export const AdminPage: React.FC<Props> = ({ session, onOpenLogin }) => {
  const [stats, setStats] = useState<any>(null);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [loading, setLoading] = useState(false);

  // Recall dialog
  const [recallBatchId, setRecallBatchId] = useState('');
  const [recallReason, setRecallReason] = useState('Subpotency detected during post-market surveillance testing');
  const [recalling, setRecalling] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const statsData = await api.getStats();
      setStats(statsData);

      if (session) {
        const batchList = await api.getBatches(session.token);
        setBatches(batchList);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session]);

  const handleTriggerRecall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !recallBatchId.trim()) return;

    if (!confirm(`Are you certain you want to trigger a permanent recall for ${recallBatchId}?`)) {
      return;
    }

    setRecalling(true);
    try {
      await api.recall(session.token, recallBatchId.trim().toUpperCase(), recallReason);
      alert(`Recall broadcasted successfully for ${recallBatchId}!`);
      setRecallBatchId('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to trigger recall');
    } finally {
      setRecalling(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.8rem' }}>Regulatory &amp; System Administration</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          National Drug Authority Oversight &bull; Cryptographic Supply Chain Surveillance
        </p>
      </div>

      {/* Network Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Total Minted Batches
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
            {stats?.metrics?.totalBatches || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#00d2b4', marginTop: '4px' }}>Anchored on Blockchain</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Active Cold-Chain In Transit
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>
            {stats?.metrics?.activeInTransit || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Real-time GPS Monitored</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Recalled / Quarantined
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444', marginTop: '6px' }}>
            {stats?.metrics?.recalledBatches || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '4px' }}>Safety Alerts Broadcasted</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Total Custody Logs
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#a855f7', marginTop: '6px' }}>
            {stats?.metrics?.totalCustodyEvents || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Cryptographically Signed</div>
        </div>
      </div>

      {/* Network Node & Smart Contract Details */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⛓️</span> Distributed Ledger Integrity Status
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Network Protocol</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
              {stats?.blockchain?.network || 'Hardhat Local / Ethereum Compatible'}
            </div>
            <div style={{ fontSize: '0.75rem', color: stats?.blockchain?.connected ? '#10b981' : '#f59e0b', marginTop: '2px' }}>
              ● {stats?.blockchain?.message || 'Syncing state'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Smart Contract Address</div>
            <div className="mono" style={{ fontSize: '0.82rem', color: '#00d2b4', marginTop: '2px', wordBreak: 'break-all' }}>
              {stats?.blockchain?.contractAddress || '0x5FbDB2315678afecb367f032d93F642f64180aa3'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Verification Standard</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
              MediTrace RBAC v1.0 &bull; EIP-155
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Recall Form */}
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          background: 'rgba(239, 68, 68, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <span style={{ fontSize: '1.4rem' }}>🚨</span>
          <h2 style={{ fontSize: '1.2rem', color: '#f87171' }}>Emergency Batch Recall Protocol</h2>
        </div>
        <p style={{ color: '#fca5a5', fontSize: '0.85rem', marginBottom: '16px' }}>
          Regulatory mandate: Issuing a recall permanently flags this batch across public verification scanners, stops all pharmacy dispensations, and alerts healthcare providers.
        </p>

        {session?.user?.role === 'ADMIN' || session?.user?.role === 'MANUFACTURER' ? (
          <form onSubmit={handleTriggerRecall} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#fca5a5' }}>Target Batch ID</label>
                <input
                  type="text"
                  className="input-field mono"
                  placeholder="MED-YYYYMMDD-XXXXX"
                  value={recallBatchId}
                  onChange={(e) => setRecallBatchId(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#fca5a5' }}>Official Regulatory Reason</label>
                <input
                  type="text"
                  className="input-field"
                  value={recallReason}
                  onChange={(e) => setRecallReason(e.target.value)}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={recalling}
              style={{ alignSelf: 'flex-start', padding: '10px 24px' }}
            >
              {recalling ? 'Broadcasting Recall...' : '⚠️ Issue Regulatory Batch Recall'}
            </button>
          </form>
        ) : (
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '12px' }}>
              Only Admin Regulators or Authorized Manufacturers can trigger emergency recalls.
            </p>
            <button className="btn btn-primary" onClick={onOpenLogin}>
              Sign In as Admin Regulator
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
