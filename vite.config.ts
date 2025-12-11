import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path'
import fs from 'fs'

// Custom plugin to serve experiment files in Dev
const serveStaticFiles = (): Plugin => ({
  name: 'serve-static-files',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url) return next();
      
      // Serve /experiment/...
      if (req.url.startsWith('/experiment')) {
        const filePath = path.join(process.cwd(), 'experiment', req.url.replace('/experiment', ''));
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Content-Type', 'text/markdown');
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
          src: 'experiment',
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
