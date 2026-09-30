import type User from '#models/user'
import type File from '#models/file'
import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class FilePolicy extends BasePolicy {
  async update(user: User, file: File): Promise<AuthorizerResponse> {
    return user.id === file.userId
  }

  async delete(user: User, file: File): Promise<AuthorizerResponse> {
    return user.id === file.userId
  }
}
