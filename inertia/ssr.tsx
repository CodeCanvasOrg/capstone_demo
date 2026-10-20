import { client } from '@/client'
import { type ReactElement } from 'react'
import Layout from '@/layouts/default'
import AuthLayout from '@/layouts/auth'
import PublicLayout from '@/layouts/public'
import { AppProviders } from '@/providers/app_providers'
import { type Data } from '@generated/data'
import ReactDOMServer from 'react-dom/server'
import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react'
import { TuyauProvider } from '@adonisjs/inertia/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'

export default function render(page: any) {
  return createInertiaApp({
    page,
    render: ReactDOMServer.renderToString,
    resolve: (name) => {
      return resolvePageComponent<ResolvedComponent>(
        `./pages/${name}.tsx`,
        import.meta.glob<ResolvedComponent>('./pages/**/*.tsx', { eager: true }),
        (resolvedPage: ReactElement<Data.SharedProps>) =>
          name.startsWith('auth/') ? (
            <AuthLayout>{resolvedPage}</AuthLayout>
          ) : name.startsWith('invitations/') || name.startsWith('errors/') ? (
            <PublicLayout>{resolvedPage}</PublicLayout>
          ) : (
            <Layout>{resolvedPage}</Layout>
          )
      )
    },
    setup: ({ App, props }) => {
      return (
        <TuyauProvider client={client}>
          <AppProviders>
            <App {...props} />
          </AppProviders>
        </TuyauProvider>
      )
    },
  })
}
