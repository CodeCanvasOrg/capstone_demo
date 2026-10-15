import { BaseMail } from '@adonisjs/mail'
export default class WorkspaceInvitationNotification extends BaseMail {
  constructor(
    private recipient: string,
    private workspaceName: string,
    private url: string
  ) {
    super()
  }
  prepare() {
    this.message
      .to(this.recipient)
      .subject(`Join ${this.workspaceName} on HumbleBeeAI`)
      .text(
        `You have been invited to ${this.workspaceName}.\n\nOpen this link and sign in with ${this.recipient} to accept:\n${this.url}\n\nThis single-use invitation expires in seven days. Opening the link does not join the workspace. If you did not expect it, you can ignore this email.`
      )
  }
}
