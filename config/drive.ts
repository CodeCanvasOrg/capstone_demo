import env from '#start/env'
import { defineConfig, services } from '@adonisjs/drive'

const publicStorageUrl = new URL(
  `/storage/v1/object/public/${env.get('SUPABASE_STORAGE_BUCKET')}/`,
  env.get('SUPABASE_ENDPOINT')
).toString()

const driveConfig = defineConfig({
  default: env.get('DRIVE_DISK'),

  /**
   * The services object can be used to configure multiple file system
   * services each using the same or a different driver.
   */
  services: {
    supabase: services.s3({
      credentials: {
        accessKeyId: env.get('SUPABASE_STORAGE_KEY'),
        secretAccessKey: env.get('SUPABASE_STORAGE_SECRET'),
      },
      region: env.get('SUPABASE_STORAGE_REGION'),
      bucket: env.get('SUPABASE_STORAGE_BUCKET'),
      endpoint: env.get('SUPABASE_ENDPOINT'),
      cdnUrl: publicStorageUrl,
      visibility: 'public',
    }),
  },
})

export default driveConfig

declare module '@adonisjs/drive/types' {
  export interface DriveDisks extends InferDriveDisks<typeof driveConfig> {}
}
