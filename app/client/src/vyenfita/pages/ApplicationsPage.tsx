/**
 * VYENFITA Applications List Page
 * 
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Application } from '../api/client';

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      const result = await api.listApplications({ limit: 100 });
      setApps(result.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete application "${name}"?`)) return;

    try {
      await api.deleteApplication(id);
      setApps((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const filtered = apps.filter(
    (app) =>
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      (app.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Applications</h1>
          <p style={styles.subtitle}>
            {apps.length} application{apps.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/vyenfita/applications/new" style={styles.primaryButton}>
          + New Application
        </Link>
      </div>

      <div style={styles.searchBar}>
        <input
          type="text"
          placeholder="Search applications..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {isLoading ? (
        <div style={styles.loading}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          {apps.length === 0
            ? 'No applications yet. Create your first one!'
            : 'No applications match your search.'}
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((app) => (
            <div key={app.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <Link
                  to={`/vyenfita/applications/${app.id}`}
                  style={styles.cardTitle}
                >
                  {app.name}
                </Link>
                <span style={styles.statusBadge(app.status)}>
                  {app.status}
                </span>
              </div>
              <p style={styles.cardDescription}>
                {app.description || 'No description'}
              </p>
              <div style={styles.cardMeta}>
                <span>Updated {new Date(app.updatedAt).toLocaleDateString()}</span>
              </div>
              <div style={styles.cardActions}>
                <Link
                  to={`/vyenfita/applications/${app.id}`}
                  style={styles.secondaryButton}
                >
                  Open
                </Link>
                <button
                  onClick={() => handleDelete(app.id, app.name)}
                  style={styles.dangerButton}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, any> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    margin: '0 0 4px 0',
  },
  subtitle: {
    color: '#666',
    margin: 0,
  },
  primaryButton: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
  },
  searchBar: {
    marginBottom: '24px',
  },
  searchInput: {
    width: '100%',
    maxWidth: '400px',
    padding: '10px 16px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
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
    marginBottom: '16px',
  },
  empty: {
    padding: '48px',
    background: '#fff',
    borderRadius: '12px',
    textAlign: 'center',
    color: '#999',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '20px',
  },
  card: {
    background: '#fff',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#333',
    textDecoration: 'none',
    flex: 1,
  },
  cardDescription: {
    fontSize: '13px',
    color: '#666',
    margin: 0,
    flex: 1,
  },
  cardMeta: {
    fontSize: '12px',
    color: '#999',
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
  },
  secondaryButton: {
    padding: '8px 16px',
    background: '#f3f4f6',
    color: '#333',
    textDecoration: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
  },
  dangerButton: {
    padding: '8px 16px',
    background: '#fee2e2',
    color: '#991b1b',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  statusBadge: (status: string) => ({
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    background:
      status === 'published'
        ? '#dcfce7'
        : status === 'draft'
        ? '#f3f4f6'
        : '#fef3c7',
    color:
      status === 'published'
        ? '#166534'
        : status === 'draft'
        ? '#666'
        : '#92400e',
  }),
};
