/**
 * VYENFITA Widget Renderer
 * 
 * Renders individual widgets on the canvas with:
 * - Selection handles
 * - Resize handles
 * - Drag to move
 * 
 * @version 1.0.0
 */

import React, { useRef, useState, useCallback } from 'react';
import { Widget, WidgetPosition } from './types';
import { useBuilder } from './builder-store';
import { colors, borderRadius, shadows, spacing } from '../design-system/tokens';
import WidgetContent from './WidgetContent';

interface WidgetRendererProps {
  widget: Widget;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
  colWidth: number;
}

const ROW_HEIGHT = 40;
const MIN_WIDTH = 1;
const MIN_HEIGHT = 1;

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({
  widget,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  colWidth,
}) => {
  const { updateWidget, state } = useBuilder();
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (state.ui.mode !== 'design') return;
      e.stopPropagation();
      onSelect();

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      setIsDragging(true);
    },
    [onSelect, state.ui.mode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragOffsetRef.current) return;

      const canvas = (e.currentTarget as HTMLElement).parentElement;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();

      // Calculate new position in grid units
      const pixelX = e.clientX - canvasRect.left - dragOffsetRef.current.x;
      const pixelY = e.clientY - canvasRect.top - dragOffsetRef.current.y;

      let gridX = Math.round(pixelX / colWidth);
      let gridY = Math.round(pixelY / ROW_HEIGHT);

      // Snap to grid
      if (state.ui.snapToGrid) {
        gridX = Math.round(gridX);
        gridY = Math.round(gridY);
      }

      // Bounds check
      gridX = Math.max(0, Math.min(12 - widget.position.width, gridX));
      gridY = Math.max(0, gridY);

      updateWidget(widget.id, {
        position: { ...widget.position, x: gridX, y: gridY },
      });
    },
    [isDragging, widget.id, widget.position, colWidth, updateWidget, state.ui.snapToGrid]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragOffsetRef.current = null;
  }, []);

  const handleResize = useCallback(
    (direction: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const startPos = { ...widget.position };

      const handleMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        const newPos: WidgetPosition = { ...startPos };

        if (direction.includes('e')) {
          newPos.width = Math.max(
            MIN_WIDTH,
            startPos.width + Math.round(deltaX / colWidth)
          );
        }
        if (direction.includes('w')) {
          const deltaCols = Math.round(deltaX / colWidth);
          newPos.x = Math.max(0, startPos.x + deltaCols);
          newPos.width = Math.max(MIN_WIDTH, startPos.width - deltaCols);
        }
        if (direction.includes('s')) {
          newPos.height = Math.max(
            MIN_HEIGHT,
            startPos.height + Math.round(deltaY / ROW_HEIGHT)
          );
        }
        if (direction.includes('n')) {
          const deltaRows = Math.round(deltaY / ROW_HEIGHT);
          newPos.y = Math.max(0, startPos.y + deltaRows);
          newPos.height = Math.max(MIN_HEIGHT, startPos.height - deltaRows);
        }

        // Bounds check
        newPos.width = Math.min(12 - newPos.x, newPos.width);

        updateWidget(widget.id, { position: newPos });
      };

      const handleUp = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [widget.id, widget.position, colWidth, updateWidget]
  );

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${widget.position.x * colWidth}px`,
    top: `${widget.position.y * ROW_HEIGHT}px`,
    width: `${widget.position.width * colWidth}px`,
    height: `${widget.position.height * ROW_HEIGHT}px`,
    outline: isSelected
      ? `2px solid ${colors.brand.primary}`
      : isHovered
      ? `2px solid ${colors.brand.primary}80`
      : 'none',
    outlineOffset: '-1px',
    cursor: state.ui.mode === 'design' ? 'move' : 'default',
    opacity: widget.hidden ? 0.3 : 1,
    transition: isDragging ? 'none' : 'all 100ms',
    userSelect: 'none',
  };

  return (
    <div
      style={style}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      data-widget-id={widget.id}
    >
      <WidgetContent widget={widget} />

      {isSelected && state.ui.mode === 'design' && (
        <>
          {/* Resize handles */}
          <ResizeHandle direction="nw" onMouseDown={(e) => handleResize('nw', e)} />
          <ResizeHandle direction="n" onMouseDown={(e) => handleResize('n', e)} />
          <ResizeHandle direction="ne" onMouseDown={(e) => handleResize('ne', e)} />
          <ResizeHandle direction="w" onMouseDown={(e) => handleResize('w', e)} />
          <ResizeHandle direction="e" onMouseDown={(e) => handleResize('e', e)} />
          <ResizeHandle direction="sw" onMouseDown={(e) => handleResize('sw', e)} />
          <ResizeHandle direction="s" onMouseDown={(e) => handleResize('s', e)} />
          <ResizeHandle direction="se" onMouseDown={(e) => handleResize('se', e)} />

          {/* Widget name label */}
          <div
            style={{
              position: 'absolute',
              top: '-24px',
              left: 0,
              background: colors.brand.primary,
              color: 'white',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {widget.name}
          </div>
        </>
      )}
    </div>
  );
};

// ============================================================
// RESIZE HANDLE
// ============================================================

const ResizeHandle: React.FC<{
  direction: string;
  onMouseDown: (e: React.MouseEvent) => void;
}> = ({ direction, onMouseDown }) => {
  const size = 8;
  const offset = -size / 2;

  const positions: Record<string, React.CSSProperties> = {
    nw: { top: offset, left: offset, cursor: 'nwse-resize' },
    n: { top: offset, left: '50%', marginLeft: offset, cursor: 'ns-resize' },
    ne: { top: offset, right: offset, cursor: 'nesw-resize' },
    w: { top: '50%', left: offset, marginTop: offset, cursor: 'ew-resize' },
    e: { top: '50%', right: offset, marginTop: offset, cursor: 'ew-resize' },
    sw: { bottom: offset, left: offset, cursor: 'nesw-resize' },
    s: { bottom: offset, left: '50%', marginLeft: offset, cursor: 'ns-resize' },
    se: { bottom: offset, right: offset, cursor: 'nwse-resize' },
  };

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        background: 'white',
        border: `2px solid ${colors.brand.primary}`,
        borderRadius: '50%',
        zIndex: 10,
        ...positions[direction],
      }}
    />
  );
};

export default WidgetRenderer;
