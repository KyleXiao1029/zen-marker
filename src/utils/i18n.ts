type Language = 'en' | 'zh';

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
    modalCancel: 'Cancel',
    create: 'Create',
    save: 'Save',
    delete: 'Delete',
    add: 'Add',
    titleNewBookmark: 'New Bookmark',
    titleNewFolder: 'New Folder',
    titleRenameFolder: 'Rename Folder',
    titleEditBookmark: 'Edit Bookmark',
    titleDeleteFolder: 'Delete Folder?',
    titleDeleteBookmark: 'Delete Bookmark?',
    inputTitle: 'Title',
    inputUrl: 'URL',
    inputFolder: 'Folder Name',
    inputName: 'Name',
    descDeleteFolder: (name: string) => `Delete "${name}" and contents?`,
    descDeleteBookmark: (name: string) => `Delete "${name}"?`,
    
    // Search Tool
    searchTools: 'Quick Search',
    searchEngine: 'Search Engine',
    manageEngines: 'Manage Search Engines',
    addSearchEngine: 'Add Search Engine',
    editSearchEngine: 'Edit Search Engine',
    deleteSearchEngine: 'Delete Search Engine?',
    inputEngineName: 'Engine Name (e.g. Google)',
    inputSearchUrl: 'Search URL (use {query} for search term)',
    descDeleteEngine: (name: string) => `Delete search engine "${name}"?`,
    searchUrlExample: 'e.g. https://www.google.com/search?q={query}',
    emptySearchEngines: 'No search engines configured',
    sortByNameAsc: 'Sort by Name (A-Z)',
    sortByNameDesc: 'Sort by Name (Z-A)',
    sortByNameLength: 'Sort by Name Length',
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
    modalCancel: '取消',
    create: '创建',
    save: '保存',
    delete: '删除',
    add: '添加',
    titleNewBookmark: '新建书签',
    titleNewFolder: '新建文件夹',
    titleRenameFolder: '重命名文件夹',
    titleEditBookmark: '编辑书签',
    titleDeleteFolder: '删除文件夹?',
    titleDeleteBookmark: '删除书签?',
    inputTitle: '标题',
    inputUrl: '网址',
    inputFolder: '文件夹名称',
    inputName: '名称',
    descDeleteFolder: (name: string) => `删除 "${name}" 及其內容？`,
    descDeleteBookmark: (name: string) => `删除 "${name}"？`,
    
    // Search Tool
    searchTools: '快捷搜索',
    searchEngine: '搜索引擎',
    manageEngines: '管理搜索引擎',
    addSearchEngine: '添加搜索引擎',
    editSearchEngine: '编辑搜索引擎',
    deleteSearchEngine: '删除搜索引擎?',
    inputEngineName: '引擎名称（如 谷歌）',
    inputSearchUrl: '搜索地址（使用 {query} 代表搜索词）',
    descDeleteEngine: (name: string) => `删除搜索引擎 "${name}"？`,
    searchUrlExample: '例如：https://www.google.com/search?q={query}',
    emptySearchEngines: '未配置搜索引擎',
    sortByNameAsc: '按名称排序 (A-Z)',
    sortByNameDesc: '按名称排序 (Z-A)',
    sortByNameLength: '按名字长度排序',
  }
};

export const getLang = (): Language => {
  const stored = localStorage.getItem('zen_lang') as Language;
  if (stored) return stored;
  return navigator.language.startsWith('zh') ? 'zh' : 'en';
};

export const setLang = (lang: Language) => {
  localStorage.setItem('zen_lang', lang);
};

export const t = (key: keyof typeof I18N['en'], ...args: any[]): string => {
  const lang = getLang();
  const val = I18N[lang][key];
  if (typeof val === 'function') {
    // @ts-ignore
    return val(...args);
  }
  return (val as string) || key;
};
