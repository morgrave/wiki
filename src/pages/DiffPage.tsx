
import React from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { ArrowLeft } from 'lucide-react';
import type { Document } from '../types';
import styles from './DiffPage.module.css';

interface DiffPageProps {
  documents: Document[];
}

const DiffPage: React.FC<DiffPageProps> = ({ documents }) => {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { projectId } = params;
  const docPath = params["*"];

  const v1 = searchParams.get('v1');
  const v2 = searchParams.get('v2');
  
  const doc1 = documents.find(d => d.project === projectId && d.version === v1 && d.filePath === docPath);
  const doc2 = documents.find(d => d.project === projectId && d.version === v2 && d.filePath === docPath);

  if (!projectId || !docPath || !v1 || !v2) {
    return <div className={styles.diffContainer}>Invalid Parameters</div>;
  }

  const [oldContent, setOldContent] = React.useState<string>('Loading...');
  const [newContent, setNewContent] = React.useState<string>('Loading...');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
       setLoading(true);
       try {
         const [res1, res2] = await Promise.all([
           doc1?.url ? fetch(doc1.url).then(r => r.text()) : Promise.resolve('(Version not found)'),
           doc2?.url ? fetch(doc2.url).then(r => r.text()) : Promise.resolve('(Version not found)')
         ]);
         
         // Strip Frontmatter
         setOldContent(res1.replace(/^---[\s\S]*?---\s*/, ''));
         setNewContent(res2.replace(/^---[\s\S]*?---\s*/, ''));
       } catch (e) {
         setOldContent('Error loading content');
         setNewContent('Error loading content');
       } finally {
         setLoading(false);
       }
    };
    
    fetchData();
  }, [doc1, doc2]);


  const newStyles = {
    variables: {
      light: {
        diffViewerBackground: '#ffffff',
        diffViewerColor: '#202122',
        addedBackground: '#e6ffed',
        addedColor: '#202122',
        removedBackground: '#ffeef0',
        removedColor: '#202122',
        wordAddedBackground: '#acf2bd',
        wordRemovedBackground: '#fdb8c0',
        addedGutterBackground: '#cdffd8',
        removedGutterBackground: '#ffdce0',
        gutterBackground: '#f6f6f6',
        gutterBackgroundDark: '#f6f6f6',
        highlightBackground: '#fffbdd',
        highlightGutterBackground: '#fff5b1',
        codeFoldGutterBackground: '#dbedff',
        codeFoldBackground: '#f1f8ff',
        emptyLineBackground: '#f6f6f6',
        gutterColor: '#54595d',
        addedGutterColor: '#212529',
        removedGutterColor: '#212529',
        codeFoldContentColor: '#54595d',
        diffViewerTitleBackground: '#f6f6f6',
        diffViewerTitleColor: '#202122',
        diffViewerTitleBorderColor: '#a2a9b1',
      }
    }
  };

  // Check if documents are inherited from a different project
  const sourceProject1 = doc1?.sourceProject;
  const sourceProject2 = doc2?.sourceProject;
  const hasInheritedSource = sourceProject1 || sourceProject2;

  return (
    <div className={styles.diffContainer}>
      <header className={styles.diffHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to={`/${projectId}/${docPath}/${v1}`} className={styles.backLink}>
            <ArrowLeft size={16} />
            Back to document
          </Link>
          <span className={styles.diffTitle}>
             Comparing <strong>{v1}</strong> vs <strong>{v2}</strong>
          </span>
        </div>
        <div>
          {/* Action buttons like Merge could go here */}
        </div>
      </header>

      {hasInheritedSource && (
        <div style={{ 
          padding: '0.75rem 1rem', 
          marginBottom: '1rem', 
          backgroundColor: '#1e293b', 
          borderRadius: '8px',
          border: '1px solid #334155',
          color: '#94a3b8',
          fontSize: '0.875rem'
        }}>
          📦 이 문서는 다른 프로젝트에서 상속되었습니다:
          {sourceProject1 && <span style={{ marginLeft: '0.5rem', color: '#60a5fa' }}>[{v1}: {sourceProject1}]</span>}
          {sourceProject2 && <span style={{ marginLeft: '0.5rem', color: '#60a5fa' }}>[{v2}: {sourceProject2}]</span>}
        </div>
      )}

      <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #334155' }}>
        {loading ? (
           <div style={{ padding: '2rem', color: '#94a3b8', textAlign: 'center' }}>Loading diff...</div>
        ) : (
          <ReactDiffViewer
            oldValue={oldContent}
            newValue={newContent}
            splitView={true}
            useDarkTheme={false}
            styles={newStyles}
            leftTitle={`Version ${v1}${sourceProject1 ? ` (from ${sourceProject1})` : ''}`}
            rightTitle={`Version ${v2}${sourceProject2 ? ` (from ${sourceProject2})` : ''}`}
          />
        )}
      </div>
    </div>
  );
};

export default DiffPage;
