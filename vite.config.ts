import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: true, // auf 0.0.0.0 lauschen (Reverse-Proxy erreicht Vite)
    port: 5173,
    // Zugriff über Domain/Reverse-Proxy erlauben.
    // '.domekologe.eu' erlaubt die Domain inkl. aller Subdomains.
    allowedHosts: ['nyxbot.domekologe.eu', '.domekologe.eu'],
    // HMR (Hot Reload) über den HTTPS-Proxy: Browser verbindet via wss auf Port 443.
    hmr: {
      host: 'nyxbot.domekologe.eu',
      protocol: 'wss',
      clientPort: 443
    }
  }
});
