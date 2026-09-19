/**
 * VYENFITA Builder Module
 * 
 * Public exports for the visual app builder.
 * 
 * Includes:
 * - Core types (Widget, Page, Application)
 * - State management (BuilderProvider, useBuilder)
 * - Main builder component
 * - Sub-components (Palette, Canvas, Properties, CodeView, Toolbar)
 * - Keyboard shortcuts
 * - Collaboration (comments, presence, activity)
 * - Templates
 * 
 * @version 1.0.0
 */

// ============================================================
// TYPES
// ============================================================

export type {
  WidgetType,
  WidgetPosition,
  WidgetProps,
  Widget,
  Page,
  ApplicationState,
  BuilderState,
  BuilderAction,
  WidgetDefinition,
} from './types';

export {
  WIDGET_REGISTRY,
  generateWidgetId,
  generatePageId,
  createWidget,
} from './types';

// ============================================================
// STORE
// ============================================================

export {
  BuilderProvider,
  useBuilder,
} from './builder-store';

// ============================================================
// MAIN COMPONENT
// ============================================================

export { default as Builder } from './Builder';
export type { BuilderProps } from './Builder';

// ============================================================
// SUB-COMPONENTS
// ============================================================

export { default as WidgetPalette } from './WidgetPalette';
export { default as Canvas } from './Canvas';
export { default as WidgetRenderer } from './WidgetRenderer';
export { default as WidgetContent } from './WidgetContent';
export { default as PropertiesPanel } from './PropertiesPanel';
export { default as CodeView } from './CodeView';
export { default as Toolbar } from './Toolbar';
export { default as PageManager } from './PageManager';
export { default as TemplatePicker } from './TemplatePicker';
export { default as ShortcutHelp } from './ShortcutHelp';

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

export {
  useKeyboardShortcuts,
  SHORTCUTS,
  getShortcutsByCategory,
  formatShortcut,
} from './keyboard-shortcuts';

export type { KeyboardShortcut } from './keyboard-shortcuts';

// ============================================================
// COLLABORATION
// ============================================================

export {
  CollaborationProvider,
  useCollaboration,
  PresenceAvatars,
  CommentPanel,
  ActivityFeed,
} from './Collaboration';

export type {
  User,
  Presence,
  Comment,
  CommentReply,
  Activity,
} from './Collaboration';

// ============================================================
// TEMPLATES
// ============================================================

export {
  TEMPLATES,
  getTemplate,
} from './templates';

export type { Template } from './templates';
