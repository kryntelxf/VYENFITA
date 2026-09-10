/**
 * VYENFITA Layout
 * 
 * Main app shell with sidebar and topbar
 * 
 * @version 1.0.0
 */

import React, { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: '/vyenfita/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/vyenfita/applications', label: 'Applications', icon: '📱' },
  { path: '/vyenfita/workflows', label: 'Workflows', icon: '⚡' },
  { path: '/vyenfita/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout({ children }: LayoutProps) {
  const { tenant, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/vyenfita/login');
  };

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandLogo}>V</div>
          <span style={styles.brandName}>VYENFITA</span>
        </div>

        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  ...styles.navItem,
                  ...(isActive ? styles.navItemActive : {}),
                }}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.tenantInfo}>
            <div style={styles.tenantName}>{tenant?.name || 'Loading...'}</div>
            <div style={styles.tenantSlug}>{tenant?.slug || ''}</div>
          </div>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Sign out
          </button>
        </div>
      </aside>

      <main style={styles.main}>
        <header style={styles.topbar}>
          <div />
          <div style={styles.topbarRight}>
            <span style={styles.userEmail}>VYENFITA</span>
          </div>
        </header>
        <div style={styles.content}>{children}</div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: '#f5f6fa',
  },
  sidebar: {
    width: '240px',
    background: '#1a1a2e',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 0',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '0 20px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  brandLogo: {
    width: '32px',
    height: '32px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '18px',
  },
  brandName: {
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  nav: {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    color: 'rgba(255,255,255,0.7)',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    transition: 'all 0.15s',
  },
  navItemActive: {
    background: 'rgba(102, 126, 234, 0.2)',
    color: '#fff',
  },
  navIcon: {
    fontSize: '16px',
  },
  sidebarFooter: {
    padding: '16px 20px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  tenantInfo: {
    marginBottom: '12px',
  },
  tenantName: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '4px',
  },
  tenantSlug: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
  },
  logoutButton: {
    width: '100%',
    padding: '8px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  topbar: {
    background: '#fff',
    padding: '16px 32px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userEmail: {
    fontSize: '14px',
    color: '#666',
  },
  content: {
    flex: 1,
    padding: '32px',
    overflow: 'auto',
  },
};
