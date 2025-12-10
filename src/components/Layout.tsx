
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import type { Project, Document } from '../types';
import styles from './Layout.module.css';

interface LayoutProps {
  projects: Project[];
  documents: Document[];
}

const Layout: React.FC<LayoutProps> = ({ projects, documents }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className={styles.container}>
      <Header documents={documents} onMenuToggle={toggleSidebar} />
      <div className={styles.body}>
        <Sidebar 
          projects={projects} 
          documents={documents} 
          isOpen={isSidebarOpen}
          onClose={closeSidebar}
        />
        <main className={styles.content} onClick={closeSidebar}>
           <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
