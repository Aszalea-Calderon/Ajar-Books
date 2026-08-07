import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	// Threlte/three.js requirement — without this Vite externalizes `three`
	// for SSR and Node fails to resolve its ESM/CJS layout at request time.
	ssr: { noExternal: ['three'] },
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					env: {
						DATABASE_URL: ':memory:',
						SESSION_SECRET: 'vitest-only-secret-never-used-outside-tests'
					},
					// Every test file imports the same $lib/server/db singleton, so
					// they all end up sharing one in-memory database connection —
					// running files in parallel lets one file's cleanup wipe another
					// file's in-flight rows. Sequential keeps each file's data stable.
					fileParallelism: false
				}
			}
		]
	}
});
