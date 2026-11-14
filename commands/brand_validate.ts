import { BaseCommand, flags } from '@adonisjs/core/ace'

export default class BrandValidate extends BaseCommand {
  static commandName = 'brand:validate'
  static description =
    'Check every brand kit version for missing assets, bad colours, variable fonts and unconfirmed identity'

  @flags.boolean({
    description: 'Treat warnings (for example, unconfirmed brand values) as failures',
  })
  declare strict: boolean

  async run() {
    const { BRAND_KITS, validateBrandKit } = await import('../shared/layout/brand.ts')
    let failed = false
    for (const kit of BRAND_KITS) {
      const findings = validateBrandKit(kit)
      const label = `${kit.id}@${kit.version} (${kit.status})`
      if (!findings.length) {
        this.logger.success(`${label}: no findings`)
        continue
      }
      for (const finding of findings) {
        const log = finding.severity === 'error' ? this.logger.error : this.logger.warning
        log.call(this.logger, `${label} ${finding.code}: ${finding.message}`)
        if (finding.severity === 'error' || this.strict) failed = true
      }
    }
    if (failed) this.exitCode = 1
  }
}
