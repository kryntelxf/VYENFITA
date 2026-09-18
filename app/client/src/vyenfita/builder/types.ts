/**
 * VYENFITA Builder Module
 * 
 * Public exports for the visual app builder.
 * 
 * The builder provides:
 * - Drag-and-drop canvas
 * - Widget palette (20+ widget types)
 * - Properties panel
 * - Undo/redo history
 * - Code view (JSON)
 * - Starter templates
 * 
 * @version 1.0.0
 */

// ============================================================
// TYPES
// ============================================================

export type {
  WidgetType,
  Widget,
  WidgetProps,
  WidgetPosition,
  WidgetDefinition,
  Page,
  ApplicationState,
  BuilderState,
  BuilderAction,
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
// COMPONENTS
// ============================================================

export { default as WidgetPalette } from './WidgetPalette';
export { default as Canvas } from './Canvas';
export { default as WidgetRenderer } from './WidgetRenderer';
export { default as WidgetContent } from './WidgetContent';
export { default as PropertiesPanel } from './PropertiesPanel';
export { default as CodeView } from './CodeView';
export { default as Toolbar } from './Toolbar';

// ============================================================
// TEMPLATES
// ============================================================

export {
  TEMPLATES,
  getTemplate,
} from './templates';

export type { Template } from './templates';

// ============================================================
// DEFAULT EXPORT — Complete Builder Layout
// ============================================================

import React, { useState } from 'react';
import { BuilderProvider } from './builder-store';
import WidgetPalette from './WidgetPalette';
import Canvas from './Canvas';
import PropertiesPanel from './PropertiesPanel';
import Toolbar from './Toolbar';
import CodeView from './CodeView';
import { TEMPLATES } from './templates';
import { colors, spacing, borderRadius, shadows, typography, transitions } from '../design-system/tokens';
import Button from '../design-system/Button';
import Modal from '../design-system/Modal';

export interface BuilderProps {
  /**
   * Initial state (optional)
   */
  initialState?: any;

  /**
   * Callback when user clicks "Save"
   */
  onSave?: (state: any) => void | Promise<void>;

  /**
   * Callback when user clicks "Preview"
   */
  onPreview?: (state: any) => void;

  /**
   * Whether to show the toolbar
   */
  showToolbar?: boolean;

  /**
   * Read-only mode (disables editing)
   */
  readOnly?: boolean;
}

/**
 * Complete VYENFITA Builder Layout
 * 
 * Combines all builder components into a single, ready-to-use editor:
 * 
 *   ┌─────────────────────────────────────────────────┐
 *   │  Toolbar (undo, zoom, templates, save)          │
 *   ├──────────┬──────────────────────────┬───────────┤
 *   │ Widget   │       Canvas             │ Properties│
 *   │ Palette  │       (drag-drop)        │  Panel    │
 *   │          │                          │           │
 *   └──────────┴──────────────────────────┴───────────┘
 * 
 * Usage:
 *   <Builder
 *     onSave={(state) => saveToBackend(state)}
 *     onPreview={(state) => openPreviewWindow(state)}
 *   />
 */
export const Builder: React.FC<BuilderProps> = ({
  initialState,
  onSave,
  onPreview,
  showToolbar = true,
  readOnly = false,
}) => {
  const [showCodeView, setShowCodeView] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <BuilderProvider>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100vw',
          height: '100vh',
          background: colors.background.tertiary,
          fontFamily: typography.fontFamily.sans,
          overflow: 'hidden',
        }}
      >
        {/* Toolbar */}
        {showToolbar && (
          <Toolbar
            onOpenCodeView={() => setShowCodeView(true)}
            onOpenTemplates={() => setShowTemplates(true)}
            onSave={async () => {
              if (!onSave) return;
              setIsSaving(true);
              try {
                await onSave(initialState);
              } finally {
                setIsSaving(false);
              }
            }}
            onPreview={onPreview ? () => onPreview(initialState) : undefined}
          />
        )}

        {/* Main Content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          {/* Left: Widget Palette */}
          {!readOnly && <WidgetPalette />}

          {/* Center: Canvas or Code View */}
          {showCodeView ? (
            <CodeView />
          ) : (
            <Canvas />
          )}

          {/* Right: Properties Panel */}
          {!readOnly && <PropertiesPanel />}
        </div>

        {/* Code View Modal */}
        {showCodeView && (
          <Modal
            isOpen={showCodeView}
            onClose={() => setShowCodeView(false)}
            title="Application Specification"
            size="xl"
          >
            <CodeView />
          </Modal>
        )}

        {/* Templates Modal */}
        <Modal
          isOpen={showTemplates}
          onClose={() => setShowTemplates(false)}
          title="Start from a Template"
          size="lg"
        >
          <TemplateGallery
            onSelect={(templateId) => {
              // Template will be loaded via useBuilder in child
              setShowTemplates(false);
            }}
          />
        </Modal>
      </div>
    </BuilderProvider>
  );
};

// ============================================================
// TEMPLATE GALLERY
// ============================================================

interface TemplateGalleryProps {
  onSelect: (templateId: string) => void;
}

const TemplateGallery: React.FC<TemplateGalleryProps> = ({ onSelect }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'business', 'personal', 'data', 'form'];
  const filteredTemplates =
    selectedCategory === 'all'
      ? TEMPLATES
      : TEMPLATES.filter((t) => t.category === selectedCategory);

  return (
    <div>
      {/* Category Filter */}
      <div
        style={{
          display: 'flex',
          gap: spacing[2],
          marginBottom: spacing[4],
          flexWrap: 'wrap',
        }}
      >
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: `${spacing[2]} ${spacing[4]}`,
              background:
                selectedCategory === cat
                  ? colors.brand.primary
                  : colors.background.secondary,
              color:
                selectedCategory === cat
                  ? colors.text.inverse
                  : colors.text.secondary,
              border: 'none',
              borderRadius: borderRadius.full,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: `all ${transitions.fast}`,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: spacing[4],
        }}
      >
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={() => onSelect(template.id)}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================================
// TEMPLATE CARD
// ============================================================

interface TemplateCardProps {
  template: (typeof TEMPLATES)[number];
  onSelect: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onSelect }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: spacing[2],
        padding: spacing[4],
        background: colors.background.primary,
        border: `1px solid ${isHovered ? colors.brand.primary : colors.border.default}`,
        borderRadius: borderRadius.xl,
        cursor: 'pointer',
        textAlign: 'left',
        transition: `all ${transitions.base}`,
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHovered ? shadows.lg : shadows.sm,
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.background.secondary,
          borderRadius: borderRadius.lg,
          fontSize: '24px',
        }}
      >
        {template.icon}
      </div>
      <div
        style={{
          fontSize: typography.fontSize.base,
          fontWeight: typography.fontWeight.semibold,
          color: colors.text.primary,
        }}
      >
        {template.name}
      </div>
      <div
        style={{
          fontSize: typography.fontSize.sm,
          color: colors.text.secondary,
          lineHeight: 1.4,
        }}
      >
        {template.description}
      </div>
      <div
        style={{
          marginTop: spacing[2],
          fontSize: typography.fontSize.xs,
          color: colors.text.tertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {template.category} · {template.state.pages.length} page(s)
      </div>
    </button>
  );
};

// ============================================================
// DEFAULT EXPORTS
// ============================================================

export default Builder;
