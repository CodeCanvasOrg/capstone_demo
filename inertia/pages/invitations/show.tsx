export default function Show(_props: {
  invitation: {
    token: string
    workspaceName: string
    email: string
    expiresAt: string
    accepted: boolean
  }
  addressedAccount: boolean
}) {
  void _props
  return (
    <div className="mx-auto max-w-xl p-10">
      <h1 className="text-2xl font-semibold">Workspace invitation</h1>
      <p className="mt-4">Sign in with the addressed account to accept an invitation.</p>
    </div>
  )
}
