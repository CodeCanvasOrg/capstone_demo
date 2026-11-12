import { test } from '@japa/runner'
import router from '@adonisjs/core/services/router'

// D-PDF-EXPORT: PDF is the only final export format. HTML stays a preview.
test.group('PDF-only final export', () => {
  test('no non-PDF final export route is registered', ({ assert }) => {
    router.commit()
    const routes = router
      .toJSON()
      .map((route) => ({ method: route.methods.join(','), pattern: route.pattern }))
    const exports = routes.filter((route) => /\/exports?(\/|$)/.test(route.pattern))
    const posts = exports.filter((route) => route.method.includes('POST'))
    assert.lengthOf(posts, 1)
    assert.match(posts[0].pattern, /\/exports\/pdf$/)
    assert.isEmpty(exports.filter((route) => /pptx|docx|cms|\/html/.test(route.pattern)))
  })
})
