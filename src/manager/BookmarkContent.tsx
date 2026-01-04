import React from 'react';
import { BookmarkNode } from './types';
import { t } from '../utils/i18n';

interface BookmarkContentProps {
    node: BookmarkNode;
    getFavicon: (url: string) => string;
    onEdit: (e: React.MouseEvent, node: BookmarkNode) => void;
    onDelete: (e: React.MouseEvent, node: BookmarkNode) => void;
}

export const BookmarkContent: React.FC<BookmarkContentProps> = ({ node, getFavicon, onEdit, onDelete }) => {
    const isFolder = !node.url;
    let hostname = '';
    if (!isFolder && node.url) {
        try {
            hostname = new URL(node.url).hostname;
        } catch (e) {
            hostname = node.url;
        }
    }

    return (
        <>
            <div className="preview-area">
                {isFolder ? (
                    <svg className="folder-icon" width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                ) : (
                    <img className="favicon" src={getFavicon(node.url!)} onError={(e) => (e.currentTarget.src = 'icons/icon48.png')} alt="" />
                )}
            </div>
            <div className="info-area">
                <div className="title" title={node.title}>{node.title || t('untitled')}</div>
                <div className="subtitle">{isFolder ? t('folder') : hostname}</div>
            </div>
            <div className="actions">
                <button className="action-btn" onClick={(e) => onEdit(e, node)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button className="action-btn delete-btn" onClick={(e) => onDelete(e, node)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        </>
    );
};
