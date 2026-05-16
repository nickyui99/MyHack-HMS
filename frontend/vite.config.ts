import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // ADK's _OriginCheckMiddleware (google.adk.cli.adk_web_server) returns
      // 403 "Forbidden: origin not allowed" on any POST whose Origin header
      // doesn't match its own host. changeOrigin only rewrites Host, not
      // Origin, so we strip Origin (and Referer) on the way out — when ADK
      // sees no Origin, the middleware short-circuits and lets the request
      // through.
      '/adk': {
        target: 'http://localhost:8100',
        changeOrigin: true,
        ws: false,
        rewrite: (p) => p.replace(/^\/adk/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        },
      },
    },
  },
});
