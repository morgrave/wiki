
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, Check, FileText } from 'lucide-react';
import type { Project } from '../types';
import styles from './KBPage.module.css';

interface TextFilePageProps {
  projects: Project[];
}

const TextFilePage: React.FC<TextFilePageProps> = ({ projects }) => {
  const { projectId, fileName } = useParams<{ projectId: string; fileName: string }>();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const project = projects.find(p => p.id === projectId);
  const txtFile = project?.txtFiles.find(f => f.name === fileName);

  useEffect(() => {
    if (txtFile) {
      setLoading(true);
      setError(null);
      fetch(txtFile.url)
        .then(async res => {
          if (!res.ok) {
             await res.text();
             if (res.status === 404) throw new Error(`${fileName} not found for this project.`);
             throw new Error(`Failed to load ${fileName}: ${res.status} ${res.statusText}`);
          }
          return res.text();
        })
        .then(text => setContent(text))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    } else if (project && !txtFile) {
      setError(`${fileName || 'File'} not found for this project.`);
      setContent('');
    }
  }, [project, txtFile, fileName]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!project) return <div>Project not found</div>;

  const displayName = fileName?.replace(/\.txt$/, '') || 'Text File';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={28} />
          <h1 className={styles.title}>{displayName}</h1>
        </div>
        
        <button 
          className={styles.copyButton} 
          onClick={handleCopy} 
          disabled={!content || loading}
        >
          {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
      </header>

      {loading && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading {fileName}...</div>}
      
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {!loading && !error && content && (
        <div className={styles.contentWrapper}>
          <pre className={styles.content}>{content}</pre>
        </div>
      )}
    </div>
  );
};

export default TextFilePage;
