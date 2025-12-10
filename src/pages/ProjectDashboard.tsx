
import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileText, FolderOpen } from 'lucide-react';
import type { Project, Document } from '../types';
import { naturalCompare } from '../utils/naturalSort';
import styles from './ProjectDashboard.module.css';

interface ProjectDashboardProps {
  projects: Project[];
  documents: Document[];
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ projects, documents }) => {
  const { projectId } = useParams<{ projectId: string }>();
  
  const currentProject = projects.find(p => p.id === projectId);
  
  // Use 'latest' version for dashboard
  const currentVersion = 'latest';

  const projectDocs = useMemo(() => {
    if (!projectId) return [];
    return documents.filter(d => d.project === projectId && d.version === currentVersion);
  }, [documents, projectId, currentVersion]);

  // Group by top-level folder
  const groups = useMemo(() => {
    const grouped: Record<string, Document[]> = {};
    const rootDocs: Document[] = [];

    projectDocs.forEach(doc => {
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
  }, [projectDocs]);

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

      {/* Root Documents */}
      {groups.rootDocs.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              <FolderOpen size={20} />
              General
            </h3>
            <span className={styles.badge}>{groups.rootDocs.length}</span>
          </div>
          <div className={styles.docList}>
            {groups.rootDocs.map(doc => (
              <Link 
                key={doc.id} 
                to={`/${projectId}/${doc.filePath}/${currentVersion}`}
                className={styles.docItem}
              >
                <FileText size={16} className={styles.docIcon} />
                <span className="truncate" title={doc.title}>{doc.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      {sortedCategories.map(category => (
        <section key={category} className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              <FolderOpen size={20} />
              {category}
            </h3>
            <span className={styles.badge}>{groups.grouped[category].length}</span>
          </div>
          <div className={styles.docList}>
            {groups.grouped[category].map(doc => (
              <Link 
                key={doc.id} 
                to={`/${projectId}/${doc.filePath}/${currentVersion}`}
                className={styles.docItem}
              >
                <FileText size={16} className={styles.docIcon} />
                <span className="truncate" title={doc.title}>{doc.title}</span>
              </Link>
            ))}
          </div>
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
