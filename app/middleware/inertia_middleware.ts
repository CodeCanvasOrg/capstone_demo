import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import UserTransformer from '#transformers/user_transformer'
import WorkspaceMembership from '#models/workspace_membership'
import WorkspaceTransformer from '#transformers/workspace_transformer'
import WorkspaceMembershipTransformer from '#transformers/workspace_membership_transformer'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'

export default class InertiaMiddleware extends BaseInertiaMiddleware {
  async share(ctx: HttpContext) {
    /**
     * The share method is called everytime an Inertia page is rendered. In
     * certain cases, a page may get rendered before the session middleware
     * or the auth middleware are executed. For example: During a 404 request.
     *
     * In that case, we must always assume that HttpContext is not fully hydrated
     * with all the properties
     */
    const { auth } = ctx as Partial<HttpContext>

    /**
     * Data shared with all Inertia pages. Make sure you are using
     * transformers for rich data-types like Models.
     */
    const memberships = auth?.user
      ? await WorkspaceMembership.query()
          .where('userId', auth.user.id)
          .whereNull('revokedAt')
          .preload('workspace')
          .orderBy('joinedAt', 'asc')
      : []
    return {
      workspace: ctx.workspace ? WorkspaceTransformer.transform(ctx.workspace) : null,
      workspaces: WorkspaceTransformer.transform(memberships.map((m) => m.workspace)),
      membership: ctx.workspaceMembership
        ? WorkspaceMembershipTransformer.transform(ctx.workspaceMembership)
        : null,
      workspaceCapabilities: {
        manageMembers: !!ctx.workspace && ctx.workspace.ownerUserId === auth?.user?.id,
        createDocuments: !!ctx.workspaceAccess,
      },
      errors: ctx.inertia.always(this.getValidationErrors(ctx)),
      user: ctx.inertia.always(auth?.user ? UserTransformer.transform(auth.user) : undefined),
    }
  }

  /**
   * The flash bag is sent to every Inertia page as a top-level "flash" field
   * (a sibling of "props") and is read on the client using "usePage().flash".
   *
   * Just like the share method, the flash method may run before the session
   * middleware, so HttpContext must be treated as partially hydrated.
   */
  flash(ctx: HttpContext) {
    const { session } = ctx as Partial<HttpContext>

    /**
     * Fetching the first error from the flash messages
     */
    return {
      error: session?.flashMessages.get('error') as string | undefined,
      success: session?.flashMessages.get('success') as string | undefined,
    }
  }

  async handle(ctx: HttpContext, next: NextFn) {
    await this.init(ctx)

    const output = await next()
    this.dispose(ctx)

    return output
  }
}

declare module '@adonisjs/inertia/types' {
  type MiddlewareSharedProps = InferSharedProps<InertiaMiddleware>
  export interface SharedProps extends MiddlewareSharedProps {}
}
