
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, Check, FileText } from 'lucide-react';
import type { Project } from '../types';
import styles from './KBPage.module.css';

interface KBPageProps {
  projects: Project[];
}

const KBPage: React.FC<KBPageProps> = ({ projects }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const project = projects.find(p => p.id === projectId);

  useEffect(() => {
    if (project?.kbUrl) {
      setLoading(true);
      setError(null);
      fetch(project.kbUrl)
        .then(async res => {
          if (!res.ok) {
             await res.text();
             // If 404, maybe file doesn't exist
             if (res.status === 404) throw new Error('KB.txt not found for this project.');
             throw new Error(`Failed to load KB.txt: ${res.status} ${res.statusText}`);
          }
          return res.text();
        })
        .then(text => setContent(text))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    } else if (project && !project.kbUrl) {
      setError('No KB.txt linked for this project.');
      setContent('');
    }
  }, [project]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!project) return <div>Project not found</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={28} />
          <h1 className={styles.title}>Knowledge Base Source</h1>
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

      {loading && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading KB.txt...</div>}
      
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

export default KBPage;
