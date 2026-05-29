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
      "fixed inset-0 z-[70] bg-black/60 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onOpenAutoFocus, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-iv-dialog="centered"
      onOpenAutoFocus={(e) => {
        if (onOpenAutoFocus) { onOpenAutoFocus(e); return; }
        e.preventDefault();
        const node = (e.currentTarget as HTMLElement) || null;
        if (node && typeof (node as any).focus === 'function') {
          try { (node as HTMLElement).focus({ preventScroll: true }); } catch { /* noop */ }
        }
      }}
      className={cn(
        // Centered modal on every screen size. The old mobile bottom-sheet
        // layout (bottom-0 + 160px padding) caused dialogs to float at the
        // bottom of the viewport with a huge blank gap above the content.
        // Now: fixed center, capped max-height that respects iOS safe areas
        // and keyboard via global rules in mobile-foundation.css.
        "fixed left-[50%] top-[50%] z-[71] -translate-x-1/2 -translate-y-1/2",
        "flex flex-col bg-background shadow-xl border border-border/50 rounded-2xl",
        // Width: leave 16px margin on each side on mobile, max-w-lg on desktop.
        "w-[calc(100vw-32px)] max-w-md sm:w-full sm:max-w-lg",
        // Vertical cap: respect safe areas (notch + home indicator) and the
        // global `html.kb-open` rule shrinks this further when the keyboard
        // is open so the dialog stays fully visible above the keyboard.
        "max-h-[calc(100dvh-var(--safe-top,0px)-var(--safe-bottom,0px)-32px)] sm:max-h-[85dvh]",
        "duration-200",
        // Centered zoom + fade animation on every size.
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
        "overflow-hidden",
        className
      )}
      {...props}
    >
      {/* Sticky close button — always at top-right, never scrolls away.
          Uses focus-visible: so the ring only paints on real keyboard
          interaction; mouse/Radix auto-focus no longer leaves a stray
          purple ring that made the X look inconsistent across modals. */}
      <DialogPrimitive.Close
        tabIndex={-1}
        className="absolute right-3 top-3 z-20 rounded-full p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
      >
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
      "flex-1 overflow-y-auto overscroll-contain min-h-0 px-5 pt-4 pb-4 space-y-4",
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
