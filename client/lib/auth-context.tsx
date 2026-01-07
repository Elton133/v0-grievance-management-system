"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { authApi, removeToken, getToken } from "./api"
import { toast } from "sonner"

export type UserRole = "student" | "class_advisor" | "hod" | "registrar"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  studentId?: string
  department?: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (data: {
    name: string
    email: string
    password: string
    role?: string
    studentId?: string
    department?: string
  }) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for stored user session and token
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("grievance_user")
      const token = getToken()
      
      if (storedUser && token) {
        try {
          const parsedUser = JSON.parse(storedUser)
          setUser(parsedUser)
        } catch (error) {
          console.error("Failed to parse stored user:", error)
          localStorage.removeItem("grievance_user")
          removeToken()
        }
      } else {
        // Clear invalid session
        if (storedUser && !token) {
          localStorage.removeItem("grievance_user")
        }
      }
    }
    setIsLoading(false)
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
        studentId: response.user.studentId,
        department: response.user.department,
      }

      setUser(userData)
      if (typeof window !== "undefined") {
        localStorage.setItem("grievance_user", JSON.stringify(userData))
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
    studentId?: string
    department?: string
  }): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    try {
      const response = await authApi.register(data)
      
      // Registration successful - user can now log in
      setIsLoading(false)
      return { success: true }
    } catch (error) {
      setIsLoading(false)
      const errorMessage =
        error instanceof Error ? error.message : "Registration failed. Please try again."
      return { success: false, error: errorMessage }
    }
  }

  const logout = () => {
    setUser(null)
    removeToken()
    if (typeof window !== "undefined") {
      localStorage.removeItem("grievance_user")
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
