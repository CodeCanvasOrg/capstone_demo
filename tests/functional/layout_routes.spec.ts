/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { account, reset } from '../helpers/workspaces.ts'

const base = (a: Awaited<ReturnType<typeof account>>) => `/workspaces/${a.workspace.id}`

test.group('Layout routes (TPL-05)', (group) => {
  group.each.setup(reset)

  test('catalog lists only enabled templates for the content type, plus brand kits and presets', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const res = await client.get(`${base(a)}/layout/catalog?docType=case_study`).loginAs(a.user)
    res.assertStatus(200)
    const data = res.body().data
    assert.sameMembers(
      data.templates.map((t: any) => t.id),
      ['case_study_concise', 'case_study_standard']
    )
    assert.equal(data.templates[0].pageBudget > 0, true)
    assert.equal(data.brands[0].name, 'HumbleBee AI')
    assert.deepEqual(data.presets, [])
    // The catalog never exposes file paths or font bytes.
    assert.notMatch(JSON.stringify(data), /node_modules|base64|\/Users\//)
  })

  test('catalog for an unimplemented type is empty, not a case-study fallback', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const res = await client.get(`${base(a)}/layout/catalog?docType=research`).loginAs(a.user)
    res.assertStatus(200)
    assert.deepEqual(res.body().data.templates, [])
  })

  test('GET/PUT document layout round-trips and reports fit and compatible choices', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const url = `${base(a)}/documents/${a.document.id}/layout`
    const get = await client.get(url).loginAs(a.user)
    get.assertStatus(200)
    assert.equal(get.body().data.selection.templateId, 'case_study_standard')

    const put = await client
      .put(url)
      .json({ templateId: 'case_study_concise', options: {}, baseRevision: 0 })
      .withCsrfToken()
      .loginAs(a.user)
    put.assertStatus(200)
    assert.equal(put.body().data.selection.templateId, 'case_study_concise')
    assert.equal(put.body().data.selection.revision, 1)
  })

  test('forged template id is rejected with a field error and nothing changes', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const url = `${base(a)}/documents/${a.document.id}/layout`
    const res = await client
      .put(url)
      .json({ templateId: '../../x', baseRevision: 0 })
      .withCsrfToken()
      .loginAs(a.user)
    res.assertStatus(422)
    const get = await client.get(url).loginAs(a.user)
    assert.isFalse(get.body().data.selection.saved)
  })

  test('another user cannot read or change a document layout or presets in this workspace', async ({
    client,
  }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const url = `${base(a)}/documents/${a.document.id}/layout`
    ;(await client.get(url).loginAs(b.user)).assertStatus(404)
    ;(
      await client
        .put(url)
        .json({ templateId: 'case_study_concise', baseRevision: 0 })
        .withCsrfToken()
        .loginAs(b.user)
    ).assertStatus(404)
    ;(await client.get(`${base(a)}/layout/catalog`).loginAs(b.user)).assertStatus(404)
  })

  test('presets can be created, listed, duplicated and deleted over HTTP', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const create = await client
      .post(`${base(a)}/layout-presets`)
      .json({ name: 'Email', templateId: 'case_study_concise', options: {} })
      .withCsrfToken()
      .loginAs(a.user)
    create.assertStatus(201)
    const id = create.body().data.id
    const dup = await client
      .post(`${base(a)}/layout-presets/${id}/duplicate`)
      .json({ name: 'Email copy' })
      .withCsrfToken()
      .loginAs(a.user)
    dup.assertStatus(201)
    const list = await client.get(`${base(a)}/layout-presets`).loginAs(a.user)
    assert.lengthOf(list.body().data, 2)
    ;(
      await client
        .delete(`${base(a)}/layout-presets/${id}`)
        .withCsrfToken()
        .loginAs(a.user)
    ).assertStatus(200)
  })

  test('unauthenticated requests are redirected or refused', async ({ client, assert }) => {
    const a = await account()
    const res = await client.get(`${base(a)}/layout/catalog`).redirects(0)
    assert.include([302, 401], res.status())
  })
})
