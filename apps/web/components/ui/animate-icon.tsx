"use client"

import { forwardRef, type ComponentProps } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

interface AnimateIconProps extends ComponentProps<typeof motion.div> {
  animateOnHover?: boolean
  animateOnClick?: boolean
  animation?: "path" | "scale" | "rotate" | "translate" | "morph"
}

const AnimateIcon = forwardRef<HTMLDivElement, AnimateIconProps>(
  (
    {
      animateOnHover = true,
      animateOnClick = false,
      animation = "scale",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const prefersReduced = useReducedMotion()

    const getHoverProps = () => {
      if (prefersReduced || !animateOnHover) return {}
      return {
        whileHover: {
          scale: animation === "scale" ? 1.15 : 1,
          rotate: animation === "rotate" ? 12 : 0,
          y: animation === "translate" ? -2 : 0,
        },
      }
    }

    const getTapProps = () => {
      if (prefersReduced || !animateOnClick) return {}
      return {
        whileTap: { scale: 0.92 },
      }
    }

    return (
      <motion.div
        ref={ref}
        className={cn("inline-flex items-center justify-center", className)}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        {...getHoverProps()}
        {...getTapProps()}
        {...props}
      >
        {children}
      </motion.div>
    )
  },
)
AnimateIcon.displayName = "AnimateIcon"

export { AnimateIcon }
