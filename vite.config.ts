import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path'
import fs from 'fs'

// Custom plugin to serve campaigns files in Dev
const serveStaticFiles = (): Plugin => ({
  name: 'serve-static-files',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url) return next();
      
      // Serve /campaigns/...
      if (req.url.startsWith('/campaigns')) {
        const filePath = path.join(process.cwd(), 'campaigns', req.url.replace('/campaigns', ''));
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const contentTypeMap: Record<string, string> = {
            '.md': 'text/markdown; charset=utf-8',
            '.html': 'text/html; charset=utf-8',
            '.txt': 'text/plain; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
          };
          res.setHeader('Content-Type', contentTypeMap[ext] || 'text/plain; charset=utf-8');
          const stream = fs.createReadStream(filePath);
          stream.pipe(res);
          return;
        }
      }

      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  base: '/wiki/',
  plugins: [
    react(),
    serveStaticFiles(),
    viteStaticCopy({
      targets: [
        {
          src: 'campaigns',
          dest: '.' 
        },
        {
          src: '404.html',
          dest: '.'
        }
      ]
    })
  ],
})
