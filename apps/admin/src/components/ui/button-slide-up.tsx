"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { Button as BaseUIButton } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const slideUpButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface SlideUpButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof slideUpButtonVariants> {
  /** Optional leading element (e.g. an icon) rendered beside the sliding text */
  children?: React.ReactNode
  /** Default label shown before hover */
  label?: string
  /** Second label that rolls up from below on hover */
  labelHover?: string
}

const SlideUpButton = React.forwardRef<HTMLButtonElement, SlideUpButtonProps>(
  ({ className, variant, size, label, labelHover, children, ...props }, ref) => {
    const defaultLabel = label ?? ""
    const hoverLabel = labelHover ?? defaultLabel
    const hasEffect =
      typeof labelHover === "string" &&
      labelHover.length > 0 &&
      labelHover !== defaultLabel

    return (
      <BaseUIButton
        className={cn(slideUpButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        <span className="relative flex items-center justify-center w-full h-full">
          {children && <span className="shrink-0">{children}</span>}
          {/* One-line viewport centered in the button. `em` scales with the
              button's font-size so the clip stays a single line across size
              variants. Grid stacking keeps the button width stable when the
              two phrases differ in length. */}
          <span className="w-full overflow-hidden h-[1.2em]">
            <motion.span
              initial={{ y: 0 }}
              whileHover={hasEffect ? { y: "-50%" } : { y: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className="h-[2.4em] grid grid-rows-2 w-full items-center"
            >
              <span className="text-body">{defaultLabel}</span>
              <span className="text-body">{hoverLabel}</span>
            </motion.span>
          </span>
        </span>
      </BaseUIButton>
    )
  }
)

SlideUpButton.displayName = "SlideUpButton"

export { SlideUpButton, slideUpButtonVariants }
