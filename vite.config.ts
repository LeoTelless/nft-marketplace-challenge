import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * The entry chunk is tiny and only `import()`s the app and the mock layer. Vite preloads just the
 * entry's static imports, so those two chunks (and their static dependencies) would be discovered
 * one network round trip late. This adds `modulepreload` links for them to the built HTML so they
 * download in parallel with the entry. Route chunks stay lazy.
 */
function preloadEntryDynamicImports(): Plugin {
  return {
    name: 'preload-entry-dynamic-imports',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const bundle = ctx.bundle
        const entry = Object.values(bundle ?? {}).find((chunk) => chunk.type === 'chunk' && chunk.isEntry)
        if (!bundle || entry?.type !== 'chunk') return
        const already = new Set([entry.fileName, ...entry.imports])
        const files = new Set<string>()
        const visit = (file: string) => {
          const chunk = bundle[file]
          if (already.has(file) || files.has(file) || chunk?.type !== 'chunk') return
          files.add(file)
          chunk.imports.forEach(visit)
        }
        entry.dynamicImports.forEach(visit)
        return [...files].map((file) => ({
          tag: 'link',
          attrs: { rel: 'modulepreload', crossorigin: true, href: `/${file}` },
          injectTo: 'head' as const,
        }))
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Must come before the React plugin so generated route files are transformed.
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      // The plugin's default leaves `pendingComponent` in the route file, which the route tree imports
      // statically: the private area's skeletons (profile, wallets, checkout, order) would join the
      // startup chunk of every page. Split it like the other components.
      codeSplittingOptions: {
        defaultBehavior: [['component'], ['errorComponent'], ['notFoundComponent'], ['pendingComponent']],
      },
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      quoteStyle: 'single',
    }),
    react(),
    tailwindcss(),
    preloadEntryDynamicImports(),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // One vendor chunk with what the app needs at startup (fewer, larger requests). It is an
            // allow-list on purpose: socket.io-client must stay in its own, dynamically imported chunk
            // (engine.io captures `WebSocket` when it is evaluated, which has to happen after the mocks
            // started) and the mock layer libraries (MSW) must not join the startup path.
            {
              name: 'vendor',
              test: /node_modules\/(react|react-dom|scheduler|@tanstack|axios|zod|tailwind-merge|clsx|class-variance-authority|tslib)\//,
              priority: 20,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // See the shim: MSW's cookie jar (tough-cookie + tldts) is unused by the simulated API.
      'tough-cookie': fileURLToPath(new URL('./src/mocks/shims/tough-cookie.ts', import.meta.url)),
    },
  },
})
