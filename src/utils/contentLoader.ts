
import type { Project, Document } from '../types';

// Project index data including name and dependencies
interface ProjectIndex {
  name: string;
  dependency?: string[];
}

// Use Vite's glob import to find files. 
// We use 'query: ?url' to ensure Vite treats them as assets if imported,
// but we mostly care about the KEYS (file paths).
const modules = import.meta.glob(['../../experiment/**/*.md', '../../experiment/**/KB.txt'], { query: '?url', import: 'default' });

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
  // Store project info including kbUrl
  const projectsMap = new Map<string, { id: string; name: string; kbUrl?: string }>();

  // Helper function to fetch project index.json
  async function fetchProjectIndex(projectId: string): Promise<ProjectIndex | null> {
    // Check cache first
    if (projectIndexCache.has(projectId)) {
      return projectIndexCache.get(projectId) || null;
    }
    
    try {
      const indexRes = await fetch(`${baseUrl}experiment/${encodeURIComponent(projectId)}/index.json`);
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
    
    const expIndex = parts.indexOf('experiment');
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
        });
        validatedProjects.add(project);
      } else {
        // No index.json - still collect documents, just don't show in project list
        invalidProjects.add(project);
      }
    }

    // Check if it is KB.txt
    if (parts[expIndex + 2] === 'KB.txt') {
      const relativePath = parts.slice(expIndex + 1).map(encodeURIComponent).join('/');
      const url = `${baseUrl}experiment/${relativePath}`;
      
      // Only set kbUrl if project is in projects list
      const p = projectsMap.get(project);
      if (p) {
        p.kbUrl = url;
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
    const url = `${baseUrl}experiment/${relativeDocPath}`;

    const doc: Document = {
      id: normalizedPath,
      project,
      version,
      filePath, 
      docName,
      title: docName,
      frontmatter: {},
      url,
      fullPath: normalizedPath
    };
    
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
