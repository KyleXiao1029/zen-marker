import React, { useEffect, useState } from 'react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableItem } from './SortableItem';
import { Modal } from '../components/Modal';
import { t, setLang, getLang } from '../utils/i18n';
import './manager.css';

interface BookmarkNode {
  id: string;
  parentId?: string;
  url?: string;
  title: string;
  children?: BookmarkNode[];
}

interface SearchEngine {
  id: string;
  name: string;
  url: string; // URL template with {query} placeholder
}

export default function Manager() {
  const [currentFolderId, setCurrentFolderId] = useState("1"); // Bookmarks Bar
  const [tree, setTree] = useState<BookmarkNode[]>([]);
  const [nodes, setNodes] = useState<BookmarkNode[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{id: string, title: string}[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentLang, setCurrentLang] = useState(getLang());
  
  // Search engines state
  const [searchEngines, setSearchEngines] = useState<SearchEngine[]>([]);
  const [searchQueries, setSearchQueries] = useState<{[key: string]: string}>({});
  
  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>({});

  // Menus
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number } | null>(null);

  // DnD Sensors
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
        const oldIndex = nodes.findIndex((item) => item.id === active.id);
        const newIndex = nodes.findIndex((item) => item.id === over.id);

        // Optimistic UI update
        setNodes((items) => arrayMove(items, oldIndex, newIndex));

        // Persist to Chrome Bookmarks
        if (typeof chrome !== 'undefined' && chrome.bookmarks) {
            // Note: browser persistence is asynchronous
            chrome.bookmarks.move(active.id as string, { index: newIndex }, () => {
                // Determine if we need to refresh the tree (only if a folder was moved)
                const movedNode = nodes[oldIndex];
                if (movedNode && !movedNode.url) {
                   loadTree(); // Refresh sidebar order if it's a folder
                }
            });
        }
    }
  };

  // Close menus on global click
  useEffect(() => {
    const handleClick = () => {
        setContextMenu(null);
        setLangMenuOpen(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Initial Load
  useEffect(() => {
      loadTree();
      loadContent(currentFolderId);
      loadSearchEngines();
  }, []);

  useEffect(() => {
      if(!searchQuery) loadContent(currentFolderId);
  }, [currentFolderId, searchQuery]);

  useEffect(() => {
      if(searchQuery) {
          chrome.bookmarks.search(searchQuery, (results) => setNodes(results));
      }
  }, [searchQuery]);

  const loadTree = () => {
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
      chrome.bookmarks.getTree((results) => setTree(results));
    } else {
      console.warn('chrome.bookmarks API not available');
    }
  }

  const loadContent = (id: string) => {
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
      chrome.bookmarks.getChildren(id, (children) => {
        setNodes(children);
      });
      // Build Breadcrumbs
      buildBreadcrumbPath(id).then(path => setBreadcrumbs(path));
    }
  };

  const buildBreadcrumbPath = (folderId: string): Promise<{id:string, title:string}[]> => {
      return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.bookmarks) {
          resolve([]);
          return;
        }
        const path: {id:string, title:string}[] = [];
        function trace(id: string) {
            if (id === '0') {
                resolve(path.reverse());
                return;
            }
            chrome.bookmarks.get(id, (results) => {
                if (!results || !results.length) {
                    resolve(path.reverse());
                    return;
                }
                const node = results[0];
                path.push({ id: node.id, title: node.title });
                trace(node.parentId!);
            });
        }
        trace(folderId);
      });
  }

  // Load search engines from Chrome storage
  const loadSearchEngines = () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['searchEngines'], (result) => {
        if (result.searchEngines && result.searchEngines.length > 0) {
          setSearchEngines(result.searchEngines);
        } else {
          initDefaultEngines();
        }
      });
    } else {
      console.warn('chrome.storage API not available');
      initDefaultEngines();
    }
  };

  const initDefaultEngines = () => {
    const defaultEngines: SearchEngine[] = [
      {
        id: '1',
        name: 'Google',
        url: 'https://www.google.com/search?q={query}'
      },
      {
        id: '2',
        name: 'Bing',
        url: 'https://www.bing.com/search?q={query}'
      },
      {
        id: '3',
        name: '百度',
        url: 'https://www.baidu.com/s?wd={query}'
      }
    ];
    setSearchEngines(defaultEngines);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      saveSearchEngines(defaultEngines);
    }
  };

  // Save search engines to Chrome storage
  const saveSearchEngines = (engines: SearchEngine[]) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ searchEngines: engines });
    }
  };

  const handleLangSelect = (lang: 'en' | 'zh') => {
      setLang(lang);
      setCurrentLang(lang);
      setLangMenuOpen(false);
      window.location.reload(); 
  };

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());



  // Auto-expand sidebar on navigation
  useEffect(() => {
    if (breadcrumbs.length > 0) {
      setExpandedFolders(prev => {
        const next = new Set(prev);
        breadcrumbs.forEach(crumb => next.add(crumb.id));
        return next;
      });
    }
  }, [breadcrumbs]);

  const toggleFolder = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Sidebar Recursive Renderer
  const renderSidebarItem = (node: BookmarkNode, level: number = 0) => {
      const isSelected = node.id === currentFolderId;
      const hasChildren = node.children && node.children.some(c => !c.url);
      const isExpanded = expandedFolders.has(node.id);

      return (
          <div key={node.id}>
              <div 
                  className={`nav-item ${isSelected ? 'active' : ''}`}
                  style={{ paddingLeft: `${12 + level * 16}px` }}
                  onClick={() => { setCurrentFolderId(node.id); setSearchQuery(""); }}
              >
                  {hasChildren && (
                    <span 
                      className={`nav-arrow ${isExpanded ? 'active' : ''}`}
                      onClick={(e) => toggleFolder(e, node.id)}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                    </span>
                  )}
                  {!hasChildren && <span style={{width: '16px', marginRight: '2px'}}></span>}

                  <span className="nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                  </span>
                  <span className="nav-title">{node.title}</span>
              </div>
              {isExpanded && node.children && node.children.map(child => {
                  if(!child.url) return renderSidebarItem(child, level + 1);
                  return null;
              })}
          </div>
      );
  };

  const getFavicon = (url: string) => {
    return chrome.runtime.getURL(`_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`);
  };

  // Actions
  const handleCreate = (isFolder: boolean) => {
      setModalConfig({
          title: isFolder ? t('titleNewFolder') : t('titleNewBookmark'),
          fields: isFolder 
            ? [{ key: 'title', placeholder: t('inputFolder') }]
            : [{ key: 'title', placeholder: t('inputTitle') }, { key: 'url', placeholder: t('inputUrl') }],
          confirmText: isFolder ? t('create') : t('add'),
          onConfirm: (data: any) => {
              if(!data.title) return;
              const payload: any = {
                  parentId: currentFolderId,
                  title: data.title
              };
              if(!isFolder) payload.url = data.url.startsWith('http') ? data.url : `https://${data.url}`;
              
              chrome.bookmarks.create(payload, () => {
                  loadContent(currentFolderId);
                  loadTree(); // Update tree if folder created
                  setModalOpen(false);
              });
          }
      });
      setModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, node: BookmarkNode) => {
      e.stopPropagation();
      const isFolder = !node.url;
      setModalConfig({
          title: isFolder ? t('titleDeleteFolder') : t('titleDeleteBookmark'),
          desc: isFolder ? t('descDeleteFolder', node.title) : t('descDeleteBookmark', node.title),
          confirmText: t('delete'),
          isDanger: true,
          onConfirm: () => {
              const action = isFolder ? chrome.bookmarks.removeTree : chrome.bookmarks.remove;
              action(node.id, () => {
                  loadContent(currentFolderId);
                  if(isFolder) loadTree();
                  setModalOpen(false);
              });
          }
      });
      setModalOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, node: BookmarkNode) => {
      e.stopPropagation();
      const isFolder = !node.url;
      setModalConfig({
          title: isFolder ? t('titleRenameFolder') : t('titleEditBookmark'),
          fields: [
              { key: 'title', placeholder: t('inputTitle'), value: node.title },
              ...(isFolder ? [] : [{ key: 'url', placeholder: t('inputUrl'), value: node.url }])
          ],
          confirmText: t('save'),
          onConfirm: (data: any) => {
             const updates: any = { title: data.title };
             if(!isFolder) updates.url = data.url;
             chrome.bookmarks.update(node.id, updates, () => {
                loadContent(currentFolderId);
                if(isFolder) loadTree();
                setModalOpen(false);
             });
          }
      });
      setModalOpen(true);
  };

  // Search Engine Management
  const handleAddSearchEngine = () => {
    setModalConfig({
      title: t('addSearchEngine'),
      desc: t('searchUrlExample'),
      fields: [
        { key: 'name', placeholder: t('inputEngineName') },
        { key: 'url', placeholder: t('inputSearchUrl') }
      ],
      confirmText: t('add'),
      onConfirm: (data: any) => {
        if (!data.name || !data.url) return;
        const newEngine: SearchEngine = {
          id: Date.now().toString(),
          name: data.name,
          url: data.url
        };
        const updated = [...searchEngines, newEngine];
        setSearchEngines(updated);
        saveSearchEngines(updated);
        setModalOpen(false);
      }
    });
    setModalOpen(true);
  };

  const handleEditSearchEngine = (engine: SearchEngine) => {
    setModalConfig({
      title: t('editSearchEngine'),
      desc: t('searchUrlExample'),
      fields: [
        { key: 'name', placeholder: t('inputEngineName'), value: engine.name },
        { key: 'url', placeholder: t('inputSearchUrl'), value: engine.url }
      ],
      confirmText: t('save'),
      onConfirm: (data: any) => {
        if (!data.name || !data.url) return;
        const updated = searchEngines.map(e => 
          e.id === engine.id ? { ...e, name: data.name, url: data.url } : e
        );
        setSearchEngines(updated);
        saveSearchEngines(updated);
        setModalOpen(false);
      }
    });
    setModalOpen(true);
  };

  const handleDeleteSearchEngine = (engine: SearchEngine) => {
    setModalConfig({
      title: t('deleteSearchEngine'),
      desc: t('descDeleteEngine', engine.name),
      confirmText: t('delete'),
      isDanger: true,
      onConfirm: () => {
        const updated = searchEngines.filter(e => e.id !== engine.id);
        setSearchEngines(updated);
        saveSearchEngines(updated);
        setModalOpen(false);
      }
    });
    setModalOpen(true);
  };

  const handleSearch = (engine: SearchEngine) => {
    const query = searchQueries[engine.id];
    if (!query) return;
    
    const searchUrl = engine.url.replace('{query}', encodeURIComponent(query));
    chrome.tabs.create({ url: searchUrl });
    
    // Clear the search query after searching
    setSearchQueries(prev => ({ ...prev, [engine.id]: '' }));
  };

  const handleSearchQueryChange = (engineId: string, value: string) => {
    setSearchQueries(prev => ({ ...prev, [engineId]: value }));
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent, engine: SearchEngine) => {
    if (e.key === 'Enter') {
      handleSearch(engine);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if ((e.target as HTMLElement).closest('.grid-item')) return;

    setContextMenu({
        visible: true,
        x: e.pageX,
        y: e.pageY
    });
  };

  const handleSort = async (order: 'asc' | 'desc' | 'length') => {
      const sorted = [...nodes].sort((a, b) => {
          const aIsFolder = !a.url;
          const bIsFolder = !b.url;

          // Always folders first
          if (aIsFolder && !bIsFolder) return -1;
          if (!aIsFolder && bIsFolder) return 1;

          const aTitle = a.title.trim();
          const bTitle = b.title.trim();

          if (order === 'length') {
              const getVisualLength = (str: string) => {
                  let len = 0;
                  for (let i = 0; i < str.length; i++) {
                      // Treat characters > 255 (like Chinese) as width 2
                      len += str.charCodeAt(i) > 255 ? 2 : 1;
                  }
                  return len;
              };
              return getVisualLength(aTitle) - getVisualLength(bTitle) || aTitle.localeCompare(bTitle);
          }

          return order === 'asc' 
            ? aTitle.localeCompare(bTitle, currentLang === 'zh' ? 'zh-CN' : 'en')
            : bTitle.localeCompare(aTitle, currentLang === 'zh' ? 'zh-CN' : 'en');
      });
      
      setNodes(sorted);
      setContextMenu(null);

      // Persist to Chrome Storage
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
          // Move specific nodes specifically to avoid index collision issues
          // We iterate and await to ensure sequential processing
          for (let i = 0; i < sorted.length; i++) {
              const node = sorted[i];
              try {
                  // Only move if necessary (optimization could be added, but safer to enforce)
                  await new Promise<void>((resolve) => {
                      chrome.bookmarks.move(node.id, { index: i }, () => resolve());
                  });
              } catch (err) {
                  console.error('Failed to move bookmark:', err);
              }
          }
          loadTree();
      }
  };

  return (
    <div className="app-container">
       <aside className="sidebar">
           <div className="sidebar-header">
               <div className="logo-area">
                   <div className="app-icon-small">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                   </div>
                   <h1>ZenMarker</h1>
               </div>
           </div>
           
           <div className="sidebar-nav">
               {tree.length > 0 && tree[0].children?.map(child => (
                   <React.Fragment key={child.id}>
                       {/* Render Top Level Folders (Bookmarks Bar, Other etc) */}
                       {renderSidebarItem(child, 0)}
                   </React.Fragment>
               ))}
           </div>

           <div className="sidebar-footer">
               <div style={{display:'flex', gap: '8px', flexDirection: 'column'}}>
                <button className="sidebar-btn" onClick={() => handleCreate(false)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                    {t('newBookmark')}
                </button>
                <button className="sidebar-btn" onClick={() => handleCreate(true)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    {t('newFolder')}
                </button>
               </div>
           </div>
       </aside>

       <main className="main-content">
           <div className="top-bar">
               <div className="search-container">
                   <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                   <input 
                       id="search-input" 
                       placeholder={t('searchPlaceholder')}
                       value={searchQuery}
                       onChange={e => setSearchQuery(e.target.value)}
                   />
               </div>
               <div className="view-options" style={{position: 'relative'}}>
                   <button 
                       className="action-btn" 
                       style={{width: '32px', height: '32px', border: 'none', background: 'transparent'}}
                       onClick={(e) => {
                           e.stopPropagation();
                           setLangMenuOpen(!langMenuOpen);
                           setContextMenu(null);
                       }}
                       title={currentLang === 'en' ? 'Switch Language' : '切换语言'}
                   >
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                   </button>
                   
                   {langMenuOpen && (
                       <div className="dropdown-menu">
                           <div className={`dropdown-item ${currentLang === 'en' ? 'active' : ''}`} onClick={() => handleLangSelect('en')}>
                               English
                           </div>
                            <div className={`dropdown-item ${currentLang === 'zh' ? 'active' : ''}`} onClick={() => handleLangSelect('zh')}>
                               中文
                           </div>
                       </div>
                   )}
               </div>
           </div>

           <div className="main-layout">
                {/* Left: Bookmarks */}
                <div className="bookmarks-section" onContextMenu={handleContextMenu}>
                    {!searchQuery && (
                        <div className="breadcrumbs">
                            {breadcrumbs.map((crumb, idx) => (
                                <div 
                                     key={crumb.id} 
                                     className={`breadcrumb-item ${idx===breadcrumbs.length-1?'active':''}`}
                                     onClick={() => setCurrentFolderId(crumb.id)}
                                 >
                                    {crumb.title} {idx < breadcrumbs.length-1 && '/'}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="section-title">
                        {searchQuery ? "Search Results" : (breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length-1].title : "Root")}
                    </div>

                    <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext 
                            items={nodes}
                            strategy={rectSortingStrategy}
                            disabled={!!searchQuery}
                        >
                            <div className="bookmarks-grid">
                                {nodes.length === 0 && <p style={{color: 'var(--text-secondary)'}}>{t('emptyState')}</p>}
                                {nodes.map(node => {
                                    const isFolder = !node.url;
                                    return (
                                        <SortableItem 
                                            key={node.id} 
                                            id={node.id}
                                            className="grid-item"
                                            onDoubleClick={() => isFolder ? setCurrentFolderId(node.id) : chrome.tabs.create({url: node.url})}
                                         >
                                    <div className="preview-area">
                                        {isFolder ? (
                                            <svg className="folder-icon" width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                                        ) : (
                                            <img className="favicon" src={getFavicon(node.url!)} onError={(e) => (e.currentTarget.src = 'icons/icon48.png')} />
                                        )}
                                    </div>
                                    <div className="info-area">
                                        <div className="title" title={node.title}>{node.title || t('untitled')}</div>
                                        <div className="subtitle">{isFolder ? t('folder') : new URL(node.url!).hostname}</div>
                                    </div>
                                    <div className="actions">
                                        <button className="action-btn" onClick={(e) => handleEdit(e, node)}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
                                        <button className="action-btn delete-btn" onClick={(e) => handleDelete(e, node)}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                        </SortableItem> 
                                    )
                                })}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>

                {/* Right: Quick Search Tools */}
                <div className="search-tools-section">
                    <div className="search-tools-header">
                        <h2 className="tools-title">{t('searchTools')}</h2>
                        <button 
                            className="icon-btn" 
                            onClick={handleAddSearchEngine}
                            title={t('addSearchEngine')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 5v14M5 12h14"/>
                            </svg>
                        </button>
                    </div>

                    <div className="search-engines-list">
                        {searchEngines.length === 0 ? (
                            <div className="empty-engines">
                                <p>{t('emptySearchEngines')}</p>
                            </div>
                        ) : (
                            searchEngines.map(engine => (
                                <div key={engine.id} className="search-engine-item">
                                    <div className="engine-header">
                                        <span className="engine-name">{engine.name}</span>
                                        <div className="engine-actions">
                                            <button 
                                                className="icon-btn-small" 
                                                onClick={() => handleEditSearchEngine(engine)}
                                                title={t('editSearchEngine')}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                </svg>
                                            </button>
                                            <button 
                                                className="icon-btn-small delete-btn" 
                                                onClick={() => handleDeleteSearchEngine(engine)}
                                                title={t('deleteSearchEngine')}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="search-input-wrapper">
                                        <input 
                                            type="text"
                                            className="search-engine-input"
                                            placeholder={`${t('searchEngine')}...`}
                                            value={searchQueries[engine.id] || ''}
                                            onChange={(e) => handleSearchQueryChange(engine.id, e.target.value)}
                                            onKeyPress={(e) => handleSearchKeyPress(e, engine)}
                                        />
                                        <button 
                                            className="search-btn"
                                            onClick={() => handleSearch(engine)}
                                            disabled={!searchQueries[engine.id]}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
       </main>
       
       <Modal 
         isOpen={modalOpen} 
         onCancel={() => setModalOpen(false)}
         {...modalConfig}
       />

       {contextMenu && contextMenu.visible && (
           <div 
               className="context-menu"
               style={{ top: contextMenu.y, left: contextMenu.x }}
               onClick={(e) => e.stopPropagation()}
           >
               <div className="context-menu-item" onClick={() => handleSort('asc')}>
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 11l-3 3-3-3m0-6h12M9 17h12"></path></svg>
                   {t('sortByNameAsc')}
               </div>
               <div className="context-menu-item" onClick={() => handleSort('desc')}>
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 13l-3-3-3 3m0 6h12M9 5h12"></path></svg>
                   {t('sortByNameDesc')}
               </div>
               <div className="context-menu-item" onClick={() => handleSort('length')}>
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 6H3M17 12H7M13 18H11"></path></svg>
                   {t('sortByNameLength')}
               </div>
           </div>
       )}
    </div>
  );
}
