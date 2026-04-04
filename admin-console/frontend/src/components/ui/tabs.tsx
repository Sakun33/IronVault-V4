import * as React from "react"
import { cn } from "@/lib/utils"

const Tabs = ({ defaultValue, className, children, ...props }: any) => {
  const [value, setValue] = React.useState(defaultValue)
  
  return (
    <div className={className} {...props}>
      {React.Children.map(children, child => {
        return React.cloneElement(child, { value, onValueChange: setValue })
      })}
    </div>
  )
}

const TabsList = React.forwardRef<any, any>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
)
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<any, any>(
  ({ className, value: tabValue, onValueChange, value: currentValue, ...props }, ref) => {
    const isActive = currentValue === tabValue
    
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          isActive && "bg-background text-foreground shadow-sm",
          className
        )}
        onClick={() => onValueChange && onValueChange(tabValue)}
        {...props}
      />
    )
  }
)
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<any, any>(
  ({ className, value: tabValue, value: currentValue, ...props }, ref) => {
    if (currentValue !== tabValue) return null
    
    return (
      <div
        ref={ref}
        className={cn(
          "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        {...props}
      />
    )
  }
)
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }

