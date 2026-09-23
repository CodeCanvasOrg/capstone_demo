import { Form } from '@adonisjs/inertia/react'
import { Button } from '@/components/ui/button'

export default function Signup() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-14">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl">Signup</h1>
        <p className="text-sm text-muted-foreground">
          Enter your details below to create your account
        </p>
      </div>

      <Form route="new_account.store" className="flex flex-col gap-4">
        {({ errors }) => (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fullName" className="text-sm font-medium">
                Full name
              </label>
              <input
                type="text"
                name="fullName"
                id="fullName"
                data-invalid={errors.fullName ? 'true' : undefined}
                className="h-9 border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 data-[invalid=true]:border-destructive"
              />
              {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                autoComplete="email"
                data-invalid={errors.email ? 'true' : undefined}
                className="h-9 border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 data-[invalid=true]:border-destructive"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <input
                type="password"
                name="password"
                id="password"
                autoComplete="new-password"
                data-invalid={errors.password ? 'true' : undefined}
                className="h-9 border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 data-[invalid=true]:border-destructive"
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="passwordConfirmation" className="text-sm font-medium">
                Confirm password
              </label>
              <input
                type="password"
                name="passwordConfirmation"
                id="passwordConfirmation"
                autoComplete="new-password"
                data-invalid={errors.passwordConfirmation ? 'true' : undefined}
                className="h-9 border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 data-[invalid=true]:border-destructive"
              />
              {errors.passwordConfirmation && (
                <p className="text-sm text-destructive">{errors.passwordConfirmation}</p>
              )}
            </div>

            <Button type="submit">Sign up</Button>
          </>
        )}
      </Form>
    </div>
  )
}
