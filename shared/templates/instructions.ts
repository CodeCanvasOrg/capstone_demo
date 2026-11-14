export const MAX_INSTRUCTIONS = 4000

/** Sent to the model when the author leaves the instructions empty. */
export const DEFAULT_INSTRUCTIONS = [
  'Write in a clear, confident, professional voice for a general business audience.',
  'Lead with the problem and the outcome, then explain what was built and how.',
  'Use only facts from the brief and the attached sources; never invent numbers, names or quotes.',
  'Prefer concrete details over adjectives, and keep sentences short.',
].join('\n')

export function resolveInstructions(value?: string | null) {
  return value?.trim() || DEFAULT_INSTRUCTIONS
}
