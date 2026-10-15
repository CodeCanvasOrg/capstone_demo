import { BaseTransformer } from '@adonisjs/core/transformers'
import type Project from '#models/project'

export default class ProjectTransformer extends BaseTransformer<Project> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'workspaceId',
      'name',
      'description',
      'createdAt',
      'updatedAt',
    ])
  }
}
