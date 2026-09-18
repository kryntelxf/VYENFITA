/**
 * VYENFITA Builder
 * 
 * The main builder component.
 * Combines all sub-components.
 * 
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { BuilderProvider, useBuilder } from './builder-store';
import { CollaborationProvider, User } from './Collaboration';
import WidgetPalette from './WidgetPalette';
import Canvas from './Canvas';
import PropertiesPanel from './PropertiesPanel';
import CodeView from './CodeView';
import Toolbar from './Toolbar';
import PageManager from './PageManager';
import TemplatePicker from './TemplatePicker';
import ShortcutHelp from './ShortcutHelp';
import { useKeyboardShortcuts } from './keyboard-shortcuts';
import { colors } from '../design-system/tokens';

// ============================================================
// INNER BUILDER (uses builder context)
// ============================================================

const BuilderInner: React.FC = () => {
  const { state } = useBuilder();
  const [view, setView] = useState<'canvas' | 'code'>('canvas');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  const handleSave = () => {
    // TODO: Call API to save application
    const data = JSON.stringify(state.application, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.application.metadata.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: colors.background.tertiary,
      }}
    >
      <Toolbar
        onOpenCodeView={() => setView(view === 'canvas' ? 'code' : 'canvas')}
        onOpenTemplates={() => setShowTemplates(true)}
        onSave={handleSave}
      />
      <PageManager />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {view === 'canvas' ? (
          <>
            {state.ui.mode === 'design' && <WidgetPalette />}
            <Canvas />
            {state.ui.mode === 'design' && <PropertiesPanel />}
          </>
        ) : (
          <CodeView />
        )}
      </div>

      <TemplatePicker isOpen={showTemplates} onClose={() => setShowTemplates(false)} />
      <ShortcutHelp isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Help button */}
      <button
        onClick={() => setShowShortcuts(true)}
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: colors.brand.primary,
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '18px',
          fontWeight: 700,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
        }}
        title="Keyboard shortcuts"
      >
        ?
      </button>
    </div>
  );
};

// ============================================================
// OUTER WRAPPER (provides context)
// ============================================================

export interface BuilderProps {
  currentUser?: User;
}

export const Builder: React.FC<BuilderProps> = ({ currentUser }) => {
  return (
    <CollaborationProvider currentUser={currentUser}>
      <BuilderProvider>
        <BuilderInner />
      </BuilderProvider>
    </CollaborationProvider>
  );
};

export default Builder;
