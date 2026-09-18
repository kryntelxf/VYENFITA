/**
 * VYENFITA Page Manager
 * 
 * Manages application pages.
 * 
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { useBuilder } from './builder-store';
import { Page, generatePageId } from './types';
import { colors, typography, spacing, borderRadius, transitions, shadows } from '../design-system/tokens';
import Button from '../design-system/Button';
import Input from '../design-system/Input';
import Modal from '../design-system/Modal';

export const PageManager: React.FC = () => {
  const { state, dispatch } = useBuilder();
  const [showNewPageModal, setShowNewPageModal] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [newPagePath, setNewPagePath] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const pages = state.application.pages;
  const currentPageId = state.application.currentPageId;

  const handleAddPage = () => {
    if (!newPageName.trim()) return;

    const newPage: Page = {
      id: generatePageId(),
      name: newPageName.trim(),
      path: newPagePath.trim() || `/${newPageName.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'custom',
      layout: 'full',
      widgets: [],
    };

    dispatch({ type: 'ADD_PAGE', payload: { page: newPage } });
    setShowNewPageModal(false);
    setNewPageName('');
    setNewPagePath('');
  };

  const handleRename = (id: string, newName: string) => {
    if (newName.trim()) {
      dispatch({
        type: 'UPDATE_PAGE',
        payload: { pageId: id, updates: { name: newName.trim() } },
      });
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleDelete = (id: string) => {
    if (pages.length <= 1) {
      alert('Cannot delete the last page');
      return;
    }
    if (confirm('Delete this page and all its widgets?')) {
      dispatch({ type: 'DELETE_PAGE', payload: { pageId: id } });
    }
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[1],
          padding: `${spacing[1]} ${spacing[3]}`,
          background: colors.background.secondary,
          borderBottom: `1px solid ${colors.border.default}`,
          overflowX: 'auto',
          minHeight: '40px',
        }}
      >
        {pages.map((page) => {
          const isActive = page.id === currentPageId;
          const isRenaming = renamingId === page.id;

          return (
            <div
              key={page.id}
              onClick={() => dispatch({ type: 'SET_CURRENT_PAGE', payload: { pageId: page.id } })}
              onDoubleClick={() => {
                setRenamingId(page.id);
                setRenameValue(page.name);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing[2],
                padding: `${spacing[1]} ${spacing[3]}`,
                background: isActive ? colors.background.primary : 'transparent',
                border: `1px solid ${isActive ? colors.border.default : 'transparent'}`,
                borderRadius: borderRadius.md,
                cursor: 'pointer',
                fontSize: typography.fontSize.sm,
                color: isActive ? colors.text.primary : colors.text.secondary,
                fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.normal,
                transition: `all ${transitions.fast}`,
                whiteSpace: 'nowrap',
                boxShadow: isActive ? shadows.xs : 'none',
              }}
            >
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRename(page.id, renameValue)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(page.id, renameValue);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 'inherit',
                    color: 'inherit',
                    fontWeight: 'inherit',
                    width: '100px',
                  }}
                />
              ) : (
                <>
                  <span>📄 {page.name}</span>
                  {pages.length > 1 && isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(page.id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: colors.text.tertiary,
                        padding: 0,
                        fontSize: '12px',
                        lineHeight: 1,
                      }}
                      title="Delete page"
                    >
                      ×
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}

        <button
          onClick={() => setShowNewPageModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[1],
            padding: `${spacing[1]} ${spacing[3]}`,
            background: 'transparent',
            border: `1px dashed ${colors.border.default}`,
            borderRadius: borderRadius.md,
            cursor: 'pointer',
            fontSize: typography.fontSize.sm,
            color: colors.text.secondary,
            transition: `all ${transitions.fast}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = colors.brand.primary;
            e.currentTarget.style.color = colors.brand.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = colors.border.default;
            e.currentTarget.style.color = colors.text.secondary;
          }}
        >
          + Add Page
        </button>
      </div>

      <Modal
        isOpen={showNewPageModal}
        onClose={() => setShowNewPageModal(false)}
        title="New Page"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNewPageModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddPage} disabled={!newPageName.trim()}>
              Create Page
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
          <Input
            label="Page Name"
            placeholder="e.g. Dashboard"
            value={newPageName}
            onChange={(e) => setNewPageName(e.target.value)}
            autoFocus
          />
          <Input
            label="URL Path"
            placeholder="/dashboard"
            value={newPagePath}
            onChange={(e) => setNewPagePath(e.target.value)}
            hint="Optional. Defaults to /{page-name}"
          />
        </div>
      </Modal>
    </>
  );
};

export default PageManager;
