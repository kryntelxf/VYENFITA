/**
 * VYENFITA Dashboard Page
 * 
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface Stats {
  members: number;
  applications: number;
  workflows: number;
  auditEvents: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsData, appsData, workflowsData] = await Promise.all([
          api.getTenantStats(),
          api.listApplications({ limit: 5 }),
          api.listWorkflows({ limit: 5 }),
        ]);

        setStats(statsData);
        setApps(appsData.data);
        setWorkflows(workflowsData.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (isLoading) {
    return <div style={styles.loading}>Loading dashboard...</div>;
  }

  if (error) {
    return <div style={styles.error}>{error}</div>;
  }

  return (
    <div>
      <h1 style={styles.title}>Dashboard</h1>
      <p style={styles.subtitle}>Overview of your VYENFITA workspace</p>

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        <StatCard label="Team Members" value={stats?.members || 0} icon="👥" />
        <StatCard
          label="Applications"
          value={stats?.applications || 0}
          icon="📱"
        />
        <StatCard label="Workflows" value={stats?.workflows || 0} icon="⚡" />
        <StatCard
          label="Audit Events"
          value={stats?.auditEvents || 0}
          icon="📋"
        />
      </div>

      {/* Quick Actions */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Quick Actions</h2>
        <div style={styles.actions}>
          <Link to="/vyenfita/applications/new" style={styles.actionButton}>
            ✨ Generate New Application
          </Link>
          <Link to="/vyenfita/workflows/new" style={styles.actionButton}>
            ⚡ Create Workflow
          </Link>
          <Link to="/vyenfita/settings/team" style={styles.actionButton}>
            👥 Invite Team Member
          </Link>
        </div>
      </div>

      {/* Recent Applications */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Recent Applications</h2>
          <Link to="/vyenfita/applications" style={styles.viewAll}>
            View all →
          </Link>
        </div>
        {apps.length === 0 ? (
          <div style={styles.empty}>No applications yet</div>
        ) : (
          <div style={styles.list}>
            {apps.map((app) => (
              <Link
                key={app.id}
                to={`/vyenfita/applications/${app.id}`}
                style={styles.listItem}
              >
                <div>
                  <div style={styles.itemName}>{app.name}</div>
                  <div style={styles.itemMeta}>
                    {app.description || 'No description'}
                  </div>
                </div>
                <span style={styles.statusBadge(app.status)}>
                  {app.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Workflows */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Recent Workflows</h2>
          <Link to="/vyenfita/workflows" style={styles.viewAll}>
            View all →
          </Link>
        </div>
        {workflows.length === 0 ? (
          <div style={styles.empty}>No workflows yet</div>
        ) : (
          <div style={styles.list}>
            {workflows.map((wf) => (
              <div key={wf.id} style={styles.listItem}>
                <div>
                  <div style={styles.itemName}>{wf.name}</div>
                  <div style={styles.itemMeta}>
                    {wf.description || 'No description'}
                  </div>
                </div>
                <span style={styles.statusBadge(wf.status)}>{wf.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>{icon}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles: Record<string, any> = {
  title: {
    fontSize: '28px',
    fontWeight: 700,
    margin: '0 0 8px 0',
  },
  subtitle: {
    color: '#666',
    marginBottom: '32px',
  },
  loading: {
    padding: '40px',
    textAlign: 'center',
    color: '#666',
  },
  error: {
    padding: '16px',
    background: '#fee',
    color: '#c33',
    borderRadius: '8px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
  },
  statCard: {
    background: '#fff',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  statIcon: {
    fontSize: '24px',
    marginBottom: '12px',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 700,
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '14px',
    color: '#666',
  },
  section: {
    marginBottom: '32px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
  },
  viewAll: {
    color: '#667eea',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  actionButton: {
    padding: '12px 20px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    textDecoration: 'none',
    color: '#333',
    fontSize: '14px',
    fontWeight: 500,
  },
  empty: {
    padding: '32px',
    background: '#fff',
    borderRadius: '12px',
    textAlign: 'center',
    color: '#999',
  },
  list: {
    background: '#fff',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #f0f0f0',
    textDecoration: 'none',
    color: 'inherit',
  },
  itemName: {
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '2px',
  },
  itemMeta: {
    fontSize: '12px',
    color: '#999',
  },
  statusBadge: (status: string) => ({
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    background:
      status === 'published' || status === 'active'
        ? '#dcfce7'
        : status === 'draft'
        ? '#f3f4f6'
        : '#fef3c7',
    color:
      status === 'published' || status === 'active'
        ? '#166534'
        : status === 'draft'
        ? '#666'
        : '#92400e',
  }),
};
