
// UI Utility for Modal
const UI = {
  $overlay: document.getElementById('modal-overlay'),
  $title: document.getElementById('modal-title'),
  $desc: document.getElementById('modal-desc'),
  $body: document.getElementById('modal-body'),
  $cancel: document.getElementById('modal-cancel'),
  $confirm: document.getElementById('modal-confirm'),
  
  // Callback storage
  onConfirm: null,
  onCancel: null,

  init() {
    this.$cancel.addEventListener('click', () => this.close());
    this.$confirm.addEventListener('click', () => {
      if(this.onConfirm) this.onConfirm();
      this.close(); 
    });
    // Optional: Close on overlay click
    // this.$overlay.addEventListener('click', (e) => { if(e.target === this.$overlay) this.close(); });
  },

  show({ title, desc, fields = [], confirmText = "OK", isDanger = false }, callback) {
    this.$title.textContent = title;
    this.$desc.textContent = desc || '';
    this.$body.innerHTML = ''; 
    
    // Setup Confirm Button
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

document.addEventListener("DOMContentLoaded", () => {
  let currentFolderId = "0"; // Root

  // Cache DOM elements
  const bookmarkList = document.getElementById("bookmark-list");
  const breadcrumbsContainer = document.getElementById("breadcrumbs");
  const searchInput = document.getElementById("search-input");
  const addBookmarkBtn = document.getElementById("add-bookmark-btn");
  const createFolderBtn = document.getElementById("create-folder-btn");
  const folderTemplate = document.getElementById("folder-template");
  const bookmarkTemplate = document.getElementById("bookmark-template");

  // Breadcrumb history
  let breadcrumbs = [{ id: "0", title: "Root" }];

  // Initialize
  loadBookmarks("0");

  // SEARCH
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    if (!query) {
      loadBookmarks(currentFolderId);
      return;
    }
    chrome.bookmarks.search(query, (results) => {
      renderList(results, true);
    });
  });

  // NAVIGATION
  function navigateTo(folderId, folderName) {
    currentFolderId = folderId;
    breadcrumbs.push({ id: folderId, title: folderName });
    updateBreadcrumbs();
    loadBookmarks(folderId);
    searchInput.value = "";
  }

  function navigateUpTo(index) {
    if (index === breadcrumbs.length - 1) return;
    const target = breadcrumbs[index];
    currentFolderId = target.id;
    breadcrumbs = breadcrumbs.slice(0, index + 1);
    updateBreadcrumbs();
    loadBookmarks(currentFolderId);
  }

  function updateBreadcrumbs() {
    breadcrumbsContainer.innerHTML = "";
    breadcrumbs.forEach((crumb, index) => {
      const span = document.createElement("span");
      span.className = `breadcrumb-item ${
        index === breadcrumbs.length - 1 ? "active" : ""
      }`;
      span.textContent = crumb.title;
      span.onclick = () => navigateUpTo(index);

      breadcrumbsContainer.appendChild(span);

      if (index < breadcrumbs.length - 1) {
        const separator = document.createElement("span");
        separator.className = "breadcrumb-separator";
        separator.textContent = "/";
        breadcrumbsContainer.appendChild(separator);
      }
    });
    breadcrumbsContainer.scrollLeft = breadcrumbsContainer.scrollWidth;
  }

  // LOAD DATA
  function loadBookmarks(parentId) {
    chrome.bookmarks.getChildren(parentId, (children) => {
      renderList(children);
    });
  }

  function renderList(nodes, isSearch = false) {
    bookmarkList.innerHTML = "";

    if (nodes.length === 0) {
      bookmarkList.innerHTML =
        '<div class="empty-state"><p>No items found</p></div>';
      return;
    }

    nodes.sort((a, b) => {
      if (a.url && !b.url) return 1;
      if (!a.url && b.url) return -1;
      return 0; 
    });

    nodes.forEach((node) => {
      const isFolder = !node.url;
      const fragment = isFolder
        ? folderTemplate.content.cloneNode(true)
        : bookmarkTemplate.content.cloneNode(true);
      const item = fragment.querySelector(".bookmark-item");

      fragment.querySelector(".item-title").textContent =
        node.title || (node.url ? node.url : "Untitled");

      if (isFolder) {
        fragment.querySelector(".item-count").textContent = "Folder"; 
        item.addEventListener("click", () => navigateTo(node.id, node.title));

        const systemIds = ["0", "1", "2", "3"]; 
        if (!systemIds.includes(node.id)) {
             const actionsDiv = document.createElement('div');
             actionsDiv.className = 'item-actions-hover';
             actionsDiv.innerHTML = `
                <button class="action-btn edit-btn" title="Rename">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="action-btn delete-btn" title="Delete">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
             `;
             item.appendChild(actionsDiv);
             
             actionsDiv.querySelector(".delete-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                UI.show({
                  title: 'Delete Folder?',
                  desc: `Delete "${node.title}" and all its contents? This cannot be undone.`,
                  confirmText: 'Delete',
                  isDanger: true
                }, () => {
                   chrome.bookmarks.removeTree(node.id, () => {
                        loadBookmarks(currentFolderId);
                    });
                });
             });

             actionsDiv.querySelector(".edit-btn").addEventListener("click", (e) => {
                 e.stopPropagation();
                 UI.show({
                   title: 'Rename Folder',
                   fields: [{ key: 'title', placeholder: 'Folder Name', value: node.title }],
                   confirmText: 'Save'
                 }, (data) => {
                     chrome.bookmarks.update(node.id, {title: data.title}, () => loadBookmarks(currentFolderId));
                 });
             });
        }
      } else {
        fragment.querySelector(".item-url").textContent = new URL(
          node.url
        ).hostname;
        const faviconUrl = chrome.runtime.getURL(
          `_favicon/?pageUrl=${encodeURIComponent(node.url)}&size=32`
        );
        fragment.querySelector(".favicon").src = faviconUrl;

        item.addEventListener("click", (e) => {
          if (e.target.closest(".action-btn")) return;
          chrome.tabs.create({ url: node.url });
        });

        // Actions
        const deleteBtn = fragment.querySelector(".delete-btn");
        if (deleteBtn) {
          deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            UI.show({
              title: 'Delete Bookmark?',
              desc: `Are you sure you want to delete "${node.title}"?`,
              confirmText: 'Delete',
              isDanger: true
            }, () => {
              chrome.bookmarks.remove(node.id, () => {
                if (isSearch) {
                  item.remove();
                } else {
                  loadBookmarks(currentFolderId);
                }
              });
            });
          });
        }

        const editBtn = fragment.querySelector(".edit-btn");
        if (editBtn) {
          editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            UI.show({
               title: 'Edit Bookmark',
               fields: [
                   { key: 'title', placeholder: 'Title', value: node.title },
                   { key: 'url', placeholder: 'URL', value: node.url }
               ],
               confirmText: 'Save'
            }, (data) => {
                chrome.bookmarks.update(node.id, { title: data.title, url: data.url }, () => {
                  loadBookmarks(currentFolderId);
                });
            });
          });
        }
      }

      bookmarkList.appendChild(fragment);
    });
  }

  // ACTIONS
  addBookmarkBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      const title = currentTab.title;
      const url = currentTab.url;

      chrome.bookmarks.create(
        {
          parentId: currentFolderId === "0" ? "1" : currentFolderId, 
          title: title,
          url: url,
        },
        () => {
          loadBookmarks(currentFolderId);
        }
      );
    });
  });

  createFolderBtn.addEventListener("click", () => {
    UI.show({
      title: 'New Folder',
      fields: [{ key: 'title', placeholder: 'Folder Name' }],
      confirmText: 'Create'
    }, (data) => {
      if(data.title) {
       chrome.bookmarks.create(
        {
          parentId: currentFolderId === "0" ? "1" : currentFolderId,
          title: data.title,
        },
        () => {
          loadBookmarks(currentFolderId);
        }
       );
      }
    });
  });

  document.getElementById("open-manager-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: "manager.html" });
  });
});
