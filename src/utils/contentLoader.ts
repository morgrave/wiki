
import type { Project, Document } from '../types';


// Use Vite's glob import to find files. 
// We use 'query: ?url' to ensure Vite treats them as assets if imported,
// but we mostly care about the KEYS (file paths).
const modules = import.meta.glob(['../../experiment/**/*.md', '../../experiment/**/KB.txt'], { query: '?url', import: 'default' });

export async function loadContent(): Promise<{ projects: Project[], documents: Document[] }> {
  const documents: Document[] = [];
  // store project info including kbUrl
  const projectsMap = new Map<string, { id: string; name: string; kbUrl?: string }>();

  const baseUrl = import.meta.env.BASE_URL;

  // Fetch project mapping from config.json
  let projectNames: Record<string, string> = {};
  try {
    const configRes = await fetch(`${baseUrl}config.json`);
    if (configRes.ok) {
      const config = await configRes.json();
      projectNames = config.projectNames || {};
    }
  } catch (e) {
    console.error('Failed to load project mapping config', e);
  }

  for (const pathKey in modules) {
    // pathKey is relative from this file, e.g. "../../experiment/HIS/KB/latest/episodes/Episode1.md"
    const normalizedPath = pathKey.replace(/\\/g, '/');
    const parts = normalizedPath.split('/');
    
    // Find 'experiment' segment
    const expIndex = parts.indexOf('experiment');
    
    // Safety check for path structure
    // Must have at least experiment/<Project>/...
    if (expIndex === -1 || parts.length < expIndex + 2) {
      continue;
    }

    const project = parts[expIndex + 1];
    
    // Initialize project if not exists
    if (!projectsMap.has(project)) {
      projectsMap.set(project, {
        id: project,
        name: projectNames[project] || project,
      });
    }

    // Check if it is KB.txt
    if (parts[expIndex + 2] === 'KB.txt') {
        // Found KB.txt for the project
        // pathKey: .../experiment/HIS/KB.txt
        const relativePath = parts.slice(expIndex + 1).map(encodeURIComponent).join('/');
        const url = `${baseUrl}experiment/${relativePath}`;
        
        const p = projectsMap.get(project)!;
        p.kbUrl = url;
        continue;
    }

    // Check for Document (Must be in KB folder)
    // Expect structure: .../experiment/<Project>/KB/<Version>/.../<File.md>
    // indices relative to expIndex:
    // +0: experiment
    // +1: Project
    // +2: KB
    if (parts.length < expIndex + 5 || parts[expIndex + 2] !== 'KB') {
        continue;
    }

    const version = parts[expIndex + 3];
    
    const restParts = parts.slice(expIndex + 4);
    const fileName = restParts[restParts.length - 1];
    const docName = fileName.replace(/\.md$/, '');
    const filePath = restParts.join('/').replace(/\.md$/, '');
    
    // Construct URL for fetching
    const relativeDocPath = parts.slice(expIndex + 1).map(encodeURIComponent).join('/');
    const url = `${baseUrl}experiment/${relativeDocPath}`;

    documents.push({
      id: normalizedPath,
      project,
      version,
      filePath, 
      docName,
      title: docName, // Fallback to filename
      frontmatter: {},
      url,
      fullPath: normalizedPath
    });
  }

  const projects = Array.from(projectsMap.values());

  return { projects, documents };
}
