
import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileText, FolderOpen, Users, ChevronDown, ChevronRight } from 'lucide-react';
import type { Project, Document } from '../types';
import { naturalCompare } from '../utils/naturalSort';
import { getDocumentFrontmatter } from '../utils/contentLoader';
import styles from './ProjectDashboard.module.css';

// 한글 초성 추출 함수
const CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const HANGUL_START = 0xAC00;
const HANGUL_END = 0xD7A3;

const getInitialConsonant = (str: string): string => {
  if (!str || str.length === 0) return '기타';
  
  const firstChar = str.charAt(0);
  const code = firstChar.charCodeAt(0);
  
  // 한글 완성형 (가-힣)
  if (code >= HANGUL_START && code <= HANGUL_END) {
    const choseongIndex = Math.floor((code - HANGUL_START) / 588);
    return CHOSEONG[choseongIndex];
  }
  
  // 영문 대소문자
  if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
    return firstChar.toUpperCase();
  }
  
  // 숫자
  if (code >= 48 && code <= 57) {
    return '0-9';
  }
  
  return '기타';
};

// 초성 순서 정의 (한글 → 영문 → 숫자 → 기타)
const getConsonantOrder = (consonant: string): number => {
  const choseongIdx = CHOSEONG.indexOf(consonant);
  if (choseongIdx !== -1) return choseongIdx;
  
  // 영문 A-Z (19 ~ 44)
  if (consonant.length === 1 && consonant >= 'A' && consonant <= 'Z') {
    return 19 + (consonant.charCodeAt(0) - 65);
  }
  
  // 숫자 (45)
  if (consonant === '0-9') return 45;
  
  // 기타 (46)
  return 46;
};

// 문서 배열을 초성별로 그룹화하는 함수
const groupByInitialConsonant = (docs: Document[]): { consonant: string; docs: Document[] }[] => {
  const grouped: Record<string, Document[]> = {};
  
  docs.forEach(doc => {
    const consonant = getInitialConsonant(doc.docName);
    if (!grouped[consonant]) grouped[consonant] = [];
    grouped[consonant].push(doc);
  });
  
  // 초성 순서대로 정렬
  const sortedKeys = Object.keys(grouped).sort((a, b) => getConsonantOrder(a) - getConsonantOrder(b));
  
  return sortedKeys.map(consonant => ({
    consonant,
    docs: grouped[consonant].sort((a, b) => naturalCompare(a.docName, b.docName))
  }));
};

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
            <div className={styles.docListContainer}>
              {groupByInitialConsonant(groups.rootDocs).map((group, groupIndex) => (
                <React.Fragment key={group.consonant}>
                  {groupIndex > 0 && <div className={styles.groupDivider}><span className={styles.dividerLabel}>{group.consonant}</span></div>}
                  {groupIndex === 0 && <div className={styles.groupHeader}><span className={styles.dividerLabel}>{group.consonant}</span></div>}
                  <div className={styles.docList}>
                    {group.docs.map(doc => (
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
                </React.Fragment>
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
            <div className={styles.docListContainer}>
              {groupByInitialConsonant(groups.grouped[category]).map((group, groupIndex) => (
                <React.Fragment key={group.consonant}>
                  {groupIndex > 0 && <div className={styles.groupDivider}><span className={styles.dividerLabel}>{group.consonant}</span></div>}
                  {groupIndex === 0 && <div className={styles.groupHeader}><span className={styles.dividerLabel}>{group.consonant}</span></div>}
                  <div className={styles.docList}>
                    {group.docs.map(doc => (
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
                </React.Fragment>
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
