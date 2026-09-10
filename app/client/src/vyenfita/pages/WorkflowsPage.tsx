/**
 * VYENFITA Workflows List Page
 * 
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { api, Workflow } from '../api/client';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const result = await api.listWorkflows({ limit: 100 });
      setWorkflows(result.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete workflow "${name}"?`)) return;

    try {
      await api.deleteWorkflow(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleExecute = async (id: string, name: string) => {
    if (!confirm(`Execute workflow "${name}" now?`)) return;

    try {
      const result = await api.executeWorkflow(id);
      alert(
        `Execution ${result.success ? 'succeeded' : 'failed'}!\n` +
          `Execution ID: ${result.data?.executionId}\n` +
          `Status: ${result.data?.status}`
      );
    } catch (err: any) {
      alert(`Execution failed: ${err.message}`);
    }
  };

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Workflows</h1>
          <p style={styles.subtitle}>
            {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {isLoading ? (
        <div style={styles.loading}>Loading...</div>
      ) : workflows.length === 0 ? (
        <div style={styles.empty}>
          No workflows yet. Create your first workflow via the API.
        </div>
      ) : (
        <div style={styles.list}>
          {workflows.map((wf) => (
            <div key={wf.id} style={styles.item}>
              <div style={styles.itemMain}>
                <div style={styles.itemName}>{wf.name}</div>
                <div style={styles.itemMeta}>
                  {wf.description || 'No description'} · Created{' '}
                  {new Date(wf.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div style={styles.itemActions}>
                <span style={styles.statusBadge(wf.status)}>{wf.status}</span>
                <button
                  onClick={() => handleExecute(wf.id, wf.name)}
                  style={styles.executeButton}
                >
                  ▶ Execute
                </button>
                <button
                  onClick={() => handleDelete(wf.id, wf.name)}
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
  list: {
    background: '#fff',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #f0f0f0',
    gap: '16px',
  },
  itemMain: {
    flex: 1,
  },
  itemName: {
    fontSize: '15px',
    fontWeight: 600,
    marginBottom: '4px',
  },
  itemMeta: {
    fontSize: '13px',
    color: '#666',
  },
  itemActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  executeButton: {
    padding: '6px 14px',
    background: '#dcfce7',
    color: '#166534',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  dangerButton: {
    padding: '6px 14px',
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
      status === 'active'
        ? '#dcfce7'
        : status === 'draft'
        ? '#f3f4f6'
        : '#fef3c7',
    color:
      status === 'active'
        ? '#166534'
        : status === 'draft'
        ? '#666'
        : '#92400e',
  }),
};
