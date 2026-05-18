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
        const error = await response.json() as {
          error?: string;
          msg?: string;
          errors?: Array<{ message?: string }>;
        };
        if (Array.isArray(error.errors) && error.errors.length > 0) {
          const messages = error.errors.map((e) => e.message).filter(Boolean) as string[];
          if (messages.length > 0) {
            throw new Error(messages.join("; "));
          }
        }
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
    return apiRequest<{
      msg: string;
      user: unknown;
      warning?: string;
      verificationEmailSent?: boolean;
    }>("/auth/register", {
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

  /** Session restore; throws `{ status: 401 }` when token is missing or invalid. */
  me: async () => {
    const token = getToken();
    if (!token) {
      throw Object.assign(new Error("No token"), { status: 401 });
    }
    const url = `${API_BASE_URL}/auth/me`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.status === 401) {
      throw Object.assign(new Error("Unauthorized"), { status: 401 });
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP error ${res.status}`);
    }
    return res.json() as Promise<{
      user: {
        id: string;
        email: string;
        name: string;
        role: string;
        submitterId?: string | null;
        group?: string | null;
        emailVerified?: boolean;
      };
    }>;
  },

  verifyEmail: async (token: string) => {
    return apiRequest<{ msg: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  resendVerification: async (email: string) => {
    return apiRequest<{ msg: string }>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
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

// Audit logs (staff / analytics)
export const auditApi = {
  getLogs: async (page = 1, limit = 100) => {
    return apiRequest<{
      data: Array<{
        id: string;
        timestamp: string;
        userId: string;
        userRole: string;
        action: string;
        ticketId?: string;
        details: string;
        ipAddress?: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }>(`/audit-logs?page=${page}&limit=${limit}`);
  },
};

// Developer API
export const developerApi = {
  getKeys: async () => apiRequest<any[]>("/settings/keys"),
  createKey: async (name: string) =>
    apiRequest<any>("/settings/keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  revokeKey: async (id: string) =>
    apiRequest<any>(`/settings/keys/${id}`, { method: "DELETE" }),
  getWebhooks: async () => apiRequest<any[]>("/settings/webhooks"),
  createWebhook: async (data: { url: string; events: string[] }) =>
    apiRequest<any>("/settings/webhooks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteWebhook: async (id: string) =>
    apiRequest<any>(`/settings/webhooks/${id}`, { method: "DELETE" }),
};

