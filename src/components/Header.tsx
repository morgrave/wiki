
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Box, Menu } from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import type { Document, Project } from '../types';
import styles from './Header.module.css';

interface HeaderProps {
  documents: Document[];
  projects: Project[];
  onMenuToggle?: () => void;
}

const Header: React.FC<HeaderProps> = ({ documents, projects, onMenuToggle }) => {
  const { projectId, version } = useParams<{ projectId: string; version?: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const currentVersion = version || 'latest';

  const projectDocs = useMemo(() => {
    if (!projectId) return [];
    return documents.filter(d => d.project === projectId && d.version === currentVersion);
  }, [documents, projectId, currentVersion]);

  const currentProject = useMemo(() => {
    if (!projectId) return null;
    return projects.find(p => p.id === projectId);
  }, [projects, projectId]);

  const projectDisplayName = currentProject?.name || projectId;

  const results = useMemo(() => {
    if (!query || !projectId) return [];
    
    const lowerQ = query.toLowerCase();
    return projectDocs.filter(d => 
      d.title.toLowerCase().includes(lowerQ) || 
      d.filePath.toLowerCase().includes(lowerQ)
    ).slice(0, 10); // Limit results
  }, [query, projectDocs, projectId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (doc: Document) => {
    setQuery('');
    setIsOpen(false);
    navigate(`/${projectId}/${doc.filePath}/${doc.version}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (results.length > 0) {
        // Find exact match first
        const exact = results.find(r => r.title.toLowerCase() === query.toLowerCase());
        if (exact) {
           handleSelect(exact);
        } else {
           handleSelect(results[0]);
        }
      }
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        {onMenuToggle && (
          <button 
            onClick={onMenuToggle}
            className={styles.menuButton}
            aria-label="Toggle sidebar"
          >
            <Menu size={24} />
          </button>
        )}
        <Link to="/" className={styles.logo}>
          <Box className="text-blue-500" />
          Wiki
        </Link>
        <div>{/* Breadcrumbs could go here */}</div>
      </div>
      
      {projectId && (
        <div className={styles.searchContainer} ref={wrapperRef}>
          <div className={styles.searchInputWrapper}>
            <Search size={18} className="text-slate-500" />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={`Search in ${projectDisplayName}...`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
            />
            {query && (
              <X 
                size={16} 
                className="text-slate-500 cursor-pointer hover:text-white"
                onClick={() => setQuery('')}
              />
            )}
          </div>

          {isOpen && results.length > 0 && (
            <div className={styles.dropdown}>
              {results.map(doc => (
                <div 
                  key={doc.id} 
                  className={styles.dropdownItem}
                  onClick={() => handleSelect(doc)}
                >
                  <span className={styles.itemTitle}>{doc.title}</span>
                  <span className={styles.itemPath}>{doc.filePath}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
