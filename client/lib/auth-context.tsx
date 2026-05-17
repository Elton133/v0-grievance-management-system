"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { authApi, removeToken, getToken } from "./api"
import { toast } from "sonner"

// Role is now a dynamic string key from TenantSettings
export type UserRole = string

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  submitterId?: string
  group?: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (data: {
    name: string
    email: string
    password: string
    role?: string
    submitterId?: string
    group?: string
  }) => Promise<{ success: boolean; error?: string; warning?: string }>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Inactivity timeout (e.g. 4 hours)
  const INACTIVITY_LIMIT_MS = 4 * 60 * 60 * 1000

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoading(false)
      return
    }

    let cleanupInactivity: (() => void) | undefined
    let cancelled = false

    const init = async () => {
      const storedUser = localStorage.getItem("grievance_user")
      const token = getToken()

      const clearStaleSession = () => {
        localStorage.removeItem("grievance_user")
        localStorage.removeItem("grievance_last_activity")
        removeToken()
        setUser(null)
      }

      if (!storedUser || !token) {
        if (storedUser && !token) {
          localStorage.removeItem("grievance_user")
        }
        localStorage.removeItem("grievance_last_activity")
        setIsLoading(false)
        return
      }

      const updateLastActivity = () => {
        localStorage.setItem("grievance_last_activity", Date.now().toString())
      }

      let parsedUser: User
      try {
        parsedUser = JSON.parse(storedUser) as User
      } catch {
        console.error("Failed to parse stored user")
        clearStaleSession()
        if (!cancelled) setIsLoading(false)
        return
      }

      const now = Date.now()
      const lastActivityRaw = localStorage.getItem("grievance_last_activity")
      const lastActivity = lastActivityRaw ? parseInt(lastActivityRaw, 10) : now

      if (now - lastActivity > INACTIVITY_LIMIT_MS) {
        clearStaleSession()
        window.location.href = "/login"
        if (!cancelled) setIsLoading(false)
        return
      }

      updateLastActivity()

      const remaining = Math.max(0, INACTIVITY_LIMIT_MS - (now - lastActivity))
      const timeoutId = window.setTimeout(() => {
        localStorage.removeItem("grievance_user")
        localStorage.removeItem("grievance_last_activity")
        removeToken()
        window.location.href = "/login"
      }, remaining)

      window.addEventListener("click", updateLastActivity)
      window.addEventListener("keydown", updateLastActivity)

      cleanupInactivity = () => {
        window.clearTimeout(timeoutId)
        window.removeEventListener("click", updateLastActivity)
        window.removeEventListener("keydown", updateLastActivity)
      }

      try {
        const { user: u } = await authApi.me()
        if (cancelled) return
        const userData: User = {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role as UserRole,
          submitterId: u.submitterId ?? undefined,
          group: u.group ?? undefined,
        }
        setUser(userData)
        localStorage.setItem("grievance_user", JSON.stringify(userData))
      } catch (e: unknown) {
        if (cancelled) return
        const status =
          typeof e === "object" && e !== null && "status" in e
            ? (e as { status: number }).status
            : undefined
        if (status === 401) {
          cleanupInactivity()
          cleanupInactivity = undefined
          clearStaleSession()
        } else {
          setUser(parsedUser)
        }
      }

      if (!cancelled) setIsLoading(false)
    }

    void init()

    return () => {
      cancelled = true
      cleanupInactivity?.()
    }
  }, [])

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    try {
      const response = await authApi.login(email, password)
      
      // Map backend user to frontend User type
      const userData: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role as UserRole,
        submitterId: response.user.submitterId,
        group: response.user.group,
      }

      setUser(userData)
      if (typeof window !== "undefined") {
        localStorage.setItem("grievance_user", JSON.stringify(userData))
        localStorage.setItem("grievance_last_activity", Date.now().toString())
      }
      setIsLoading(false)
      return { success: true }
    } catch (error) {
      setIsLoading(false)
      const errorMessage =
        error instanceof Error ? error.message : "Login failed. Please try again."
      return { success: false, error: errorMessage }
    }
  }

  const register = async (data: {
    name: string
    email: string
    password: string
    role?: string
    submitterId?: string
    group?: string
  }): Promise<{ success: boolean; error?: string; warning?: string }> => {
    setIsLoading(true)
    try {
      const response = await authApi.register(data)

      setIsLoading(false)
      return { success: true, warning: response.warning }
    } catch (error) {
      setIsLoading(false)
      const errorMessage =
        error instanceof Error ? error.message : "Registration failed. Please try again."
      return { success: false, error: errorMessage }
    }
  }

  const logout = () => {
    setIsLoading(true)
    setUser(null)
    removeToken()
    if (typeof window !== "undefined") {
      localStorage.removeItem("grievance_user")
      localStorage.removeItem("grievance_last_activity")
      // Redirect to login page
      window.location.href = "/login"
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
