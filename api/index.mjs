// Vercel Function entry. `vercel.json` rewrites every non-static request here.
// The handler lives in the compiled app (build/bin/vercel.js) so it resolves
// dependencies from build/node_modules, which the Vercel build installs.
// The manifest import only exists so Vercel's file tracer bundles the whole app
// (see scripts/vercel_manifest.mjs).
import '../build/vercel_manifest.js'

export { default } from '../build/bin/vercel.js'
