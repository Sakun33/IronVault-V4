import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  color?: string
  className?: string
}

export function StatCard({ icon: Icon, label, value, color = "text-primary", className }: StatCardProps) {
  return (
    <Card className={cn("group rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-border/60 bg-card hover:-translate-y-0.5", className)}>
      <CardContent className="p-4 flex flex-col gap-2.5">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-current/10", color.replace('text-', 'bg-') + '/10')}>
          <Icon className={cn("w-[18px] h-[18px]", color)} />
        </div>
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
      </CardContent>
    </Card>
  )
}

interface SectionCardProps {
  icon: LucideIcon
  label: string
  count?: number
  color?: string
  className?: string
  onClick?: () => void
}

export function SectionCard({ icon: Icon, label, count, color = "text-primary", className, onClick }: SectionCardProps) {
  return (
    <Card 
      className={cn(
        "group rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-border/60 bg-card cursor-pointer active:scale-95 hover:-translate-y-0.5",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 flex flex-col items-center justify-center gap-2.5 min-h-[100px]">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color.replace('text-', 'bg-') + '/10')}>
          <Icon className={cn("w-5 h-5", color)} />
        </div>
        <span className="font-medium text-foreground text-center text-sm">{label}</span>
        {count !== undefined && (
          <span className="text-[11px] text-muted-foreground font-medium">{count} items</span>
        )}
      </CardContent>
    </Card>
  )
}
