/**
 * VYENFITA Template Picker
 * 
 * Modal to select a starter template.
 * 
 * @version 1.0.0
 */

import React from 'react';
import Modal from '../design-system/Modal';
import { colors, typography, spacing, borderRadius, transitions, shadows } from '../design-system/tokens';
import { TEMPLATES, Template } from './templates';
import { useBuilder } from './builder-store';

interface TemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({ isOpen, onClose }) => {
  const { dispatch } = useBuilder();

  const handleSelect = (template: Template) => {
    if (confirm(`Replace current app with "${template.name}" template?`)) {
      dispatch({ type: 'LOAD', payload: { state: template.state } });
      onClose();
    }
  };

  const categories: Record<string, Template[]> = {};
  for (const t of TEMPLATES) {
    if (!categories[t.category]) categories[t.category] = [];
    categories[t.category].push(t);
  }

  const categoryLabels: Record<string, string> = {
    business: '💼 Business',
    personal: '👤 Personal',
    data: '📊 Data',
    form: '📝 Form',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose a Template" size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[6] }}>
        {Object.entries(categories).map(([category, templates]) => (
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: spacing[3],
              }}
            >
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={() => handleSelect(template)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};

// ============================================================
// TEMPLATE CARD
// ============================================================

const TemplateCard: React.FC<{ template: Template; onSelect: () => void }> = ({
  template,
  onSelect,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: spacing[4],
        background: colors.background.primary,
        border: `1px solid ${isHovered ? colors.brand.primary : colors.border.default}`,
        borderRadius: borderRadius.lg,
        cursor: 'pointer',
        transition: `all ${transitions.fast}`,
        boxShadow: isHovered ? shadows.md : shadows.sm,
        transform: isHovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ fontSize: '32px', marginBottom: spacing[2] }}>{template.icon}</div>
      <div
        style={{
          fontSize: typography.fontSize.base,
          fontWeight: typography.fontWeight.semibold,
          color: colors.text.primary,
          marginBottom: spacing[1],
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
          marginTop: spacing[3],
          fontSize: typography.fontSize.xs,
          color: colors.text.tertiary,
        }}
      >
        {template.state.pages.length} page(s)
      </div>
    </div>
  );
};

export default TemplatePicker;
