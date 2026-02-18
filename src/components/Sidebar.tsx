
import React, { useMemo } from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import { Folder, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import type { Project, Document } from '../types';
import styles from './Sidebar.module.css';
import { naturalCompare } from '../utils/naturalSort';

interface SidebarProps {
  projects: Project[];
  documents: Document[];
  isOpen?: boolean;
  onClose?: () => void;
}

interface TreeNode {
  name: string;
  path: string;
  children: Record<string, TreeNode>;
  doc?: Document;
}

// Separate component for folder to manage state
const SidebarFolder: React.FC<{ node: TreeNode; depth: number; currentPath: string }> = ({ node, depth, currentPath }) => {
  // Check if any child is active to auto-expand
  const hasActiveChild = useMemo(() => {
    const checkActive = (n: TreeNode): boolean => {
      // Logic to check active child
      if (n.doc && n.doc.filePath === currentPath) return true;
      return Object.values(n.children).some(child => checkActive(child));
    };
    return checkActive(node);
  }, [node, currentPath]);

  const [isOpen, setIsOpen] = React.useState(hasActiveChild);
  
  // Update open state if selection changes and is inside this folder (Auto-expand)
  React.useEffect(() => {
    if (hasActiveChild) setIsOpen(true);
  }, [hasActiveChild]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen(!isOpen);
  };

  return (
    <div style={{ paddingLeft: depth > 0 ? '0.5rem' : 0 }}>
      {/* Folder Header */}
      <div 
        className={styles.folderLabel} 
        onClick={toggle}
        style={{ cursor: 'pointer' }}
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {node.name}
      </div>
      
      {/* Children */}
      {isOpen && (
        <div style={{ paddingLeft: '0.8rem', borderLeft: '1px solid var(--border-color)', marginLeft: '0.35rem' }}>
          {Object.values(node.children).map(child => (
            <SidebarNode key={child.path} node={child} depth={depth + 1} currentPath={currentPath} />
          ))}
        </div>
      )}
    </div>
  );
};

const SidebarNode: React.FC<{ node: TreeNode; depth: number; currentPath: string }> = ({ node, depth, currentPath }) => {
  const { projectId, version = 'latest' } = useParams<{ projectId: string; version?: string }>();
  const currentVersion = version || 'latest';

  const isFile = !!node.doc;

  if (isFile) {
    return (
      <NavLink
        to={`/${projectId}/${node.doc!.filePath}/${currentVersion}`}
        className={({ isActive }) => clsx(
            styles.fileLink,
            isActive && styles.fileActive
        )}
        style={{ paddingLeft: '0.5rem' }} 
      >
        <FileText size={14} />
        <span className="truncate">{node.doc!.title || node.name}</span>
      </NavLink>
    );
  }

  return <SidebarFolder node={node} depth={depth} currentPath={currentPath} />;
};

const Sidebar: React.FC<SidebarProps> = ({ projects, documents, isOpen = true, onClose }) => {
  const { projectId, version = 'latest' } = useParams<{ projectId: string; version?: string }>();
  const navigate = useNavigate();
  const params = useParams();
  const currentPath = params['*'] || '';

  // Filter docs for current project and 'latest' (or current) version
  const currentVersion = version === 'latest' || !version ? 'latest' : version;

  const projectDocs = useMemo(() => {
    if (!projectId) return [];
    return documents.filter(d => d.project === projectId && d.version === currentVersion);
  }, [documents, projectId, currentVersion]);

  const tree = useMemo(() => {
    const root: Record<string, TreeNode> = {};
    
    // Sort docs by path/name for consistency
    const sortedDocs = [...projectDocs].sort((a, b) => naturalCompare(a.filePath, b.filePath));

    sortedDocs.forEach(doc => {
      const parts = doc.filePath.split('/'); 
      let current = root;
      
      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = {
            name: part,
            path: parts.slice(0, index + 1).join('/'),
            children: {}
          };
        }
        
        if (index === parts.length - 1) {
          current[part].doc = doc;
        }
        
        current = current[part].children;
      });
    });
    
    return root;
  }, [projectDocs]);

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div className={styles.overlay} onClick={onClose} />
      )}
      
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
      
      <div className={styles.section}>
        <label className={styles.sectionTitle}>PROJECTS</label>
        <div>
          {projects.map(p => (
            <div 
              key={p.id}
              onClick={() => navigate(`/${p.id}`)}
              className={clsx(
                styles.projectItem,
                projectId === p.id && styles.itemActive
              )}
            >
              <Folder size={16} />
              <span className="text-sm font-medium">{p.name}</span>
            </div>
          ))}
        </div>
      </div>

      {projectId && (
        <>
          <div className={styles.section} style={{ paddingTop: 0 }}>
            <label className={styles.sectionTitle}>PROMPT</label>
            <div>
              {projects.find(p => p.id === projectId)?.txtFiles.map(file => (
               <NavLink
                 key={file.name}
                 to={`/${projectId}/prompt/${encodeURIComponent(file.name)}`}
                 className={({ isActive }) => clsx(
                   styles.fileLink,
                   isActive && styles.fileActive
                 )}
               >
                 <FileText size={14} />
                 <span>{file.name}</span>
               </NavLink>
              ))}
            </div>
          </div>

          <div className={styles.section} style={{ paddingTop: 0 }}>
            <label className={styles.sectionTitle}>WORKSPACE</label>
            <div>
               <NavLink
                 to={`/${projectId}/log`}
                 className={({ isActive }) => clsx(
                   styles.fileLink,
                   isActive && styles.fileActive
                 )}
               >
                 <FileText size={14} />
                 <span>LOG</span>
               </NavLink>
            </div>
          </div>

          <div className={styles.section} style={{ paddingTop: 0 }}>
             <label className={styles.sectionTitle}>DOCUMENTS</label>
             <div>
               {Object.values(tree).map(node => (
                  <SidebarNode key={node.path} node={node} depth={0} currentPath={currentPath} />
               ))}
             </div>
          </div>
        </>
      )}
    </aside>
    </>
  );
};

export default Sidebar;
