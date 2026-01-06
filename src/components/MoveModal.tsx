import React, { useState, useEffect } from 'react';
import { BookmarkNode } from '../manager/types';
import { t } from '../utils/i18n';
import '../manager/manager.css'; // Ensure we have styles

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetId: string) => void;
  tree: BookmarkNode[];
  selectedIds: Set<string>;
}

export const MoveModal: React.FC<MoveModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  tree,
  selectedIds
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['0', '1']));
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
        setSelectedTargetId(null);
        setExpandedFolders(new Set(['0', '1']));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleFolder = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTree = (nodes: BookmarkNode[], level = 0, disabledPath = false) => {
    return nodes.map(node => {
        // Only render folders
        if (node.url) return null;

        const isMovingItem = selectedIds.has(node.id);
        // If this node is being moved, it cannot be a target.
        // Also, none of its descendants can be targets (cannot move folder into its own child).
        const isDisabled = disabledPath || isMovingItem;

        const isTarget = selectedTargetId === node.id;
        const isExpanded = expandedFolders.has(node.id);
        const hasChildren = node.children && node.children.some(c => !c.url);

        return (
            <div key={node.id}>
                 <div 
                    className={`nav-item ${isTarget ? 'active' : ''}`}
                    style={{ 
                        paddingLeft: `${12 + level * 16}px`,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.5 : 1
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isDisabled) setSelectedTargetId(node.id);
                    }}
                 >
                    {hasChildren ? (
                        <span 
                            className={`nav-arrow ${isExpanded ? 'active' : ''}`}
                            onClick={(e) => toggleFolder(e, node.id)}
                            style={{visibility: 'visible'}}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </span>
                    ) : (
                        <span style={{width: '20px', marginRight: '-2px'}}></span>
                    )}
                    
                    <span className="nav-icon">
                        {isExpanded ? (
                             <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
                        ) : (
                             <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                        )}
                    </span>
                    <span className="nav-title">{node.title || (node.id === '0' ? 'Root' : t('untitled'))}</span>
                 </div>
                 {isExpanded && node.children && renderTree(node.children, level + 1, isDisabled)}
            </div>
        );
    });
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'active' : ''}`} onMouseDown={onClose}>
      <div 
        className="modal" 
        style={{height: '600px', width: '400px', maxWidth: '90%'}} 
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">{t('titleMove')}</div>
        </div>
        <div className="modal-body" style={{flex: 1, overflowY: 'auto', padding: '10px 0'}}>
             {tree.length > 0 && renderTree(tree)}
        </div>
        <div className="modal-footer">
          <button className="modal-btn cancel" onClick={onClose}>
            {t('modalCancel')}
          </button>
          <button 
            className="modal-btn confirm" 
            onClick={() => selectedTargetId && onConfirm(selectedTargetId)}
            disabled={!selectedTargetId}
            style={{opacity: !selectedTargetId ? 0.5 : 1}}
          >
            {t('moveTo')}
          </button>
        </div>
      </div>
    </div>
  );
};
