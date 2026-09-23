import { Form } from '@adonisjs/inertia/react'
import { Button } from '@/components/ui/button'

export default function Login() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-14">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl">Login</h1>
        <p className="text-sm text-muted-foreground">
          Enter your details below to login to your account
        </p>
      </div>

      <Form route="session.store" className="flex flex-col gap-4">
        {({ errors }) => (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                autoComplete="username"
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
                autoComplete="current-password"
                data-invalid={errors.password ? 'true' : undefined}
                className="h-9 border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 data-[invalid=true]:border-destructive"
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit">Login</Button>
          </>
        )}
      </Form>
    </div>
  )
}
