"use client"

import Lottie from "lottie-react"
import animationData from "@/public/animations/animation.json"

interface AppLoaderProps {
  message?: string
  size?: number
}

export function AppLoader({ message = "Loading...", size = 160 }: AppLoaderProps) {
  return (
    <div className="min-h-[200px] flex flex-col items-center justify-center">
      <div className="flex items-center justify-center">
        <Lottie
          animationData={animationData}
          loop
          autoplay
          style={{ width: size, height: size }}
        />
      </div>
      {message && (
        <p className="mt-2 text-sm text-muted-foreground text-center px-4">
          {message}
        </p>
      )}
    </div>
  )
}


