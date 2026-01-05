import React, { useEffect, useRef, useState } from 'react';
import { t } from '../utils/i18n';
import './manager.css';
import { SearchEngine } from './types';
import {
  DndContext, 
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragEndEvent,
  DragStartEvent,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { SortableItem } from './SortableItem';

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
    onSort: (order: 'asc' | 'desc' | 'length') => void;
    onReorder: (newEngines: SearchEngine[]) => void;
}

const SearchCard = ({ 
    engine, 
    searchQuery, 
    onQueryChange, 
    onSearch, 
    onContextMenu, 
    inputRef,
    isOverlay = false
}: { 
    engine: SearchEngine, 
    searchQuery: string, 
    onQueryChange?: (id: string, val: string) => void, 
    onSearch?: (engine: SearchEngine) => void,
    onContextMenu?: (e: React.MouseEvent) => void,
    inputRef?: React.RefObject<HTMLInputElement>,
    isOverlay?: boolean
}) => {
    const getFavicon = (urlStr: string) => {
        try {
            const url = new URL(urlStr.replace('{z}', ''));
            return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
        } catch (e) {
            return 'icons/icon48.png';
        }
    };

    return (
        <div 
            className={`search-card ${isOverlay ? 'drag-overlay-card' : ''}`}
            style={isOverlay ? { 
                cursor: 'grabbing', 
                boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                background: 'var(--bg-secondary)', // Ensure background is opaque
                border: '1px solid var(--border-color)',
                zIndex: 9999
            } : undefined}
            onContextMenu={onContextMenu}
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
                    ref={inputRef}
                    type="text"
                    className="search-engine-input"
                    placeholder={t('searchAction', engine.name)}
                    value={searchQuery || ''}
                    onChange={(e) => onQueryChange && onQueryChange(engine.id, e.target.value)}
                    onKeyDown={(e) => {
                        if(e.key === 'Enter' && onSearch) onSearch(engine);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    readOnly={isOverlay}
                />
                <button 
                    className="search-go-btn"
                    onClick={() => onSearch && onSearch(engine)}
                    disabled={!searchQuery}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export const SearchPopup: React.FC<SearchPopupProps> = ({
    isOpen,
    onClose,
    searchEngines,
    searchQueries,
    onQueryChange,
    onSearch,
    onAddEngine,
    onEditEngine,
    onDeleteEngine,
    onSort,
    onReorder
}) => {
    const [gridColumns, setGridColumns] = useState(3);
    const [columnMenuOpen, setColumnMenuOpen] = useState(false);
    const [sortMenuOpen, setSortMenuOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, engine: SearchEngine } | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const firstInputRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get(['gridColumns'], (result) => {
                if (result.gridColumns) {
                    setGridColumns(result.gridColumns);
                } else {
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

    // Auto-focus logic
    useEffect(() => {
        if (isOpen && firstInputRef.current) {
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
             setSortMenuOpen(false);
             setContextMenu(null);
        };
        
        window.addEventListener('keydown', handleKeyDown);
        if (columnMenuOpen || sortMenuOpen || contextMenu) {
            window.addEventListener('click', handleGlobalClick);
            window.addEventListener('contextmenu', handleGlobalClick);
        }
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('click', handleGlobalClick);
            window.removeEventListener('contextmenu', handleGlobalClick);
        };
    }, [isOpen, onClose, columnMenuOpen, sortMenuOpen, contextMenu]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (active.id !== over?.id) {
            const oldIndex = searchEngines.findIndex((item) => item.id === active.id);
            const newIndex = searchEngines.findIndex((item) => item.id === over?.id);
            const newOrder = arrayMove(searchEngines, oldIndex, newIndex);
            onReorder(newOrder);
        }
    };

    if (!isOpen) return null;

    const activeEngine = activeId ? searchEngines.find(e => e.id === activeId) : null;

    return (
        <div className="search-popup-overlay" onMouseDown={onClose}>
            <div 
                className="search-popup-content" 
                onMouseDown={e => e.stopPropagation()}
            >
                <div className="search-popup-header">
                    <h2 className="search-popup-title">{t('searchTools')}</h2>
                    <div style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
                        
                         {/* Sort Button - Similar to Manager */}
                         <div className="column-selector" style={{position: 'relative'}}>
                             <button 
                                 className="icon-btn-tiny"
                                 onClick={(e) => {
                                     e.stopPropagation();
                                     setSortMenuOpen(!sortMenuOpen);
                                     setColumnMenuOpen(false);
                                 }}
                                 title={t('sort')}
                                 style={{
                                     width: '32px', 
                                     height: '32px', 
                                     border: '1px solid var(--border-color)',
                                     borderRadius: '6px',
                                     background: sortMenuOpen ? 'var(--bg-secondary)' : 'transparent'
                                 }}
                             >
                                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M6 12h12M9 18h6"/></svg>
                             </button>

                             {sortMenuOpen && (
                                 <div className="dropdown-menu" style={{right: 'auto', left: 0, minWidth: '180px'}}>
                                     <div className="dropdown-item" onClick={() => { onSort('asc'); setSortMenuOpen(false); }}>
                                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: 8}}><path d="M15 11l-3 3-3-3m0-6h12M9 17h12"></path></svg>
                                         {t('sortByNameAsc')}
                                     </div>
                                     <div className="dropdown-item" onClick={() => { onSort('desc'); setSortMenuOpen(false); }}>
                                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: 8}}><path d="M15 13l-3-3-3 3m0 6h12M9 5h12"></path></svg>
                                         {t('sortByNameDesc')}
                                     </div>
                                     <div className="dropdown-item" onClick={() => { onSort('length'); setSortMenuOpen(false); }}>
                                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: 8}}><path d="M21 6H3M17 12H7M13 18H11"></path></svg>
                                         {t('sortByNameLength')}
                                     </div>
                                 </div>
                             )}
                         </div>

                        <div className="column-selector" style={{position: 'relative'}}>
                            <button
                                className="icon-btn-tiny"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setColumnMenuOpen(!columnMenuOpen);
                                    setSortMenuOpen(false);
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
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={searchEngines}
                            strategy={rectSortingStrategy}
                        >
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
                                    <SortableItem 
                                        key={engine.id} 
                                        id={engine.id}
                                        className="search-card-wrapper"
                                    >
                                        <SearchCard 
                                            engine={engine}
                                            searchQuery={searchQueries[engine.id]}
                                            onQueryChange={onQueryChange}
                                            onSearch={onSearch}
                                            inputRef={index === 0 ? firstInputRef : undefined}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setContextMenu({ x: e.clientX, y: e.clientY, engine });
                                            }}
                                        />
                                    </SortableItem>
                                ))
                            )}
                            </div>
                        </SortableContext>
                        <DragOverlay adjustScale={true}>
                            {activeEngine ? (
                                <div style={{width: '250px'}}> 
                                    <SearchCard 
                                        engine={activeEngine}
                                        searchQuery={searchQueries[activeEngine.id]}
                                        isOverlay={true}
                                    />
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
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
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path>
                        </svg>
                        <span>{t('deleteSearchEngine')}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
