/**
 * VYENFITA Builder Canvas
 * 
 * The main design surface where widgets are placed.
 * 
 * @version 1.0.0
 */

import React, { useRef, useState, useCallback } from 'react';
import { useBuilder } from './builder-store';
import { WidgetType, WidgetPosition, createWidget } from './types';
import { colors, spacing, borderRadius } from '../design-system/tokens';
import WidgetRenderer from './WidgetRenderer';

const CANVAS_WIDTH = 1200;
const GRID_COLS = 12;

export const Canvas: React.FC = () => {
  const { state, addWidget, selectWidget, hoverWidget } = useBuilder();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const currentPage = state.application.pages.find(
    (p) => p.id === state.application.currentPageId
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const widgetType = e.dataTransfer.getData('widget-type') as WidgetType;
      if (!widgetType) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Convert pixel to grid
      const colWidth = CANVAS_WIDTH / GRID_COLS;
      const gridX = Math.max(0, Math.floor(x / colWidth));
      const gridY = Math.floor(y / 40);

      const position: WidgetPosition = {
        x: gridX,
        y: gridY,
        width: 4,
        height: 1,
      };

      addWidget(widgetType, position);
    },
    [addWidget]
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Only deselect if clicking directly on canvas, not on a widget
      if (e.target === canvasRef.current) {
        selectWidget(null);
      }
    },
    [selectWidget]
  );

  if (!currentPage) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.text.tertiary,
        }}
      >
        No page selected
      </div>
    );
  }

  const colWidth = CANVAS_WIDTH / GRID_COLS;

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        background: colors.background.tertiary,
        padding: spacing[6],
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          position: 'relative',
          width: `${CANVAS_WIDTH}px`,
          minHeight: '800px',
          background: colors.background.primary,
          borderRadius: borderRadius.xl,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          transform: `scale(${state.ui.zoom})`,
          transformOrigin: 'top center',
          transition: 'border-color 200ms',
          border: dragOver ? `2px dashed ${colors.brand.primary}` : '2px solid transparent',
        }}
      >
        {/* Grid overlay */}
        {state.ui.gridVisible && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              backgroundImage: `
                linear-gradient(to right, ${colors.neutral[200]} 1px, transparent 1px),
                linear-gradient(to bottom, ${colors.neutral[200]} 1px, transparent 1px)
              `,
              backgroundSize: `${colWidth}px ${state.ui.gridSize * 5}px`,
              opacity: 0.5,
              borderRadius: borderRadius.xl,
            }}
          />
        )}

        {/* Empty state */}
        {currentPage.widgets.length === 0 && !dragOver && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: colors.text.tertiary,
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: spacing[3] }}>🎨</div>
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: spacing[1] }}>
              Start building
            </div>
            <div style={{ fontSize: '14px' }}>
              Drag widgets from the left panel or click to add
            </div>
          </div>
        )}

        {/* Widgets */}
        {currentPage.widgets.map((widget) => (
          <WidgetRenderer
            key={widget.id}
            widget={widget}
            isSelected={state.ui.selectedWidgetId === widget.id}
            isHovered={state.ui.hoveredWidgetId === widget.id}
            onSelect={() => selectWidget(widget.id)}
            onHover={(hovered) => hoverWidget(hovered ? widget.id : null)}
            colWidth={colWidth}
          />
        ))}
      </div>
    </div>
  );
};

export default Canvas;
