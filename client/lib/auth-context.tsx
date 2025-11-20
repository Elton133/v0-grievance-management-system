"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

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
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Mock users for demonstration
const mockUsers: User[] = [
  {
    id: "1",
    email: "student@university.edu",
    name: "John Doe",
    role: "student",
    studentId: "ST2024001",
    department: "Computer Science",
  },
  {
    id: "2",
    email: "advisor@university.edu",
    name: "Dr. Jane Smith",
    role: "class_advisor",
    department: "Computer Science",
  },
  {
    id: "3",
    email: "hod@university.edu",
    name: "Prof. Robert Johnson",
    role: "hod",
    department: "Computer Science",
  },
  {
    id: "4",
    email: "registrar@university.edu",
    name: "Ms. Sarah Wilson",
    role: "registrar",
  },
]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    // Check for stored user session
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem("grievance_user")
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser))
        } catch (error) {
          console.error("Failed to parse stored user:", error)
          localStorage.removeItem("grievance_user")
        }
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Mock authentication - in real app, this would be an API call
    const foundUser = mockUsers.find((u) => u.email === email)

    if (foundUser && password === "password123") {
      setUser(foundUser)
      if (typeof window !== 'undefined') {
        localStorage.setItem("grievance_user", JSON.stringify(foundUser))
      }
      setIsLoading(false)
      return true
    }

    setIsLoading(false)
    return false
  }

  const logout = () => {
    setUser(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem("grievance_user")
    }
  }

  return <AuthContext.Provider value={{ user, login, logout, isLoading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
