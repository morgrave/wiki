
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import clsx from 'clsx';
import { Copy, Check, FileText, ChevronRight, ChevronDown, CheckSquare, Square, Filter } from 'lucide-react';
import styles from './LogPage.module.css';

// Discover all log files at build time (html and txt)
const logModules = import.meta.glob('../../campaigns/**/log/*.{html,txt}', { query: '?raw', import: 'default', eager: false });

interface LogFile {
  name: string;
  path: string; // relative URL path to fetch from
  projectId: string;
}

function discoverLogFiles(projectId: string, baseUrl: string): LogFile[] {
  const files: LogFile[] = [];

  for (const pathKey in logModules) {
    const normalized = pathKey.replace(/\\/g, '/');
    const parts = normalized.split('/');
    const campIdx = parts.indexOf('campaigns');
    if (campIdx === -1) continue;

    const project = parts[campIdx + 1];
    if (project !== projectId) continue;

    // Verify it's in the log folder
    if (parts[campIdx + 2] !== 'log') continue;

    const fileName = parts[parts.length - 1];
    const relativePath = parts.slice(campIdx + 1).map(encodeURIComponent).join('/');
    const url = `${baseUrl}campaigns/${relativePath}`;

    files.push({
      name: fileName,
      path: url,
      projectId: project,
    });
  }

  // Sort by numeric filename (1.html, 2.html, ... 10.html, ...)
  files.sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, ''), 10);
    const numB = parseInt(b.name.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.name.localeCompare(b.name);
  });

  return files;
}

const generateRegex = (name: string) => String.raw`(${name}\s+- .*\r?\n".*")|(${name}:".*"(\r?\n".*")*)`;

const LogPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const baseUrl = import.meta.env.BASE_URL;

  const logFiles = useMemo(
    () => (projectId ? discoverLogFiles(projectId, baseUrl) : []),
    [projectId, baseUrl]
  );

  // State
  const [characterName, setCharacterName] = useState<string>('캐릭터명');
  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set());
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const [regexStr, setRegexStr] = useState(generateRegex('캐릭터명'));
  const [extractedContent, setExtractedContent] = useState<string>('');
  const [extracting, setExtracting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For scrolling to expanded item
  const [lastExpanded, setLastExpanded] = useState<string | null>(null);
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setCharacterName(newName);
    setRegexStr(generateRegex(newName));
  };

  // Fetch file content when expanded
  const fetchFileContent = useCallback(async (file: LogFile) => {
    if (fileContents.has(file.path) || loadingFiles.has(file.path)) return;

    setLoadingFiles(prev => new Set(prev).add(file.path));
    try {
      const res = await fetch(file.path);
      if (!res.ok) throw new Error(`Failed to fetch ${file.name}`);
      const text = await res.text();
      setFileContents(prev => new Map(prev).set(file.path, text));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFiles(prev => {
        const next = new Set(prev);
        next.delete(file.path);
        return next;
      });
    }
  }, [fileContents, loadingFiles]);

  // Toggle expand/collapse
  const toggleExpand = (file: LogFile) => {
    if (!expandedFiles.has(file.path)) {
      setLastExpanded(file.path);
      fetchFileContent(file);
    } else {
      // Closing: if this is the last open file, scroll to top
      if (expandedFiles.size === 1) {
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 100);
      }
    }
    
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file.path)) {
        next.delete(file.path);
      } else {
        next.add(file.path);
      }
      return next;
    });
  };

  // Effect to scroll to expanded item
  useEffect(() => {
    if (lastExpanded && expandedFiles.has(lastExpanded)) {
      // Small timeout to allow layout transition (max-height removal) to happen
      setTimeout(() => {
        const el = fileRefs.current.get(lastExpanded);
        if (el) {
          const rect = el.getBoundingClientRect();
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          // scroll slightly above the element to show the title clearly
          window.scrollTo({ top: rect.top + scrollTop - 120, behavior: 'auto' });
        }
      }, 100);
      setLastExpanded(null);
    }
  }, [expandedFiles, lastExpanded]);

  // Toggle checkbox
  const toggleCheck = (file: LogFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file.path)) {
        next.delete(file.path);
      } else {
        next.add(file.path);
      }
      return next;
    });
  };

  // Select all / deselect all
  const toggleSelectAll = () => {
    if (checkedFiles.size === logFiles.length) {
      setCheckedFiles(new Set());
    } else {
      setCheckedFiles(new Set(logFiles.map(f => f.path)));
    }
  };

  // Extract matching lines from selected files
  const handleExtract = async () => {
    setExtracting(true);
    setError(null);
    setExtractedContent('');

    try {
      let regex: RegExp;
      try {
        regex = new RegExp(regexStr, 'gm');
      } catch (e) {
        setError(`Invalid regex: ${(e as Error).message}`);
        setExtracting(false);
        return;
      }

      const selectedFiles = logFiles.filter(f => checkedFiles.has(f.path));
      if (selectedFiles.length === 0) {
        setError('No files selected. Please select at least one file.');
        setExtracting(false);
        return;
      }

      const results: string[] = [];

      for (const file of selectedFiles) {
        // Fetch content if not already loaded
        let content = fileContents.get(file.path);
        if (!content) {
          try {
            const res = await fetch(file.path);
            if (!res.ok) continue;
            content = await res.text();
            setFileContents(prev => new Map(prev).set(file.path, content!));
          } catch {
            continue;
          }
        }

        // Apply regex to find matches
        let match;
        regex.lastIndex = 0; // Reset regex state
        while ((match = regex.exec(content)) !== null) {
          // From each match, only keep double-quoted dialogue parts
          const matchedLines = match[0].split('\n');
          for (const line of matchedLines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('"') && trimmed.length > 1) {
              // Line starts with quote (PER format) — keep as-is
              results.push(trimmed);
            } else if (trimmed.includes('"')) {
              // Line has quotes mid-line (HIS format like 세이리:"...") — extract quoted part
              const quoteMatch = trimmed.match(/".*"/g);
              if (quoteMatch) {
                for (const q of quoteMatch) {
                  results.push(q);
                }
              }
            }
          }
        }
      }

      if (results.length === 0) {
        setExtractedContent('(No matches found)');
      } else {
        setExtractedContent(results.join('\n'));
      }
    } catch (err) {
      setError(`Extraction error: ${(err as Error).message}`);
    } finally {
      setExtracting(false);
    }
  };

  // Copy to clipboard
  const handleCopy = () => {
    if (!extractedContent) return;
    navigator.clipboard.writeText(extractedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle Enter key on inputs
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !extracting && checkedFiles.size > 0) {
      handleExtract();
    }
  };

  if (!projectId) return <div>Project not found</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={28} />
          <h1 className={styles.title}>Log Extractor</h1>
        </div>
      </header>

      {/* Regex input + Extract button */}
      <div className={styles.controls}>
        <input
          type="text"
          className={styles.nameInput}
          value={characterName}
          onChange={handleNameChange}
          onKeyDown={handleKeyDown}
          placeholder="Character Name"
        />
        <input
          type="text"
          className={styles.regexInput}
          value={regexStr}
          onChange={e => setRegexStr(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter regex pattern..."
        />
        <button
          className={styles.extractButton}
          onClick={handleExtract}
          disabled={extracting || checkedFiles.size === 0}
        >
          <Filter size={16} />
          {extracting ? 'Extracting...' : 'Extract'}
        </button>
      </div>

      {/* File list */}
      <div className={styles.fileListSection}>
        <div className={styles.fileListHeader}>
          <h2 className={styles.fileListTitle}>Log Files ({logFiles.length})</h2>
          <button className={styles.selectAllButton} onClick={toggleSelectAll}>
            {checkedFiles.size === logFiles.length ? <CheckSquare size={18} /> : <Square size={18} />}
            {checkedFiles.size === logFiles.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {logFiles.length === 0 ? (
          <div className={styles.emptyState}>No log files found for this project.</div>
        ) : (
          <div className={clsx(styles.fileList, expandedFiles.size > 0 && styles.fileListExpanded)}>
            {logFiles.map(file => {
              const isExpanded = expandedFiles.has(file.path);
              const isChecked = checkedFiles.has(file.path);
              const isLoading = loadingFiles.has(file.path);
              const content = fileContents.get(file.path);

              return (
                <div 
                  key={file.path} 
                  className={styles.fileItem}
                  ref={(el) => {
                    if (el) fileRefs.current.set(file.path, el);
                    else fileRefs.current.delete(file.path);
                  }}
                >
                  <div
                    className={styles.fileItemHeader}
                    onClick={() => toggleExpand(file)}
                  >
                    <input
                      type="checkbox"
                      className={styles.fileCheckbox}
                      checked={isChecked}
                      onClick={e => toggleCheck(file, e)}
                      onChange={() => {}}
                    />
                    <span className={styles.expandIcon}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span className={styles.fileName}>{file.name}</span>
                  </div>

                  {isExpanded && (
                    <div className={styles.fileContent}>
                      {isLoading ? (
                        <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Loading...</span>
                      ) : content ? (
                        <pre className={styles.fileContentText}>
                          {content}
                        </pre>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Failed to load content.</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className={styles.error}>{error}</div>
      )}

      {/* Extracted results */}
      {extractedContent && !error && (
        <div className={styles.resultSection}>
          <div className={styles.resultHeader}>
            <h2 className={styles.resultTitle}>Extracted Results</h2>
            {extractedContent !== '(No matches found)' && (
              <button
                className={styles.copyButton}
                onClick={handleCopy}
                disabled={!extractedContent}
              >
                {copied ? <Check size={18} color="#22c55e" /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            )}
          </div>
          <div className={styles.contentWrapper}>
            <pre className={styles.content}>{extractedContent}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogPage;
