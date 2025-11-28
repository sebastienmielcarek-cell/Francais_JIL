import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Charge les variables d'environnement (API_KEY) pour qu'elles soient accessibles
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Remplace process.env.API_KEY par la vraie valeur lors du build
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
  };
});