
import type { Project, Document } from '../types';

// Project index data including name and dependencies
interface ProjectIndex {
  name: string;
  dependency?: string[];
  player?: string[];
}

// Use Vite's glob import to find files. 
// We use 'query: ?url' to ensure Vite treats them as assets if imported,
// but we mostly care about the KEYS (file paths).
const modules = import.meta.glob(['../../campaigns/**/*.md', '../../campaigns/**/*.txt'], { query: '?url', import: 'default' });
const imageModules = import.meta.glob(['../../campaigns/**/*.{png,jpg,jpeg,bmp,gif,webp}']);

// Cache for document frontmatter
const frontmatterCache = new Map<string, any>();
// Cache for inflight frontmatter requests to prevent thundering herd
const pendingFrontmatterRequests = new Map<string, Promise<any>>();

export async function loadContent(): Promise<{ projects: Project[], documents: Document[] }> {
  const baseUrl = import.meta.env.BASE_URL;
  
  // Cache for project index data
  const projectIndexCache = new Map<string, ProjectIndex | null>();
  
  // Track which projects have been validated (have index.json)
  const validatedProjects = new Set<string>();
  // Track which projects have been checked but don't have index.json
  const invalidProjects = new Set<string>();
  
  // Store all raw documents by project
  const rawDocumentsByProject = new Map<string, Document[]>();
  
  // Build map of available images (checking existence only)
  // Map key (normalized path w/o extension) -> Image Extension/Path Info
  const validImageExtensions = new Map<string, string>(); // key -> original path
  
  for (const path in imageModules) {
    const normalized = path.replace(/\\/g, '/');
    const key = normalized.substring(0, normalized.lastIndexOf('.')).toLowerCase();
    validImageExtensions.set(key, path);
  }

  // Store project info including txtFiles
  const projectsMap = new Map<string, { id: string; name: string; txtFiles: { name: string; url: string }[]; players?: string[] }>();

  // Helper function to fetch project index.json
  async function fetchProjectIndex(projectId: string): Promise<ProjectIndex | null> {
    // Check cache first
    if (projectIndexCache.has(projectId)) {
      return projectIndexCache.get(projectId) || null;
    }
    
    try {
      const indexRes = await fetch(`${baseUrl}campaigns/${encodeURIComponent(projectId)}/index.json`);
      if (indexRes.ok) {
        const indexData = await indexRes.json() as ProjectIndex;
        projectIndexCache.set(projectId, indexData);
        return indexData;
      }
    } catch (e) {
      console.error(`Failed to load index.json for project ${projectId}`, e);
    }
    projectIndexCache.set(projectId, null);
    return null;
  }

  // Recursively resolve all dependencies for a project
  // Returns array of project IDs in order of priority (later = higher priority)
  async function resolveDependencies(projectId: string, visited: Set<string> = new Set()): Promise<string[]> {
    // Prevent circular dependencies
    if (visited.has(projectId)) {
      return [];
    }
    visited.add(projectId);
    
    const projectIndex = await fetchProjectIndex(projectId);
    if (!projectIndex || !projectIndex.dependency) {
      return [];
    }
    
    const result: string[] = [];
    
    // Process dependencies in order
    for (const depId of projectIndex.dependency) {
      // First resolve nested dependencies
      const nestedDeps = await resolveDependencies(depId, visited);
      for (const nested of nestedDeps) {
        if (!result.includes(nested)) {
          result.push(nested);
        }
      }
      // Then add this dependency
      if (!result.includes(depId)) {
        result.push(depId);
      }
    }
    
    return result;
  }

  // First pass: collect all documents grouped by project
  for (const pathKey in modules) {
    const normalizedPath = pathKey.replace(/\\/g, '/');
    const parts = normalizedPath.split('/');
    
    const expIndex = parts.indexOf('campaigns');
    if (expIndex === -1 || parts.length < expIndex + 2) {
      continue;
    }

    const project = parts[expIndex + 1];
    
    // Initialize project document array if not exists
    if (!rawDocumentsByProject.has(project)) {
      rawDocumentsByProject.set(project, []);
    }
    
    // Check if we need to validate this project for display (only once per project)
    if (!validatedProjects.has(project) && !invalidProjects.has(project)) {
      const projectIndex = await fetchProjectIndex(project);
      if (projectIndex && projectIndex.name) {
        // Project has valid index.json - add to projects list
        projectsMap.set(project, {
          id: project,
          name: projectIndex.name,
          txtFiles: [],
          players: projectIndex.player,
        });
        validatedProjects.add(project);
      } else {
        // No index.json - still collect documents, just don't show in project list
        invalidProjects.add(project);
      }
    }

    // Check if it is a .txt file directly under the project root (not in subdirectories)
    const txtFileName = parts[parts.length - 1];
    if (txtFileName.endsWith('.txt') && parts.length === expIndex + 3) {
      const relativePath = parts.slice(expIndex + 1).map(encodeURIComponent).join('/');
      const url = `${baseUrl}campaigns/${relativePath}`;
      
      // Only add txtFile if project is in projects list
      const p = projectsMap.get(project);
      if (p) {
        p.txtFiles.push({ name: txtFileName, url });
      }
      continue;
    }

    // Check for Document (Must be in KB folder)
    if (parts.length < expIndex + 5 || parts[expIndex + 2] !== 'KB') {
      continue;
    }

    const version = parts[expIndex + 3];
    const restParts = parts.slice(expIndex + 4);
    const fileName = restParts[restParts.length - 1];
    const docName = fileName.replace(/\.md$/, '');
    const filePath = restParts.join('/').replace(/\.md$/, '');
    
    const relativeDocPath = parts.slice(expIndex + 1).map(encodeURIComponent).join('/');
    const url = `${baseUrl}campaigns/${relativeDocPath}`;

    const doc: Document = {
      id: normalizedPath,
      project,
      version,
      filePath, 
      docName,
      title: docName,
      frontmatter: {},
      url,
      fullPath: normalizedPath,
      thumbnail: undefined // Set below
    };
    
    // Resolve thumbnail URL manually if image exists
    const key = normalizedPath.replace(/\.md$/, '').toLowerCase();
    if (validImageExtensions.has(key)) {
        const imgPath = validImageExtensions.get(key)!;
        // imgPath is like "../../campaigns/S3/Image.png"
        // We need to convert it to a URL like `${baseUrl}campaigns/S3/Image.png`
        // existing logic: parts = imgPath.split('/') -> ['..', '..', 'campaigns', 'S3', 'Image.png']
        const imgParts = imgPath.split('/');
        const imgExpIndex = imgParts.indexOf('campaigns');
        if (imgExpIndex !== -1) {
             const relativeImgPath = imgParts.slice(imgExpIndex + 1).map(encodeURIComponent).join('/');
             doc.thumbnail = `${baseUrl}campaigns/${relativeImgPath}`;
        }
    }
    
    rawDocumentsByProject.get(project)!.push(doc);
  }



  // Second pass: resolve dependencies and merge documents
  // Only process projects that have valid index.json (in validatedProjects)
  const documents: Document[] = [];
  
  for (const projectId of validatedProjects) {
    const projectDocs = rawDocumentsByProject.get(projectId) || [];
    
    // Get resolved dependencies for this project
    const dependencies = await resolveDependencies(projectId);
    
    // Create a map to track documents by version+filePath for deduplication
    // Later entries (higher priority) will override earlier ones
    const docMap = new Map<string, Document>();
    
    // First, add documents from dependencies (in order, so later ones override)
    for (const depId of dependencies) {
      const depDocs = rawDocumentsByProject.get(depId) || [];
      for (const depDoc of depDocs) {
        const key = `${depDoc.version}:${depDoc.filePath}`;
        // Create a new document that belongs to this project but tracks source
        docMap.set(key, {
          ...depDoc,
          id: `${projectId}:${depDoc.id}`, // Create unique ID for this project
          project: projectId,
          sourceProject: depDoc.project // Track original source
        });
      }
    }
    
    // Then add own documents (highest priority, overrides dependencies)
    for (const ownDoc of projectDocs) {
      // If thumbnail is missing, try to resolve from dependencies
      if (!ownDoc.thumbnail) {
        // Iterate dependencies in reverse order (high priority first)
        for (let i = dependencies.length - 1; i >= 0; i--) {
          const depId = dependencies[i];
          
          // Helper to check and set thumbnail
          const tryResolveImage = (versionToCheck: string) => {
            // Note: validImageExtensions keys are already lowercased and normalized
            // We need to construct the key matching how it was created
            const depKey = `../../campaigns/${depId}/KB/${versionToCheck}/${ownDoc.filePath}`.toLowerCase();
            if (validImageExtensions.has(depKey)) {
              const imgPath = validImageExtensions.get(depKey)!;
              const imgParts = imgPath.split('/');
              const imgExpIndex = imgParts.indexOf('campaigns');
              if (imgExpIndex !== -1) {
                const relativeImgPath = imgParts.slice(imgExpIndex + 1).map(encodeURIComponent).join('/');
                ownDoc.thumbnail = `${baseUrl}campaigns/${relativeImgPath}`;
                return true;
              }
            }
            return false;
          };

          // Try exact version first
          if (tryResolveImage(ownDoc.version)) break;
          // Try 'latest' fallback
          if (ownDoc.version !== 'latest' && tryResolveImage('latest')) break;
        }
      }

      const key = `${ownDoc.version}:${ownDoc.filePath}`;
      
      docMap.set(key, ownDoc); // Own docs don't have sourceProject
    }
    
    // Add all resolved documents
    for (const doc of docMap.values()) {
      documents.push(doc);
    }
  }

  const projects = Array.from(projectsMap.values());

  return { projects, documents };
}

