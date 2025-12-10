
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
  return (
    <div className={styles.container}>
      <Header documents={documents} />
      <div className={styles.body}>
        <Sidebar projects={projects} documents={documents} />
        <main className={styles.content}>
           <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
