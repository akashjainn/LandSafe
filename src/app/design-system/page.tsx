"use client"

import { 
  AppShell, 
  PageHeader, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent,
  GlassCard,
  GradientCard,
  Button,
  IconButton,
  LoadingButton,
  tokens 
} from "@/components/ds"
import { Plane, Plus, Settings } from "lucide-react"

export default function DesignSystemDemo() {
  return (
    <AppShell 
      title="Design System" 
      subtitle="Unified components with consistent tokens"
      actions={
        <Button variant="secondary">
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      }
    >
      <div className="space-y-8">
        
        {/* Buttons Section */}
        <section>
          <PageHeader title="Buttons" subtitle="Consistent button variants using design tokens" />
          <div className="flex gap-3 flex-wrap">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <IconButton icon={<Plus className="w-4 h-4" />} />
            <LoadingButton loading>Loading...</LoadingButton>
          </div>
        </section>

        {/* Cards Section */}
        <section>
          <PageHeader title="Cards" subtitle="Card variants with unified styling" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <Card>
              <CardHeader>
                <CardTitle>Standard Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[var(--gray-500)]">
                  Clean white card with subtle shadow and rounded corners.
                </p>
              </CardContent>
            </Card>

            <GlassCard className="p-6 text-white bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <h3 className="font-semibold mb-2">Glass Card</h3>
              <p className="text-white/80">
                Glass morphism effect with backdrop blur and transparency.
              </p>
            </GlassCard>

            <GradientCard className="p-6">
              <h3 className="font-semibold mb-2">Gradient Card</h3>
              <p className="text-blue-100">
                Branded gradient background using primary color tokens.
              </p>
            </GradientCard>

          </div>
        </section>

        {/* Flight Card Example */}
        <section>
          <PageHeader title="Flight Card Example" subtitle="Real-world usage of design system" />
          <Card className="max-w-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--blue-600)] rounded-[var(--radius)] flex items-center justify-center">
                    <Plane className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>UA 1234</CardTitle>
                    <p className="text-[var(--gray-500)] text-sm">United Airlines</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-[var(--gray-900)]">On Time</div>
                  <div className="text-xs text-[var(--green-500)]">Departed</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[var(--gray-900)]">SFO</div>
                  <div className="text-sm text-[var(--gray-500)]">San Francisco</div>
                  <div className="text-sm text-[var(--gray-500)]">10:30 AM</div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="h-px bg-[var(--gray-200)] flex-1 max-w-20"></div>
                  <Plane className="w-4 h-4 text-[var(--gray-400)] mx-3" />
                  <div className="h-px bg-[var(--gray-200)] flex-1 max-w-20"></div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-[var(--gray-900)]">LAX</div>
                  <div className="text-sm text-[var(--gray-500)]">Los Angeles</div>
                  <div className="text-sm text-[var(--gray-500)]">12:45 PM</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Design Tokens Display */}
        <section>
          <PageHeader title="Design Tokens" subtitle="Color palette and design values" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <Card>
              <CardHeader>
                <CardTitle>Colors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2 text-[var(--gray-700)]">Grays</h4>
                  <div className="flex gap-2">
                    {[50, 100, 200, 300, 500, 700, 900].map(shade => (
                      <div key={shade} className="text-center">
                        <div 
                          className="w-8 h-8 rounded border"
                          style={{ backgroundColor: `var(--gray-${shade})` }}
                        />
                        <div className="text-xs mt-1">{shade}</div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2 text-[var(--gray-700)]">Blues</h4>
                  <div className="flex gap-2">
                    {[500, 600, 700].map(shade => (
                      <div key={shade} className="text-center">
                        <div 
                          className="w-8 h-8 rounded border"
                          style={{ backgroundColor: `var(--blue-${shade})` }}
                        />
                        <div className="text-xs mt-1">{shade}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Layout Tokens</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--gray-700)]">Radius</span>
                  <span className="font-mono text-sm bg-[var(--gray-100)] px-2 py-1 rounded">12px</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--gray-700)]">Shadow SM</span>
                  <div className="w-8 h-8 bg-white rounded shadow-[var(--shadow-sm)] border"></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--gray-700)]">Shadow MD</span>
                  <div className="w-8 h-8 bg-white rounded shadow-[var(--shadow-md)] border"></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--gray-700)]">Shadow LG</span>
                  <div className="w-8 h-8 bg-white rounded shadow-[var(--shadow-lg)] border"></div>
                </div>
              </CardContent>
            </Card>

          </div>
        </section>

      </div>
    </AppShell>
  )
}
