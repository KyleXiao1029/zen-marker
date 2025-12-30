import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps extends React.HTMLAttributes<HTMLDivElement> {
  id: string;
}

export function SortableItem({ id, children, style, ...props }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
      id,
      transition: {
        duration: 200, // Faster duration (default is 250)
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      } 
  });

  const combinedStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 'auto',
    cursor: isDragging ? 'grabbing' : undefined,
    ...style,
  };

  return (
    <div ref={setNodeRef} style={combinedStyle} {...attributes} {...listeners} {...props}>
      {children}
    </div>
  );
}
