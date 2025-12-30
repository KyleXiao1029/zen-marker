import React, { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { t } from '../utils/i18n';
import './popup.css';

interface BookmarkNode {
  id: string;
  parentId?: string;
  url?: string;
  title: string;
  children?: BookmarkNode[];
}

export default function Popup() {
  const [currentFolderId, setCurrentFolderId] = useState("0");
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: "0", title: "Root" }]);
  const [nodes, setNodes] = useState<BookmarkNode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>({});

  useEffect(() => {
    if(!searchQuery) loadBookmarks(currentFolderId);
  }, [currentFolderId, searchQuery]);

  useEffect(() => {
    if (searchQuery) {
      chrome.bookmarks.search(searchQuery, (results) => setNodes(results));
    }
  }, [searchQuery]);

  const loadBookmarks = (id: string) => {
    chrome.bookmarks.getChildren(id, (children) => {
      const sorted = children.sort((a, b) => {
        if (!a.url && b.url) return -1;
        if (a.url && !b.url) return 1;
        return 0;
      });
      setNodes(sorted);
    });
  };

  const navigateTo = (id: string, title: string) => {
    setCurrentFolderId(id);
    setBreadcrumbs([...breadcrumbs, { id, title }]);
    setSearchQuery("");
  };

  const navigateUp = (index: number) => {
    if (index === breadcrumbs.length - 1) return;
    const target = breadcrumbs[index];
    setCurrentFolderId(target.id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const handleOpenManager = () => {
    chrome.tabs.create({ url: "manager.html" });
  };

  const handleCreateFolder = () => {
    setModalConfig({
        title: t('titleNewFolder'),
        fields: [{ key: 'title', placeholder: t('inputFolder') }],
        confirmText: t('create'),
        onConfirm: (data: any) => {
            if(data.title) {
                chrome.bookmarks.create({
                    parentId: currentFolderId === "0" ? "1" : currentFolderId,
                    title: data.title
                }, () => loadBookmarks(currentFolderId));
            }
            setModalOpen(false);
        }
    });
    setModalOpen(true);
  };

  const handleCreateBookmark = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs[0];
          setModalConfig({
              title: t('titleNewBookmark'),
              fields: [
                  { key: 'title', placeholder: t('inputTitle'), value: tab.title },
                  { key: 'url', placeholder: t('inputUrl'), value: tab.url }
              ],
              confirmText: t('add'),
              onConfirm: (data: any) => {
                if(data.title && data.url) {
                    chrome.bookmarks.create({
                        parentId: currentFolderId === "0" ? "1" : currentFolderId,
                        title: data.title,
                        url: data.url
                    }, () => loadBookmarks(currentFolderId));
                }
                setModalOpen(false);
              }
          });
          setModalOpen(true);
      });
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
                 if(searchQuery) {
                     setNodes(nodes.filter(n => n.id !== node.id));
                 } else {
                     loadBookmarks(currentFolderId);
                 }
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
                if(searchQuery) {
                    // Update local state for search
                    setNodes(nodes.map(n => n.id === node.id ? { ...n, ...updates } : n));
                } else {
                    loadBookmarks(currentFolderId);
                }
                setModalOpen(false);
             });
          }
      });
      setModalOpen(true);
  };

  const getFavicon = (url: string) => {
    return chrome.runtime.getURL(`_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-top">
           <div className="app-title">ZenMarker</div>
           <div style={{display:'flex', gap: '8px'}}>
               <button className="icon-button" onClick={handleCreateFolder} title={t('newFolder')}>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
               </button>
               <button className="icon-button" onClick={handleCreateBookmark} title={t('newBookmark')}>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/></svg>
               </button>
           </div>
        </div>
        <div className="search-container">
            <div className="search-bar">
                <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input 
                    id="search-input" 
                    placeholder={t('searchPlaceholder')} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        </div>
        {!searchQuery && (
            <div className="breadcrumbs">
               {breadcrumbs.map((crumb, idx) => (
                   <React.Fragment key={crumb.id}>
                       <div 
                           className={`breadcrumb-item ${idx === breadcrumbs.length - 1 ? 'active' : ''}`}
                           onClick={() => navigateUp(idx)}
                       >
                           {crumb.title}
                       </div>
                       {idx < breadcrumbs.length - 1 && <span className="breadcrumb-separator">/</span>}
                   </React.Fragment>
               ))}
            </div>
        )}
      </header>

      <div className="bookmark-list">
         {nodes.length === 0 && <div className="empty-state">{t('emptyState')}</div>}
         {nodes.map(node => {
             const isFolder = !node.url;
             return (
                 <div 
                    key={node.id} 
                    className="bookmark-item"
                    onClick={() => isFolder ? navigateTo(node.id, node.title) : chrome.tabs.create({ url: node.url })}
                 >
                     <div className="item-icon">
                         {isFolder ? (
                             <svg className="folder-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                         ) : (
                             <div className="favicon-wrapper">
                                 <img src={getFavicon(node.url!)} alt="" onError={(e) => (e.currentTarget.src = 'icons/icon16.png')}/>
                             </div>
                         )}
                     </div>
                     <div className="item-content">
                         <div className="item-title">{node.title || (node.url ? node.url : t('untitled'))}</div>
                         <div className="item-url">{isFolder ? t('folder') : new URL(node.url!).hostname}</div>
                     </div>
                     {!['0','1','2','3'].includes(node.id) && (
                         <div className="item-actions-hover">
                             <button className="action-btn" onClick={(e) => handleEdit(e, node)}>
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                             </button>
                             <button className="action-btn delete-btn" onClick={(e) => handleDelete(e, node)}>
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                             </button>
                         </div>
                     )}
                 </div>
             );
         })}
      </div>

      <footer className="app-footer">
          <button className="text-button" onClick={handleOpenManager}>{t('titleEditBookmark')} Manager ↗</button>
      </footer>

      <Modal 
         isOpen={modalOpen}
         onCancel={() => setModalOpen(false)}
         {...modalConfig}
      />
    </div>
  );
}
