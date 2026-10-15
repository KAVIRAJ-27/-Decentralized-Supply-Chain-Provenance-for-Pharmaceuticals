import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { UserSession, Organization, User, AdminActivity, OrganizationType, UserRole } from '../types';
import { RoleBadge } from '../components/RoleBadge';

interface Props {
  session: UserSession | null;
  onOpenLogin: () => void;
}

type AdminSection = 'overview' | 'organizations' | 'users' | 'activities' | 'safety';

export const AdminPage: React.FC<Props> = ({ session, onOpenLogin }) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Data states
  const [metrics, setMetrics] = useState<any>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activities, setActivities] = useState<AdminActivity[]>([]);

  // Search & Filter States: Organizations
  const [orgSearch, setOrgSearch] = useState('');
  const [orgTypeFilter, setOrgTypeFilter] = useState<string>('');
  const [orgStatusFilter, setOrgStatusFilter] = useState<string>('');

  // Search & Filter States: Users
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('');
  const [userActiveFilter, setUserActiveFilter] = useState<string>('');

  // Search: Activities
  const [activitySearch, setActivitySearch] = useState('');

  // Modals
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showEditOrgModal, setShowEditOrgModal] = useState<Organization | null>(null);
  const [showViewOrgModal, setShowViewOrgModal] = useState<Organization | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

  // Form states: New Organization
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgType, setNewOrgType] = useState<OrganizationType>('MANUFACTURER');
  const [newOrgAddress, setNewOrgAddress] = useState('');
  const [newOrgEmail, setNewOrgEmail] = useState('');
  const [newOrgLicense, setNewOrgLicense] = useState('');
  const [newOrgWallet, setNewOrgWallet] = useState('');
  const [submittingOrg, setSubmittingOrg] = useState(false);

  // Form states: Edit Organization
  const [editOrgName, setEditOrgName] = useState('');
  const [editOrgAddress, setEditOrgAddress] = useState('');
  const [editOrgEmail, setEditOrgEmail] = useState('');
  const [editOrgWallet, setEditOrgWallet] = useState('');
  const [submittingEditOrg, setSubmittingEditOrg] = useState(false);

  // Form states: New User
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('MANUFACTURER');
  const [newUserOrgId, setNewUserOrgId] = useState('');
  const [submittingUser, setSubmittingUser] = useState(false);

  // Recall dialog (Safety tab)
  const [recallBatchId, setRecallBatchId] = useState('');
  const [recallReason, setRecallReason] = useState('Subpotency detected during post-market surveillance testing');
  const [recalling, setRecalling] = useState(false);

  // Load all initial data
  const loadAdminData = async () => {
    if (!session || session.user.role !== 'ADMIN') return;
    setLoading(true);
    setErrorBanner(null);

    try {
      const [metricsData, orgsData, usersData, actsData] = await Promise.all([
        api.getAdminMetrics(session.token).catch(() => null),
        api.getOrganizations(session.token).catch(() => []),
        api.getUsers(session.token).catch(() => []),
        api.getAdminActivities(session.token, 50).catch(() => []),
      ]);

      setMetrics(metricsData);
      setOrganizations(orgsData);
      setUsers(usersData);
      setActivities(actsData);

      if (orgsData.length > 0 && !newUserOrgId) {
        setNewUserOrgId(orgsData[0].organizationId);
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to load administrative records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [session]);

  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 5000);
  };

  // --------------------------------------------------------------------------
  // Organization Handlers
  // --------------------------------------------------------------------------

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSubmittingOrg(true);
    setErrorBanner(null);

    try {
      await api.createOrganization(session.token, {
        name: newOrgName,
        type: newOrgType,
        address: newOrgAddress,
        contactEmail: newOrgEmail,
        licenseNumber: newOrgLicense,
        walletAddress: newOrgWallet || undefined,
      });

      showSuccess(`Organization '${newOrgName}' successfully accredited and registered.`);
      setShowCreateOrgModal(false);
      setNewOrgName('');
      setNewOrgAddress('');
      setNewOrgEmail('');
      setNewOrgLicense('');
      setNewOrgWallet('');
      loadAdminData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to create organization');
    } finally {
      setSubmittingOrg(false);
    }
  };

  const handleOpenEditOrg = (org: Organization) => {
    setShowEditOrgModal(org);
    setEditOrgName(org.name);
    setEditOrgAddress(org.address);
    setEditOrgEmail(org.contactEmail);
    setEditOrgWallet(org.walletAddress || '');
  };

  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !showEditOrgModal) return;
    setSubmittingEditOrg(true);
    setErrorBanner(null);

    try {
      await api.updateOrganization(session.token, showEditOrgModal.organizationId, {
        name: editOrgName,
        address: editOrgAddress,
        contactEmail: editOrgEmail,
        walletAddress: editOrgWallet || undefined,
      });

      showSuccess(`Organization '${editOrgName}' details updated.`);
      setShowEditOrgModal(null);
      loadAdminData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to update organization');
    } finally {
      setSubmittingEditOrg(false);
    }
  };

  const handleToggleOrgStatus = async (org: Organization) => {
    if (!session) return;
    const newStatus = org.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = newStatus === 'ACTIVE' ? 'activate' : 'deactivate';

    if (
      !confirm(
        `Are you sure you want to ${actionLabel} '${org.name}'?\n\nNote: Historical supply chain and batch records will remain permanently intact.`
      )
    ) {
      return;
    }

    try {
      await api.setOrganizationStatus(session.token, org.organizationId, newStatus);
      showSuccess(`Organization '${org.name}' is now ${newStatus}.`);
      loadAdminData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to change organization status');
    }
  };

  // --------------------------------------------------------------------------
  // User Handlers
  // --------------------------------------------------------------------------

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSubmittingUser(true);
    setErrorBanner(null);

    try {
      await api.createUser(session.token, {
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
        organizationId: newUserOrgId,
      });

      showSuccess(`User account '${newUserName}' (${newUserRole}) created successfully.`);
      setShowCreateUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      loadAdminData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to create user account');
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    if (!session) return;
    const nextStatus = !user.isActive;
    const actionLabel = nextStatus ? 'activate' : 'deactivate';

    if (!confirm(`Are you sure you want to ${actionLabel} user account '${user.name}'?`)) {
      return;
    }

    try {
      await api.setUserStatus(session.token, user.id, nextStatus);
      showSuccess(`User '${user.name}' account is now ${nextStatus ? 'Active' : 'Deactivated'}.`);
      loadAdminData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to change user status');
    }
  };

  // --------------------------------------------------------------------------
  // Emergency Recall Handler
  // --------------------------------------------------------------------------

  const handleTriggerRecall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !recallBatchId.trim()) return;

    if (!confirm(`Are you certain you want to trigger an irreversible regulatory recall for ${recallBatchId}?`)) {
      return;
    }

    setRecalling(true);
    try {
      await api.recall(session.token, recallBatchId.trim().toUpperCase(), recallReason);
      showSuccess(`Emergency recall successfully issued for batch ${recallBatchId}.`);
      setRecallBatchId('');
      loadAdminData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to trigger recall');
    } finally {
      setRecalling(false);
    }
  };

  // Unauthenticated view
  if (!session || session.user.role !== 'ADMIN') {
    return (
      <div style={{ maxWidth: '640px', margin: '60px auto', textAlign: 'center', padding: '36px' }} className="glass-panel">
        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⚖️</div>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '12px' }}>National Drug Regulatory Console</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
          Access to institutional management, participant accreditation, and system governance is restricted to authenticated Admin personnel.
        </p>
        <button className="btn btn-primary" onClick={onOpenLogin}>
          Sign In as Admin Regulator
        </button>
      </div>
    );
  }

  // Filtered Lists
  const filteredOrgs = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(orgSearch.toLowerCase()) ||
      org.licenseNumber.toLowerCase().includes(orgSearch.toLowerCase()) ||
      org.contactEmail.toLowerCase().includes(orgSearch.toLowerCase()) ||
      org.organizationId.toLowerCase().includes(orgSearch.toLowerCase());
    const matchesType = !orgTypeFilter || org.type === orgTypeFilter;
    const matchesStatus = !orgStatusFilter || org.status === orgStatusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.organizationName && u.organizationName.toLowerCase().includes(userSearch.toLowerCase()));
    const matchesRole = !userRoleFilter || u.role === userRoleFilter;
    const matchesActive =
      userActiveFilter === '' ? true : userActiveFilter === 'ACTIVE' ? u.isActive : !u.isActive;
    return matchesSearch && matchesRole && matchesActive;
  });

  const filteredActivities = activities.filter((act) => {
    if (!activitySearch) return true;
    const q = activitySearch.toLowerCase();
    return (
      act.action.toLowerCase().includes(q) ||
      act.actorName.toLowerCase().includes(q) ||
      act.targetName.toLowerCase().includes(q) ||
      (act.details && act.details.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Top Banner Alert System */}
      {errorBanner && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '16px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            fontSize: '0.88rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠️ {errorBanner}</span>
          <button
            onClick={() => setErrorBanner(null)}
            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            &times;
          </button>
        </div>
      )}

      {successBanner && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '16px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#34d399',
            fontSize: '0.88rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✓ {successBanner}</span>
          <button
            onClick={() => setSuccessBanner(null)}
            style={{ background: 'transparent', border: 'none', color: '#34d399', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Admin Dashboard Container with Sidebar Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '24px', alignItems: 'flex-start' }}>
        {/* ================================================================== */}
        {/* Sidebar Navigation */}
        {/* ================================================================== */}
        <aside
          className="glass-panel"
          style={{
            padding: '20px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            position: 'sticky',
            top: '80px',
          }}
        >
          <div style={{ padding: '0 8px 12px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Admin Module
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
              Control Panel
            </div>
          </div>

          <button
            onClick={() => setActiveSection('overview')}
            className="btn btn-secondary"
            style={{
              justifyContent: 'flex-start',
              padding: '10px 14px',
              fontSize: '0.85rem',
              background: activeSection === 'overview' ? 'rgba(0, 210, 180, 0.15)' : 'transparent',
              borderColor: activeSection === 'overview' ? 'var(--primary)' : 'transparent',
              color: activeSection === 'overview' ? 'var(--primary)' : 'var(--text-muted)',
            }}
          >
            📊 Dashboard Overview
          </button>

          <button
            onClick={() => setActiveSection('organizations')}
            className="btn btn-secondary"
            style={{
              justifyContent: 'flex-start',
              padding: '10px 14px',
              fontSize: '0.85rem',
              background: activeSection === 'organizations' ? 'rgba(0, 210, 180, 0.15)' : 'transparent',
              borderColor: activeSection === 'organizations' ? 'var(--primary)' : 'transparent',
              color: activeSection === 'organizations' ? 'var(--primary)' : 'var(--text-muted)',
            }}
          >
            🏢 Organizations ({organizations.length})
          </button>

          <button
            onClick={() => setActiveSection('users')}
            className="btn btn-secondary"
            style={{
              justifyContent: 'flex-start',
              padding: '10px 14px',
              fontSize: '0.85rem',
              background: activeSection === 'users' ? 'rgba(0, 210, 180, 0.15)' : 'transparent',
              borderColor: activeSection === 'users' ? 'var(--primary)' : 'transparent',
              color: activeSection === 'users' ? 'var(--primary)' : 'var(--text-muted)',
            }}
          >
            👥 User Management ({users.length})
          </button>

          <button
            onClick={() => setActiveSection('activities')}
            className="btn btn-secondary"
            style={{
              justifyContent: 'flex-start',
              padding: '10px 14px',
              fontSize: '0.85rem',
              background: activeSection === 'activities' ? 'rgba(0, 210, 180, 0.15)' : 'transparent',
              borderColor: activeSection === 'activities' ? 'var(--primary)' : 'transparent',
              color: activeSection === 'activities' ? 'var(--primary)' : 'var(--text-muted)',
            }}
          >
            📜 Activity Logs ({activities.length})
          </button>

          <button
            onClick={() => setActiveSection('safety')}
            className="btn btn-secondary"
            style={{
              justifyContent: 'flex-start',
              padding: '10px 14px',
              fontSize: '0.85rem',
              background: activeSection === 'safety' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              borderColor: activeSection === 'safety' ? '#ef4444' : 'transparent',
              color: activeSection === 'safety' ? '#f87171' : 'var(--text-muted)',
            }}
          >
            🚨 Safety &amp; Recalls
          </button>

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', fontSize: '0.72rem', color: 'var(--text-dim)', paddingLeft: '8px' }}>
            Logged in as:<br />
            <strong style={{ color: '#f8fafc' }}>{session.user.name}</strong>
          </div>
        </aside>

        {/* ================================================================== */}
        {/* Main Content Area */}
        {/* ================================================================== */}
        <section>
          {/* SECTION 1: OVERVIEW */}
          {activeSection === 'overview' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h1 style={{ fontSize: '1.8rem' }}>System Overview</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Real-time regulatory telemetry across participants, credentials, and ledger state.
                  </p>
                </div>
                <button className="btn btn-secondary" onClick={loadAdminData} disabled={loading}>
                  {loading ? 'Refreshing...' : '🔄 Refresh Data'}
                </button>
              </div>

              {/* Metric Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total Organizations</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                    {metrics?.organizations?.total ?? organizations.length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '4px' }}>
                    {metrics?.organizations?.active ?? organizations.filter((o) => o.status === 'ACTIVE').length} Active &bull;{' '}
                    <span style={{ color: '#fbbf24' }}>
                      {metrics?.organizations?.inactive ?? organizations.filter((o) => o.status !== 'ACTIVE').length} Inactive
                    </span>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Registered Users</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                    {metrics?.users?.total ?? users.length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '4px' }}>
                    {metrics?.users?.active ?? users.filter((u) => u.isActive).length} Active Credentials
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Administrative Audits</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>
                    {activities.length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Immutable action logs</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Ledger Batches</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#00d2b4', marginTop: '4px' }}>
                    {metrics?.batchesCount ?? 1}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#00d2b4', marginTop: '4px' }}>Tracked on blockchain</div>
                </div>
              </div>

              {/* Organization Type Distribution Breakdown */}
              <div className="glass-panel" style={{ padding: '22px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: '#f8fafc' }}>
                  Accredited Supply Chain Participants by Type
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  {(['MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY', 'HOSPITAL'] as OrganizationType[]).map((type) => {
                    const count = organizations.filter((o) => o.type === type).length;
                    return (
                      <div
                        key={type}
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          padding: '14px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <RoleBadge role={type} />
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '8px' }}>{count}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                          Verified entities
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Administrative Activity Stream */}
              <div className="glass-panel" style={{ padding: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', color: '#f8fafc' }}>Recent Administrative Activities</h3>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                    onClick={() => setActiveSection('activities')}
                  >
                    View All Logs &rarr;
                  </button>
                </div>

                {activities.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>No activities logged yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activities.slice(0, 5).map((act) => (
                      <div
                        key={act.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: 'rgba(255,255,255,0.02)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.04)',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: act.action.includes('CREATED') || act.action.includes('ACTIVATED')
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(245, 158, 11, 0.15)',
                                color: act.action.includes('CREATED') || act.action.includes('ACTIVATED') ? '#34d399' : '#fbbf24',
                              }}
                            >
                              {act.action.replace(/_/g, ' ')}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{act.targetName}</span>
                          </div>
                          {act.details && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {act.details}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                            {new Date(act.timestamp).toLocaleString()}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>by {act.actorName}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 2: ORGANIZATIONS */}
          {activeSection === 'organizations' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1 style={{ fontSize: '1.8rem' }}>Organization Management</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Accredit and manage manufacturers, distributors, pharmacies, and hospital networks.
                  </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreateOrgModal(true)}>
                  + Add New Organization
                </button>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search by name, license number, or email..."
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  style={{ flex: 2, minWidth: '220px' }}
                />

                <select
                  className="input-field"
                  value={orgTypeFilter}
                  onChange={(e) => setOrgTypeFilter(e.target.value)}
                  style={{ flex: 1, minWidth: '160px' }}
                >
                  <option value="">All Types</option>
                  <option value="MANUFACTURER">Manufacturer</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="PHARMACY">Pharmacy</option>
                  <option value="HOSPITAL">Hospital</option>
                </select>

                <select
                  className="input-field"
                  value={orgStatusFilter}
                  onChange={(e) => setOrgStatusFilter(e.target.value)}
                  style={{ flex: 1, minWidth: '140px' }}
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>

              {/* Organizations Table */}
              <div className="glass-panel" style={{ padding: '16px', overflowX: 'auto' }}>
                {filteredOrgs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏢</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No organizations match the filter criteria.</div>
                    <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Try resetting search keywords or status filters.</div>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '12px 14px' }}>Organization</th>
                        <th style={{ padding: '12px 14px' }}>Type</th>
                        <th style={{ padding: '12px 14px' }}>License Number</th>
                        <th style={{ padding: '12px 14px' }}>Contact Email</th>
                        <th style={{ padding: '12px 14px' }}>Status</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrgs.map((org) => {
                        const isActive = org.status === 'ACTIVE';
                        return (
                          <tr
                            key={org.organizationId}
                            style={{
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            <td style={{ padding: '14px' }}>
                              <div style={{ fontWeight: 700, color: '#f8fafc' }}>{org.name}</div>
                              <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                                {org.organizationId}
                              </div>
                            </td>
                            <td style={{ padding: '14px' }}>
                              <RoleBadge role={org.type} />
                            </td>
                            <td style={{ padding: '14px' }}>
                              <span className="mono" style={{ color: '#38bdf8' }}>{org.licenseNumber}</span>
                            </td>
                            <td style={{ padding: '14px', color: 'var(--text-muted)' }}>
                              {org.contactEmail}
                            </td>
                            <td style={{ padding: '14px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: '9999px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: isActive ? '#34d399' : '#f87171',
                                  border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                }}
                              >
                                {org.status}
                              </span>
                            </td>
                            <td style={{ padding: '14px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                  onClick={() => setShowViewOrgModal(org)}
                                >
                                  Details
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                  onClick={() => handleOpenEditOrg(org)}
                                >
                                  Edit
                                </button>
                                <button
                                  className={isActive ? 'btn btn-danger' : 'btn btn-primary'}
                                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                  onClick={() => handleToggleOrgStatus(org)}
                                >
                                  {isActive ? 'Deactivate' : 'Activate'}
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

          {/* SECTION 3: USERS */}
          {activeSection === 'users' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1 style={{ fontSize: '1.8rem' }}>User Management</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Issue credentials, assign accredited roles, and manage institutional accounts.
                  </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreateUserModal(true)}>
                  + Add New User
                </button>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search by user name, work email, or organization..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{ flex: 2, minWidth: '220px' }}
                />

                <select
                  className="input-field"
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  style={{ flex: 1, minWidth: '160px' }}
                >
                  <option value="">All Roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MANUFACTURER">Manufacturer</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="PHARMACY">Pharmacy</option>
                  <option value="HOSPITAL">Hospital</option>
                </select>

                <select
                  className="input-field"
                  value={userActiveFilter}
                  onChange={(e) => setUserActiveFilter(e.target.value)}
                  style={{ flex: 1, minWidth: '140px' }}
                >
                  <option value="">All Access States</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Deactivated Only</option>
                </select>
              </div>

              {/* Users Table */}
              <div className="glass-panel" style={{ padding: '16px', overflowX: 'auto' }}>
                {filteredUsers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👥</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No users found matching query.</div>
                    <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Try clearing filters or search parameters.</div>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '12px 14px' }}>Personnel</th>
                        <th style={{ padding: '12px 14px' }}>Assigned Role</th>
                        <th style={{ padding: '12px 14px' }}>Organization</th>
                        <th style={{ padding: '12px 14px' }}>Status</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => {
                        const isSelf = u.id === session.user.id;
                        return (
                          <tr
                            key={u.id}
                            style={{
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                            }}
                          >
                            <td style={{ padding: '14px' }}>
                              <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                                {u.name} {isSelf && <span style={{ fontSize: '0.7rem', color: '#00d2b4' }}>(You)</span>}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                            </td>
                            <td style={{ padding: '14px' }}>
                              <RoleBadge role={u.role} />
                            </td>
                            <td style={{ padding: '14px' }}>
                              <div style={{ color: '#e2e8f0' }}>{u.organizationName || 'N/A'}</div>
                              <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                {u.organizationId}
                              </div>
                            </td>
                            <td style={{ padding: '14px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: '9999px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: u.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: u.isActive ? '#34d399' : '#f87171',
                                }}
                              >
                                {u.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                              </span>
                            </td>
                            <td style={{ padding: '14px', textAlign: 'right' }}>
                              {!isSelf && (
                                <button
                                  className={u.isActive ? 'btn btn-danger' : 'btn btn-primary'}
                                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                  onClick={() => handleToggleUserStatus(u)}
                                >
                                  {u.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                              )}
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

          {/* SECTION 4: ACTIVITY LOGS */}
          {activeSection === 'activities' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h1 style={{ fontSize: '1.8rem' }}>Administrative Audit Trail</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Chronological activity log of accreditation, user provisioning, and state modifications.
                  </p>
                </div>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Filter logs by action or entity..."
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  style={{ maxWidth: '300px' }}
                />
              </div>

              <div className="glass-panel" style={{ padding: '16px' }}>
                {filteredActivities.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                    No audit records match your query.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '12px 14px' }}>Timestamp</th>
                        <th style={{ padding: '12px 14px' }}>Action Trigger</th>
                        <th style={{ padding: '12px 14px' }}>Target Entity</th>
                        <th style={{ padding: '12px 14px' }}>Details</th>
                        <th style={{ padding: '12px 14px' }}>Actor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActivities.map((act) => (
                        <tr key={act.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                              {new Date(act.timestamp).toLocaleString()}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: 'rgba(0, 210, 180, 0.1)',
                                color: '#00d2b4',
                                border: '1px solid rgba(0, 210, 180, 0.3)',
                              }}
                            >
                              {act.action}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#f8fafc' }}>{act.targetName}</div>
                            <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                              {act.targetId}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                            {act.details || 'N/A'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>{act.actorName}</div>
                            <div style={{ fontSize: '0.7rem', color: '#f59e0b' }}>{act.actorRole}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* SECTION 5: SAFETY & RECALLS */}
          {activeSection === 'safety' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h1 style={{ fontSize: '1.8rem', color: '#f87171' }}>Emergency Recall &amp; Safety Protocol</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Irrevocably flag tainted or counter medication batches across public verification portals.
                </p>
              </div>

              <div
                className="glass-panel"
                style={{
                  padding: '24px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.05)',
                  marginBottom: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '1.5rem' }}>🚨</span>
                  <h3 style={{ fontSize: '1.2rem', color: '#f87171' }}>Issue Regulatory Recall Notice</h3>
                </div>
                <p style={{ color: '#fca5a5', fontSize: '0.85rem', marginBottom: '16px' }}>
                  Broadcasting a recall updates the smart contract ledger, stops hospital dispensations, and alerts inspectors immediately upon scanning.
                </p>

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
                      <label style={{ fontSize: '0.75rem', color: '#fca5a5' }}>Official Recall Rationale</label>
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
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: ADD NEW ORGANIZATION */}
      {/* ==================================================================== */}
      {showCreateOrgModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowCreateOrgModal(false)}
        >
          <div
            className="glass-panel"
            style={{ maxWidth: '520px', width: '100%', padding: '28px', background: '#0d1527' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.3rem' }}>Accredit New Organization</h2>
              <button
                onClick={() => setShowCreateOrgModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateOrganization} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Legal Entity Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Apex Biotech Pharmaceuticals Ltd."
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Organization Type</label>
                  <select
                    className="input-field"
                    value={newOrgType}
                    onChange={(e) => setNewOrgType(e.target.value as OrganizationType)}
                    required
                  >
                    <option value="MANUFACTURER">Manufacturer</option>
                    <option value="DISTRIBUTOR">Distributor</option>
                    <option value="PHARMACY">Pharmacy</option>
                    <option value="HOSPITAL">Hospital</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Drug Regulatory License</label>
                  <input
                    type="text"
                    className="input-field mono"
                    placeholder="e.g. MFG-FDA-8832-GMP"
                    value={newOrgLicense}
                    onChange={(e) => setNewOrgLicense(e.target.value.toUpperCase())}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Compliance Contact Email</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="compliance@organization.com"
                  value={newOrgEmail}
                  onChange={(e) => setNewOrgEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Physical Address / Formulation Facility</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Suite, Street, City, Industrial Corridor"
                  value={newOrgAddress}
                  onChange={(e) => setNewOrgAddress(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>EVM Wallet Address (Optional)</label>
                <input
                  type="text"
                  className="input-field mono"
                  placeholder="0x..."
                  value={newOrgWallet}
                  onChange={(e) => setNewOrgWallet(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submittingOrg}>
                  {submittingOrg ? 'Registering...' : '✓ Issue Accreditation'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowCreateOrgModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: EDIT ORGANIZATION */}
      {/* ==================================================================== */}
      {showEditOrgModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowEditOrgModal(null)}
        >
          <div
            className="glass-panel"
            style={{ maxWidth: '500px', width: '100%', padding: '28px', background: '#0d1527' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.3rem' }}>Edit Organization</h2>
              <button
                onClick={() => setShowEditOrgModal(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateOrganization} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Entity Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={editOrgName}
                  onChange={(e) => setEditOrgName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Contact Email</label>
                <input
                  type="email"
                  className="input-field"
                  value={editOrgEmail}
                  onChange={(e) => setEditOrgEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Physical Facility Address</label>
                <input
                  type="text"
                  className="input-field"
                  value={editOrgAddress}
                  onChange={(e) => setEditOrgAddress(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>EVM Wallet Address</label>
                <input
                  type="text"
                  className="input-field mono"
                  value={editOrgWallet}
                  onChange={(e) => setEditOrgWallet(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submittingEditOrg}>
                  {submittingEditOrg ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowEditOrgModal(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: VIEW ORGANIZATION DETAILS */}
      {/* ==================================================================== */}
      {showViewOrgModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowViewOrgModal(null)}
        >
          <div
            className="glass-panel"
            style={{ maxWidth: '520px', width: '100%', padding: '28px', background: '#0d1527' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RoleBadge role={showViewOrgModal.type} />
                <h2 style={{ fontSize: '1.25rem', color: '#f8fafc' }}>{showViewOrgModal.name}</h2>
              </div>
              <button
                onClick={() => setShowViewOrgModal(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Organization ID</div>
                <div className="mono" style={{ color: '#00d2b4', marginTop: '2px' }}>{showViewOrgModal.organizationId}</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Regulatory License</div>
                <div className="mono" style={{ color: '#38bdf8', marginTop: '2px' }}>{showViewOrgModal.licenseNumber}</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Physical Facility</div>
                <div style={{ marginTop: '2px' }}>{showViewOrgModal.address}</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Contact Email</div>
                <div style={{ marginTop: '2px', color: '#e2e8f0' }}>{showViewOrgModal.contactEmail}</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>EVM Stamped Wallet</div>
                <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '2px', wordBreak: 'break-all' }}>
                  {showViewOrgModal.walletAddress || 'None provided'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Onboarding Date</div>
                <div style={{ marginTop: '2px' }}>{new Date(showViewOrgModal.createdAt).toLocaleString()}</div>
              </div>
            </div>

            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '20px' }}
              onClick={() => setShowViewOrgModal(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: ADD NEW USER */}
      {/* ==================================================================== */}
      {showCreateUserModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowCreateUserModal(false)}
        >
          <div
            className="glass-panel"
            style={{ maxWidth: '500px', width: '100%', padding: '28px', background: '#0d1527' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.3rem' }}>Provision User Account</h2>
              <button
                onClick={() => setShowCreateUserModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Full Personnel Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Dr. Jennifer Hayes"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Institutional Work Email</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="name@organization.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Initial Password (min 6 chars)</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>System Role</label>
                  <select
                    className="input-field"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    required
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MANUFACTURER">Manufacturer</option>
                    <option value="DISTRIBUTOR">Distributor</option>
                    <option value="PHARMACY">Pharmacy</option>
                    <option value="HOSPITAL">Hospital</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Linked Organization</label>
                  <select
                    className="input-field"
                    value={newUserOrgId}
                    onChange={(e) => setNewUserOrgId(e.target.value)}
                    required
                  >
                    {organizations.map((org) => (
                      <option key={org.organizationId} value={org.organizationId}>
                        {org.name} ({org.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submittingUser}>
                  {submittingUser ? 'Provisioning...' : '✓ Provision Account'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowCreateUserModal(false)}
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
