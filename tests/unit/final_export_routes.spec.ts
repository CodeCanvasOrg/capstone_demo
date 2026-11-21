import { test } from '@japa/runner'
import router from '@adonisjs/core/services/router'

// D-WEB-EXPORT (supersedes D-PDF-EXPORT for HTML): the final export formats are PDF and a
// self-contained web page. PPTX, DOCX and CMS stay deferred.
test.group('Final export formats', () => {
  test('only the PDF and web page final export routes are registered', ({ assert }) => {
    router.commit()
    const routes = Object.values(router.toJSON())
      .flat()
      .map((route) => ({
        method: route.methods.join(','),
        pattern: route.pattern,
      }))
    const exports = routes.filter((route) => /\/exports?(\/|$)/.test(route.pattern))
    const posts = exports
      .filter((route) => route.method.includes('POST'))
      .map((route) => route.pattern.split('/').at(-1))
      .sort()
    assert.deepEqual(posts, ['pdf', 'web'])
    assert.isEmpty(exports.filter((route) => /pptx|docx|cms|\/html/.test(route.pattern)))
  })
})
