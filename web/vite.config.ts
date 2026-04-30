import { defineConfig } from 'vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		vanillaExtractPlugin(),
		viteCompression({
			deleteOriginFile: true,
		})
	],
	server: {
		proxy: {
			'/api': {
				target: 'http://127.0.0.1:8013',
				changeOrigin: true,
				ws: true,
			}
		}
	}
});
