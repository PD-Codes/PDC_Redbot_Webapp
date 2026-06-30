import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // $lib ist in SvelteKit bereits eingebaut – nicht erneut definieren.
    adapter: adapter()
  }
};

export default config;
