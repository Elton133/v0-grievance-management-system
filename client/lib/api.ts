/**
 * API Client for Backend Communication
 * Handles all HTTP requests to the backend server
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// Get auth token from localStorage
export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("grievance_token");
};

// Set auth token in localStorage
export const setToken = (token: string): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem("grievance_token", token);
  }
};

// Remove auth token from localStorage
export const removeToken = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("grievance_token");
  }
};

// Generic fetch wrapper with error handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle non-JSON responses
    const contentType = response.headers.get("content-type");
    const isJson = contentType?.includes("application/json");

    if (!response.ok) {
      if (isJson) {
        const error = await response.json();
        throw new Error(error.error || error.msg || `HTTP error! status: ${response.status}`);
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    // Handle empty responses
    if (response.status === 204 || response.contentLength === 0) {
      return {} as T;
    }

    return isJson ? await response.json() : ({} as T);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Network error: Could not connect to server");
  }
}

// Auth API
export const authApi = {
  register: async (data: {
    name: string;
    email: string;
    password: string;
    role?: string;
    studentId?: string;
    department?: string;
  }) => {
    return apiRequest<{ msg: string; user: any }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  login: async (email: string, password: string) => {
    const response = await apiRequest<{ token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    
    if (response.token) {
      setToken(response.token);
    }
    
    return response;
  },

  logout: () => {
    removeToken();
  },
};

// Petition API
export const petitionApi = {
  // Create a new petition
  create: async (data: {
    subject: string;
    description: string;
    type: string;
    department?: string;
    year?: string;
    priority?: string;
  }) => {
    return apiRequest<any>("/petitions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Get all petitions
  getAll: async () => {
    return apiRequest<any[]>("/petitions");
  },

  // Get user's petitions
  getMyPetitions: async () => {
    return apiRequest<any[]>("/petitions/my");
  },

  // Get petition by ID
  getById: async (id: string) => {
    return apiRequest<any>(`/petitions/${id}`);
  },

  // Update petition status
  updateStatus: async (id: string, status: string, comment?: string) => {
    return apiRequest<any>(`/petitions/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, comment }),
    });
  },

  // Add comment to petition
  addComment: async (id: string, content: string, isInternal?: boolean) => {
    return apiRequest<any>(`/petitions/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ content, isInternal }),
    });
  },

  // Update petition details (students only, submitted status only)
  update: async (
    id: string,
    data: {
      subject?: string;
      description?: string;
      type?: string;
      priority?: string;
      year?: string;
      department?: string;
    }
  ) => {
    return apiRequest<any>(`/petitions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Delete petition (students only, submitted status only)
  delete: async (id: string) => {
    return apiRequest<{ message: string }>(`/petitions/${id}`, {
      method: "DELETE",
    });
  },
};

// Health check
export const healthCheck = async () => {
  try {
    const response = await fetch(`${API_BASE_URL.replace("/api", "")}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

