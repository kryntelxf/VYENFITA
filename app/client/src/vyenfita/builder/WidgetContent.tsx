/**
 * VYENFITA Widget Content
 * 
 * Renders the actual content of a widget.
 * 
 * @version 1.0.0
 */

import React from 'react';
import { Widget } from './types';
import Button from '../design-system/Button';
import Input from '../design-system/Input';
import Textarea from '../design-system/Textarea';
import { colors, spacing, borderRadius, typography } from '../design-system/tokens';

interface WidgetContentProps {
  widget: Widget;
}

export const WidgetContent: React.FC<WidgetContentProps> = ({ widget }) => {
  const { type, props } = widget;

  switch (type) {
    case 'text':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            padding: spacing[2],
            fontSize: props.fontSize || '14px',
            color: props.color || colors.text.primary,
            fontWeight: props.fontWeight || 'normal',
            textAlign: props.textAlign || 'left',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          {props.text || 'Text'}
        </div>
      );

    case 'heading':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            padding: spacing[2],
            fontSize: props.fontSize || '24px',
            color: props.color || colors.text.primary,
            fontWeight: props.fontWeight || '600',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          {props.text || 'Heading'}
        </div>
      );

    case 'button':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing[1],
          }}
        >
          <Button
            variant="primary"
            style={{
              width: '100%',
              height: '100%',
              background: props.backgroundColor,
              color: props.color,
            }}
          >
            {props.text || 'Button'}
          </Button>
        </div>
      );

    case 'input':
      return (
        <div style={{ width: '100%', padding: spacing[1] }}>
          <Input
            label={props.label}
            placeholder={props.placeholder}
            required={props.required}
            fullWidth
          />
        </div>
      );

    case 'textarea':
      return (
        <div style={{ width: '100%', padding: spacing[1], height: '100%' }}>
          <Textarea
            label={props.label}
            placeholder={props.placeholder}
            required={props.required}
            fullWidth
            style={{ height: '100%', minHeight: 'unset' }}
          />
        </div>
      );

    case 'select':
      return (
        <div style={{ width: '100%', padding: spacing[1] }}>
          <label
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: colors.text.primary,
              display: 'block',
              marginBottom: spacing[1],
            }}
          >
            {props.label || 'Select'}
          </label>
          <select
            style={{
              width: '100%',
              padding: `${spacing[2]} ${spacing[3]}`,
              fontSize: typography.fontSize.base,
              border: `1px solid ${colors.border.default}`,
              borderRadius: borderRadius.lg,
              background: colors.background.primary,
              outline: 'none',
            }}
          >
            {props.options?.map((opt: any) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    case 'checkbox':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            padding: spacing[2],
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
          }}
        >
          <input type="checkbox" />
          <label style={{ fontSize: typography.fontSize.base }}>
            {props.label || 'Checkbox'}
          </label>
        </div>
      );

    case 'radio':
      return (
        <div style={{ width: '100%', padding: spacing[2] }}>
          <div
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              marginBottom: spacing[1],
            }}
          >
            {props.label || 'Radio'}
          </div>
          {props.options?.map((opt: any) => (
            <div key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
              <input type="radio" name={widget.id} />
              <label style={{ fontSize: typography.fontSize.base }}>{opt.label}</label>
            </div>
          ))}
        </div>
      );

    case 'datepicker':
      return (
        <div style={{ width: '100%', padding: spacing[1] }}>
          <Input type="date" label={props.label} fullWidth />
        </div>
      );

    case 'filepicker':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            padding: spacing[3],
            border: `2px dashed ${colors.border.default}`,
            borderRadius: borderRadius.lg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing[1],
            background: colors.background.secondary,
          }}
        >
          <div style={{ fontSize: '24px' }}>📎</div>
          <div style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary }}>
            {props.label || 'Click or drag files'}
          </div>
        </div>
      );

    case 'table':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: colors.background.primary,
            border: `1px solid ${colors.border.default}`,
            borderRadius: borderRadius.lg,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: spacing[2],
              background: colors.background.secondary,
              borderBottom: `1px solid ${colors.border.default}`,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: spacing[2],
            }}
          >
            <div>Column 1</div>
            <div>Column 2</div>
            <div>Column 3</div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.text.tertiary, fontSize: typography.fontSize.sm }}>
            Table data
          </div>
        </div>
      );

    case 'chart':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: colors.background.primary,
            border: `1px solid ${colors.border.default}`,
            borderRadius: borderRadius.lg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing[2],
            color: colors.text.tertiary,
          }}
        >
          <div style={{ fontSize: '32px' }}>📈</div>
          <div style={{ fontSize: typography.fontSize.sm }}>{props.label || 'Chart'}</div>
        </div>
      );

    case 'card':
    case 'container':
    case 'form':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: colors.background.primary,
            border: `1px dashed ${colors.border.default}`,
            borderRadius: borderRadius.lg,
            padding: spacing[2],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.text.tertiary,
            fontSize: typography.fontSize.sm,
          }}
        >
          Drop widgets here
        </div>
      );

    case 'image':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: colors.background.secondary,
            border: `1px dashed ${colors.border.default}`,
            borderRadius: borderRadius.lg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.text.tertiary,
            fontSize: typography.fontSize.sm,
          }}
        >
          {props.value ? (
            <img src={props.value} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} />
          ) : (
            <span>🖼️ Image</span>
          )}
        </div>
      );

    case 'video':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: colors.neutral[900],
            borderRadius: borderRadius.lg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.text.tertiary,
            fontSize: typography.fontSize.sm,
          }}
        >
          {props.value ? (
            <video src={props.value} controls style={{ maxWidth: '100%', maxHeight: '100%' }} />
          ) : (
            <span>🎥 Video</span>
          )}
        </div>
      );

    case 'iframe':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: colors.background.secondary,
            border: `1px solid ${colors.border.default}`,
            borderRadius: borderRadius.lg,
            overflow: 'hidden',
          }}
        >
          {props.value ? (
            <iframe src={props.value} style={{ width: '100%', height: '100%', border: 'none' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.text.tertiary, fontSize: typography.fontSize.sm }}>
              🌐 Iframe
            </div>
          )}
        </div>
      );

    case 'divider':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            padding: `0 ${spacing[2]}`,
          }}
        >
          <hr style={{ width: '100%', border: 'none', borderTop: `1px solid ${colors.border.default}` }} />
        </div>
      );

    case 'spacer':
      return <div style={{ width: '100%', height: '100%' }} />;

    case 'tabs':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: colors.background.primary,
            border: `1px solid ${colors.border.default}`,
            borderRadius: borderRadius.lg,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              borderBottom: `1px solid ${colors.border.default}`,
              background: colors.background.secondary,
            }}
          >
            {props.options?.map((opt: any, i: number) => (
              <div
                key={opt.value}
                style={{
                  padding: `${spacing[2]} ${spacing[4]}`,
                  borderBottom: i === 0 ? `2px solid ${colors.brand.primary}` : 'none',
                  fontSize: typography.fontSize.sm,
                  fontWeight: i === 0 ? typography.fontWeight.semibold : typography.fontWeight.normal,
                  color: i === 0 ? colors.brand.primary : colors.text.secondary,
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.text.tertiary, fontSize: typography.fontSize.sm }}>
            Tab content
          </div>
        </div>
      );

    default:
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: colors.background.secondary,
            border: `1px dashed ${colors.border.default}`,
            borderRadius: borderRadius.lg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: typography.fontSize.sm,
            color: colors.text.tertiary,
          }}
        >
          {type}
        </div>
      );
  }
};

export default WidgetContent;
