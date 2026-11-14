/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { account, reset } from '../helpers/workspaces.ts'
import DocumentService from '#services/documents/document_service'
import LayoutPresetService from '#services/layout/layout_preset_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'

test.group('Workspace layout presets (TPL-05, TPL-07)', (group) => {
  group.each.setup(reset)
  const service = new LayoutPresetService()

  test('create, list and apply a preset to two documents', async ({ assert }) => {
    const a = await account()
    const preset = await service.create(a.context, {
      name: 'Email one-pager',
      templateId: 'case_study_concise',
      options: { imageMode: 'without' },
    })
    assert.equal(preset.templateVersion, 1)
    assert.equal(preset.brandVersion, 1)
    assert.deepEqual(
      (await service.list(a.context)).map((p) => p.name),
      ['Email one-pager']
    )

    const second = await new DocumentService().create(
      a.context,
      { title: 'Second', sourceMode: 'input_only' },
      []
    )
    for (const id of [a.document.id, second.id]) {
      const applied = await new LayoutSelectionService().applyPreset(a.context, id, preset.id, 0)
      assert.equal(applied.templateId, 'case_study_concise')
      assert.deepInclude(applied.options, { imageMode: 'without' })
    }
  })

  test('preset names are unique per workspace, case-insensitively', async ({ assert }) => {
    const a = await account()
    await service.create(a.context, { name: 'Standard', templateId: 'case_study_standard' })
    await assert.rejects(
      () => service.create(a.context, { name: 'standard', templateId: 'case_study_standard' }),
      /already exists/i
    )
  })

  test('presets reject forged templates and invalid options', async ({ assert }) => {
    const a = await account()
    await assert.rejects(() => service.create(a.context, { name: 'Bad', templateId: 'nope' }))
    await assert.rejects(() =>
      service.create(a.context, {
        name: 'Bad options',
        templateId: 'case_study_standard',
        options: { imageMode: 'x' },
      })
    )
  })

  test('updating a preset leaves already-applied documents on their pinned selection', async ({
    assert,
  }) => {
    const a = await account()
    const preset = await service.create(a.context, {
      name: 'Shared',
      templateId: 'case_study_standard',
    })
    await new LayoutSelectionService().applyPreset(a.context, a.document.id, preset.id, 0)
    await service.update(a.context, preset.id, { templateId: 'case_study_concise' })
    const doc = await new LayoutSelectionService().resolve(a.context, a.document.id)
    assert.equal(doc.templateId, 'case_study_standard')
    assert.equal(doc.presetId, preset.id)
  })

  test('duplicate copies pinned versions and options under a new name', async ({ assert }) => {
    const a = await account()
    const preset = await service.create(a.context, {
      name: 'Base',
      templateId: 'case_study_concise',
      options: { imageMode: 'without' },
    })
    const copy = await service.duplicate(a.context, preset.id, 'Base copy')
    assert.notEqual(copy.id, preset.id)
    assert.equal(copy.templateId, 'case_study_concise')
    assert.deepInclude(copy.options, { imageMode: 'without' })
  })

  test('other workspaces cannot read, apply, change or delete a preset', async ({ assert }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const preset = await service.create(a.context, {
      name: 'Private',
      templateId: 'case_study_standard',
    })
    assert.deepEqual(await service.list(b.context), [])
    await assert.rejects(() => service.update(b.context, preset.id, { name: 'Hacked' }))
    await assert.rejects(() => service.remove(b.context, preset.id))
    await assert.rejects(() =>
      new LayoutSelectionService().applyPreset(b.context, b.document.id, preset.id, 0)
    )
    await assert.rejects(() => service.duplicate(b.context, preset.id, 'Stolen'))
  })

  test('deleting a preset leaves documents that used it unchanged', async ({ assert }) => {
    const a = await account()
    const preset = await service.create(a.context, {
      name: 'Temp',
      templateId: 'case_study_concise',
    })
    await new LayoutSelectionService().applyPreset(a.context, a.document.id, preset.id, 0)
    await service.remove(a.context, preset.id)
    assert.equal(
      (await new LayoutSelectionService().resolve(a.context, a.document.id)).templateId,
      'case_study_concise'
    )
  })
})
