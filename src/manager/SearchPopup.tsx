import React, { useEffect, useRef } from 'react';
import { t } from '../utils/i18n';
import './manager.css';

interface SearchEngine {
    id: string;
    name: string;
    url: string;
}

interface SearchPopupProps {
    isOpen: boolean;
    onClose: () => void;
    searchEngines: SearchEngine[];
    searchQueries: { [key: string]: string };
    onQueryChange: (engineId: string, value: string) => void;
    onSearch: (engine: SearchEngine) => void;
    onAddEngine: () => void;
    onEditEngine: (engine: SearchEngine) => void;
    onDeleteEngine: (engine: SearchEngine) => void;
}

export const SearchPopup: React.FC<SearchPopupProps> = ({
    isOpen,
    onClose,
    searchEngines,
    searchQueries,
    onQueryChange,
    onSearch,
    onAddEngine,
    onEditEngine,
    onDeleteEngine
}) => {
    const [gridColumns, setGridColumns] = React.useState(3);
    const [columnMenuOpen, setColumnMenuOpen] = React.useState(false);
    const [contextMenu, setContextMenu] = React.useState<{ x: number, y: number, engine: SearchEngine } | null>(null);
    const firstInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get(['gridColumns'], (result) => {
                if (result.gridColumns) {
                    setGridColumns(result.gridColumns);
                } else {
                    // Try local storage if not in sync storage (first migration)
                    const saved = localStorage.getItem('zen_marker_grid_columns');
                    if (saved) setGridColumns(parseInt(saved, 10));
                }
            });
        } else {
            const saved = localStorage.getItem('zen_marker_grid_columns');
            if (saved) {
                setGridColumns(parseInt(saved, 10));
            }
        }
    }, []);

    const handleColumnChange = (cols: number) => {
        setGridColumns(cols);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ gridColumns: cols });
        }
        localStorage.setItem('zen_marker_grid_columns', cols.toString());
    };

    const getFavicon = (urlStr: string) => {
        try {
            const url = new URL(urlStr.replace('{z}', ''));
            return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
        } catch (e) {
            return 'icons/icon48.png';
        }
    };

    // Auto-focus logic
    useEffect(() => {
        if (isOpen && firstInputRef.current) {
            // Small delay to allow animation to start/settle slightly
            setTimeout(() => {
                firstInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    // Close on Escape & Click Outside
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        const handleGlobalClick = () => {
             setColumnMenuOpen(false);
             setContextMenu(null);
        };
        
        window.addEventListener('keydown', handleKeyDown);
        if (columnMenuOpen || contextMenu) {
            window.addEventListener('click', handleGlobalClick);
            window.addEventListener('contextmenu', handleGlobalClick);
        }
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('click', handleGlobalClick);
            window.removeEventListener('contextmenu', handleGlobalClick);
        };
    }, [isOpen, onClose, columnMenuOpen, contextMenu]);

    if (!isOpen) return null;

    return (
        <div className="search-popup-overlay" onMouseDown={onClose}>
            <div 
                className="search-popup-content" 
                onMouseDown={e => e.stopPropagation()}
            >
                <div className="search-popup-header">
                    <h2 className="search-popup-title">{t('searchTools')}</h2>
                    <div style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
                        <div className="column-selector" style={{position: 'relative'}}>
                            <button
                                className="icon-btn-tiny"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setColumnMenuOpen(!columnMenuOpen);
                                }}
                                title={t('columns', gridColumns)}
                                style={{
                                    width: '32px', 
                                    height: '32px', 
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    background: columnMenuOpen ? 'var(--bg-secondary)' : 'transparent'
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="14" width="7" height="7"></rect>
                                    <rect x="3" y="14" width="7" height="7"></rect>
                                </svg>
                            </button>
                            
                            {columnMenuOpen && (
                                <div className="dropdown-menu" style={{right: 'auto', left: 0, minWidth: '100px'}}>
                                    {[1, 2, 3, 4].map(num => (
                                        <div
                                            key={num}
                                            className={`dropdown-item ${gridColumns === num ? 'active' : ''}`}
                                            onClick={() => {
                                                handleColumnChange(num);
                                                setColumnMenuOpen(false);
                                            }}
                                        >
                                            {t('columns', num)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{display: 'flex', gap: '8px'}}>
                            <button 
                                className="icon-btn" 
                                onClick={onAddEngine}
                                title={t('addSearchEngine')}
                                style={{ width: '32px', height: '32px' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 5v14M5 12h14"/>
                                </svg>
                            </button>
                             <button 
                                className="action-btn"
                                onClick={onClose}
                                title={t('modalCancel')}
                                style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'rgba(128,128,128,0.1)' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="search-popup-body">
                    <div 
                        className="search-engines-list" 
                        style={{ 
                            gridTemplateColumns: `repeat(${gridColumns}, 1fr)` 
                        }}
                    >
                    {searchEngines.length === 0 ? (
                        <div className="empty-engines">
                            <p>{t('emptySearchEngines')}</p>
                        </div>
                    ) : (
                        searchEngines.map((engine, index) => (
                            <div 
                                key={engine.id} 
                                className="search-card"
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setContextMenu({
                                        x: e.clientX,
                                        y: e.clientY,
                                        engine
                                    });
                                }}
                            >
                                <div className="search-card-left">
                                    <img 
                                        className="engine-icon" 
                                        src={getFavicon(engine.url)} 
                                        alt={engine.name}
                                        onError={(e) => (e.currentTarget.style.display = 'none')} 
                                    />
                                </div>
                                
                                <div className="search-card-input-wrapper">
                                    <input 
                                        ref={index === 0 ? firstInputRef : null}
                                        type="text"
                                        className="search-engine-input"
                                        placeholder={t('searchAction', engine.name)}
                                        value={searchQueries[engine.id] || ''}
                                        onChange={(e) => onQueryChange(engine.id, e.target.value)}
                                        onKeyPress={(e) => {
                                            if(e.key === 'Enter') onSearch(engine);
                                        }}
                                    />
                                    <button 
                                        className="search-go-btn"
                                        onClick={() => onSearch(engine)}
                                        disabled={!searchQueries[engine.id]}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="11" cy="11" r="8"/>
                                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                    </div>
                </div>
            </div>

            {contextMenu && (
                <div 
                    className="context-menu"
                    style={{
                        top: contextMenu.y,
                        left: contextMenu.x,
                    }}
                    onMouseDown={e => e.stopPropagation()}
                >
                    <div 
                        className="context-menu-item"
                        onClick={() => {
                            onEditEngine(contextMenu.engine);
                            setContextMenu(null);
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>{t('editSearchEngine')}</span>
                    </div>
                    <div 
                        className="context-menu-item delete"
                        style={{ color: '#ff3b30' }}
                        onClick={() => {
                            onDeleteEngine(contextMenu.engine);
                            setContextMenu(null);
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path>
                        </svg>
                        <span>{t('deleteSearchEngine')}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
