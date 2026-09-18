/**
 * VYENFITA Builder Toolbar
 * 
 * Top toolbar with common actions.
 * 
 * @version 1.0.0
 */

import React from 'react';
import { useBuilder } from './builder-store';
import { colors, typography, spacing, borderRadius, transitions, shadows } from '../design-system/tokens';
import Button from '../design-system/Button';

interface ToolbarProps {
  onOpenCodeView?: () => void;
  onOpenTemplates?: () => void;
  onSave?: () => void;
  onPreview?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onOpenCodeView,
  onOpenTemplates,
  onSave,
  onPreview,
}) => {
  const { state, undo, redo, canUndo, canRedo, setMode, setZoom } = useBuilder();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${spacing[2]} ${spacing[4]}`,
        background: colors.background.primary,
        borderBottom: `1px solid ${colors.border.default}`,
        height: '52px',
        flexShrink: 0,
      }}
    >
      {/* Left: App name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
            borderRadius: borderRadius.md,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            color: 'white',
            fontSize: '14px',
          }}
        >
          V
        </div>
        <div>
          <div style={{ fontSize: typography.fontSize.sm, fontWeight: 600, color: colors.text.primary }}>
            {state.application.metadata.name}
          </div>
          <div style={{ fontSize: typography.fontSize.xs, color: colors.text.tertiary }}>
            {state.ui.mode === 'design' ? 'Design Mode' : 'Preview Mode'}
          </div>
        </div>
      </div>

      {/* Center: Tools */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
        <ToolButton onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          ↶
        </ToolButton>
        <ToolButton onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          ↷
        </ToolButton>

        <div style={{ width: '1px', height: '24px', background: colors.border.default, margin: `0 ${spacing[2]}` }} />

        <ToolButton onClick={() => setZoom(state.ui.zoom - 0.1)} title="Zoom out">
          −
        </ToolButton>
        <span style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary, minWidth: '48px', textAlign: 'center' }}>
          {Math.round(state.ui.zoom * 100)}%
        </span>
        <ToolButton onClick={() => setZoom(state.ui.zoom + 0.1)} title="Zoom in">
          +
        </ToolButton>
        <ToolButton onClick={() => setZoom(1)} title="Reset zoom">
          ⤢
        </ToolButton>

        <div style={{ width: '1px', height: '24px', background: colors.border.default, margin: `0 ${spacing[2]}` }} />

        <ToolButton onClick={onOpenTemplates} title="Templates">
          📚
        </ToolButton>
        <ToolButton onClick={onOpenCodeView} title="View code">
          {'</>'}
        </ToolButton>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
        <Button
          variant={state.ui.mode === 'preview' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setMode(state.ui.mode === 'design' ? 'preview' : 'design')}
        >
          {state.ui.mode === 'design' ? '👁 Preview' : '✏️ Edit'}
        </Button>
        <Button variant="primary" size="sm" onClick={onSave}>
          💾 Save
        </Button>
      </div>
    </div>
  );
};

// ============================================================
// TOOL BUTTON
// ============================================================

const ToolButton: React.FC<{
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}> = ({ onClick, disabled, title, children }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isHovered && !disabled ? colors.neutral[100] : 'transparent',
        border: 'none',
        borderRadius: borderRadius.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '16px',
        color: disabled ? colors.text.tertiary : colors.text.primary,
        transition: `background ${transitions.fast}`,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
};

export default Toolbar;
