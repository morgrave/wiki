
import React from 'react';
import { Link } from 'react-router-dom';
import { Folder } from 'lucide-react';
import type { Project } from '../types';

interface HomeProps {
  projects: Project[];
}

const Home: React.FC<HomeProps> = ({ projects }) => {
  return (
    <div className="container" style={{ paddingTop: '4rem' }}>
      <h1>Welcome to Wiki</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '2rem' }}>
        Select a project to begin
      </p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {projects.map(p => (
          <Link 
            key={p.id} 
            to={`/p/${p.id}`}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem',
              background: 'var(--bg-secondary)',
              padding: '1.5rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              textDecoration: 'none',
              transition: 'transform 0.2s, border-color 0.2s'
            }}
            onMouseOver={(e) => {
               (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-color)';
               (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
               (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
               (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '50%' }}>
              <Folder size={24} color="var(--accent-color)" />
            </div>
            <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>{p.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Home;
