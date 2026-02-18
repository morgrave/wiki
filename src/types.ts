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
  sourceProject?: string; // Original project if inherited via dependency
  thumbnail?: string; // URL to hero image/thumbnail if exists
}

export interface Project {
  id: string;
  name: string;
  txtFiles: { name: string; url: string }[];
  players?: string[]; // List of hero/player names
}

export interface ContentData {
  projects: Project[];
  documents: Document[];
}
