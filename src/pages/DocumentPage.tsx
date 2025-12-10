
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { GitCompare, Loader2 } from 'lucide-react';
import type { Document } from '../types';
import styles from './DocumentPage.module.css';

interface DocumentPageProps {
  documents: Document[];
}

const DocumentPage: React.FC<DocumentPageProps> = ({ documents }) => {
  const params = useParams();
  const navigate = useNavigate();

  /* 
     With path="*" inside /:projectId route, 'params["*"]' captures the whole subpath.
     Example subpath: "characters/Palas/latest" 
  */
  const fullPath = params["*"] || "";
  
  // We assume the version is the LAST segment efficiently.
  const parts = fullPath.split('/');
  const version = parts.length > 0 ? parts[parts.length - 1] : 'latest';
  const actualDocPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  const { projectId } = params as { projectId: string };

  const currentDoc = documents.find(d => 
    d.project === projectId && 
    d.version === version && 
    d.filePath === actualDocPath
  );

  const [content, setContent] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (currentDoc?.url) {
      setLoading(true);
      setError(null);
      fetch(currentDoc.url)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load document');
          return res.text();
        })
        .then(text => {
           // If the file still has frontmatter, we might want to strip it for display if `react-markdown` doesn't handle it gracefully?
           // Actually gray-matter handles it on build side. The file on disk HAS frontmatter.
           // Can we strip it client side? Yes.
           // Simple regex for frontmatter: ^---[\s\S]*?---
           const cleanText = text.replace(/^---[\s\S]*?---\s*/, '');
           setContent(cleanText);
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [currentDoc]);

  const otherVersions = documents.filter(d => 
    d.project === projectId && 
    d.filePath === actualDocPath && 
    d.version !== version
  );

  if (!currentDoc) {
    return (
      <div className={styles.pageContainer}>
        <h1>Document Not Found</h1>
        <p>Project: {projectId}</p>
        <p>Version: {version}</p>
        <p>Path: {actualDocPath}</p>
      </div>
    );
  }

  const handleDiff = (otherVer: string) => {
    navigate(`/${projectId}/diff/${actualDocPath}?v1=${version}&v2=${otherVer}`);
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.historyBar}>
        <div className={styles.versionBadge}>{version}</div>
        {otherVersions.length > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {otherVersions.map(ov => (
              <button 
                key={ov.version} 
                className={styles.compareButton}
                onClick={() => handleDiff(ov.version)}
                title={`Compare with version ${ov.version}`}
              >
                <GitCompare size={14} />
                <span>Diff {ov.version}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <h1 className={styles.title}>{currentDoc.title}</h1>

      {currentDoc.frontmatter && Object.keys(currentDoc.frontmatter).length > 0 && (
        <div className={styles.metadata}>
          {Object.entries(currentDoc.frontmatter).map(([key, value]) => {
            if (key === 'title') return null; // Already shown
            return (
              <div key={key} className={styles.metaRow}>
                <span className={styles.metaKey}>{key}:</span>
                <span className={styles.metaValue}>{String(value)}</span>
              </div>
            );
          })}
        </div>
      )}

      {loading && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '400px',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <Loader2 size={48} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
        </div>
      )}
      {error && <div className="text-red-400">Error: {error}</div>}

      {!loading && !error && (
        <div className={styles.markdown}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
               a: ({node, ...props}) => {
                  return <a {...props} style={{ color: 'var(--accent-color)' }} />
               }
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};



export default DocumentPage;
