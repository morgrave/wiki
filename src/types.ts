export interface Frontmatter {
  title?: string;
  [key: string]: any;
}

export interface Document {
  id: string;
  project: string;
  version: string;
  filePath: string;
  docName: string;
  title: string;
  frontmatter: Frontmatter;
  url: string; // Path to fetch content
  fullPath?: string; // Optional dev path
}

export interface Project {
  id: string;
  name: string;
  kbUrl?: string;
}

export interface ContentData {
  projects: Project[];
  documents: Document[];
}
