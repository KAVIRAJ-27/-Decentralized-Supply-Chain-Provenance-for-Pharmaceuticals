import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { MedicineBatch, Medicine, UserSession } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { QrModal } from '../components/QrModal';

interface Props {
  session: UserSession | null;
  onOpenLogin: () => void;
}

type ManufacturerTab = 'overview' | 'medicines' | 'create-batch' | 'batches' | 'qr-center';

export const ManufacturerPage: React.FC<Props> = ({ session, onOpenLogin }) => {
  const [activeTab, setActiveTab] = useState<ManufacturerTab>('overview');
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [stats, setStats] = useState<{
    totalMedicines: number;
    totalBatches: number;
    activeBatches: number;
    expiredBatches: number;
    recalledBatches: number;
  }>({
    totalMedicines: 0,
    totalBatches: 0,
    activeBatches: 0,
    expiredBatches: 0,
    recalledBatches: 0,
  });

  const [loading, setLoading] = useState(false);
  const [selectedBatchForQr, setSelectedBatchForQr] = useState<MedicineBatch | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Search & Filter States
  const [batchSearch, setBatchSearch] = useState('');
  const [batchStatusFilter, setBatchStatusFilter] = useState('');
  const [medicineSearch, setMedicineSearch] = useState('');

  // Register Medicine Form & Modal State
  const [showRegisterMedicineModal, setShowRegisterMedicineModal] = useState(false);
  const [medName, setMedName] = useState('');
  const [medGenericName, setMedGenericName] = useState('');
  const [medDescription, setMedDescription] = useState('');
  const [medDosageForm, setMedDosageForm] = useState('Injection');
  const [medStrength, setMedStrength] = useState('');
  const [medPackaging, setMedPackaging] = useState('100mL Vial');
  const [registeringMed, setRegisteringMed] = useState(false);

  // Edit Medicine Modal State
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editPackaging, setEditPackaging] = useState('');
  const [editStrength, setEditStrength] = useState('');
  const [editDosageForm, setEditDosageForm] = useState('');
  const [savingEditMed, setSavingEditMed] = useState(false);

  // Batch Creation Form State
  const [selectedMedicineId, setSelectedMedicineId] = useState<string>('');
  const [drugName, setDrugName] = useState('Paracetamol Infusion USP');
  const [genericName, setGenericName] = useState('Paracetamol / Acetaminophen');
  const [dosage, setDosage] = useState('1000mg/100mL IV');
  const [strength, setStrength] = useState('10mg/mL');
  const [packaging, setPackaging] = useState('100mL glass vial');
  const [quantity, setQuantity] = useState<number | ''>(2500);
  const [location, setLocation] = useState('Apex Plant 1, Cleanroom Suite C');
  const [mfgDate, setMfgDate] = useState(new Date().toISOString().split('T')[0]);
  const [expDate, setExpDate] = useState(
    new Date(Date.now() + 2 * 365 * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [submittingBatch, setSubmittingBatch] = useState(false);
  const [recentlyCreatedBatch, setRecentlyCreatedBatch] = useState<MedicineBatch | null>(null);

  // Dispatch Modal State
  const [dispatchBatchId, setDispatchBatchId] = useState<string | null>(null);
  const [dispatchLocation, setDispatchLocation] = useState('Outbound Logistics Hub');
  const [dispatchTemp, setDispatchTemp] = useState(4.5);
  const [dispatchNotes, setDispatchNotes] = useState('Cold chain storage 2-8°C, packed in insulated containers');

  const generateAutoBatchId = () => {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `MED-${dateStr}-${rand}`;
  };

  const [batchId, setBatchId] = useState(generateAutoBatchId());

  // Load Data
  const loadAllData = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [batchList, medList, statsData] = await Promise.all([
        api.getBatches(session.token).catch(() => []),
        api.getMedicines(session.token).catch(() => []),
        api.getManufacturerStats(session.token).catch(() => ({
          totalMedicines: 0,
          totalBatches: 0,
          activeBatches: 0,
          expiredBatches: 0,
          recalledBatches: 0,
        })),
      ]);

      setBatches(batchList);
      setMedicines(medList);
      setStats(statsData);

      // Pre-select first medicine if none selected
      if (medList.length > 0 && !selectedMedicineId) {
        handleSelectMedicine(medList[0]);
      }
    } catch (err: any) {
      console.error('Error loading manufacturer data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [session]);

  const handleSelectMedicine = (med: Medicine) => {
    setSelectedMedicineId(med.medicineId || med.id || '');
    setDrugName(med.name);
    setGenericName(med.genericName);
    setDosage(med.dosageForm + (med.strength ? ` - ${med.strength}` : ''));
    setStrength(med.strength || '');
    setPackaging(med.packaging || '');
  };

  // Medicine Selection dropdown change
  const onMedicineDropdownChange = (medId: string) => {
    const found = medicines.find((m) => (m.medicineId || m.id) === medId);
    if (found) {
      handleSelectMedicine(found);
    } else {
      setSelectedMedicineId(medId);
    }
  };

  // Register Medicine
  const handleRegisterMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    if (!medName.trim() || !medGenericName.trim()) {
      setFeedback({ type: 'error', message: 'Medicine Name and Generic Name are required.' });
      return;
    }

    setRegisteringMed(true);
    setFeedback(null);
    try {
      const newMed = await api.createMedicine(session.token, {
        name: medName.trim(),
        genericName: medGenericName.trim(),
        description: medDescription.trim(),
        dosageForm: medDosageForm.trim(),
        strength: medStrength.trim(),
        packaging: medPackaging.trim(),
      });

      setFeedback({
        type: 'success',
        message: `Medicine "${newMed.name}" (${newMed.medicineId || newMed.id}) registered successfully!`,
      });
      setShowRegisterMedicineModal(false);
      setMedName('');
      setMedGenericName('');
      setMedDescription('');
      setMedStrength('');
      loadAllData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to register medicine' });
    } finally {
      setRegisteringMed(false);
    }
  };

  // Open Edit Medicine Modal
  const openEditMedicine = (med: Medicine) => {
    setEditingMedicine(med);
    setEditDescription(med.description || '');
    setEditPackaging(med.packaging || '');
    setEditStrength(med.strength || '');
    setEditDosageForm(med.dosageForm || '');
  };

  // Update Medicine
  const handleUpdateMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !editingMedicine) return;

    setSavingEditMed(true);
    setFeedback(null);
    try {
      const targetId = editingMedicine.medicineId || editingMedicine.id || '';
      await api.updateMedicine(session.token, targetId, {
        description: editDescription.trim(),
        packaging: editPackaging.trim(),
        strength: editStrength.trim(),
        dosageForm: editDosageForm.trim(),
      });

      setFeedback({
        type: 'success',
        message: `Medicine "${editingMedicine.name}" updated successfully!`,
      });
      setEditingMedicine(null);
      loadAllData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update medicine' });
    } finally {
      setSavingEditMed(false);
    }
  };

  // Batch Creation
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      onOpenLogin();
      return;
    }

    // Validation
    if (!batchId.trim()) {
      setFeedback({ type: 'error', message: 'Batch ID is required.' });
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      setFeedback({ type: 'error', message: 'Quantity must be a positive integer greater than zero.' });
      return;
    }

    const mfgTimestamp = new Date(mfgDate).getTime();
    const expTimestamp = new Date(expDate).getTime();

    if (isNaN(mfgTimestamp)) {
      setFeedback({ type: 'error', message: 'Valid manufacturing date is required.' });
      return;
    }

    if (isNaN(expTimestamp)) {
      setFeedback({ type: 'error', message: 'Valid expiry date is required.' });
      return;
    }

    if (expTimestamp <= mfgTimestamp) {
      setFeedback({ type: 'error', message: 'Expiry date must be strictly later than manufacturing date.' });
      return;
    }

    setSubmittingBatch(true);
    setFeedback(null);
    try {
      await api.createBatch(session.token, {
        batchId: batchId.trim().toUpperCase(),
        medicineId: selectedMedicineId || undefined,
        drugName: drugName.trim(),
        genericName: genericName.trim(),
        dosage: dosage.trim(),
        strength: strength.trim(),
        packaging: packaging.trim(),
        quantity: Number(quantity),
        manufacturingDate: new Date(mfgDate).toISOString(),
        expiryDate: new Date(expDate).toISOString(),
        location: location.trim(),
      });

      setFeedback({
        type: 'success',
        message: `Batch ${batchId} created and registered successfully! Provenance QR code is ready.`,
      });

      // Find created batch
      const newlyCreated: MedicineBatch = {
        batchId: batchId.trim().toUpperCase(),
        medicineId: selectedMedicineId || undefined,
        drugName: drugName.trim(),
        genericName: genericName.trim(),
        dosage: dosage.trim(),
        strength: strength.trim(),
        packaging: packaging.trim(),
        quantity: Number(quantity),
        remainingQuantity: Number(quantity),
        manufacturingDate: new Date(mfgDate).toISOString(),
        expiryDate: new Date(expDate).toISOString(),
        manufacturerName: session.user.organizationName,
        manufacturerAddress: session.user.walletAddress || '0x0000000000000000000000000000000000000000',
        manufacturerOrganizationId: session.user.organizationId,
        currentStatus: 'MANUFACTURED',
        currentOwnerRole: 'MANUFACTURER',
        currentOwnerName: session.user.organizationName,
        currentOwnerAddress: session.user.walletAddress || '0x0000000000000000000000000000000000000000',
        custodianAddress: session.user.walletAddress || '',
        custodianName: session.user.organizationName,
        currentLocation: location.trim(),
        location: location.trim(),
        isRecalled: false,
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setRecentlyCreatedBatch(newlyCreated);
      setBatchId(generateAutoBatchId());
      loadAllData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create batch' });
    } finally {
      setSubmittingBatch(false);
    }
  };

  // Dispatch Batch to Distributor
  const handleDispatch = async (bId: string) => {
    if (!session) return;
    try {
      await api.updateStatus(session.token, bId, {
        newStatus: 'IN_TRANSIT_TO_DISTRIBUTOR',
        location: dispatchLocation,
        temperatureCelsius: Number(dispatchTemp),
        notes: dispatchNotes,
      });
      setDispatchBatchId(null);
      loadAllData();
      alert(`Batch ${bId} dispatched to Distributor successfully!`);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch batch');
    }
  };

  // Filtering Batches
  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      b.batchId.toLowerCase().includes(batchSearch.toLowerCase()) ||
      b.drugName.toLowerCase().includes(batchSearch.toLowerCase()) ||
      (b.genericName && b.genericName.toLowerCase().includes(batchSearch.toLowerCase()));
    const matchesStatus = batchStatusFilter ? b.currentStatus === batchStatusFilter : true;
    return matchesSearch && matchesStatus;
  });

  // Filtering Medicines
  const filteredMedicines = medicines.filter((m) => {
    const mId = m.medicineId || m.id || '';
    return (
      m.name.toLowerCase().includes(medicineSearch.toLowerCase()) ||
      m.genericName.toLowerCase().includes(medicineSearch.toLowerCase()) ||
      mId.toLowerCase().includes(medicineSearch.toLowerCase())
    );
  });

  if (!session) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', textAlign: 'center', padding: '36px' }} className="glass-panel">
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏭</div>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '12px' }}>Manufacturer Operations Portal</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
          Authentication required. Please sign in with an authorized <strong>MANUFACTURER</strong> account to register medicines, synthesize batches, and generate cryptographic QR labels.
        </p>
        <button className="btn btn-primary" onClick={onOpenLogin}>
          Sign In as Manufacturer
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 16px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.8rem' }}>🏭</span>
            <h1 style={{ fontSize: '1.8rem', letterSpacing: '-0.02em' }}>Manufacturer Console</h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'rgba(0, 210, 180, 0.15)',
                color: '#00d2b4',
                border: '1px solid rgba(0, 210, 180, 0.3)',
              }}
            >
              GMP CERTIFIED
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            {session.user.organizationName} &bull; Org ID:{' '}
            <span className="mono" style={{ color: '#38bdf8' }}>{session.user.organizationId || 'ORG-MFG-01'}</span> &bull; License:{' '}
            <span className="mono">{session.user.licenseNumber || 'MFG-IND-88219'}</span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={loadAllData} title="Refresh data">
            🔄 Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setActiveTab('create-batch');
              setBatchId(generateAutoBatchId());
            }}
          >
            + New Batch
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
          marginBottom: '24px',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'overview', label: '📊 Overview & KPIs' },
          { id: 'medicines', label: `💊 Medicine Catalog (${medicines.length})` },
          { id: 'create-batch', label: '⚗️ Formulate & Mint Batch' },
          { id: 'batches', label: `📦 Batch Inventory (${batches.length})` },
          { id: 'qr-center', label: '📱 QR Verification Center' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ManufacturerTab)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab.id ? 'rgba(0, 210, 180, 0.15)' : 'transparent',
              color: activeTab === tab.id ? '#00d2b4' : 'var(--text-muted)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              borderBottom: activeTab === tab.id ? '2px solid #00d2b4' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            color: feedback.type === 'success' ? '#34d399' : '#f87171',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong>{feedback.type === 'success' ? '✓ Success: ' : '⚠️ Error: '}</strong>
            {feedback.message}
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Warning Alert if Expired or Recalled Batches Exist */}
      {(stats.expiredBatches > 0 || stats.recalledBatches > 0) && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '10px',
            marginBottom: '24px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>🚨</span>
          <div>
            <strong>Supply Chain Attention Required: </strong>
            {stats.expiredBatches > 0 && <span>{stats.expiredBatches} batch(es) have expired. </span>}
            {stats.recalledBatches > 0 && <span>{stats.recalledBatches} batch(es) are flagged with active recall notices.</span>}
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW & KPIS */}
      {activeTab === 'overview' && (
        <div>
          {/* KPI Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '28px',
            }}
          >
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Registered Medicines
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 700, color: '#38bdf8', marginTop: '6px' }}>
                {stats.totalMedicines}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Active drug master records
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Total Batches Minted
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 700, color: '#00d2b4', marginTop: '6px' }}>
                {stats.totalBatches}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Immutable production lots
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Active Batches
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 700, color: '#10b981', marginTop: '6px' }}>
                {stats.activeBatches}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Currently valid in supply chain
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Expired Batches
              </div>
              <div
                style={{
                  fontSize: '2.2rem',
                  fontWeight: 700,
                  color: stats.expiredBatches > 0 ? '#ef4444' : 'var(--text-dim)',
                  marginTop: '6px',
                }}
              >
                {stats.expiredBatches}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Past expiry date
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Recalled Batches
              </div>
              <div
                style={{
                  fontSize: '2.2rem',
                  fontWeight: 700,
                  color: stats.recalledBatches > 0 ? '#f59e0b' : 'var(--text-dim)',
                  marginTop: '6px',
                }}
              >
                {stats.recalledBatches}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Security or quality flagged
              </div>
            </div>
          </div>

          {/* Quick Actions & Recent Activity Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
            {/* Quick Actions */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>⚡ Quick Operations</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  className="btn btn-primary"
                  style={{ justifyContent: 'flex-start', padding: '14px 18px', textAlign: 'left' }}
                  onClick={() => {
                    setActiveTab('create-batch');
                    setBatchId(generateAutoBatchId());
                  }}
                >
                  <span style={{ fontSize: '1.3rem', marginRight: '8px' }}>⚗️</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>Formulate &amp; Mint Batch</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 400 }}>
                      Issue unique ID, register expiry and generate QR code
                    </div>
                  </div>
                </button>

                <button
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '14px 18px', textAlign: 'left' }}
                  onClick={() => {
                    setActiveTab('medicines');
                    setShowRegisterMedicineModal(true);
                  }}
                >
                  <span style={{ fontSize: '1.3rem', marginRight: '8px' }}>💊</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>Register New Drug Spec</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>
                      Add medicine name, strength, dosage, and packaging
                    </div>
                  </div>
                </button>

                <button
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '14px 18px', textAlign: 'left' }}
                  onClick={() => setActiveTab('qr-center')}
                >
                  <span style={{ fontSize: '1.3rem', marginRight: '8px' }}>📱</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>QR Labeling Center</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>
                      Export, download, and print physical package labels
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Recent Batch Activity */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.2rem' }}>🕒 Recent Batch Production</h3>
                <button
                  onClick={() => setActiveTab('batches')}
                  style={{ background: 'transparent', border: 'none', color: '#00d2b4', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  View All &rarr;
                </button>
              </div>

              {batches.length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>No batches created yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {batches.slice(0, 4).map((b) => (
                    <div
                      key={b.batchId}
                      style={{
                        padding: '12px 14px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00d2b4' }}>
                          {b.batchId}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 600, marginTop: '2px' }}>
                          {b.drugName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          Qty: {b.quantity.toLocaleString()} units &bull; Exp: {new Date(b.expiryDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <StatusBadge status={b.currentStatus} />
                        <div style={{ marginTop: '6px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                            onClick={() => setSelectedBatchForQr(b)}
                          >
                            📱 QR
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MEDICINE MANAGEMENT */}
      {activeTab === 'medicines' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.4rem' }}>Medicine Master Catalog</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                Standardized drug definitions registered for {session.user.organizationName}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Search by drug name or generic..."
                className="input-field"
                style={{ width: '280px' }}
                value={medicineSearch}
                onChange={(e) => setMedicineSearch(e.target.value)}
              />
              <button className="btn btn-primary" onClick={() => setShowRegisterMedicineModal(true)}>
                + Register Medicine
              </button>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
            {filteredMedicines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🔍</div>
                <p>No medicines found matching your search.</p>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: '12px' }}
                  onClick={() => setShowRegisterMedicineModal(true)}
                >
                  Register First Medicine
                </button>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)' }}>
                    <th style={{ padding: '12px 14px' }}>Medicine ID</th>
                    <th style={{ padding: '12px 14px' }}>Trade Name</th>
                    <th style={{ padding: '12px 14px' }}>Generic Name</th>
                    <th style={{ padding: '12px 14px' }}>Dosage Form</th>
                    <th style={{ padding: '12px 14px' }}>Strength</th>
                    <th style={{ padding: '12px 14px' }}>Packaging</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map((m) => {
                    const mId = m.medicineId || m.id || '';
                    return (
                      <tr
                        key={mId}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '14px' }}>
                          <span className="mono" style={{ color: '#38bdf8', fontWeight: 600 }}>
                            {mId}
                          </span>
                        </td>
                        <td style={{ padding: '14px', fontWeight: 600, color: '#f8fafc' }}>{m.name}</td>
                        <td style={{ padding: '14px', color: 'var(--text-muted)' }}>{m.genericName}</td>
                        <td style={{ padding: '14px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              fontSize: '0.8rem',
                            }}
                          >
                            {m.dosageForm || 'N/A'}
                          </span>
                        </td>
                        <td style={{ padding: '14px' }}>{m.strength || 'Standard'}</td>
                        <td style={{ padding: '14px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                          {m.packaging || 'Standard Packaging'}
                        </td>
                        <td style={{ padding: '14px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                              onClick={() => openEditMedicine(m)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn btn-primary"
                              style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                              onClick={() => {
                                handleSelectMedicine(m);
                                setActiveTab('create-batch');
                              }}
                            >
                              ⚗️ Mint Batch
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CREATE BATCH */}
      {activeTab === 'create-batch' && (
        <div style={{ maxWidth: '840px', margin: '0 auto' }}>
          <div className="glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem' }}>Formulate &amp; Mint Medicine Batch</h2>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '4px' }}>
                  Create an immutable, traceable pharmaceutical lot verified with cryptographic provenance
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setBatchId(generateAutoBatchId())}>
                🎲 Generate New Batch ID
              </button>
            </div>

            {recentlyCreatedBatch && (
              <div
                style={{
                  background: 'rgba(0, 210, 180, 0.1)',
                  border: '1px solid rgba(0, 210, 180, 0.3)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  marginBottom: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ color: '#00d2b4', fontWeight: 700, fontSize: '0.95rem' }}>
                    ✓ Batch {recentlyCreatedBatch.batchId} Ready for Labeling!
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {recentlyCreatedBatch.drugName} &bull; {recentlyCreatedBatch.quantity} units
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                  onClick={() => setSelectedBatchForQr(recentlyCreatedBatch)}
                >
                  📱 Preview &amp; Print QR Label
                </button>
              </div>
            )}

            <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Medicine Preset Selector */}
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Select Registered Medicine Specification
                </label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <select
                    className="input-field"
                    style={{ flex: 1 }}
                    value={selectedMedicineId}
                    onChange={(e) => onMedicineDropdownChange(e.target.value)}
                  >
                    <option value="">-- Choose from Registered Medicines --</option>
                    {medicines.map((m) => {
                      const mId = m.medicineId || m.id || '';
                      return (
                        <option key={mId} value={mId}>
                          {m.name} ({m.genericName}) - {m.strength || m.dosageForm}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowRegisterMedicineModal(true)}
                  >
                    + New Spec
                  </button>
                </div>
              </div>

              {/* Batch ID and Facility */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Batch Identifier (Global Standard)
                  </label>
                  <input
                    type="text"
                    className="input-field mono"
                    style={{ marginTop: '6px' }}
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value.toUpperCase())}
                    placeholder="MED-20261015-ABCDE"
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    Unique across all supply chain nodes
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Production Facility / Cleanroom
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ marginTop: '6px' }}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Apex Plant 1, Cleanroom Suite C"
                    required
                  />
                </div>
              </div>

              {/* Drug Trade Name & Generic Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Drug Trade Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ marginTop: '6px' }}
                    value={drugName}
                    onChange={(e) => setDrugName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Generic Name / API
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ marginTop: '6px' }}
                    value={genericName}
                    onChange={(e) => setGenericName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Strength, Dosage, Packaging */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Strength
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ marginTop: '6px' }}
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    placeholder="e.g. 500mg or 10mg/mL"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Dosage / Form
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ marginTop: '6px' }}
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="e.g. Tablet, IV Infusion"
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Packaging
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ marginTop: '6px' }}
                    value={packaging}
                    onChange={(e) => setPackaging(e.target.value)}
                    placeholder="e.g. 10x10 Blister Pack"
                  />
                </div>
              </div>

              {/* Quantity, Mfg Date, Expiry Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Formulation Units (Quantity)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    style={{ marginTop: '6px' }}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    min={1}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Manufacturing Date
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    style={{ marginTop: '6px' }}
                    value={mfgDate}
                    onChange={(e) => setMfgDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Expiry Date (Must be &gt; Mfg)
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    style={{ marginTop: '6px' }}
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Organization Lock Note */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8rem',
                  color: 'var(--text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>🔒</span>
                <span>
                  This batch will be anchored to manufacturer{' '}
                  <strong style={{ color: '#f8fafc' }}>{session.user.organizationName}</strong> (
                  <span className="mono">{session.user.organizationId || 'ORG-MFG-01'}</span>). Identity is enforced server-side.
                </span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingBatch}
                style={{ marginTop: '8px', padding: '14px', fontSize: '1rem' }}
              >
                {submittingBatch ? 'Registering Batch on Ledger...' : '✓ Mint Batch & Generate Cryptographic QR'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: BATCH INVENTORY & TRACKING */}
      {activeTab === 'batches' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.4rem' }}>Production Batch Inventory</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                Full provenance and lifecycle tracking for manufactured pharmaceutical lots
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search batch ID or drug..."
                className="input-field"
                style={{ width: '240px' }}
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
              />

              <select
                className="input-field"
                style={{ width: '180px' }}
                value={batchStatusFilter}
                onChange={(e) => setBatchStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="MANUFACTURED">MANUFACTURED</option>
                <option value="IN_TRANSIT_TO_DISTRIBUTOR">IN TRANSIT</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="RECALLED">RECALLED</option>
              </select>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
            {filteredBatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📦</div>
                <p>No batches found matching filter criteria.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)' }}>
                    <th style={{ padding: '12px 14px' }}>Batch Identifier</th>
                    <th style={{ padding: '12px 14px' }}>Drug / Specification</th>
                    <th style={{ padding: '12px 14px' }}>Units Available</th>
                    <th style={{ padding: '12px 14px' }}>Mfg / Expiry</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((b) => (
                    <tr
                      key={b.batchId}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '14px' }}>
                        <div className="mono" style={{ color: '#00d2b4', fontWeight: 700 }}>
                          {b.batchId}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                          {b.currentLocation}
                        </div>
                      </td>

                      <td style={{ padding: '14px' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{b.drugName}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                          {b.genericName} &bull; {b.dosage}
                        </div>
                      </td>

                      <td style={{ padding: '14px' }}>
                        <span className="mono" style={{ fontWeight: 600 }}>
                          {b.remainingQuantity.toLocaleString()}
                        </span>{' '}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          / {b.quantity.toLocaleString()}
                        </span>
                      </td>

                      <td style={{ padding: '14px', fontSize: '0.82rem' }}>
                        <div>Mfg: {new Date(b.manufacturingDate).toLocaleDateString()}</div>
                        <div style={{ color: new Date(b.expiryDate).getTime() < Date.now() ? '#ef4444' : 'var(--text-dim)' }}>
                          Exp: {new Date(b.expiryDate).toLocaleDateString()}
                          {new Date(b.expiryDate).getTime() < Date.now() && ' (EXPIRED)'}
                        </div>
                      </td>

                      <td style={{ padding: '14px' }}>
                        <StatusBadge status={b.currentStatus} />
                      </td>

                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                            onClick={() => setSelectedBatchForQr(b)}
                          >
                            📱 QR Label
                          </button>

                          {b.currentStatus === 'MANUFACTURED' && (
                            <button
                              className="btn btn-primary"
                              style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                              onClick={() => setDispatchBatchId(b.batchId)}
                            >
                              🚚 Dispatch
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: QR VERIFICATION & LABELING CENTER */}
      {activeTab === 'qr-center' && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.4rem' }}>QR Verification &amp; Packaging Labels</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Standard GS1-compatible cryptographic QR labels for pharmaceutical packaging inspection
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            {batches.map((b) => {
              const verifyUrl = `${window.location.origin}/?verify=${encodeURIComponent(b.batchId)}`;
              return (
                <div
                  key={b.batchId}
                  className="glass-panel"
                  style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className="mono" style={{ fontSize: '0.95rem', fontWeight: 700, color: '#00d2b4' }}>
                        {b.batchId}
                      </span>
                      <StatusBadge status={b.currentStatus} />
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
                      {b.drugName}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                      {b.genericName} &bull; {b.dosage}
                    </div>

                    <div
                      style={{
                        background: '#ffffff',
                        borderRadius: '12px',
                        padding: '12px',
                        display: 'flex',
                        justifyContent: 'center',
                        margin: '16px auto',
                        width: '140px',
                        boxShadow: '0 4px 15px rgba(0, 210, 180, 0.2)',
                      }}
                    >
                      <svg width="116" height="116" viewBox="0 0 200 200" fill="#000000">
                        <rect x="10" y="10" width="50" height="50" fill="#070a12" rx="4" />
                        <rect x="20" y="20" width="30" height="30" fill="#ffffff" rx="2" />
                        <rect x="27" y="27" width="16" height="16" fill="#00d2b4" rx="2" />
                        <rect x="140" y="10" width="50" height="50" fill="#070a12" rx="4" />
                        <rect x="150" y="20" width="30" height="30" fill="#ffffff" rx="2" />
                        <rect x="157" y="27" width="16" height="16" fill="#00d2b4" rx="2" />
                        <rect x="10" y="140" width="50" height="50" fill="#070a12" rx="4" />
                        <rect x="20" y="150" width="30" height="30" fill="#ffffff" rx="2" />
                        <rect x="27" y="157" width="16" height="16" fill="#00d2b4" rx="2" />
                        <rect x="75" y="75" width="14" height="14" fill="#00b89e" />
                        <rect x="95" y="95" width="14" height="14" fill="#00d2b4" rx="2" />
                        <rect x="155" y="175" width="14" height="14" fill="#00d2b4" />
                      </svg>
                    </div>

                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-dim)',
                        background: 'rgba(0,0,0,0.25)',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        wordBreak: 'break-all',
                        textAlign: 'center',
                      }}
                    >
                      {verifyUrl}
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '0.78rem', padding: '8px 10px' }}
                      onClick={() => setSelectedBatchForQr(b)}
                    >
                      🖨️ Print Label
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '8px 10px' }}
                      onClick={() => {
                        navigator.clipboard?.writeText(verifyUrl);
                        alert('Verification link copied!');
                      }}
                    >
                      📋 Copy Link
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* REGISTER MEDICINE MODAL */}
      {showRegisterMedicineModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowRegisterMedicineModal(false)}
        >
          <div
            className="glass-panel"
            style={{ maxWidth: '520px', width: '100%', padding: '28px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.25rem', color: '#f8fafc' }}>💊 Register New Medicine Specification</h3>
              <button
                onClick={() => setShowRegisterMedicineModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRegisterMedicine} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Drug Trade Name *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Paracetamol Infusion USP"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Generic Name (API) *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Paracetamol / Acetaminophen"
                  value={medGenericName}
                  onChange={(e) => setMedGenericName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Dosage Form
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Injection, Tablet, Syrup"
                    value={medDosageForm}
                    onChange={(e) => setMedDosageForm(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Strength
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. 500mg, 10mg/mL"
                    value={medStrength}
                    onChange={(e) => setMedStrength(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Standard Packaging
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. 100mL Glass Vial / 10x10 Blister"
                  value={medPackaging}
                  onChange={(e) => setMedPackaging(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Description / Indications
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="Enter therapeutic indications, storage requirements, etc."
                  value={medDescription}
                  onChange={(e) => setMedDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={registeringMed}>
                  {registeringMed ? 'Saving Specification...' : '✓ Register Medicine'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowRegisterMedicineModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MEDICINE MODAL */}
      {editingMedicine && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setEditingMedicine(null)}
        >
          <div
            className="glass-panel"
            style={{ maxWidth: '500px', width: '100%', padding: '28px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>✏️ Edit Medicine Details</h3>
                <div style={{ fontSize: '0.8rem', color: '#00d2b4', marginTop: '2px' }}>
                  {editingMedicine.name} ({editingMedicine.medicineId || editingMedicine.id})
                </div>
              </div>
              <button
                onClick={() => setEditingMedicine(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateMedicine} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Dosage Form
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editDosageForm}
                    onChange={(e) => setEditDosageForm(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Strength
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editStrength}
                    onChange={(e) => setEditStrength(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Packaging Specifications
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={editPackaging}
                  onChange={(e) => setEditPackaging(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Therapeutic Description / Notes
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={savingEditMed}>
                  {savingEditMed ? 'Updating...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEditingMedicine(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISPATCH TO DISTRIBUTOR MODAL */}
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
          onClick={() => setDispatchBatchId(null)}
        >
          <div
            className="glass-panel"
            style={{ maxWidth: '440px', width: '100%', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>🚚 Dispatch Batch: {dispatchBatchId}</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '14px' }}>
              Hand over batch custody to authorized distributor partner
            </p>
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

      {/* QR CODE MODAL */}
      {selectedBatchForQr && (
        <QrModal batch={selectedBatchForQr} onClose={() => setSelectedBatchForQr(null)} />
      )}
    </div>
  );
};
