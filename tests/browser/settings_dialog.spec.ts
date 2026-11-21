import { test } from '@japa/runner'
import { account, reset } from '../helpers/workspaces.ts'

const screenshots = process.env.UI_SCREENSHOT_DIR

test.group('Settings dialog', (group) => {
  group.each.setup(() => reset())

  test('opens from the sidebar account menu and saves preferences and keys', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const fixture = await account('settings-ui@example.test')
    await browserContext.loginAs(fixture.user)
    const page = await visit(`/workspaces/${fixture.workspace.id}`)
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.getByRole('button', { name: 'Account and settings' }).click()
    const menu = page.getByRole('menu')
    await menu.waitFor()
    if (screenshots) await page.screenshot({ path: `${screenshots}/settings-menu.png` })

    await menu.getByRole('menuitem', { name: /^Settings/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Settings' })
    await dialog.getByRole('heading', { name: 'Preferences' }).waitFor()
    if (screenshots) await page.screenshot({ path: `${screenshots}/settings-preferences.png` })

    const spellcheck = dialog.getByRole('switch', { name: 'Spellcheck' })
    assert.equal(await spellcheck.getAttribute('aria-checked'), 'true')
    const saved = page.waitForResponse(
      (r) => r.url().endsWith('/settings/preferences') && r.status() === 200
    )
    await spellcheck.click()
    await saved
    await fixture.user.refresh()
    assert.isFalse(fixture.user.preferences.editor.spellcheck)

    for (const name of [
      'Profile',
      'Appearance',
      'AI & generation',
      'Notifications',
      'Connectors',
      'General',
      'Security & privacy',
    ]) {
      await dialog.getByRole('navigation').getByRole('button', { name, exact: true }).click()
      if (screenshots)
        await page.screenshot({
          path: `${screenshots}/settings-${name.toLowerCase().replace(/[^a-z]+/g, '-')}.png`,
        })
    }

    await dialog.getByRole('navigation').getByRole('button', { name: 'API keys' }).click()
    await dialog.getByRole('button', { name: 'Add key' }).first().click()
    await dialog.getByRole('textbox', { name: 'API key' }).fill('sk-or-v1-0123456789abcdefWXYZ')
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await dialog.getByText('…WXYZ', { exact: false }).waitFor()
    if (screenshots) await page.screenshot({ path: `${screenshots}/settings-api-keys.png` })

    await page.setViewportSize({ width: 390, height: 844 })
    if (screenshots) await page.screenshot({ path: `${screenshots}/settings-mobile.png` })
  })
})
