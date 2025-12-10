
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DocumentPage from './pages/DocumentPage';
import DiffPage from './pages/DiffPage';
import Home from './pages/Home';
import ProjectDashboard from './pages/ProjectDashboard';
import KBPage from './pages/KBPage';
import { loadContent } from './utils/contentLoader';
import type { ContentData } from './types';

function App() {
  const [data, setData] = useState<ContentData | null>(null);

  useEffect(() => {
    loadContent().then(setData);
  }, []);

  if (!data) {
    return <div style={{ padding: '2rem', color: '#94a3b8', textAlign: 'center' }}>Loading Wiki Index...</div>;
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home projects={data.projects} />} />
        
        <Route path="/:projectId" element={<Layout projects={data.projects} documents={data.documents} />}>
           <Route index element={<ProjectDashboard projects={data.projects} documents={data.documents} />} />
           
           <Route path="KB" element={<KBPage projects={data.projects} />} />
           <Route path="diff/*" element={<DiffPage documents={data.documents} />} />
           {/* Catch-all for docPath, then version at the end. 
               We need a splat for docPath because it can contain slashes. 
               However, React Router v6 splat needs to be at the end usually. 
               Since version is distinct, we might need a custom matching or strict order.
               Actually, :docPath* is not a valid syntax directly in middle.
               We can use '/*' and parse manually inside DocumentPage, OR use a fixed pattern if possible.
               Alternatively, we can try to rely on the fact that version is the LAST segment.
            */}
           <Route path="*" element={<DocumentPage documents={data.documents} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
