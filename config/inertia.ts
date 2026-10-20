import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/inertia'

const inertiaConfig = defineConfig({
  assetsVersion: app.inTest ? 'tenancy-test' : undefined,
  /**
   * Server-side rendering options.
   */
  ssr: {
    /**
     * Toggle SSR mode for Inertia pages.
     */
    enabled: false,

    /**
     * Entry file used by the SSR server build.
     */
    entrypoint: 'inertia/ssr.tsx',
  },
})

export default inertiaConfig
