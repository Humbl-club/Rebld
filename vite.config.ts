import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Parse .env.local file directly to avoid shell env var conflicts (local dev only)
function parseEnvFile(filepath: string): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length) {
            env[key.trim()] = valueParts.join('=').trim();
          }
        }
      }
    }
  } catch (e) {
    // File doesn't exist (e.g., on Vercel) - fall back to process.env
  }
  return env;
}

// Get env var: prefer .env.local (local dev), fall back to process.env (Vercel)
function getEnvVar(fileEnv: Record<string, string>, key: string): string {
  return fileEnv[key] || process.env[key] || '';
}

export default defineConfig(({ mode }) => {
  // Read .env.local for local dev, fall back to process.env for Vercel
  const fileEnv = parseEnvFile(path.resolve(process.cwd(), '.env.local'));

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 1000, // Increase from 500kb to 1000kb
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor chunks for better caching
            'vendor-react': ['react', 'react-dom'],
            'vendor-clerk': ['@clerk/clerk-react'],
            'vendor-convex': ['convex/react'],
          },
        },
      },
    },
    define: {
      // Environment variables exposed to client
      // Local dev: reads from .env.local to avoid stale shell variables
      // Vercel: reads from process.env (set in Vercel dashboard)
      'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(getEnvVar(fileEnv, 'VITE_CLERK_PUBLISHABLE_KEY')),
      'import.meta.env.VITE_USE_EMULATORS': JSON.stringify(getEnvVar(fileEnv, 'VITE_USE_EMULATORS')),
      'import.meta.env.VITE_CONVEX_URL': JSON.stringify(getEnvVar(fileEnv, 'VITE_CONVEX_URL')),
      // Define process.env for legacy code compatibility (AI calls now use Convex server-side)
      'process.env.API_KEY': JSON.stringify(''),
      'process.env.GEMINI_API_KEY': JSON.stringify(''),
      'process.env': JSON.stringify({}),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
