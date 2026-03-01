const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://worktrace-backend.onrender.com/api'
    : 'http://localhost:5000/api');




// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Helper function to get headers
const getHeaders = (includeAuth = true) => {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
};

// API request helper
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    ...options,
    headers: {
      ...getHeaders(options.includeAuth !== false),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    
    // Handle network errors
    if (!response.ok) {
      let errorMessage = `Request failed (${response.status})`;
      try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          errorMessage = data.message || data.detail || errorMessage;
        } else {
          const rawText = await response.text();
          if (rawText && rawText.trim()) {
            errorMessage = rawText.trim().slice(0, 300);
          } else if (response.statusText) {
            errorMessage = response.statusText;
          }
        }
      } catch (e) {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      
      // Handle specific status codes
      if (response.status === 401) {
        if (!errorMessage || errorMessage === `Request failed (${response.status})`) {
          errorMessage = 'Unauthorized. Please login again.';
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } else if (response.status === 403) {
        if (!errorMessage || errorMessage === `Request failed (${response.status})`) {
          errorMessage = 'Access forbidden. You don\'t have permission.';
        }
      } else if (response.status === 404) {
        if (!errorMessage || errorMessage === `Request failed (${response.status})`) {
          errorMessage = 'Resource not found.';
        }
      } else if (response.status === 500) {
        if (!errorMessage || errorMessage === `Request failed (${response.status})`) {
          errorMessage = 'Server error. Please try again later.';
        }
      }
      
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return data;
    } else {
      return { message: 'Success' };
    }
  } catch (error) {
    // Handle network/fetch errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new Error(
        `Failed to connect to backend. Please ensure the backend server is running at ${API_BASE_URL}`
      );
      networkError.isNetworkError = true;
      throw networkError;
    }
    
    // Re-throw other errors
    console.error('API Error:', error);
    throw error;
  }
};

// Authentication APIs
export const authAPI = {
  login: async (email, password) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      includeAuth: false,
    });
  },

  logout: async () => {
    return apiRequest('/auth/logout', {
      method: 'POST',
    });
  },

  getCurrentUser: async () => {
    return apiRequest('/auth/me');
  },

  register: async (name, email, password) => {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
      includeAuth: false,
    });
  },
};

