/*
|--------------------------------------------------------------------------
| Vercel Function entrypoint
|--------------------------------------------------------------------------
|
| Same boot sequence as bin/server.ts, but instead of listening on a port the
| AdonisJS request handler is handed to Vercel. The app boots once per function
| instance and is reused across requests.
|
*/

import 'reflect-metadata'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { Ignitor, prettyPrintError } from '@adonisjs/core'

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void

const APP_ROOT = new URL('../', import.meta.url)

const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

async function boot(): Promise<RequestHandler> {
  // Some paths (e.g. the queue's job `locations` glob) resolve against the cwd. In the
  // container the app runs from build/; on Vercel the cwd is the function root.
  process.chdir(fileURLToPath(APP_ROOT))

  const ignitor = new Ignitor(APP_ROOT, { importer: IMPORTER }).tap((app) => {
    app.booting(async () => {
      await import('#start/env')
    })
  })

  const app = ignitor.createApp('web')
  await app.init()
  await app.boot()

  let handler: RequestHandler | undefined
  await app.start(async () => {
    const server = await app.container.make('server')
    await server.boot()
    handler = server.handle.bind(server)
  })

  if (!handler) throw new Error('AdonisJS HTTP server failed to boot')
  return handler
}

let booting: Promise<RequestHandler> | undefined

export default async function vercelHandler(req: IncomingMessage, res: ServerResponse) {
  booting ??= boot().catch((error) => {
    // Let the next request retry instead of caching a failed boot.
    booting = undefined
    prettyPrintError(error)
    throw error
  })
  const handle = await booting
  await handle(req, res)
}
