/**
 * VYENFITA Settings Page
 * 
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function SettingsPage() {
  const [tenant, setTenant] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tenantData, membersData, rolesData] = await Promise.all([
        api.getTenant(),
        api.listMembers(),
        api.listRoles(),
      ]);

      setTenant(tenantData);
      setMembers(membersData);
      setRoles(rolesData);

      // Set default role for invite
      const editorRole = rolesData.find((r: any) => r.name === 'Editor');
      if (editorRole) setInviteRoleId(editorRole.id);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteRoleId) {
      alert('Please fill in email and select a role');
      return;
    }

    setInviteLoading(true);
    try {
      await api.inviteMember(inviteEmail, inviteRoleId);
      setInviteEmail('');
      await loadData();
      alert('Member invited successfully');
    } catch (err: any) {
      alert(`Invite failed: ${err.message}`);
    } finally {
      setInviteLoading(false);
    }
  };

  if (isLoading) {
    return <div style={styles.loading}>Loading settings...</div>;
  }

  return (
    <div>
      <h1 style={styles.title}>Settings</h1>
      <p style={styles.subtitle}>Manage your tenant and team</p>

      {error && <div style={styles.error}>{error}</div>}

      {/* Tenant Info */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Organization</h2>
        <div style={styles.card}>
          <div style={styles.field}>
            <label style={styles.label}>Name</label>
            <div style={styles.value}>{tenant?.name}</div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Slug</label>
            <div style={styles.value}>{tenant?.slug}</div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Tenant ID</label>
            <div style={styles.value} title="Share this with your team for login">
              {tenant?.id}
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Plan</label>
            <div style={styles.value}>{tenant?.plan || 'free'}</div>
          </div>
        </div>
      </div>

      {/* Members */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Team Members ({members.length})</h2>
        <div style={styles.card}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.memberEmail}>{member.email}</div>
                    <div style={styles.memberName}>{member.name}</div>
                  </td>
                  <td style={styles.td}>{member.roleName}</td>
                  <td style={styles.td}>
                    <span style={styles.statusBadge(member.status)}>
                      {member.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {member.joinedAt
                      ? new Date(member.joinedAt).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Invite Team Member</h2>
        <div style={styles.card}>
          <div style={styles.inviteRow}>
            <input
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={styles.input}
            />
            <select
              value={inviteRoleId}
              onChange={(e) => setInviteRoleId(e.target.value)}
              style={styles.select}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleInvite}
              disabled={inviteLoading}
              style={styles.primaryButton}
            >
              {inviteLoading ? 'Inviting...' : 'Send Invite'}
            </button>
          </div>
        </div>
      </div>
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
    marginBottom: '20px',
  },
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '12px',
  },
  card: {
    background: '#fff',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    fontSize: '12px',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
    display: 'block',
  },
  value: {
    fontSize: '14px',
    color: '#333',
    fontFamily: 'monospace',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '8px 12px',
    borderBottom: '1px solid #e5e7eb',
  },
  tr: {
    borderBottom: '1px solid #f0f0f0',
  },
  td: {
    padding: '12px',
    fontSize: '14px',
  },
  memberEmail: {
    fontWeight: 500,
    marginBottom: '2px',
  },
  memberName: {
    fontSize: '12px',
    color: '#999',
  },
  inviteRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
  },
  select: {
    padding: '10px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    minWidth: '150px',
  },
  primaryButton: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  statusBadge: (status: string) => ({
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    background: status === 'active' ? '#dcfce7' : '#f3f4f6',
    color: status === 'active' ? '#166534' : '#666',
  }),
};
