import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function serveRawCssPlugin(): Plugin {
  return {
    name: 'serve-raw-css',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url === '/styles.css' || url.startsWith('/styles.css?') || url.startsWith('/styles.css&')) {
          const baseDir = typeof import.meta.dirname !== 'undefined' ? import.meta.dirname : path.resolve('.');
          const cssPath = path.resolve(baseDir, 'styles.css');
          if (fs.existsSync(cssPath)) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            return res.end(fs.readFileSync(cssPath));
          }
        }
        next();
      });
    }
  };
}

function copyStaticRootFilesPlugin(): Plugin {
  return {
    name: 'copy-static-root-files',
    closeBundle() {
      const filesToCopy = [
        'styles.css',
        'logo.png',
        'logo.jpg',
        'firebase-config.js',
        'firebase-sync.js',
        'app-modules.js',
        'app-features.js',
        'app-barcodes.js',
        'app-admin-tools.js',
        'app.js',
        'monitoring.js',
        'sw.js',
        'manifest.webmanifest',
        'icon-192.svg',
        'icon-512.svg'
      ];
      const baseDir = typeof import.meta.dirname !== 'undefined' ? import.meta.dirname : path.resolve('.');
      const distDir = path.resolve(baseDir, 'dist');
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }
      for (const file of filesToCopy) {
        const srcPath = path.resolve(baseDir, file);
        const destPath = path.resolve(distDir, file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
  };
}

export default defineConfig(() => {
  const baseDir = typeof import.meta.dirname !== 'undefined' ? import.meta.dirname : path.resolve('.');
  return {
    plugins: [serveRawCssPlugin(), react(), tailwindcss(), copyStaticRootFilesPlugin()],
    resolve: {
      alias: {
        '@': baseDir,
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: false,
      watch: null,
    },
  };
});
