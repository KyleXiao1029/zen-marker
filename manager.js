
// I18N Dictionary
const I18N = {
    en: {
        searchPlaceholder: 'Search your bookmarks...',
        newBookmark: 'New Bookmark',
        newFolder: 'New Folder',
        emptyState: 'No items found',
        folder: 'Folder',
        bookmark: 'Bookmark',
        untitledFolder: 'Untitled Folder',
        untitled: 'Untitled',
        // Modals
        modalCancel: 'Cancel',
        create: 'Create',
        save: 'Save',
        delete: 'Delete',
        add: 'Add',
        // Titles
        titleNewBookmark: 'New Bookmark',
        titleNewFolder: 'New Folder',
        titleRenameFolder: 'Rename Folder',
        titleEditBookmark: 'Edit Bookmark',
        titleDeleteFolder: 'Delete Folder?',
        titleDeleteBookmark: 'Delete Bookmark?',
        // Inputs
        inputTitle: 'Title',
        inputUrl: 'URL',
        inputFolder: 'Folder Name',
        inputName: 'Name',
        // Descs
        descDeleteFolder: (name) => `Delete "${name}" and contents?`,
        descDeleteBookmark: (name) => `Delete "${name}"?`,
    },
    zh: {
        searchPlaceholder: '搜索书签...',
        newBookmark: '新建书签',
        newFolder: '新建文件夹',
        emptyState: '未找到项目',
        folder: '文件夹',
        bookmark: '书签',
        untitledFolder: '无题文件夹',
        untitled: '无题',
        // Modals
        modalCancel: '取消',
        create: '创建',
        save: '保存',
        delete: '删除',
        add: '添加',
        // Titles
        titleNewBookmark: '新建书签',
        titleNewFolder: '新建文件夹',
        titleRenameFolder: '重命名文件夹',
        titleEditBookmark: '编辑书签',
        titleDeleteFolder: '删除文件夹?',
        titleDeleteBookmark: '删除书签?',
        // Inputs
        inputTitle: '标题',
        inputUrl: '网址',
        inputFolder: '文件夹名称',
        inputName: '名称',
        // Descs
        descDeleteFolder: (name) => `删除 "${name}" 及其內容？`,
        descDeleteBookmark: (name) => `删除 "${name}"？`,
    }
};

let currentLang = localStorage.getItem('zen_lang') || (navigator.language.startsWith('zh') ? 'zh' : 'en');

function t(key, ...args) {
    const val = I18N[currentLang][key];
    if (typeof val === 'function') return val(...args);
    return val || key;
}

// UI Utility for Modal
const UI = {
  $overlay: document.getElementById('modal-overlay'),
  $title: document.getElementById('modal-title'),
  $desc: document.getElementById('modal-desc'),
  $body: document.getElementById('modal-body'),
  $cancel: document.getElementById('modal-cancel'),
  $confirm: document.getElementById('modal-confirm'),
  
  onConfirm: null,

  init() {
    this.$cancel.addEventListener('click', () => this.close());
    this.$confirm.addEventListener('click', () => {
      if(this.onConfirm) this.onConfirm();
      this.close(); 
    });
  },

  show({ title, desc, fields = [], confirmText = "OK", isDanger = false }, callback) {
    this.$title.textContent = title;
    this.$desc.textContent = desc || '';
    this.$body.innerHTML = ''; 
    
    // Update cancel button text dynamically
    this.$cancel.textContent = t('modalCancel');

    this.$confirm.textContent = confirmText;
    this.$confirm.className = `modal-btn confirm ${isDanger ? 'danger' : ''}`;
    
    // Setup Input if needed
    const inputEls = [];
    if (fields.length > 0) {
       fields.forEach(field => {
           const inputEl = document.createElement('input');
           inputEl.type = 'text';
           inputEl.className = 'modal-input';
           inputEl.placeholder = field.placeholder || '';
           inputEl.value = field.value || '';
           inputEl.dataset.key = field.key; // e.g. 'title' or 'url'
           // Basic spacing between multiple inputs
           if(fields.length > 1) inputEl.style.marginBottom = '12px';
           
           this.$body.appendChild(inputEl);
           inputEls.push(inputEl);

           inputEl.addEventListener('keyup', (e) => {
               if(e.key === 'Enter') this.$confirm.click();
           });
       });
       
       // Focus input after transition
       setTimeout(() => inputEls[0].focus(), 100);
    }

    this.onConfirm = () => {
        if (inputEls.length > 0) {
            // Return object { key: value }
            const result = {};
            inputEls.forEach(el => result[el.dataset.key] = el.value);
            callback(result);
        } else {
            callback(true); // Just confirmation
        }
    };

    this.$overlay.classList.add('active');
  },

  close() {
    this.$overlay.classList.remove('active');
    this.onConfirm = null;
  }
};

