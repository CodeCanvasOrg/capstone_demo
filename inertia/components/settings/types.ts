import type { Dispatch, SetStateAction } from 'react'
import type { Preferences, SettingsPayload } from '../../../shared/settings.ts'

export const SETTINGS_TABS = [
  'profile',
  'security',
  'appearance',
  'preferences',
  'ai',
  'notifications',
  'api-keys',
  'connectors',
  'workspace',
] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

export type UpdatePreference = <S extends keyof Preferences, K extends keyof Preferences[S]>(
  section: S,
  key: K,
  value: Preferences[S][K]
) => void

export type SectionProps = {
  data: SettingsPayload
  setData: Dispatch<SetStateAction<SettingsPayload>>
  updatePreference: UpdatePreference
  go: (tab: SettingsTab) => void
}
