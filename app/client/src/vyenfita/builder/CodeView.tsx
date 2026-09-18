/**
 * VYENFITA Code View
 * 
 * Shows JSON/YAML representation of the application.
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { useBuilder } from './builder-store';
import { colors, typography, spacing, borderRadius, shadows } from '../design-system/tokens';
import Button from '../design-system/Button';

export const CodeView: React.FC = () => {
  const { state, dispatch } = useBuilder();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setCode(JSON.stringify(state.application, null, 2));
    }
  }, [state.application, isEditing]);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(code);
      dispatch({ type: 'LOAD', payload: { state: parsed } });
      setError(null);
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: colors.neutral[950],
        color: colors.neutral[100],
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing[3],
          background: colors.neutral[900],
          borderBottom: `1px solid ${colors.neutral[800]}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: 600 }}>App Spec</span>
          <span style={{ fontSize: typography.fontSize.xs, color: colors.neutral[500] }}>
            {state.application.pages.length} page(s)
          </span>
        </div>
        <div style={{ display: 'flex', gap: spacing[2] }}>
          <Button variant="ghost" onClick={handleCopy} style={{ color: colors.neutral[300] }}>
            📋 Copy
          </Button>
          {isEditing ? (
            <>
              <Button variant="secondary" onClick={() => { setIsEditing(false); setError(null); }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleApply}>
                Apply
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setIsEditing(true)}>
              ✏️ Edit
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: spacing[3],
            background: colors.semantic.errorDark,
            color: 'white',
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily.mono,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Code */}
      <div style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
        {isEditing ? (
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%',
              height: '100%',
              padding: spacing[4],
              background: 'transparent',
              color: colors.neutral[100],
              fontFamily: typography.fontFamily.mono,
              fontSize: '13px',
              lineHeight: '1.6',
              border: 'none',
              outline: 'none',
              resize: 'none',
            }}
          />
        ) : (
          <pre
            style={{
              margin: 0,
              padding: spacing[4],
              fontFamily: typography.fontFamily.mono,
              fontSize: '13px',
              lineHeight: '1.6',
              color: colors.neutral[100],
              whiteSpace: 'pre',
            }}
          >
            {code}
          </pre>
        )}
      </div>
    </div>
  );
};

export default CodeView;
