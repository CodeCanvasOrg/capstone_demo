import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function Home() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-16 px-4 py-20">
      <div className="flex flex-col items-center text-center gap-6">
        <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
          Introducing Code Canvas
        </Badge>
        <h1 className="text-5xl font-extrabold tracking-tight lg:text-6xl">
          Transform Your Success into <span className="text-primary">Impactful Case Studies</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Humblebee helps you showcase your best work with professional, data-driven case studies
          that convert prospects into clients.
        </p>
        <div className="flex gap-4 mt-4">
          <Button size="lg">Get Started</Button>
          <Button size="lg" variant="outline">
            View Templates
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Effortless Drafting</CardTitle>
            <CardDescription>
              Turn raw project notes into structured narratives using our intelligent canvas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Automated structural suggestions to ensure no key detail is missed.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Data Visualization</CardTitle>
            <CardDescription>
              Present metrics and KPIs in a visually compelling way.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Integrated charts and widgets to prove your impact with numbers.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>One-Click Publish</CardTitle>
            <CardDescription>
              Export your case studies to multiple formats or embed them directly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              SEO-optimized pages ready to be shared with your target audience.
            </div>
          </CardContent>
        </Card>
      </div>

      <footer className="border-t py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Humblebee. All rights reserved.
      </footer>
    </div>
  )
}
