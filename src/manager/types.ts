export interface BookmarkNode {
  id: string;
  parentId?: string;
  url?: string;
  title: string;
  children?: BookmarkNode[];
}

export interface SearchEngine {
  id: string;
  name: string;
  url: string; // URL template with {z} placeholder
}
