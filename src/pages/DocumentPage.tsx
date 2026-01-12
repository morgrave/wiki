
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { GitCompare, History, Loader2 } from 'lucide-react';
import type { Document } from '../types';
import styles from './DocumentPage.module.css';

import { naturalCompare } from '../utils/naturalSort';

// ** 바로 옆에 특수문자가 있는 경우 zero-width space를 삽입하여 정상 렌더링되게 함
function fixBoldMarkers(text: string): string {
  return text
    .replace(/\*\*([''"""「」『』【】])/g, '**\u200B$1')
    .replace(/([''"""「」『』【】])\*\*/g, '$1\u200B**');
}

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

  const latestDoc = documents.find(d => 
    d.project === projectId && 
    d.version === 'latest' && 
    d.filePath === actualDocPath
  );

  const heroImage = latestDoc?.thumbnail;
  const showInfobox = !!heroImage;

  const [content, setContent] = React.useState<string>('');
  const [frontmatter, setFrontmatter] = React.useState<Record<string, any> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (currentDoc?.url) {
      setLoading(true);
      setError(null);
      setFrontmatter(null); // Reset frontmatter
      
      fetch(currentDoc.url)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load document');
          return res.text();
        })
        .then(text => {
           // Parse Frontmatter
           const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
           let parsedFm: Record<string, any> | null = null;
           let cleanText = text;

           if (fmMatch) {
             const rawFm = fmMatch[1];
             parsedFm = {};
             rawFm.split(/\r?\n/).forEach(line => {
               const parts = line.split(':');
               if (parts.length > 1) {
                 const key = parts[0].trim();
                 const value = parts.slice(1).join(':').trim();
                 if (key) parsedFm![key] = value;
               }
             });
             cleanText = text.replace(fmMatch[0], '');
           }

           setFrontmatter(parsedFm);
           setContent(fixBoldMarkers(cleanText));
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [currentDoc]);

  const otherVersions = React.useMemo(() => {
    return documents
      .filter(d => 
        d.project === projectId && 
        d.filePath === actualDocPath && 
        d.version !== version
      )
      .sort((a, b) => naturalCompare(a.version, b.version));
  }, [documents, projectId, actualDocPath, version]);

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

  const handleViewVersion = (targetVer: string) => {
    navigate(`/${projectId}/${actualDocPath}/${targetVer}`);
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.historyBar}>
        <div className={styles.versionBadge}>{version}</div>
        {otherVersions.length > 0 && (
          <div className={styles.buttonsGroup}>
            <div className={styles.compareWrapper}>
              <History size={16} className={styles.compareIcon} />
              <select 
                key={`view-${version}`}
                className={styles.compareSelect}
                onChange={(e) => handleViewVersion(e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>과거 버전</option>
                {otherVersions.map(ov => (
                  <option key={ov.version} value={ov.version}>
                    {ov.version}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.compareWrapper}>
              <GitCompare size={16} className={styles.compareIcon} />
              <select 
                className={styles.compareSelect}
                onChange={(e) => handleDiff(e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>수정 내역</option>
                {otherVersions.map(ov => (
                  <option key={ov.version} value={ov.version}>
                    {ov.version}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <h1 className={styles.title}>{currentDoc.title}</h1>

      {/* Render Metadata Grid at top ONLY if NOT showing infobox */}
      {!showInfobox && frontmatter && Object.keys(frontmatter).length > 0 && (
        <div className={styles.metadataGrid}>
          {Object.entries(frontmatter).map(([key, value]) => {
            return (
              <React.Fragment key={key}>
                <div className={styles.metaKey}>{key}</div>
                <div className={styles.metaValue}>{String(value)}</div>
              </React.Fragment>
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
          {showInfobox && (
            <aside className={styles.infobox}>
              <div className={styles.infoboxHeader}>
                 {frontmatter?.title || currentDoc.title}
              </div>
              <div className={styles.infoboxImageContainer}>
                <img src={heroImage} alt={currentDoc.title} className={styles.infoboxImage} />
              </div>
              {frontmatter && Object.keys(frontmatter).length > 0 && (
                <div className={styles.metadataGrid}>
                  {Object.entries(frontmatter).map(([key, value]) => (
                    <React.Fragment key={key}>
                      <div className={styles.metaKey}>{key}</div>
                      <div className={styles.metaValue}>{String(value)}</div>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </aside>
          )}
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
