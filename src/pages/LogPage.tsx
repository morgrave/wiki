
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

// Discover project text files (excluding logs)
const projectTxtModules = import.meta.glob('../../campaigns/**/*.txt', { query: '?raw', import: 'default', eager: false });

interface ProjectFile {
  name: string;
  path: string;
  projectId: string;
}

function discoverProjectFiles(projectId: string, baseUrl: string): ProjectFile[] {
  const files: ProjectFile[] = [];

  for (const pathKey in projectTxtModules) {
    const normalized = pathKey.replace(/\\/g, '/');
    const parts = normalized.split('/');
    const campIdx = parts.indexOf('campaigns');
    if (campIdx === -1) continue;

    const project = parts[campIdx + 1];
    if (project !== projectId) continue;

    // Exclude if it is in 'log' folder
    // Structure: campaigns/{project}/log/... -> log is at campIdx + 2
    if (parts[campIdx + 2] === 'log') continue;

    const fileName = parts[parts.length - 1];
    const relativePath = parts.slice(campIdx + 1).map(encodeURIComponent).join('/');
    const url = `${baseUrl}campaigns/${relativePath}`;

    files.push({
      name: fileName,
      path: url,
      projectId: project,
    });
  }
  
  // Sort alphabetically
  files.sort((a, b) => a.name.localeCompare(b.name));
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

  const projectFiles = useMemo(
    () => (projectId ? discoverProjectFiles(projectId, baseUrl) : []),
    [projectId, baseUrl]
  );

  // State
  const [characterName, setCharacterName] = useState<string>('캐릭터명');
  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set());
  
  // New State for Prepend/Append
  const [checkedPrependFiles, setCheckedPrependFiles] = useState<Set<string>>(new Set());
  const [checkedAppendFiles, setCheckedAppendFiles] = useState<Set<string>>(new Set());

  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const [regexStr, setRegexStr] = useState(generateRegex('캐릭터명'));
  const [extractedContent, setExtractedContent] = useState<string>('');
  const [extracting, setExtracting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExtracted, setHasExtracted] = useState(false);

  // For scrolling to expanded item
  const [lastExpanded, setLastExpanded] = useState<string | null>(null);
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setCharacterName(newName);
    setRegexStr(generateRegex(newName));
  };

  // Helper to fetch text content
  const getFileContent = async (path: string): Promise<string | null> => {
    if (fileContents.has(path)) return fileContents.get(path)!;
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      const text = await res.text();
      setFileContents(prev => new Map(prev).set(path, text));
      return text;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  // Fetch file content when expanded
  const fetchFileContent = useCallback(async (file: LogFile | ProjectFile) => {
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

  // Toggle expand/collapse (prefix is used to distinguish prepend/append sections)
  const toggleExpand = (path: string, prefix: string = '') => {
    const expandKey = prefix ? `${prefix}${path}` : path;
    // Find file object to fetch if needed
    const fileObj = [...logFiles, ...projectFiles].find(f => f.path === path);
    
    if (!expandedFiles.has(expandKey)) {
      setLastExpanded(expandKey);
      if (fileObj) fetchFileContent(fileObj);
    } else {
      // Closing: if this is the last open file, scroll to top
      if (expandedFiles.size === 1) {
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 100);
      }
    }
    
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(expandKey)) {
        next.delete(expandKey);
      } else {
        next.add(expandKey);
      }
      return next;
    });
  };

  // Effect to scroll to expanded item
  useEffect(() => {
    if (lastExpanded && expandedFiles.has(lastExpanded)) {
      setTimeout(() => {
        const el = fileRefs.current.get(lastExpanded);
        if (el) {
          const rect = el.getBoundingClientRect();
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          window.scrollTo({ top: rect.top + scrollTop - 120, behavior: 'auto' });
        }
      }, 100);
      setLastExpanded(null);
    }
  }, [expandedFiles, lastExpanded]);

  // Generic toggle check
  const toggleGenericCheck = (path: string, setFunction: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setFunction(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Toggle checkbox for log files specifically
  const toggleCheck = (file: LogFile, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleGenericCheck(file.path, setCheckedFiles);
  };

  const toggleSelectAll = () => {
    if (checkedFiles.size === logFiles.length) {
      setCheckedFiles(new Set());
    } else {
      setCheckedFiles(new Set(logFiles.map(f => f.path)));
    }
  };

  // Extract matching lines from selected files
  const handleExtract = useCallback(async () => {
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

      const selectedLogFiles = logFiles.filter(f => checkedFiles.has(f.path));
      if (selectedLogFiles.length === 0) {
        setError('No log files selected. Please select at least one log file.');
        setExtracting(false);
        return;
      }

      // Collect Prepend Content
      const prependContentParts: string[] = [];
      const prependFilesList = projectFiles.filter(f => checkedPrependFiles.has(f.path));
      for (const f of prependFilesList) {
        const text = await getFileContent(f.path);
        if (text) {
          prependContentParts.push(text);
        }
      }

      // Collect Append Content
      const appendContentParts: string[] = [];
      const appendFilesList = projectFiles.filter(f => checkedAppendFiles.has(f.path));
      for (const f of appendFilesList) {
        const text = await getFileContent(f.path);
        if (text) {
          appendContentParts.push(text);
        }
      }

      const results: string[] = [];

      for (const file of selectedLogFiles) {
        let content = await getFileContent(file.path);
        if (!content) continue;

        // Apply regex to find matches
        let match;
        regex.lastIndex = 0; // Reset regex state
        while ((match = regex.exec(content)) !== null) {
          const matchedLines = match[0].split('\n');
          for (const line of matchedLines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('"') && trimmed.length > 1) {
              results.push(trimmed);
            } else if (trimmed.includes('"')) {
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

      let finalOutput = '';
      if (prependContentParts.length > 0) {
        finalOutput += prependContentParts.join('\n\n') + '\n\n';
      }

      if (results.length === 0) {
        finalOutput += '(No regex matches found in logs)';
      } else {
        finalOutput += results.join('\n');
      }

      if (appendContentParts.length > 0) {
        finalOutput += '\n\n' + appendContentParts.join('\n\n');
      }

      setExtractedContent(finalOutput);
      setHasExtracted(true);
    } catch (err) {
      setError(`Extraction error: ${(err as Error).message}`);
    } finally {
      setExtracting(false);
    }
  }, [regexStr, logFiles, projectFiles, checkedFiles, checkedPrependFiles, checkedAppendFiles]);

  // Auto re-extract when checkbox states change (only after initial extraction)
  useEffect(() => {
    if (hasExtracted && !extracting) {
      handleExtract();
    }
  }, [checkedFiles, checkedPrependFiles, checkedAppendFiles]);

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

      {/* Main Layout containing File Lists */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        
        {/* Prepend Files Section */}
        {projectFiles.length > 0 && (
          <div className={styles.fileListSection}>
            <div className={styles.fileListHeader}>
              <h2 className={styles.fileListTitle}>Prepend Files</h2>
            </div>
            <div className={clsx(styles.fileList, [...expandedFiles].some(k => k.startsWith('prepend-')) && styles.fileListExpanded)}>
              {projectFiles.map(file => {
                const expandKey = `prepend-${file.path}`;
                const isExpanded = expandedFiles.has(expandKey);
                const isChecked = checkedPrependFiles.has(file.path);
                const isLoading = loadingFiles.has(file.path);
                const content = fileContents.get(file.path);

                return (
                  <div 
                    key={`prepend-${file.path}`} 
                    className={styles.fileItem}
                  >
                     <div
                      className={styles.fileItemHeader}
                      onClick={() => toggleExpand(file.path, 'prepend-')}
                    >
                      <input
                        type="checkbox"
                        className={styles.fileCheckbox}
                        checked={isChecked}
                        onClick={(e) => { e.stopPropagation(); toggleGenericCheck(file.path, setCheckedPrependFiles); }}
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
                          <pre className={styles.fileContentText}>{content}</pre>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Failed to load.</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Log Files (Main) Section */}
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
            <div className={clsx(styles.fileList, logFiles.some(f => expandedFiles.has(f.path)) && styles.fileListExpanded)}>
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
                      onClick={() => toggleExpand(file.path)}
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

        {/* Append Files Section */}
        {projectFiles.length > 0 && (
          <div className={styles.fileListSection}>
            <div className={styles.fileListHeader}>
              <h2 className={styles.fileListTitle}>Append Files</h2>
            </div>
            <div className={clsx(styles.fileList, [...expandedFiles].some(k => k.startsWith('append-')) && styles.fileListExpanded)}>
              {projectFiles.map(file => {
                const expandKey = `append-${file.path}`;
                const isExpanded = expandedFiles.has(expandKey);
                // Note: using different state for append checks
                const isChecked = checkedAppendFiles.has(file.path);
                const isLoading = loadingFiles.has(file.path);
                const content = fileContents.get(file.path);

                // Use slightly different key to avoid conflicts if needed, but path is unique globally usually.
                // However, same file appearing in prepend and append lists creates confusion if we use same 'key'.
                // Using prefixes for keys.
                return (
                  <div 
                    key={`append-${file.path}`} 
                    className={styles.fileItem}
                    // Ref logic simplified: we might not need auto-scroll for these auxiliary files, 
                    // or we need to handle keys carefully in fileRefs if we do.
                    // For now, let's submit ref only if unique. Since we use path as key in fileRefs,
                    // valid ref will be overwritten. It's acceptable for now.
                  >
                     <div
                      className={styles.fileItemHeader}
                      onClick={() => toggleExpand(file.path, 'append-')}
                    >
                      <input
                        type="checkbox"
                        className={styles.fileCheckbox}
                        checked={isChecked}
                        onClick={(e) => { e.stopPropagation(); toggleGenericCheck(file.path, setCheckedAppendFiles); }}
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
                          <pre className={styles.fileContentText}>{content}</pre>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Failed to load.</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
