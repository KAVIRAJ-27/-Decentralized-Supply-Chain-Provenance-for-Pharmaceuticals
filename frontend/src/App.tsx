import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { PublicVerifyPage } from './pages/PublicVerifyPage';
import { ManufacturerPage } from './pages/ManufacturerPage';
import { DistributorPage } from './pages/DistributorPage';
import { PharmacyPage } from './pages/PharmacyPage';
import { HospitalPage } from './pages/HospitalPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { AccessDenied } from './components/AccessDenied';
import { UserSession, UserRole } from './types';
import { api } from './services/api';

const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  ADMIN: 'admin',
  MANUFACTURER: 'manufacturer',
  DISTRIBUTOR: 'distributor',
  PHARMACY: 'pharmacy',
  HOSPITAL: 'hospital',
  CONSUMER: 'verify',
};

const ROUTE_REQUIRED_ROLES: Record<string, UserRole[]> = {
  admin: ['ADMIN'],
  manufacturer: ['MANUFACTURER'],
  distributor: ['DISTRIBUTOR'],
  pharmacy: ['PHARMACY', 'HOSPITAL'],
  hospital: ['HOSPITAL', 'PHARMACY'],
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('verify');
  const [session, setSession] = useState<UserSession | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [redirectReason, setRedirectReason] = useState<string | null>(null);
  const [urlBatchId, setUrlBatchId] = useState<string | undefined>(undefined);
  const [globalNotice, setGlobalNotice] = useState<string | null>(null);

  // Parse path to route key
  const getRouteFromLocation = useCallback((): string => {
    const segments = window.location.pathname.replace(/^\/+/, '').split('/');
    const path = segments[0]?.toLowerCase() || '';
    if (['admin', 'manufacturer', 'distributor', 'pharmacy', 'hospital', 'login', 'verify'].includes(path)) {
      return path;
    }
    // Also check query param ?tab=
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['admin', 'manufacturer', 'distributor', 'pharmacy', 'hospital', 'login', 'verify'].includes(tabParam)) {
      return tabParam;
    }
    return 'verify';
  }, []);

  const navigateTo = (tab: string, reason?: string) => {
    setActiveTab(tab);
    setRedirectReason(reason || null);
    const newPath = tab === 'verify' ? '/' : `/${tab}`;
    try {
      window.history.pushState({}, '', newPath);
    } catch (e) {
      // Fallback in test/restricted environments
    }
  };

  // 1. Initial Load & Route Sync
  useEffect(() => {
    const initialRoute = getRouteFromLocation();
    const segments = window.location.pathname.replace(/^\/+/, '').split('/');
    const params = new URLSearchParams(window.location.search);
    const queryVerify = params.get('verify') || params.get('batch');

    // Handle direct public verification route (/verify/:batchId or ?verify=)
    if (segments[0]?.toLowerCase() === 'verify' && segments[1]) {
      setUrlBatchId(segments[1].toUpperCase());
      setActiveTab('verify');
    } else if (queryVerify) {
      setUrlBatchId(queryVerify.toUpperCase());
      setActiveTab('verify');
    } else {
      setActiveTab(initialRoute);
    }

    // Check localStorage session
    const saved = localStorage.getItem('meditrace_session');
    if (saved) {
      try {
        const parsed: UserSession = JSON.parse(saved);
        setSession(parsed);

        // Validate session token with server in background
        api.getCurrentUser(parsed.token).catch(() => {
          // Token expired, revoked, or account deactivated
          localStorage.removeItem('meditrace_session');
          setSession(null);
          setGlobalNotice('Your previous session has expired or was revoked. Please sign in again.');
        });
      } catch (e) {
        localStorage.removeItem('meditrace_session');
      }
    }

    const handlePopState = () => {
      const route = getRouteFromLocation();
      const segs = window.location.pathname.replace(/^\/+/, '').split('/');
      if (segs[0]?.toLowerCase() === 'verify' && segs[1]) {
        setUrlBatchId(segs[1].toUpperCase());
      }
      setActiveTab(route);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getRouteFromLocation]);

  // Handle successful login
  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    localStorage.setItem('meditrace_session', JSON.stringify(newSession));
    setShowLoginModal(false);
    setRedirectReason(null);
    setGlobalNotice(null);

    // Direct user to their authorized portal
    const targetDashboard = ROLE_DASHBOARD_MAP[newSession.user.role] || 'verify';
    navigateTo(targetDashboard);
  };

  // Handle explicit logout
  const handleLogout = async () => {
    if (session?.token) {
      await api.logout(session.token).catch(() => {});
    }
    setSession(null);
    localStorage.removeItem('meditrace_session');
    navigateTo('login');
  };

  // Evaluate Route Access
  const renderCurrentView = () => {
    // Public Verify Page: Always accessible without login
    if (activeTab === 'verify') {
      return <PublicVerifyPage initialBatchId={urlBatchId} />;
    }

    // Dedicated Login Page
    if (activeTab === 'login') {
      if (session) {
        // Already logged in -> jump to permitted dashboard
        const userPortal = ROLE_DASHBOARD_MAP[session.user.role] || 'verify';
        return (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <h2>You are already authenticated as {session.user.name} ({session.user.role})</h2>
            <button
              onClick={() => navigateTo(userPortal)}
              className="btn btn-primary"
              style={{ marginTop: '16px' }}
            >
              Go to Your {session.user.role} Dashboard
            </button>
          </div>
        );
      }
      return (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onNavigateToVerify={() => navigateTo('verify')}
          redirectReason={redirectReason}
        />
      );
    }

    // Protected Route Evaluation
    const requiredRoles = ROUTE_REQUIRED_ROLES[activeTab];

    // Case 1: Unauthenticated user attempting to access protected route -> Redirect to Login
    if (!session) {
      return (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onNavigateToVerify={() => navigateTo('verify')}
          redirectReason={`Sign in required: Access to the ${activeTab.toUpperCase()} portal requires institutional authentication.`}
        />
      );
    }

    // Case 2: Authenticated user attempting to access another role's dashboard -> Access Denied
    if (requiredRoles && !requiredRoles.includes(session.user.role)) {
      const authorizedPortal = ROLE_DASHBOARD_MAP[session.user.role] || 'verify';
      return (
        <AccessDenied
          userRole={session.user.role}
          requiredRole={requiredRoles.join(' or ')}
          onNavigateHome={() => navigateTo(authorizedPortal)}
          onLogout={handleLogout}
        />
      );
    }

    // Case 3: Authenticated and Authorized
    switch (activeTab) {
      case 'admin':
        return <AdminPage session={session} onOpenLogin={() => navigateTo('login')} />;
      case 'manufacturer':
        return <ManufacturerPage session={session} onOpenLogin={() => navigateTo('login')} />;
      case 'distributor':
        return <DistributorPage session={session} onOpenLogin={() => navigateTo('login')} />;
      case 'pharmacy':
        return <PharmacyPage session={session} onOpenLogin={() => navigateTo('login')} />;
      case 'hospital':
        return <HospitalPage session={session} onOpenLogin={() => navigateTo('login')} />;
      default:
        return <PublicVerifyPage initialBatchId={urlBatchId} />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => navigateTo(tab)}
        session={session}
        onLogout={handleLogout}
        onOpenLoginModal={() => navigateTo('login')}
      />

      {/* Global alert / Session revocation banner */}
      {globalNotice && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
            padding: '10px 24px',
            textAlign: 'center',
            color: '#f87171',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <span>🔒 {globalNotice}</span>
          <button
            onClick={() => setGlobalNotice(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            &times;
          </button>
        </div>
      )}

      <main style={{ flex: 1 }}>{renderCurrentView()}</main>

      {/* Professional Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(7, 10, 18, 0.95)',
          padding: '24px',
          textAlign: 'center',
          marginTop: '40px',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
          <p>MediTrace &bull; Decentralized Pharmaceutical Supply Chain Provenance Platform</p>
          <p style={{ marginTop: '6px', fontSize: '0.75rem' }}>
            Equipped with Strong PBKDF2 Encryption, Token Blacklisting, Role-Based Access Control, and Smart Contracts.
          </p>
        </div>
      </footer>
    </div>
  );
};
