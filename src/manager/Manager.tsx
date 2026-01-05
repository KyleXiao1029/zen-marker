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
import { DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { SortableItem } from './SortableItem';
import { BookmarkContent } from './BookmarkContent';
import { BookmarkNode, SearchEngine } from './types';
import { Modal } from '../components/Modal';
import { SearchPopup } from './SearchPopup';
import { t, setLang, getLang } from '../utils/i18n';
import './manager.css';
import './overlay.css';



export default function Manager() {
  const [currentFolderId, setCurrentFolderId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('folder') || "1";
    }
    return "1";
  }); // Bookmarks Bar
  const [tree, setTree] = useState<BookmarkNode[]>([]);
  const [nodes, setNodes] = useState<BookmarkNode[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{id: string, title: string}[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentLang, setCurrentLang] = useState(getLang());
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Search engines state
  const [searchEngines, setSearchEngines] = useState<SearchEngine[]>([]);
  const [searchQueries, setSearchQueries] = useState<{[key: string]: string}>({});
  
  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [searchPopupOpen, setSearchPopupOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>({});

  // Menus
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [renameTitleValue, setRenameTitleValue] = useState("");
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, node: BookmarkNode} | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [gridSize, setGridSize] = useState(160);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: {
        start: ['Space'],
        cancel: ['Escape'],
        end: ['Space', 'Enter'],
      }
    })
  );

  useEffect(() => {
    document.documentElement.style.setProperty('--grid-item-size', `${gridSize}px`);
  }, [gridSize]);

  const isFirstRender = React.useRef(true);

  // Sync URL with current folder
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const currentUrlFolder = url.searchParams.get('folder');
        
        if (currentUrlFolder !== currentFolderId) {
            url.searchParams.set('folder', currentFolderId);
            if (isFirstRender.current && !currentUrlFolder) {
                 window.history.replaceState({}, '', url.toString());
            } else {
                 window.history.pushState({}, '', url.toString());
            }
        }
    }
    isFirstRender.current = false;
  }, [currentFolderId]);

  // Handle back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
        const params = new URLSearchParams(window.location.search);
        const folder = params.get('folder');
        if (folder) {
            setCurrentFolderId(folder);
        }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);

    if (!over) return;



    if (active.id !== over.id) {
        const oldIndex = nodes.findIndex((item) => item.id === active.id);
        const newIndex = nodes.findIndex((item) => item.id === over.id);

        // Optimistic UI update
        setNodes((items) => arrayMove(items, oldIndex, newIndex));

        // Persist to Chrome Bookmarks
        if (typeof chrome !== 'undefined' && chrome.bookmarks) {
            // Note: browser persistence is asynchronous
            // When moving an item to a higher index (down the list), Chrome inserts BEFORE the item at that index.
            // But since the item itself is still in the list (conceptually), to place it AFTER the target,
            // we often need to increment the index by 1.
            let chromeIndex = newIndex;
            if (newIndex > oldIndex) {
                chromeIndex++;
            }

            chrome.bookmarks.move(active.id as string, { index: chromeIndex }, () => {
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
    const handleClick = (e: any) => {
        setSortMenuOpen(false);
        setLangMenuOpen(false);
        setContextMenu(null);
        
        // Clear selection if clicking on empty background (not on a grid item)
        // This is a naive check; ideally check if target is inside .bookmarks-grid but not .grid-item
        if (e.target.closest('.app-container') && !e.target.closest('.grid-item') && !e.target.closest('.action-btn')) {
            setSelectedIds(new Set());
            setLastSelectedId(null);
        }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Initial Load
  useEffect(() => {
      loadTree();
      loadContent(currentFolderId);
      loadSearchEngines();
      loadSettings();

      return () => {
          // Cleanup if needed
      }

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
        url: 'https://www.google.com/search?q={z}'
      },
      {
        id: '2',
        name: 'Bing',
        url: 'https://www.bing.com/search?q={z}'
      },
      {
        id: '3',
        name: '百度',
        url: 'https://www.baidu.com/s?wd={z}'
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

  const loadSettings = () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['lang', 'viewMode', 'gridSize'], (result) => {
            if (result.lang) {
                setLang(result.lang);
                setCurrentLang(result.lang); 
            }
            if (result.viewMode) {
                setViewMode(result.viewMode);
            }
            if (result.gridSize) {
                setGridSize(result.gridSize);
            }
        });
    }
  };

  const handleLangSelect = (lang: 'en' | 'zh') => {
      setLang(lang);
      setCurrentLang(lang);
      setLangMenuOpen(false);
      
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set({ lang });
      }
  };

  // Persist View Settings
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ viewMode });
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ gridSize });
    }
  }, [gridSize]);

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
                  onDoubleClick={(e) => hasChildren && toggleFolder(e, node.id)}
              >
                  {hasChildren && (
                    <span 
                      className={`nav-arrow ${isExpanded ? 'active' : ''}`}
                      onClick={(e) => toggleFolder(e, node.id)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </span>
                  )}
                  {!hasChildren && <span style={{width: '20px', marginRight: '-2px'}}></span>}

                  <span className="nav-icon">
                    {isExpanded ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                    )}
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

  const handleDeleteMultiple = () => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      
      setModalConfig({
          title: t('delete'),
          desc: `Delete ${ids.length} items?`,
          confirmText: t('delete'),
          isDanger: true,
          onConfirm: () => {
              // Recursive or Batch delete
              ids.forEach(id => {
                 const node = nodes.find(n => n.id === id);
                 if (node) {
                     const action = !node.url ? chrome.bookmarks.removeTree : chrome.bookmarks.remove;
                     action(id, () => {});
                 }
              });
              // Wait a bit or use callback properly (simplified here)
              setTimeout(() => {
                  loadContent(currentFolderId);
                  loadTree();
                  setSelectedIds(new Set());
              }, 200);
              setModalOpen(false);
          }
      });
      setModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, node: BookmarkNode) => {
      e.stopPropagation();
      // If deleting a single item that is not in selection, select only it
      // If deleting an item IN selection, delete all selected? Windows deletes all selected usually.
      // For simplicity, if button clicked, just delete that one.
      
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
                  setSelectedIds(prev => {
                      const next = new Set(prev);
                      next.delete(node.id);
                      return next;
                  });
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
    
    const searchUrl = engine.url.replace('{z}', encodeURIComponent(query));
    chrome.tabs.create({ url: searchUrl });
    
    // Clear the search query after searching
    setSearchQueries(prev => ({ ...prev, [engine.id]: '' }));
  };

  const handleSearchQueryChange = (engineId: string, value: string) => {
    setSearchQueries(prev => ({ ...prev, [engineId]: value }));
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
      setNodes(sorted);
      setSortMenuOpen(false);

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

  const handleRenameTitle = () => {
    if (!renameTitleValue.trim() || !currentFolderId || currentFolderId === '0') {
      setIsRenamingTitle(false);
      return;
    }

    chrome.bookmarks.update(currentFolderId, { title: renameTitleValue }, () => {
       // Refresh breadcrumbs/tree
       loadContent(currentFolderId);
       loadTree();
       setIsRenamingTitle(false);
    });
  };

  const startRenaming = () => {
      // Don't rename Root or Search results
      if (searchQuery || ['0', '1', '2'].includes(currentFolderId)) return;
      
      const currentTitle = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length-1].title : "";
      setRenameTitleValue(currentTitle);
      setIsRenamingTitle(true);
  };

  const handleSearchEngineSort = (order: 'asc' | 'desc' | 'length') => {
      const sorted = [...searchEngines].sort((a, b) => {
          const aName = a.name.trim();
          const bName = b.name.trim();

          if (order === 'length') {
              const getVisualLength = (str: string) => {
                  let len = 0;
                  for (let i = 0; i < str.length; i++) {
                      len += str.charCodeAt(i) > 255 ? 2 : 1;
                  }
                  return len;
              };
              return getVisualLength(aName) - getVisualLength(bName) || aName.localeCompare(bName);
          }

          return order === 'asc' 
            ? aName.localeCompare(bName, currentLang === 'zh' ? 'zh-CN' : 'en')
            : bName.localeCompare(aName, currentLang === 'zh' ? 'zh-CN' : 'en');
      });
      
      setSearchEngines(sorted);
      saveSearchEngines(sorted);
  };

  const handleSearchEngineReorder = (newEngines: SearchEngine[]) => {
      setSearchEngines(newEngines);
      saveSearchEngines(newEngines);
  };

  const handleSelection = (e: React.MouseEvent, id: string) => {
      // Don't trigger if clicking actions
      // if ((e.target as HTMLElement).closest('button')) return; 
      
      if (e.ctrlKey || e.metaKey) {
          setSelectedIds(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
          });
          setLastSelectedId(id);
      } else if (e.shiftKey && lastSelectedId) {
          const currentIndex = nodes.findIndex(n => n.id === id);
          const lastIndex = nodes.findIndex(n => n.id === lastSelectedId);
          if (currentIndex !== -1 && lastIndex !== -1) {
              const start = Math.min(currentIndex, lastIndex);
              const end = Math.max(currentIndex, lastIndex);
              const range = nodes.slice(start, end + 1).map(n => n.id);
              setSelectedIds(new Set(range));
          }
      } else {
          // Single select
          // Only if not dragging... but here we are in onClick which fires after drag?
          setSelectedIds(new Set([id]));
          setLastSelectedId(id);
      }
  };

  const handleContextMenu = (e: React.MouseEvent, node: BookmarkNode) => {
      e.preventDefault();
      // Prevent context menu on drag
      if (activeId) return;

      // If right clicking an item that is NOT selected, select it exclusively
      if (!selectedIds.has(node.id)) {
          setSelectedIds(new Set([node.id]));
          setLastSelectedId(node.id);
      }

      setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Ignore if input is active (e.g. renaming or search)
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
            return;
        }

        if (e.key === 'Delete') {
            if (selectedIds.size > 0) {
                handleDeleteMultiple();
            }
        }
        
        if (e.key === 'Enter') {
            // Prevent default behavior (like form submission if any)
            e.preventDefault();
            
            if (selectedIds.size === 1) {
                const id = Array.from(selectedIds)[0];
                const node = nodes.find(n => n.id === id);
                if (node) {
                    if (!node.url) {
                        // Open Folder
                        setCurrentFolderId(node.id);
                        setSearchQuery("");
                    } else {
                        // Open URL
                        chrome.tabs.create({url: node.url});
                    }
                }
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, nodes, currentFolderId, handleDeleteMultiple]);




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
                <div className="view-options" style={{position: 'relative', display: 'flex', gap: '8px', alignItems: 'center'}}>
                    <button 
                        className="action-btn" 
                        style={{width: '32px', height: '32px', border: 'none', background: 'transparent', borderRadius: '50%'}}
                        onClick={() => setSearchPopupOpen(true)}
                        title={t('searchTools')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                           <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                    </button>



                    <button 
                        className="action-btn" 
                        style={{width: '32px', height: '32px', border: 'none', background: 'transparent'}}
                        onClick={(e) => {
                            e.stopPropagation();
                            setLangMenuOpen(!langMenuOpen);
                            setSortMenuOpen(false);
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
                 <div className="bookmarks-section" style={{flex: 1}}>
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

                     <div className="section-header">
                         <div className="title-area">
                             {isRenamingTitle ? (
                                 <input 
                                     className="section-title-input"
                                     value={renameTitleValue}
                                     onChange={(e) => setRenameTitleValue(e.target.value)}
                                     onBlur={handleRenameTitle}
                                     onKeyDown={(e) => {
                                         if(e.key === 'Enter') handleRenameTitle();
                                         if(e.key === 'Escape') setIsRenamingTitle(false);
                                     }}
                                     autoFocus
                                 />
                             ) : (
                                 <>
                                     <h2 className="section-title">
                                         {searchQuery ? "Search Results" : (breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length-1].title : "Root")}
                                     </h2>
                                     {!searchQuery && !['0', '1', '2'].includes(currentFolderId) && (
                                         <button className="edit-title-btn" onClick={startRenaming} title={t('renameFolder') || "Rename"}>
                                             <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                         </button>
                                     )}
                                 </>
                             )}
                         </div>

                         <div className="view-controls" style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                            {viewMode === 'grid' && (
                                <div className="segmented-control" style={{display: 'flex', background: 'var(--bg-secondary)', padding: '2px', borderRadius: '8px'}}>
                                    {[120, 160, 200].map(size => (
                                        <button
                                            key={size}
                                            className={`action-btn ${gridSize === size ? 'active' : ''}`}
                                            style={{
                                                width: 'auto', 
                                                padding: '0 8px',
                                                height: '28px', 
                                                border: 'none', 
                                                background: gridSize === size ? 'var(--bg-color)' : 'transparent', 
                                                boxShadow: gridSize === size ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                fontSize: '12px',
                                                fontWeight: 500
                                            }}
                                            onClick={() => setGridSize(size)}
                                        >
                                            {size === 120 ? 'S' : size === 160 ? 'M' : 'L'}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="view-toggles" style={{display: 'flex', background: 'var(--bg-secondary)', padding: '2px', borderRadius: '8px'}}>
                                <button 
                                    className={`action-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                    style={{width: '28px', height: '28px', border: 'none', background: viewMode === 'grid' ? 'var(--bg-color)' : 'transparent', boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}}
                                    onClick={() => setViewMode('grid')}
                                    title={t('gridView') || "Grid View"}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                                </button>
                                <button 
                                    className={`action-btn ${viewMode === 'list' ? 'active' : ''}`}
                                    style={{width: '28px', height: '28px', border: 'none', background: viewMode === 'list' ? 'var(--bg-color)' : 'transparent', boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}}
                                    onClick={() => setViewMode('list')}
                                    title={t('listView') || "List View"}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                                </button>
                            </div>

                            <div className="sort-toggle" style={{display: 'flex', background: 'var(--bg-secondary)', padding: '2px', borderRadius: '8px', position: 'relative'}}>
                                <button 
                                    className={`action-btn ${sortMenuOpen ? 'active' : ''}`}
                                    style={{width: '28px', height: '28px', border: 'none', background: sortMenuOpen ? 'var(--bg-color)' : 'transparent', boxShadow: sortMenuOpen ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSortMenuOpen(!sortMenuOpen);
                                        setLangMenuOpen(false);
                                    }}
                                    title={t('sort') || "Sort"}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M6 12h12M9 18h6"/></svg>
                                </button>
                                
                                {sortMenuOpen && (
                                     <div className="sort-menu" style={{top: 'calc(100% + 4px)', right: 0}}>
                                         <div className="sort-item" onClick={() => handleSort('asc')}>
                                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 11l-3 3-3-3m0-6h12M9 17h12"></path></svg>
                                             {t('sortByNameAsc')}
                                         </div>
                                         <div className="sort-item" onClick={() => handleSort('desc')}>
                                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 13l-3-3-3 3m0 6h12M9 5h12"></path></svg>
                                             {t('sortByNameDesc')}
                                         </div>
                                         <div className="sort-item" onClick={() => handleSort('length')}>
                                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 6H3M17 12H7M13 18H11"></path></svg>
                                              {t('sortByNameLength')}
                                         </div>
                                     </div>
                                )}
                            </div>
                         </div>


                     </div>

                     <DndContext 
                         sensors={sensors}
                         collisionDetection={closestCenter}
                         onDragStart={handleDragStart}
                         onDragEnd={handleDragEnd}
                         onDragCancel={handleDragCancel}
                     >
                         <SortableContext 
                             items={nodes}
                             strategy={rectSortingStrategy}
                             disabled={!!searchQuery}
                         >
                             <div className={`bookmarks-grid ${viewMode === "list" ? "list-view" : ""}`}>
                                 {nodes.length === 0 && <p style={{color: 'var(--text-secondary)'}}>{t('emptyState')}</p>}
                                 {nodes.map(node => {
                                     const isFolder = !node.url;
                                     return (
                                        <SortableItem 
                                            key={node.id} 
                                            id={node.id}
                                            className={`grid-item ${selectedIds.has(node.id) ? 'selected' : ''}`}
                                            onClick={(e) => handleSelection(e, node.id)}
                                            onDoubleClick={() => {
                                                if (isFolder) setCurrentFolderId(node.id); 
                                                else chrome.tabs.create({url: node.url});
                                            }}
                                            onContextMenu={(e) => handleContextMenu(e, node)}
                                         >
                                            <BookmarkContent 
                                                 node={node}
                                                 viewMode={viewMode}
                                                 getFavicon={getFavicon}
                                                 onEdit={handleEdit}
                                                 onDelete={handleDelete}
                                             />
                                        </SortableItem>
                                    )
                                })}
                             </div>
                         </SortableContext>
                         <DragOverlay adjustScale={true}>
                              {activeId ? (
                                  <div className={viewMode === 'list' ? 'list-view' : undefined} style={{width: '100%'}}>
                                      <div className="grid-item dragging-overlay" style={{cursor:'grabbing'}}>
                                          <BookmarkContent 
                                              node={nodes.find(n => n.id === activeId)!}
                                              viewMode={viewMode}
                                              getFavicon={getFavicon}
                                              onEdit={() => {}} 
                                              onDelete={() => {}}
                                          />
                                      </div>
                                  </div>
                              ) : null}
                         </DragOverlay>
                     </DndContext>
                 </div>
            </div>
       </main>
       
       <SearchPopup 
         isOpen={searchPopupOpen}
         onClose={() => setSearchPopupOpen(false)}
         searchEngines={searchEngines}
         searchQueries={searchQueries}
         onQueryChange={handleSearchQueryChange}
         onSearch={handleSearch}
         onAddEngine={handleAddSearchEngine}
         onEditEngine={handleEditSearchEngine}
         onDeleteEngine={handleDeleteSearchEngine}
         onSort={handleSearchEngineSort}
         onReorder={handleSearchEngineReorder}
       />

       {/* Modal must be rendered AFTER SearchPopup if they share same context, 
           but since we use CSS z-index, DOM order is less critical. 
           However, keeping Modal last is safer for focus management if overlapping. 
       */}
       <Modal 
         isOpen={modalOpen} 
         onCancel={() => setModalOpen(false)}
         {...modalConfig}
       />

       {contextMenu && (
           <div 
               className="context-menu" 
               style={{ top: contextMenu.y, left: contextMenu.x }}
               onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
           >
               <div className="context-menu-item" onClick={(e) => {
                   setContextMenu(null);
                   handleEdit(e, contextMenu.node);
               }}>
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                   {t('edit') || "Edit"}
               </div>
               <div className="context-menu-item danger" onClick={(e) => {
                   setContextMenu(null);
                   if (selectedIds.size > 1) {
                       handleDeleteMultiple();
                   } else {
                       handleDelete(e, contextMenu.node);
                   }
               }}>
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                   {selectedIds.size > 1 ? `${t('delete')} (${selectedIds.size})` : (t('delete') || "Delete")}
               </div>
           </div>
       )}


    </div>
  );
}
