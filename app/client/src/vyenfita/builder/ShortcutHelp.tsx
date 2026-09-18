/**
 * VYENFITA Shortcut Help Modal
 * 
 * Shows all keyboard shortcuts.
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import Modal from '../design-system/Modal';
import { colors, typography, spacing, borderRadius } from '../design-system/tokens';
import { getShortcutsByCategory, formatShortcut } from './keyboard-shortcuts';

interface ShortcutHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutHelp: React.FC<ShortcutHelpProps> = ({ isOpen, onClose }) => {
  const groups = getShortcutsByCategory();

  const categoryLabels: Record<string, string> = {
    edit: '✏️ Edit',
    widget: '🧩 Widget',
    view: '👁 View',
    navigation: '🧭 Navigation',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[5] }}>
        {Object.entries(groups).map(([category, shortcuts]) => (
          <div key={category}>
            <div
              style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                color: colors.text.secondary,
                marginBottom: spacing[3],
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {categoryLabels[category] || category}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
              {shortcuts.map((shortcut, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: `${spacing[2]} 0`,
                    borderBottom: `1px solid ${colors.border.default}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: typography.fontSize.sm,
                      color: colors.text.primary,
                    }}
                  >
                    {shortcut.description}
                  </span>
                  <kbd
                    style={{
                      padding: `${spacing[1]} ${spacing[2]}`,
                      background: colors.neutral[100],
                      border: `1px solid ${colors.border.default}`,
                      borderBottom: `2px solid ${colors.border.default}`,
                      borderRadius: borderRadius.md,
                      fontSize: typography.fontSize.xs,
                      fontFamily: typography.fontFamily.mono,
                      fontWeight: typography.fontWeight.medium,
                      color: colors.text.secondary,
                    }}
                  >
                    {formatShortcut(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default ShortcutHelp;
