import vine from '@vinejs/vine'

export const profileValidator = vine.create({
  fullName: vine.string().trim().maxLength(120).nullable(),
  email: vine.string().trim().toLowerCase().email().maxLength(254),
})

export const passwordValidator = vine.create({
  currentPassword: vine.string(),
  password: vine.string().minLength(8).maxLength(32).confirmed({
    confirmationField: 'passwordConfirmation',
  }),
  passwordConfirmation: vine.string(),
})

export const credentialValidator = vine.create({
  secret: vine.string().trim().minLength(8).maxLength(2048),
  label: vine.string().trim().maxLength(80).nullable().optional(),
})
