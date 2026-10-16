import './css/app.css'
import { type ReactElement } from 'react'
import { client } from './client'
import Layout from '@/layouts/default'
import AuthLayout from '@/layouts/auth'
import PublicLayout from '@/layouts/public'
import { AppProviders } from '@/providers/app_providers'
import { type Data } from '@generated/data'
import { createRoot } from 'react-dom/client'
import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react'
import { TuyauProvider } from '@adonisjs/inertia/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'

const appName = import.meta.env.VITE_APP_NAME || 'CodeCanvas'

createInertiaApp({
  title: (title) => (title ? `${title} - ${appName}` : appName),
  resolve: (name) => {
    return resolvePageComponent<ResolvedComponent>(
      `./pages/${name}.tsx`,
      import.meta.glob<ResolvedComponent>('./pages/**/*.tsx'),
      (page: ReactElement<Data.SharedProps>) =>
        name.startsWith('auth/') ? (
          <AuthLayout>{page}</AuthLayout>
        ) : name.startsWith('invitations/') || name.startsWith('errors/') ? (
          <PublicLayout>{page}</PublicLayout>
        ) : (
          <Layout>{page}</Layout>
        )
    )
  },
  setup({ el, App, props }) {
    createRoot(el).render(
      <TuyauProvider client={client}>
        <AppProviders>
          <App {...props} />
        </AppProviders>
      </TuyauProvider>
    )
  },
  progress: {
    color: 'var(--primary)',
  },
})
