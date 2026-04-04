import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

const Sheet = ({ open, onOpenChange, children }: any) => {
  return (
    <>
      {React.Children.map(children, child => {
        if (child.type.displayName === 'SheetTrigger') {
          return React.cloneElement(child, { onClick: () => onOpenChange(true) })
        }
        if (child.type.displayName === 'SheetContent') {
          return open ? React.cloneElement(child, { onClose: () => onOpenChange(false) }) : null
        }
        return child
      })}
    </>
  )
}

const SheetTrigger = ({ children, onClick, asChild, ...props }: any) => {
  if (asChild) {
    return React.cloneElement(children, { onClick })
  }
  return <div onClick={onClick} {...props}>{children}</div>
}
SheetTrigger.displayName = "SheetTrigger"

const SheetContent = ({ children, onClose, className, side = "right" }: any) => {
  const sideStyles: Record<string, string> = {
    right: "right-0 top-0 h-full w-3/4 sm:max-w-sm",
    left: "left-0 top-0 h-full w-3/4 sm:max-w-sm",
    top: "top-0 left-0 right-0 h-auto",
    bottom: "bottom-0 left-0 right-0 h-auto",
  }
  
  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out",
        sideStyles[side],
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
SheetContent.displayName = "SheetContent"

export { Sheet, SheetTrigger, SheetContent }