// Task APIs
export const taskAPI = {
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    const query = params.toString();
    return apiRequest(`/tasks${query ? `?${query}` : ''}`);
  },

  getById: async (id) => {
    return apiRequest(`/tasks/${id}`);
  },

  create: async (taskData) => {
    return apiRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  },

  update: async (id, taskData) => {
    return apiRequest(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData),
    });
  },

  delete: async (id) => {
    return apiRequest(`/tasks/${id}`, {
      method: 'DELETE',
    });
  },

  updateStatus: async (id, status) => {
    return apiRequest(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  getSubtasks: async (taskId) => {
    return apiRequest(`/tasks/${taskId}/subtasks`);
  },

  createSubtask: async (taskId, title) => {
    return apiRequest(`/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  updateSubtask: async (taskId, subtaskId, subtaskData) => {
    return apiRequest(`/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'PUT',
      body: JSON.stringify(subtaskData),
    });
  },

  deleteSubtask: async (taskId, subtaskId) => {
    return apiRequest(`/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'DELETE',
    });
  },
};

// Project APIs
export const projectAPI = {
  getAll: async () => {
    return apiRequest('/projects');
  },

  getById: async (id) => {
    return apiRequest(`/projects/${id}`);
  },

  create: async (projectData) => {
    return apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  },

  update: async (id, projectData) => {
    return apiRequest(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(projectData),
    });
  },

  delete: async (id) => {
    return apiRequest(`/projects/${id}`, {
      method: 'DELETE',
    });
  },

  getOverview: async () => {
    return apiRequest('/projects/overview');
  },
};

// Team APIs
export const teamAPI = {
  getMembers: async () => {
    return apiRequest('/team/members');
  },

  getMemberById: async (id) => {
    return apiRequest(`/team/members/${id}`);
  },

  getMemberTasks: async (id) => {
    return apiRequest(`/team/members/${id}/tasks`);
  },

  invite: async (inviteData) => {
    return apiRequest('/team/invite', {
      method: 'POST',
      body: JSON.stringify(inviteData),
    });
  },

  updateRole: async (id, role) => {
    return apiRequest(`/team/members/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  removeMember: async (id) => {
    return apiRequest(`/team/members/${id}`, {
      method: 'DELETE',
    });
  },
};

// Deadline APIs
export const deadlineAPI = {
  getAll: async () => {
    return apiRequest('/deadlines');
  },

  create: async (deadlineData) => {
    return apiRequest('/deadlines', {
      method: 'POST',
      body: JSON.stringify(deadlineData),
    });
  },

  update: async (id, deadlineData) => {
    return apiRequest(`/deadlines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(deadlineData),
    });
  },

  delete: async (id) => {
    return apiRequest(`/deadlines/${id}`, {
      method: 'DELETE',
    });
  },
};

// Analytics APIs
export const analyticsAPI = {
  getTaskCompletionRate: async () => {
    return apiRequest('/analytics/task-completion');
  },

  getProductivityScore: async () => {
    return apiRequest('/analytics/productivity');
  },
};

// Reports APIs
export const reportsAPI = {
  getSummary: async () => {
    return apiRequest('/reports/summary');
  },
  getTaskCompletion: async (weeks = 8) => {
    return apiRequest(`/reports/task-completion?weeks=${weeks}`);
  },
  getProductivity: async (period = 'month') => {
    return apiRequest(`/reports/productivity?period=${period}`);
  },
  getProductivityTrends: async (period = 'week', points = 12) => {
    return apiRequest(`/reports/productivity-trends?period=${period}&points=${points}`);
  },
  getProjectPerformance: async () => {
    return apiRequest('/reports/project-performance');
  },
  getByPriority: async () => {
    return apiRequest('/reports/by-priority');
  },
  getByStatus: async () => {
    return apiRequest('/reports/by-status');
  },
};

// Sprints APIs
export const sprintsAPI = {
  getAll: async () => {
    return apiRequest('/sprints');
  },
  getById: async (id) => {
    return apiRequest(`/sprints/${id}`);
  },
  create: async (sprintData) => {
    return apiRequest('/sprints', {
      method: 'POST',
      body: JSON.stringify(sprintData),
    });
  },
  update: async (id, sprintData) => {
    return apiRequest(`/sprints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(sprintData),
    });
  },
  delete: async (id) => {
    return apiRequest(`/sprints/${id}`, {
      method: 'DELETE',
    });
  },
  getTasks: async (id) => {
    return apiRequest(`/sprints/${id}/tasks`);
  },
  getBacklog: async (projectId) => {
    const query = projectId ? `?project_id=${projectId}` : '';
    return apiRequest(`/sprints/tasks/backlog${query}`);
  },
  addTasks: async (id, taskIds) => {
    return apiRequest(`/sprints/${id}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    });
  },
  removeTask: async (id, taskId) => {
    return apiRequest(`/sprints/${id}/tasks/${taskId}`, {
      method: 'DELETE',
    });
  },
};

// Settings APIs (user info for settings page)
export const settingsAPI = {
  getUser: async () => {
    return apiRequest('/settings/user');
  },
  updateUser: async (userData) => {
    return apiRequest('/settings/user', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },
  updatePreferences: async (prefs) => {
    return apiRequest('/settings/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  },
  updateWorkspace: async (workspace) => {
    return apiRequest('/settings/workspace', {
      method: 'PUT',
      body: JSON.stringify(workspace),
    });
  },
  uploadAvatar: async (file) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/settings/avatar/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = 'Failed to upload avatar.';
      try {
        const data = await response.json();
        errorMessage = data.message || data.detail || errorMessage;
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    return response.json();
  },
  getIntegrations: async () => {
    return apiRequest('/settings/integrations');
  },
  changePassword: async (password, newPassword) => {
    return apiRequest('/settings/password', {
      method: 'PUT',
      body: JSON.stringify({ password, new_password: newPassword }),
    });
  },
  deleteAccount: async (password) => {
    return apiRequest('/settings/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
  },
};

// Chatbot APIs
export const chatbotAPI = {
  chat: async (message) => {
    return apiRequest('/chatbot/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },
};

const apiServices = {
  authAPI,
  taskAPI,
  projectAPI,
  teamAPI,
  deadlineAPI,
  analyticsAPI,
  reportsAPI,
  sprintsAPI,
  settingsAPI,
  chatbotAPI,
};

export default apiServices;
