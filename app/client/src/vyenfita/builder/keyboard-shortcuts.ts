/**
 * VYENFITA Keyboard Shortcuts
 * 
 * Global keyboard handler for builder.
 * 
 * @version 1.0.0
 */

import { useEffect } from 'react';
import { useBuilder } from './builder-store';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: 'edit' | 'view' | 'widget' | 'navigation';
  action: string;
}

export const SHORTCUTS: KeyboardShortcut[] = [
  // Edit
  { key: 'z', ctrl: true, description: 'Undo', category: 'edit', action: 'undo' },
  { key: 'z', ctrl: true, shift: true, description: 'Redo', category: 'edit', action: 'redo' },
  { key: 'y', ctrl: true, description: 'Redo (alt)', category: 'edit', action: 'redo' },
  { key: 'c', ctrl: true, description: 'Copy widget', category: 'edit', action: 'copy' },
  { key: 'v', ctrl: true, description: 'Paste widget', category: 'edit', action: 'paste' },
  { key: 'd', ctrl: true, description: 'Duplicate widget', category: 'edit', action: 'duplicate' },
  { key: 'Delete', description: 'Delete widget', category: 'edit', action: 'delete' },
  { key: 'Backspace', description: 'Delete widget', category: 'edit', action: 'delete' },

  // Widget
  { key: 'Escape', description: 'Deselect', category: 'widget', action: 'deselect' },
  { key: 'ArrowUp', description: 'Move up', category: 'widget', action: 'move-up' },
  { key: 'ArrowDown', description: 'Move down', category: 'widget', action: 'move-down' },
  { key: 'ArrowLeft', description: 'Move left', category: 'widget', action: 'move-left' },
  { key: 'ArrowRight', description: 'Move right', category: 'widget', action: 'move-right' },

  // View
  { key: '0', ctrl: true, description: 'Reset zoom', category: 'view', action: 'zoom-reset' },
  { key: '=', ctrl: true, description: 'Zoom in', category: 'view', action: 'zoom-in' },
  { key: '-', ctrl: true, description: 'Zoom out', category: 'view', action: 'zoom-out' },
  { key: 'g', ctrl: true, description: 'Toggle grid', category: 'view', action: 'toggle-grid' },
  { key: 'p', ctrl: true, description: 'Toggle preview mode', category: 'view', action: 'toggle-mode' },
];

/**
 * Hook to handle keyboard shortcuts.
 * Call once in the Builder component.
 */
export function useKeyboardShortcuts(): void {
  const {
    state,
    undo,
    redo,
    deleteWidget,
    duplicateWidget,
    copyWidget,
    pasteWidget,
    selectWidget,
    updateWidget,
    setZoom,
    setMode,
    dispatch,
  } = useBuilder();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if focused on input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key;

      // Undo
      if (ctrl && key === 'z' && !shift) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo
      if ((ctrl && key === 'z' && shift) || (ctrl && key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      // Copy
      if (ctrl && key === 'c' && state.ui.selectedWidgetId) {
        e.preventDefault();
        copyWidget(state.ui.selectedWidgetId);
        return;
      }

      // Paste
      if (ctrl && key === 'v' && state.ui.clipboard) {
        e.preventDefault();
        pasteWidget({ x: 0, y: 0 });
        return;
      }

      // Duplicate
      if (ctrl && key === 'd' && state.ui.selectedWidgetId) {
        e.preventDefault();
        duplicateWidget(state.ui.selectedWidgetId);
        return;
      }

      // Delete
      if ((key === 'Delete' || key === 'Backspace') && state.ui.selectedWidgetId) {
        e.preventDefault();
        deleteWidget(state.ui.selectedWidgetId);
        return;
      }

      // Deselect
      if (key === 'Escape') {
        e.preventDefault();
        selectWidget(null);
        return;
      }

      // Move widget with arrows
      if (state.ui.selectedWidgetId && key.startsWith('Arrow')) {
        const widget = state.application.pages
          .flatMap((p) => p.widgets)
          .find((w) => w.id === state.ui.selectedWidgetId);
        if (widget) {
          e.preventDefault();
          const step = shift ? 5 : 1;
          const pos = { ...widget.position };

          if (key === 'ArrowUp') pos.y = Math.max(0, pos.y - 1);
          if (key === 'ArrowDown') pos.y = pos.y + 1;
          if (key === 'ArrowLeft') pos.x = Math.max(0, pos.x - 1);
          if (key === 'ArrowRight') pos.x = Math.min(12 - pos.width, pos.x + 1);

          updateWidget(widget.id, { position: pos });
        }
        return;
      }

      // Zoom reset
      if (ctrl && key === '0') {
        e.preventDefault();
        setZoom(1);
        return;
      }

      // Zoom in
      if (ctrl && (key === '=' || key === '+')) {
        e.preventDefault();
        setZoom(state.ui.zoom + 0.1);
        return;
      }

      // Zoom out
      if (ctrl && key === '-') {
        e.preventDefault();
        setZoom(state.ui.zoom - 0.1);
        return;
      }

      // Toggle grid
      if (ctrl && key === 'g') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_GRID' });
        return;
      }

      // Toggle preview mode
      if (ctrl && key === 'p') {
        e.preventDefault();
        setMode(state.ui.mode === 'design' ? 'preview' : 'design');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    state,
    undo,
    redo,
    deleteWidget,
    duplicateWidget,
    copyWidget,
    pasteWidget,
    selectWidget,
    updateWidget,
    setZoom,
    setMode,
    dispatch,
  ]);
}

/**
 * Get shortcuts grouped by category.
 */
export function getShortcutsByCategory(): Record<string, KeyboardShortcut[]> {
  const groups: Record<string, KeyboardShortcut[]> = {};
  for (const shortcut of SHORTCUTS) {
    if (!groups[shortcut.category]) groups[shortcut.category] = [];
    groups[shortcut.category].push(shortcut);
  }
  return groups;
}

/**
 * Format shortcut for display.
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.meta) parts.push('⌘');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  parts.push(shortcut.key === ' ' ? 'Space' : shortcut.key);
  return parts.join(' + ');
}
