import { Form, Link } from '@adonisjs/inertia/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/auth_shell'
import { Head } from '@inertiajs/react'
import { ArrowUpRight } from 'lucide-react'

export default function Login() {
  return (
    <AuthShell title="Welcome back." description="Login to pick up where you left off.">
      <Head title="Login" />
      <Form route="session.store" className="flex flex-col gap-4">
        {({ errors, processing }) => (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                type="email"
                name="email"
                id="email"
                autoComplete="username"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className="h-10 border-muted-foreground bg-background"
                required
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-sm text-destructive">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                type="password"
                name="password"
                id="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className="h-10 border-muted-foreground bg-background"
                required
              />
              {errors.password && (
                <p id="password-error" role="alert" className="text-sm text-destructive">
                  {errors.password}
                </p>
              )}
            </div>

            <Button type="submit" size="lg" disabled={processing}>
              {processing ? 'Logging in…' : 'Login'}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Button>
          </>
        )}
      </Form>
      <p className="border-t border-border pt-5 text-sm text-muted-foreground">
        New here?{' '}
        <Link
          route="new_account.create"
          className="font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          Create an account
        </Link>
      </p>
    </AuthShell>
  )
}
