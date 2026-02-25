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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
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
    if (response.status === 204) {
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
    submitterId?: string;
    group?: string;
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

// Ticket API
export const ticketApi = {
  // Create a new ticket
  create: async (data: {
    subject: string;
    description: string;
    type: string;
    group?: string;
    year?: string;
    priority?: string;
  }) => {
    return apiRequest<any>("/tickets", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Get all tickets (with pagination)
  getAll: async (page: number = 1, limit: number = 20) => {
    return apiRequest<{
      data: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }>(`/tickets?page=${page}&limit=${limit}`);
  },

  // Get user's tickets (with pagination)
  getMyTickets: async (page: number = 1, limit: number = 20) => {
    return apiRequest<{
      data: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }>(`/tickets/my?page=${page}&limit=${limit}`);
  },

  // Get ticket by ID
  getById: async (id: string) => {
    return apiRequest<any>(`/tickets/${id}`);
  },

  // Update ticket status
  updateStatus: async (id: string, status: string, comment?: string) => {
    return apiRequest<any>(`/tickets/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, comment }),
    });
  },

  // Add comment to ticket
  addComment: async (id: string, content: string, isInternal?: boolean) => {
    return apiRequest<any>(`/tickets/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ content, isInternal }),
    });
  },

  // Update ticket details (submitters only, submitted status only)
  update: async (
    id: string,
    data: {
      subject?: string;
      description?: string;
      type?: string;
      priority?: string;
      year?: string;
      group?: string;
    }
  ) => {
    return apiRequest<any>(`/tickets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Delete ticket (submitters only, submitted status only)
  delete: async (id: string) => {
    return apiRequest<{ message: string }>(`/tickets/${id}`, {
      method: "DELETE",
    });
  },

  // Add attachment to ticket
  addAttachment: async (
    ticketId: string,
    data: {
      fileName: string;
      fileUrl: string;
      fileSize?: number;
      mimeType?: string;
    }
  ) => {
    return apiRequest<any>(`/tickets/${ticketId}/attachments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Delete attachment from ticket
  deleteAttachment: async (ticketId: string, attachmentId: string) => {
    return apiRequest<{ message: string }>(
      `/tickets/${ticketId}/attachments/${attachmentId}`,
      {
        method: "DELETE",
      }
    );
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

// Settings API (Tenant CMS Configuration)
export const settingsApi = {
  get: async () => {
    return apiRequest<any>("/settings");
  },

  update: async (data: Record<string, any>) => {
    return apiRequest<any>("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  reset: async () => {
    return apiRequest<any>("/settings/reset", {
      method: "POST",
    });
  },
};