const documentTextCache = new Map<string, string>();
const pendingTextRequests = new Map<string, Promise<string>>();

export async function getDocumentContent(doc: Document): Promise<string> {
    const url = doc.url;
    if (documentTextCache.has(url)) {
        return documentTextCache.get(url)!;
    }

    if (pendingTextRequests.has(url)) {
        return pendingTextRequests.get(url)!;
    }

    const promise = (async () => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch document');
            const text = await response.text();
            documentTextCache.set(url, text);
            return text;
        } catch (error) {
            console.error('Error fetching document content for', doc.filePath, error);
            return '';
        } finally {
            pendingTextRequests.delete(url);
        }
    })();

    pendingTextRequests.set(url, promise);
    return promise;
}

export async function getDocumentFrontmatter(doc: Document): Promise<any> {
    // Check cache first
    if (frontmatterCache.has(doc.url)) {
        return frontmatterCache.get(doc.url);
    }
    
    // Check inflight requests
    if (pendingFrontmatterRequests.has(doc.url)) {
        return pendingFrontmatterRequests.get(doc.url);
    }

    const promise = (async () => {
        try {
            const text = await getDocumentContent(doc);
            
            // Simple frontmatter parser
            const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            let frontmatter: any = {};
            
            if (match) {
                const content = match[1];
                // Extract title
                const titleMatch = content.match(/^title:\s*(.*)$/m);
                if (titleMatch) {
                    frontmatter.title = titleMatch[1].trim().replace(/^["'](.*)["']$/, '$1');
                }
            }
            
            frontmatterCache.set(doc.url, frontmatter);
            return frontmatter;
        } catch (error) {
            console.error('Error parsing frontmatter for', doc.filePath, error);
            frontmatterCache.set(doc.url, {});
            return {};
        } finally {
            pendingFrontmatterRequests.delete(doc.url);
        }
    })();

    pendingFrontmatterRequests.set(doc.url, promise);
    return promise;
}
