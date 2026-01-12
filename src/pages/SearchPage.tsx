import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import type { Document } from '../types';
import { getDocumentContent } from '../utils/contentLoader';
import styles from './SearchPage.module.css';

interface SearchPageProps {
  documents: Document[];
}

interface SearchResult {
  doc: Document;
  snippet: string;
  rank: number;
}

const SNIPPET_LENGTH = 200;

// Helper to highlight matching text
const HighlightedText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query) return <span>{text}</span>;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <b key={i} className={styles.match}>{part}</b>
        ) : (
          part
        )
      )}
    </span>
  );
};

const SearchPage: React.FC<SearchPageProps> = ({ documents }) => {
  const [searchParams] = useSearchParams();
  const { projectId } = useParams<{ projectId: string }>();
  // We can treat version as default 'latest' if not present in context, 
  // but if we are in a versioned sub-route, we might want to know.
  // Currently routing structure is /:projectId/... 
  // We'll search 'latest' documents by default unless we want to support version searching.
  // The user didn't specify version constraints.
  
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const targetDocuments = useMemo(() => {
    if (!projectId) return [];
    // Filter by project and default to 'latest'
    return documents.filter(d => d.project === projectId && d.version === 'latest');
  }, [documents, projectId]);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      const searchResults: SearchResult[] = [];
      const lowerQ = query.toLowerCase();

      await Promise.all(targetDocuments.map(async (doc) => {
        try {
          const rawContent = await getDocumentContent(doc);
          
          // Remove frontmatter for search context (optional, but cleaner)
          const contentWithoutFrontmatter = rawContent.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
          // Simple markdown strip (remove #, *, etc to make snippet cleaner)
          // keeping it minimal to avoid removing actual text
          const plainText = contentWithoutFrontmatter; 
          
          const lowerContent = plainText.toLowerCase();
          const titleMatch = doc.title.toLowerCase().includes(lowerQ);
          const contentMatchIndex = lowerContent.indexOf(lowerQ);

          if (titleMatch || contentMatchIndex !== -1) {
             let snippet = '';
             if (contentMatchIndex !== -1) {
                // Create snippet around match
                const start = Math.max(0, contentMatchIndex - SNIPPET_LENGTH / 2);
                let end = Math.min(plainText.length, contentMatchIndex + SNIPPET_LENGTH / 2);
                
                // Adjust to word boundaries if possible
                const spaceBefore = plainText.lastIndexOf(' ', start);
                const realStart = spaceBefore > -1 && start - spaceBefore < 20 ? spaceBefore + 1 : start;
                
                const spaceAfter = plainText.indexOf(' ', end);
                const realEnd = spaceAfter > -1 && spaceAfter - end < 20 ? spaceAfter : end;

                snippet = plainText.substring(realStart, realEnd);

                if (realStart > 0) snippet = '...' + snippet;
                if (realEnd < plainText.length) snippet = snippet + '...';
             } else {
                 // Title matched but no obvious content match, show beginning
                 snippet = plainText.substring(0, SNIPPET_LENGTH) + (plainText.length > SNIPPET_LENGTH ? '...' : '');
             }

             searchResults.push({
                 doc,
                 snippet,
                 rank: (doc.title.toLowerCase() === lowerQ ? 20 : 0) + 
                       (titleMatch ? 10 : 0) + 
                       (contentMatchIndex !== -1 ? 5 : 0)
             });
          }
        } catch (e) {
            console.error(e);
        }
      }));

      // Sort by rank desc
      searchResults.sort((a, b) => b.rank - a.rank);
      setResults(searchResults);
      setIsSearching(false);
    };

    performSearch();
  }, [query, targetDocuments]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.stats}>
          {isSearching ? (
             <span>Searching...</span>
          ) : (
             <span>Found {results.length} results for <b>{query}</b></span>
          )}
        </div>
      </div>

      <div className={styles.resultsList}>
        {!isSearching && results.length === 0 && query && (
            <div className={styles.noResults}>
                <h3>No documents found</h3>
                <p>Your search - <b>{query}</b> - did not match any documents.</p>
            </div>
        )}

        {results.map(({ doc, snippet }) => (
          <div key={doc.id} className={styles.resultItem}>
            <div className={styles.resultUrl}>
                {doc.project} › {doc.filePath}
            </div>
            <Link to={`/${doc.project}/${doc.filePath}/${doc.version}`} className={styles.resultTitle}>
              <HighlightedText text={doc.title} query={query} />
            </Link>
            <div className={styles.resultSnippet}>
              <HighlightedText text={snippet} query={query} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchPage;
