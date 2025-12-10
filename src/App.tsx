
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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home projects={data.projects} />} />
        
        <Route path="/p/:projectId" element={<Layout projects={data.projects} documents={data.documents} />}>
           <Route index element={<ProjectDashboard projects={data.projects} documents={data.documents} />} />
           
           <Route path="v/:version/d/*" element={<DocumentPage documents={data.documents} />} />
           <Route path="diff/*" element={<DiffPage documents={data.documents} />} />
           <Route path="kb" element={<KBPage projects={data.projects} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
