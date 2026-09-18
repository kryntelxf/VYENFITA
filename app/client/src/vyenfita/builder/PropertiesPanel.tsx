/**
 * VYENFITA Properties Panel
 * 
 * Right panel to edit selected widget properties.
 * 
 * @version 1.0.0
 */

import React from 'react';
import { useBuilder } from './builder-store';
import { colors, typography, spacing, borderRadius } from '../design-system/tokens';
import Input from '../design-system/Input';
import Textarea from '../design-system/Textarea';
import Button from '../design-system/Button';

export const PropertiesPanel: React.FC = () => {
  const { state, updateWidget, deleteWidget, duplicateWidget } = useBuilder();
  const selectedWidget = state.application.pages
    .flatMap((p) => p.widgets)
    .find((w) => w.id === state.ui.selectedWidgetId);

  if (!selectedWidget) {
    return (
      <div
        style={{
          width: '280px',
          height: '100%',
          background: colors.background.primary,
          borderLeft: `1px solid ${colors.border.default}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.text.tertiary,
          fontSize: typography.fontSize.sm,
          padding: spacing[4],
          textAlign: 'center',
        }}
      >
        Select a widget to edit its properties
      </div>
    );
  }

  const handlePropChange = (key: string, value: any) => {
    updateWidget(selectedWidget.id, {
      props: { ...selectedWidget.props, [key]: value },
    });
  };

  const handlePositionChange = (key: string, value: number) => {
    updateWidget(selectedWidget.id, {
      position: { ...selectedWidget.position, [key]: value },
    });
  };

  return (
    <div
      style={{
        width: '280px',
        height: '100%',
        background: colors.background.primary,
        borderLeft: `1px solid ${colors.border.default}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: spacing[3],
          borderBottom: `1px solid ${colors.border.default}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing[2],
        }}
      >
        <div>
          <div
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: colors.text.primary,
            }}
          >
            {selectedWidget.name}
          </div>
          <div
            style={{
              fontSize: typography.fontSize.xs,
              color: colors.text.tertiary,
              textTransform: 'uppercase',
            }}
          >
            {selectedWidget.type}
          </div>
        </div>
        <button
          onClick={() => deleteWidget(selectedWidget.id)}
          title="Delete widget"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            color: colors.semantic.error,
            padding: spacing[1],
          }}
        >
          🗑️
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: spacing[3], display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
        {/* General */}
        <Section title="General">
          <Input
            label="Name"
            value={selectedWidget.name}
            onChange={(e) => updateWidget(selectedWidget.id, { name: e.target.value })}
            fullWidth
          />
        </Section>

        {/* Position & Size */}
        <Section title="Layout">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[2] }}>
            <Input
              label="X"
              type="number"
              value={selectedWidget.position.x}
              onChange={(e) => handlePositionChange('x', parseInt(e.target.value) || 0)}
              fullWidth
            />
            <Input
              label="Y"
              type="number"
              value={selectedWidget.position.y}
              onChange={(e) => handlePositionChange('y', parseInt(e.target.value) || 0)}
              fullWidth
            />
            <Input
              label="Width"
              type="number"
              value={selectedWidget.position.width}
              onChange={(e) => handlePositionChange('width', parseInt(e.target.value) || 1)}
              fullWidth
            />
            <Input
              label="Height"
              type="number"
              value={selectedWidget.position.height}
              onChange={(e) => handlePositionChange('height', parseInt(e.target.value) || 1)}
              fullWidth
            />
          </div>
        </Section>

        {/* Widget-specific props */}
        <Section title="Properties">
          {renderPropFields(selectedWidget, handlePropChange)}
        </Section>

        {/* Actions */}
        <Section title="Actions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
            <Button variant="secondary" onClick={() => duplicateWidget(selectedWidget.id)} fullWidth>
              Duplicate
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
};

// ============================================================
// HELPERS
// ============================================================

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div
      style={{
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        color: colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: spacing[2],
      }}
    >
      {title}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>{children}</div>
  </div>
);

function renderPropFields(widget: any, onChange: (key: string, value: any) => void): React.ReactNode {
  const { type, props } = widget;

  const fields: React.ReactNode[] = [];

  // Text-like widgets
  if (['text', 'heading', 'button'].includes(type)) {
    fields.push(
      <Input
        key="text"
        label="Text"
        value={props.text || ''}
        onChange={(e) => onChange('text', e.target.value)}
        fullWidth
      />
    );
  }

  // Input widgets
  if (['input', 'textarea', 'select', 'datepicker', 'filepicker'].includes(type)) {
    fields.push(
      <Input
        key="label"
        label="Label"
        value={props.label || ''}
        onChange={(e) => onChange('label', e.target.value)}
        fullWidth
      />,
      <Input
        key="placeholder"
        label="Placeholder"
        value={props.placeholder || ''}
        onChange={(e) => onChange('placeholder', e.target.value)}
        fullWidth
      />
    );
  }

  // Button color
  if (type === 'button') {
    fields.push(
      <Input
        key="bg"
        label="Background Color"
        type="color"
        value={props.backgroundColor || '#667eea'}
        onChange={(e) => onChange('backgroundColor', e.target.value)}
        fullWidth
      />,
      <Input
        key="color"
        label="Text Color"
        type="color"
        value={props.color || '#ffffff'}
        onChange={(e) => onChange('color', e.target.value)}
        fullWidth
      />
    );
  }

  // Font size
  if (['text', 'heading'].includes(type)) {
    fields.push(
      <Input
        key="fontSize"
        label="Font Size"
        value={props.fontSize || '14px'}
        onChange={(e) => onChange('fontSize', e.target.value)}
        fullWidth
      />
    );
  }

  return fields.length > 0 ? <>{fields}</> : <div style={{ fontSize: typography.fontSize.sm, color: colors.text.tertiary }}>No editable properties</div>;
}

export default PropertiesPanel;
