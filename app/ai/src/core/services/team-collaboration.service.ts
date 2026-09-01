/**
 * VYENFITA Team Collaboration Service
 * 
 * Manages team collaboration
 * - Workspaces
 * - Team invitations
 * - Resource sharing
 * - Team permissions
 * - Activity feed
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  tenantId: string;
  members: WorkspaceMember[];
  settings: WorkspaceSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  userId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joinedAt: Date;
  invitedBy: string;
  status: 'active' | 'pending' | 'inactive';
}

export interface WorkspaceSettings {
  allowPublicSharing: boolean;
  requireApproval: boolean;
  defaultRole: string;
  maxMembers: number;
  features: string[];
}

export interface Invitation {
  id: string;
  workspaceId: string;
  email: string;
  role: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface SharedResource {
  id: string;
  resourceId: string;
  resourceType: 'application' | 'workflow' | 'report' | 'template';
  workspaceId: string;
  sharedBy: string;
  permissions: string[];
  sharedAt: Date;
}

export class TeamCollaborationService {
  private workspaces: Map<string, Workspace>;
  private invitations: Map<string, Invitation>;
  private sharedResources: Map<string, SharedResource>;

  constructor() {
    this.workspaces = new Map();
    this.invitations = new Map();
    this.sharedResources = new Map();
  }

  /**
   * Create a workspace
   */
  createWorkspace(
    name: string,
    description: string,
    ownerId: string,
    tenantId: string,
    settings?: Partial<WorkspaceSettings>
  ): Workspace {
    const workspace: Workspace = {
      id: uuidv4(),
      name,
      description,
      ownerId,
      tenantId,
      members: [
        {
          userId: ownerId,
          role: 'owner',
          joinedAt: new Date(),
          invitedBy: ownerId,
          status: 'active',
        },
      ],
      settings: {
        allowPublicSharing: false,
        requireApproval: true,
        defaultRole: 'viewer',
        maxMembers: 100,
        features: ['applications', 'workflows', 'reports'],
        ...settings,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  /**
   * Get a workspace
   */
  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id);
  }

  /**
   * Get all workspaces for a user
   */
  getWorkspacesByUser(userId: string): Workspace[] {
    const result: Workspace[] = [];
    for (const workspace of this.workspaces.values()) {
      if (workspace.members.some(m => m.userId === userId)) {
        result.push(workspace);
      }
    }
    return result;
  }

  /**
   * Invite a user to a workspace
   */
  inviteUser(workspaceId: string, email: string, role: string, invitedBy: string): Invitation {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const token = uuidv4();
    const invitation: Invitation = {
      id: uuidv4(),
      workspaceId,
      email,
      role,
      invitedBy,
      status: 'pending',
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
    };

    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  /**
   * Accept an invitation
   */
  acceptInvitation(invitationId: string, userId: string): boolean {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) return false;

    if (invitation.status !== 'pending') return false;
    if (invitation.expiresAt < new Date()) {
      invitation.status = 'expired';
      this.invitations.set(invitationId, invitation);
      return false;
    }

    const workspace = this.workspaces.get(invitation.workspaceId);
    if (!workspace) return false;

    workspace.members.push({
      userId,
      role: invitation.role,
      joinedAt: new Date(),
      invitedBy: invitation.invitedBy,
      status: 'active',
    });

    invitation.status = 'accepted';
    this.invitations.set(invitationId, invitation);
    this.workspaces.set(workspace.id, workspace);

    return true;
  }

  /**
   * Remove a member from a workspace
   */
  removeMember(workspaceId: string, userId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    const index = workspace.members.findIndex(m => m.userId === userId);
    if (index === -1) return false;

    // Cannot remove the owner
    if (workspace.members[index].role === 'owner') return false;

    workspace.members.splice(index, 1);
    this.workspaces.set(workspaceId, workspace);
    return true;
  }

  /**
   * Update member role
   */
  updateMemberRole(workspaceId: string, userId: string, newRole: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    const member = workspace.members.find(m => m.userId === userId);
    if (!member) return false;

    // Cannot change owner role
    if (member.role === 'owner') return false;

    member.role = newRole as any;
    this.workspaces.set(workspaceId, workspace);
    return true;
  }

  /**
   * Share a resource
   */
  shareResource(
    resourceId: string,
    resourceType: SharedResource['resourceType'],
    workspaceId: string,
    sharedBy: string,
    permissions: string[]
  ): SharedResource {
    const sharedResource: SharedResource = {
      id: uuidv4(),
      resourceId,
      resourceType,
      workspaceId,
      sharedBy,
      permissions,
      sharedAt: new Date(),
    };

    this.sharedResources.set(sharedResource.id, sharedResource);
    return sharedResource;
  }

  /**
   * Get shared resources for a workspace
   */
  getSharedResources(workspaceId: string): SharedResource[] {
    const result: SharedResource[] = [];
    for (const resource of this.sharedResources.values()) {
      if (resource.workspaceId === workspaceId) {
        result.push(resource);
      }
    }
    return result;
  }

  /**
   * Unshare a resource
   */
  unshareResource(resourceId: string): boolean {
    let found = false;
    for (const [id, resource] of this.sharedResources) {
      if (resource.resourceId === resourceId) {
        this.sharedResources.delete(id);
        found = true;
      }
    }
    return found;
  }

  /**
   * Get all invitations for a workspace
   */
  getInvitations(workspaceId: string): Invitation[] {
    const result: Invitation[] = [];
    for (const invitation of this.invitations.values()) {
      if (invitation.workspaceId === workspaceId) {
        result.push(invitation);
      }
    }
    return result;
  }

  /**
   * Get all invitations for a user (by email)
   */
  getInvitationsByEmail(email: string): Invitation[] {
    const result: Invitation[] = [];
    for (const invitation of this.invitations.values()) {
      if (invitation.email === email && invitation.status === 'pending') {
        result.push(invitation);
      }
    }
    return result;
  }

  /**
   * Delete a workspace
   */
  deleteWorkspace(id: string): boolean {
    return this.workspaces.delete(id);
  }
          }
