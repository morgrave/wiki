
import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileText, FolderOpen, Users, ChevronDown, ChevronRight } from 'lucide-react';
import type { Project, Document } from '../types';
import { naturalCompare } from '../utils/naturalSort';
import { getDocumentFrontmatter } from '../utils/contentLoader';
import styles from './ProjectDashboard.module.css';

interface ProjectDashboardProps {
  projects: Project[];
  documents: Document[];
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ projects, documents }) => {
  const { projectId } = useParams<{ projectId: string }>();
  
  // Store full frontmatter now (title, image, etc.)
  const [frontmatters, setFrontmatters] = useState<Record<string, any>>({});
  
  const currentProject = projects.find(p => p.id === projectId);
  
  // Use 'latest' version for dashboard
  const currentVersion = 'latest';

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const projectDocs = useMemo(() => {
    if (!projectId) return [];
    return documents.filter(d => d.project === projectId && d.version === currentVersion);
  }, [documents, projectId, currentVersion]);

  useEffect(() => {
    const loadFrontmatters = async () => {
      const newFrontmatters: Record<string, any> = {};
      
      const promises = projectDocs.map(async (doc) => {
        const fm = await getDocumentFrontmatter(doc);
        if (fm) {
          newFrontmatters[doc.id] = fm;
        }
      });
      
      await Promise.all(promises);
      setFrontmatters(prev => ({ ...prev, ...newFrontmatters }));
    };
    
    if (projectDocs.length > 0) {
        loadFrontmatters();
    }
  }, [projectDocs]);

  // Separate Heroes and other docs
  const { heroDocs, normalDocs } = useMemo(() => {
    const players = currentProject?.players || [];
    const heroes: Document[] = [];
    const others: Document[] = [];

    projectDocs.forEach(doc => {
      // Check if docName is in players list (case-insensitive perhaps? assuming exact match for now based on JSON)
      if (players.includes(doc.docName)) {
        heroes.push(doc);
      } else {
        others.push(doc);
      }
    });

    // Sort heroes by order in player array if possible, or naturally
    heroes.sort((a, b) => {
        const idxA = players.indexOf(a.docName);
        const idxB = players.indexOf(b.docName);
        return idxA - idxB;
    });

    return { heroDocs: heroes, normalDocs: others };
  }, [projectDocs, currentProject]);

  // Group normal docs by top-level folder
  const groups = useMemo(() => {
    const grouped: Record<string, Document[]> = {};
    const rootDocs: Document[] = [];

    normalDocs.forEach(doc => {
      const parts = doc.filePath.split('/');
      if (parts.length > 1) {
        const category = parts[0];
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(doc);
      } else {
        rootDocs.push(doc);
      }
    });

    // Sort documents within each category naturally
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => naturalCompare(a.filePath, b.filePath));
    });
    rootDocs.sort((a, b) => naturalCompare(a.filePath, b.filePath));

    return { grouped, rootDocs };
  }, [normalDocs]);

  if (!currentProject) {
    return <div className={styles.dashboard}>Project not found</div>;
  }

  const sortedCategories = Object.keys(groups.grouped).sort(naturalCompare);

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.title}>{currentProject.name}</h1>
        <div className={styles.meta}>
          Dashboard • {currentVersion} • {projectDocs.length} Documents
        </div>
      </header>

      {/* Heroes Section */}
      {heroDocs.length > 0 && (
        <section className={styles.section}>
          <div 
            className={styles.sectionHeader} 
            onClick={() => toggleSection('heroes')}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <h3 className={styles.sectionTitle}>
              {collapsedSections.has('heroes') ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
              <Users size={20} />
              Heroes
            </h3>
            <span className={styles.badge}>{heroDocs.length}</span>
          </div>
          {!collapsedSections.has('heroes') && (
            <div className={styles.heroList}>
              {heroDocs.map(doc => {
                  const fm = frontmatters[doc.id] || {};
                  
                  return (
                    <Link 
                      key={doc.id} 
                      to={`/${projectId}/${doc.filePath}/${currentVersion}`}
                      className={styles.heroCard}
                    >
                      <div className={styles.heroImageContainer}>
                          {doc.thumbnail ? (
                              <img src={doc.thumbnail} alt={doc.docName} className={styles.heroImage} />
                          ) : (
                              <div className={styles.heroFallback}>
                                  <Users size={32} />
                              </div>
                          )}
                      </div>
                      <div className={styles.heroContent}>
                          <div className={styles.heroName}>{doc.docName}</div>
                          {fm.title && <div className={styles.heroTitle}>{fm.title}</div>}
                      </div>
                    </Link>
                  );
              })}
            </div>
          )}
        </section>
      )}

      {/* Root Documents */}
      {groups.rootDocs.length > 0 && (
        <section className={styles.section}>
          <div 
            className={styles.sectionHeader}
            onClick={() => toggleSection('general')}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <h3 className={styles.sectionTitle}>
              {collapsedSections.has('general') ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
              <FolderOpen size={20} />
              General
            </h3>
            <span className={styles.badge}>{groups.rootDocs.length}</span>
          </div>
          {!collapsedSections.has('general') && (
            <div className={styles.docList}>
              {groups.rootDocs.map(doc => (
                <Link 
                  key={doc.id} 
                  to={`/${projectId}/${doc.filePath}/${currentVersion}`}
                  className={styles.docItem}
                >
                  <FileText size={16} className={styles.docIcon} />
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span className="truncate" title={doc.docName}>{doc.docName}</span>
                    {frontmatters[doc.id]?.title && (
                      <span className="truncate" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }} title={frontmatters[doc.id].title}>
                        {frontmatters[doc.id].title}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Categories */}
      {sortedCategories.map(category => (
        <section key={category} className={styles.section}>
          <div 
            className={styles.sectionHeader}
            onClick={() => toggleSection(category)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <h3 className={styles.sectionTitle}>
              {collapsedSections.has(category) ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
              <FolderOpen size={20} />
              {category}
            </h3>
            <span className={styles.badge}>{groups.grouped[category].length}</span>
          </div>
          {!collapsedSections.has(category) && (
            <div className={styles.docList}>
              {groups.grouped[category].map(doc => (
                <Link 
                  key={doc.id} 
                  to={`/${projectId}/${doc.filePath}/${currentVersion}`}
                  className={styles.docItem}
                >
                  <FileText size={16} className={styles.docIcon} />
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span className="truncate" title={doc.docName}>{doc.docName}</span>
                    {frontmatters[doc.id]?.title && (
                      <span className="truncate" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }} title={frontmatters[doc.id].title}>
                        {frontmatters[doc.id].title}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ))}
      
      {projectDocs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          No documents found for this project.
        </div>
      )}
    </div>
  );
};

export default ProjectDashboard;
