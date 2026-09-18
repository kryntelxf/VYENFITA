/**
 * VYENFITA Collaboration
 * 
 * Real-time collaboration features:
 * - Presence (who's viewing)
 * - Comments
 * - Activity feed
 * 
 * NOTE: This is a client-side foundation. 
 * Server-side WebSocket integration is pending (Phase 26).
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { colors, typography, spacing, borderRadius, shadows } from '../design-system/tokens';

// ============================================================
// TYPES
// ============================================================

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
}

export interface Presence {
  userId: string;
  user: User;
  cursor?: { x: number; y: number };
  selection?: string;
  lastSeen: Date;
}

export interface Comment {
  id: string;
  widgetId?: string;
  userId: string;
  user: User;
  text: string;
  createdAt: Date;
  resolved: boolean;
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  userId: string;
  user: User;
  text: string;
  createdAt: Date;
}

export interface Activity {
  id: string;
  userId: string;
  user: User;
  action: string;
  target?: string;
  timestamp: Date;
}

// ============================================================
// CONTEXT
// ============================================================

interface CollaborationContextValue {
  currentUser: User | null;
  presences: Presence[];
  comments: Comment[];
  activities: Activity[];
  addComment: (text: string, widgetId?: string) => void;
  resolveComment: (id: string) => void;
  deleteComment: (id: string) => void;
  replyToComment: (commentId: string, text: string) => void;
  logActivity: (action: string, target?: string) => void;
}

const CollaborationContext = createContext<CollaborationContextValue | undefined>(undefined);

// ============================================================
// PROVIDER
// ============================================================

export const CollaborationProvider: React.FC<{ children: React.ReactNode; currentUser?: User }> = ({
  children,
  currentUser = null,
}) => {
  const [presences, setPresences] = useState<Presence[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const addComment = (text: string, widgetId?: string) => {
    if (!currentUser) return;
    const comment: Comment = {
      id: `comment-${Date.now()}`,
      widgetId,
      userId: currentUser.id,
      user: currentUser,
      text,
      createdAt: new Date(),
      resolved: false,
      replies: [],
    };
    setComments((prev) => [...prev, comment]);
    logActivity('commented', widgetId);
  };

  const resolveComment = (id: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, resolved: true } : c))
    );
  };

  const deleteComment = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const replyToComment = (commentId: string, text: string) => {
    if (!currentUser) return;
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              replies: [
                ...c.replies,
                {
                  id: `reply-${Date.now()}`,
                  userId: currentUser.id,
                  user: currentUser,
                  text,
                  createdAt: new Date(),
                },
              ],
            }
          : c
      )
    );
  };

  const logActivity = (action: string, target?: string) => {
    if (!currentUser) return;
    setActivities((prev) => [
      {
        id: `activity-${Date.now()}`,
        userId: currentUser.id,
        user: currentUser,
        action,
        target,
        timestamp: new Date(),
      },
      ...prev.slice(0, 49),
    ]);
  };

  return (
    <CollaborationContext.Provider
      value={{
        currentUser,
        presences,
        comments,
        activities,
        addComment,
        resolveComment,
        deleteComment,
        replyToComment,
        logActivity,
      }}
    >
      {children}
    </CollaborationContext.Provider>
  );
};

export function useCollaboration(): CollaborationContextValue {
  const ctx = useContext(CollaborationContext);
  if (!ctx) throw new Error('useCollaboration must be used within CollaborationProvider');
  return ctx;
}

// ============================================================
// PRESENCE AVATARS
// ============================================================

export const PresenceAvatars: React.FC = () => {
  const { presences } = useCollaboration();

  if (presences.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '-8px' }}>
      {presences.slice(0, 5).map((p) => (
        <div
          key={p.userId}
          title={p.user.name}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: p.user.color,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 600,
            border: '2px solid white',
            marginLeft: '-8px',
            boxShadow: shadows.sm,
          }}
        >
          {p.user.name.charAt(0).toUpperCase()}
        </div>
      ))}
      {presences.length > 5 && (
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: colors.neutral[300],
            color: colors.text.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 600,
            border: '2px solid white',
            marginLeft: '-8px',
          }}
        >
          +{presences.length - 5}
        </div>
      )}
    </div>
  );
};

// ============================================================
// COMMENT PANEL
// ============================================================

export const CommentPanel: React.FC<{ widgetId?: string }> = ({ widgetId }) => {
  const { comments, addComment, resolveComment, deleteComment } = useCollaboration();
  const [newComment, setNewComment] = useState('');

  const relevantComments = widgetId
    ? comments.filter((c) => c.widgetId === widgetId)
    : comments;

  const handleSubmit = () => {
    if (newComment.trim()) {
      addComment(newComment.trim(), widgetId);
      setNewComment('');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: colors.background.primary,
        borderLeft: `1px solid ${colors.border.default}`,
        width: '280px',
      }}
    >
      <div
        style={{
          padding: spacing[3],
          borderBottom: `1px solid ${colors.border.default}`,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.text.primary,
        }}
      >
        💬 Comments ({relevantComments.length})
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: spacing[3] }}>
        {relevantComments.length === 0 ? (
          <div
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.text.tertiary,
              textAlign: 'center',
              padding: spacing[6],
            }}
          >
            No comments yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
            {relevantComments.map((comment) => (
              <div
                key={comment.id}
                style={{
                  padding: spacing[3],
                  background: comment.resolved ? colors.neutral[100] : colors.background.secondary,
                  borderRadius: borderRadius.lg,
                  border: `1px solid ${colors.border.default}`,
                  opacity: comment.resolved ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: spacing[2],
                  }}
                >
                  <div
                    style={{
                      fontSize: typography.fontSize.xs,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.text.primary,
                    }}
                  >
                    {comment.user.name}
                  </div>
                  <div
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.text.tertiary,
                    }}
                  >
                    {new Date(comment.createdAt).toLocaleTimeString()}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.text.secondary,
                    marginBottom: spacing[2],
                  }}
                >
                  {comment.text}
                </div>
                <div style={{ display: 'flex', gap: spacing[2] }}>
                  {!comment.resolved && (
                    <button
                      onClick={() => resolveComment(comment.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: typography.fontSize.xs,
                        color: colors.semantic.success,
                      }}
                    >
                      ✓ Resolve
                    </button>
                  )}
                  <button
                    onClick={() => deleteComment(comment.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: typography.fontSize.xs,
                      color: colors.semantic.error,
                    }}
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: spacing[3], borderTop: `1px solid ${colors.border.default}` }}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
          }}
          style={{
            width: '100%',
            padding: spacing[2],
            fontSize: typography.fontSize.sm,
            border: `1px solid ${colors.border.default}`,
            borderRadius: borderRadius.md,
            outline: 'none',
            resize: 'vertical',
            minHeight: '60px',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim()}
          style={{
            marginTop: spacing[2],
            width: '100%',
            padding: spacing[2],
            background: newComment.trim() ? colors.brand.primary : colors.neutral[300],
            color: 'white',
            border: 'none',
            borderRadius: borderRadius.md,
            cursor: newComment.trim() ? 'pointer' : 'not-allowed',
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
          }}
        >
          Post Comment
        </button>
      </div>
    </div>
  );
};

// ============================================================
// ACTIVITY FEED
// ============================================================

export const ActivityFeed: React.FC = () => {
  const { activities } = useCollaboration();

  if (activities.length === 0) {
    return (
      <div
        style={{
          padding: spacing[3],
          fontSize: typography.fontSize.sm,
          color: colors.text.tertiary,
          textAlign: 'center',
        }}
      >
        No activity yet
      </div>
    );
  }

  return (
    <div style={{ padding: spacing[3] }}>
      {activities.map((activity) => (
        <div
          key={activity.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: spacing[2],
            padding: `${spacing[2]} 0`,
            borderBottom: `1px solid ${colors.border.default}`,
            fontSize: typography.fontSize.sm,
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: activity.user.color,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {activity.user.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: colors.text.primary }}>
              <strong>{activity.user.name}</strong> {activity.action}
              {activity.target && ` ${activity.target}`}
            </div>
            <div
              style={{
                fontSize: typography.fontSize.xs,
                color: colors.text.tertiary,
                marginTop: '2px',
              }}
            >
              {new Date(activity.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CollaborationProvider;
