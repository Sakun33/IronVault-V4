"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Mobile: bottom sheet — pinned to the bottom edge with rounded top
        // corners, slides up from the bottom on open, full viewport width.
        // sm and up: classic centered modal with zoom + fade.
        "fixed z-50 flex flex-col w-full bg-background shadow-xl duration-200 border border-border/50",
        // Mobile bottom-sheet positioning
        "left-0 bottom-0 max-w-full max-h-[92dvh] rounded-t-2xl rounded-b-none border-b-0",
        // Desktop centered modal
        "sm:left-[50%] sm:top-[50%] sm:bottom-auto sm:translate-x-[-50%] sm:-translate-y-1/2",
        "sm:max-w-lg sm:max-h-[85dvh] sm:rounded-2xl sm:border-b",
        // Animations: slide up from bottom on mobile, zoom on desktop
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        "data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full",
        "sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=closed]:slide-out-to-left-1/2",
        "sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95",
        "overflow-hidden",
        className
      )}
      {...props}
    >
      {/* Drag handle — visible only on mobile bottom-sheet layout. Pure
          decoration here; tap-to-dismiss is handled by the existing close
          button + Radix's overlay click. */}
      <div aria-hidden className="sm:hidden flex justify-center pt-2 pb-1">
        <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
      </div>
      {/* Sticky close button — always at top-right, never scrolls away */}
      <DialogPrimitive.Close className="absolute right-3 top-3 z-20 rounded-full p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex-shrink-0 flex flex-col space-y-1.5 border-b border-border/50 px-5 pt-5 pb-4 pr-10",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex-1 overflow-y-auto overscroll-contain min-h-0 px-5 py-4 space-y-4",
      className
    )}
    {...props}
  />
)
DialogBody.displayName = "DialogBody"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex-shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-border/50 px-5 py-4 bg-background",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-foreground",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
