import { Form, Link } from '@adonisjs/inertia/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/auth_shell'
import { Head } from '@inertiajs/react'
import { ArrowUpRight } from 'lucide-react'

export default function Signup() {
  return (
    <AuthShell
      title="Start your next story."
      description="Create your account and bring your work together."
    >
      <Head title="Sign up" />
      <Form route="new_account.store" className="flex flex-col gap-4">
        {({ errors, processing }) => (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName" className="text-sm font-medium">
                Full name
              </Label>
              <Input
                type="text"
                name="fullName"
                id="fullName"
                autoComplete="name"
                aria-invalid={errors.fullName ? true : undefined}
                aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                className="h-10 border-muted-foreground bg-background"
                required
              />
              {errors.fullName && (
                <p id="fullName-error" role="alert" className="text-sm text-destructive">
                  {errors.fullName}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                type="email"
                name="email"
                id="email"
                autoComplete="email"
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
                autoComplete="new-password"
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="passwordConfirmation" className="text-sm font-medium">
                Confirm password
              </Label>
              <Input
                type="password"
                name="passwordConfirmation"
                id="passwordConfirmation"
                autoComplete="new-password"
                aria-invalid={errors.passwordConfirmation ? true : undefined}
                aria-describedby={
                  errors.passwordConfirmation ? 'passwordConfirmation-error' : undefined
                }
                className="h-10 border-muted-foreground bg-background"
                required
              />
              {errors.passwordConfirmation && (
                <p
                  id="passwordConfirmation-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.passwordConfirmation}
                </p>
              )}
            </div>

            <Button type="submit" size="lg" disabled={processing}>
              {processing ? 'Creating account…' : 'Create account'}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Button>
          </>
        )}
      </Form>
      <p className="border-t border-border pt-5 text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          route="session.create"
          className="font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          Login
        </Link>
      </p>
    </AuthShell>
  )
}