UI.init();

document.addEventListener('DOMContentLoaded', () => {
    let currentFolderId = '1'; // Default to Bookmarks Bar
    
    const sidebarNav = document.getElementById('sidebar-nav');
    const bookmarkList = document.getElementById('bookmark-list');
    const gridTemplate = document.getElementById('grid-item-template');
    const currentFolderTitle = document.getElementById('current-folder-title');
    const breadcrumbsContainer = document.getElementById('breadcrumbs');
    const searchInput = document.getElementById('search-input');
    
    // Initial Load
    applyLanguage();
    refreshAll();

    function applyLanguage() {
        // Static UI elements
        document.getElementById('search-input').placeholder = t('searchPlaceholder');
        
        // Update Sidebar buttons (text node is the last child usually, careful with SVG)
        // A safer way is ensuring the structure is known or wrapping text in span.
        // For now, let's re-inject the inner HTML of buttons completely or just update text.
        // Re-writing simpler:
        const bmBtn = document.getElementById('new-bookmark-btn');
        bmBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round"/></svg>
            ${t('newBookmark')}
        `;
        
        const folderBtn = document.getElementById('new-folder-btn');
        folderBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
            ${t('newFolder')}
        `;
    }

    // Event Listeners
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if(!query) {
            refreshAll();
            return;
        }
        chrome.bookmarks.search(query, (results) => {
            currentFolderTitle.textContent = t('searchPlaceholder'); // Or "Results"
            renderGrid(results, true);
        });
    });

    document.getElementById('lang-switch-btn').addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'zh' : 'en';
        localStorage.setItem('zen_lang', currentLang);
        applyLanguage(); // Update static
        refreshAll();    // Re-render grid text
    });

    document.getElementById('new-bookmark-btn').addEventListener('click', () => {
        UI.show({
            title: t('titleNewBookmark'),
            fields: [
                { key: 'title', placeholder: t('inputTitle') },
                { key: 'url', placeholder: t('inputUrl') }
            ],
            confirmText: t('add')
        }, (data) => {
             if(data.title && data.url) {
                 let finalUrl = data.url;
                 // Auto-prepend https:// if missing
                 if (!/^https?:\/\//i.test(finalUrl)) {
                     finalUrl = 'https://' + finalUrl;
                 }
                 chrome.bookmarks.create({
                     parentId: currentFolderId,
                     title: data.title,
                     url: finalUrl
                 }, () => refreshAll());
             }
        });
    });

    document.getElementById('new-folder-btn').addEventListener('click', () => {
        UI.show({
            title: t('titleNewFolder'),
            fields: [{ key: 'title', placeholder: t('inputFolder') }],
            confirmText: t('create')
        }, (data) => {
             if(data.title) chrome.bookmarks.create({ parentId: currentFolderId, title: data.title }, () => refreshAll());
        });
    });

    // Core Functions
    function refreshAll() {
        loadSidebar();
        loadContent(currentFolderId);
    }

    function loadSidebar() {
        chrome.bookmarks.getTree((tree) => {
            const root = tree[0];
            sidebarNav.innerHTML = '';
            
            root.children.forEach(child => {
                 renderSidebarItem(child, 0);
                 if(child.children) {
                     child.children.forEach(sub => {
                         if(sub.children) { 
                             renderSidebarItem(sub, 1);
                         }
                     });
                 }
            });
        });
    }

    function renderSidebarItem(node, level) {
        const div = document.createElement('div');
        div.className = `nav-item ${node.id === currentFolderId ? 'active' : ''}`;
        div.style.paddingLeft = `${12 + level * 16}px`;
        div.innerHTML = `
            <span class="nav-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
            </span>
            ${node.title}
        `;
        div.onclick = () => {
            currentFolderId = node.id;
            refreshAll();
        };
        sidebarNav.appendChild(div);
    }

    function loadContent(folderId) {
        // 1. Get current folder info for Title
        chrome.bookmarks.get(folderId, (results) => {
            if (results && results[0]) {
                currentFolderTitle.textContent = results[0].title;
            }
        });

        // 2. Build and Render Breadcrumbs (Real path from Root)
        buildBreadcrumbPath(folderId).then(path => {
            renderBreadcrumbs(path);
        });
        
        // 3. Get Children
        chrome.bookmarks.getChildren(folderId, (children) => {
            renderGrid(children);
        });
    }

    function buildBreadcrumbPath(folderId) {
        return new Promise((resolve) => {
            const path = [];
            
            function trace(id) {
                // Stop at Root ('0')
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
                    trace(node.parentId);
                });
            }
            trace(folderId);
        });
    }

    function renderBreadcrumbs(path) {
        breadcrumbsContainer.innerHTML = '';
        
        path.forEach((node, index) => {
            const span = document.createElement('span');
            span.className = 'breadcrumb-item';
            span.textContent = node.title;
            
            // Last item is active (not clickable)
            if (index === path.length - 1) {
                span.classList.add('active');
                span.style.fontWeight = '600';
                span.style.color = 'var(--text-primary)';
                span.style.cursor = 'default';
            } else {
                span.onclick = () => {
                   currentFolderId = node.id;
                   refreshAll();
                };
            }
            
            breadcrumbsContainer.appendChild(span);

            // Add separator if not last
            if (index < path.length - 1) {
                const sep = document.createElement('span');
                sep.textContent = '/';
                sep.style.opacity = '0.4';
                breadcrumbsContainer.appendChild(sep);
            }
        });
    }

    function renderGrid(nodes, isSearch = false) {
        bookmarkList.innerHTML = '';
        
        if(nodes.length === 0) {
            bookmarkList.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:var(--text-secondary); margin-top:40px;">${t('emptyState')}</p>`;
            return;
        }

        // REMOVE Sorting to allow custom Drag & Drop order
        // nodes.sort((a,b) => { ... });

        // Initialize Sortable Grid Logic
        let dragSource = null;
        
        nodes.forEach((node, index) => {
            const isFolder = !node.url;
            const clone = gridTemplate.content.cloneNode(true);
            const el = clone.querySelector('.grid-item');
            
            // Setup Drag & Drop
            el.setAttribute('draggable', 'true');
            el.dataset.id = node.id;
            
            // Drag Events
            el.addEventListener('dragstart', (e) => {
                dragSource = el;
                el.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                // Delay to allow ghost image to be created before hiding element
                setTimeout(() => el.style.opacity = '0.01', 0);
            });

            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
                el.style.opacity = '1';
                dragSource = null;

                // Sync new order to Chrome
                syncOrderChanges();
            });

            el.addEventListener('dragover', (e) => {
                e.preventDefault(); // Allow dropping
                
                const target = e.currentTarget;
                if (target === dragSource || !dragSource) return;

                const midX = target.getBoundingClientRect().left + target.offsetWidth / 2;
                
                // Real-time Swap Logic
                const gridItems = Array.from(bookmarkList.children);
                const sourceIndex = gridItems.indexOf(dragSource);
                const targetIndex = gridItems.indexOf(target);

                if (sourceIndex < targetIndex && e.clientX > midX) {
                     target.after(dragSource);
                } else if (sourceIndex > targetIndex && e.clientX < midX) {
                     target.before(dragSource);
                }
            });
            
            // Elements
            const titleEl = el.querySelector('.title');
            const subTitleEl = el.querySelector('.subtitle');
            const faviconImg = el.querySelector('.favicon');
            const folderIconDiv = el.querySelector('.folder-icon');
            
            titleEl.textContent = node.title || (isFolder ? t('untitledFolder') : t('untitled'));
            
            if(isFolder) {
                // FOLDER Logic
                folderIconDiv.style.display = 'block'; 
                faviconImg.style.display = 'none';     
                subTitleEl.textContent = t('folder');
            } else {
                folderIconDiv.style.display = 'none';
                faviconImg.style.display = 'block';
                
                try {
                    const url = new URL(node.url);
                    // 1. Use Chrome Native Source
                    const chromeIcon = chrome.runtime.getURL(`_favicon/?pageUrl=${encodeURIComponent(node.url)}&size=32`);
                    faviconImg.src = chromeIcon;
                    
                    // 2. Generic Fallback
                    faviconImg.onerror = () => {
                         faviconImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='1.5'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M2 12h20'/%3E%3Cpath d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'/%3E%3C/svg%3E";
                    };
                    
                    subTitleEl.textContent = url.hostname;
                } catch (e) {
                    faviconImg.style.display = 'none';
                    folderIconDiv.style.display = 'block';
                    folderIconDiv.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" color="var(--text-secondary)"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
                    subTitleEl.textContent = t('bookmark');
                }
            }
            
            // Interaction Logic:
            // 1. Double Click -> Open (Enter folder or Open URL)
            el.addEventListener('dblclick', () => { 
                if(isFolder) {
                    currentFolderId = node.id;
                    refreshAll();
                    searchInput.value = '';
                } else {
                    chrome.tabs.create({url: node.url});
                }
            });

            // Actions 
            const deleteBtn = el.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                UI.show({
                    title: isFolder ? t('titleDeleteFolder') : t('titleDeleteBookmark'),
                    desc: isFolder ? t('descDeleteFolder', node.title) : t('descDeleteBookmark', node.title),
                    confirmText: t('delete'),
                    isDanger: true
                }, () => {
                    const action = isFolder ? chrome.bookmarks.removeTree : chrome.bookmarks.remove;
                    action(node.id, () => {
                        if(isSearch) el.remove();
                        else loadContent(currentFolderId);
                    });
                });
            });

            const editBtn = el.querySelector('.edit-btn');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const fields = [{ key: 'title', placeholder: t('inputName'), value: node.title }];
                if (!isFolder) {
                    fields.push({ key: 'url', placeholder: t('inputUrl'), value: node.url });
                }

                UI.show({
                    title: isFolder ? t('titleRenameFolder') : t('titleEditBookmark'),
                    fields: fields,
                    confirmText: t('save')
                }, (data) => {
                    const updates = { title: data.title };
                    if (!isFolder && data.url) updates.url = data.url;
                    
                    chrome.bookmarks.update(node.id, updates, () => loadContent(currentFolderId));
                });
            });

            bookmarkList.appendChild(clone);
        });
    }

    // Helper: Sync DOM order to actual Chrome Bookmark order
    function syncOrderChanges() {
        const gridItems = Array.from(bookmarkList.children);
        
        // We only need to move items if their index actually changed.
        // Chrome Move API is efficient, but let's be safe.
        // Strategy: Iterate through DOM, if item's current index != loop index, move it.
        // NOTE: Moving an item shifts others, so simple iteration might be tricky.
        // Robust Strategy: Re-order everything by index 0 to N. 
        // Chrome optimizes this if index is same.
        
        gridItems.forEach((el, newIndex) => {
            const id = el.dataset.id;
            chrome.bookmarks.move(id, { index: newIndex });
        });
    }
});
