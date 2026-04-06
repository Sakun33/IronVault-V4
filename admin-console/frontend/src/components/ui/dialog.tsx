import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

const Dialog = ({ open, onOpenChange, children }: any) => {
  return (
    <>
      {React.Children.map(children, child => {
        if (child.type.displayName === 'DialogTrigger') {
          return React.cloneElement(child, { onClick: () => onOpenChange(true) })
        }
        if (child.type.displayName === 'DialogContent') {
          return open ? React.cloneElement(child, { onClose: () => onOpenChange(false) }) : null
        }
        return child
      })}
    </>
  )
}

const DialogTrigger = ({ children, onClick, asChild, ...props }: any) => {
  if (asChild) {
    return React.cloneElement(children, { onClick })
  }
  return <div onClick={onClick} {...props}>{children}</div>
}
DialogTrigger.displayName = "DialogTrigger"

const DialogContent = ({ children, onClose, className }: any) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
        className
      )}>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  )
}
DialogContent.displayName = "DialogContent"

const DialogHeader = ({ className, ...props }: any) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  />
)

const DialogTitle = React.forwardRef<any, any>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
)
DialogTitle.displayName = "DialogTitle"

const DialogFooter = ({ className, ...props }: any) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
)

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter }

