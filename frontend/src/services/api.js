import axios from 'axios';

// API base URL: accept absolute http(s) URLs or relative paths from env, otherwise fallback.
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
const fallbackApiBaseUrl = `http://${window.location.hostname || 'localhost'}:8000/api`;
const API_BASE_URL = configuredApiBaseUrl
  ? configuredApiBaseUrl.replace(/\/+$/, '')
  : fallbackApiBaseUrl;

const LOCALHOST_API_BASE_URL = 'http://localhost:8000/api';
const LOOPBACK_API_BASE_URL = 'http://127.0.0.1:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Recover from local dev networking edge cases where localhost fails.
    if (
      error.code === 'ERR_NETWORK' &&
      originalRequest &&
      !originalRequest._networkRetry
    ) {
      originalRequest._networkRetry = true;

      if ((originalRequest.baseURL || API_BASE_URL).includes('localhost:8000')) {
        originalRequest.baseURL = LOOPBACK_API_BASE_URL;
      } else if ((originalRequest.baseURL || API_BASE_URL).includes('127.0.0.1:8000')) {
        originalRequest.baseURL = LOCALHOST_API_BASE_URL;
      }

      return api(originalRequest);
    }

    // If 401 error and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Try to refresh the token
        const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        
        // Store new access token
        localStorage.setItem('access_token', access);

        // Retry the original request with new token
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API functions
export const authAPI = {
  // Register new user
  register: async (userData) => {
    const response = await api.post('/auth/register/', userData);
    
    // Store tokens
    if (response.data.tokens) {
      localStorage.setItem('access_token', response.data.tokens.access);
      localStorage.setItem('refresh_token', response.data.tokens.refresh);
    }
    
    return response.data;
  },

  // Login user
  login: async (username, password) => {
    const response = await api.post('/auth/token/', { username, password });
    
    // Store tokens
    localStorage.setItem('access_token', response.data.access);
    localStorage.setItem('refresh_token', response.data.refresh);
    
    return response.data;
  },

  // Logout user
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('access_token');
  },

  // Change password for current user
  changePassword: async (currentPassword, newPassword, confirmPassword) => {
    // Validate inputs
    if (!newPassword) {
      throw new Error('New password is required');
    }
    if (newPassword !== confirmPassword) {
      throw new Error('Passwords do not match');
    }
    
    // Use the /users/me/ endpoint to update password
    const response = await api.patch('/users/me/', {
      password: newPassword,
    });
    
    return response.data;
  },
};

// User API functions
export const userAPI = {
  // Get current user
  getCurrentUser: async () => {
    const response = await api.get('/users/me/');
    if (response.data?.role) {
      localStorage.setItem('user_role', response.data.role);
    }
    return response.data;
  },

  // Update current user's profile (self-update)
  updateProfile: async (userData) => {
    const response = await api.patch('/users/me/', userData);
    return response.data;
  },

  // Get all users (admin only)
  getAllUsers: async (params = {}) => {
    const response = await api.get('/users/', { params });
    return response.data;
  },

  // Create new user (admin only)
  createUser: async (userData) => {
    const response = await api.post('/users/', userData);
    return response.data;
  },

  // Get user by ID
  getUserById: async (id) => {
    const response = await api.get(`/users/${id}/`);
    return response.data;
  },

  // Update user
  updateUser: async (id, userData) => {
    const response = await api.patch(`/users/${id}/`, userData);
    return response.data;
  },

  // Delete user
  deleteUser: async (id) => {
    const response = await api.delete(`/users/${id}/`);
    return response.data;
  },

  // Verify user (admin only)
  verifyUser: async (id) => {
    const response = await api.post(`/users/${id}/verify/`);
    return response.data;
  },

  // Unverify user (admin only)
  unverifyUser: async (id) => {
    const response = await api.post(`/users/${id}/unverify/`);
    return response.data;
  },

  // Activate user (admin only)
  activateUser: async (id) => {
    const response = await api.post(`/users/${id}/activate/`);
    return response.data;
  },

  // Deactivate user (admin only)
  deactivateUser: async (id) => {
    const response = await api.post(`/users/${id}/deactivate/`);
    return response.data;
  },
};

// Patient API functions
export const patientAPI = {
  // Create a patient with CBC report and blood smear images
  createPatient: async (formData) => {
    const response = await api.post('/patients/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  // Get all patients
  getPatients: async (params = {}) => {
    const response = await api.get('/patients/', { params });
    return response.data?.results || response.data;
  },

  // Get single patient details
  getPatientById: async (id) => {
    const response = await api.get(`/patients/${id}/`);
    return response.data;
  },

  // Update single patient details
  updatePatient: async (id, patientData) => {
    const response = await api.patch(`/patients/${id}/`, patientData);
    return response.data;
  },

  // Delete single patient
  deletePatient: async (id) => {
    const response = await api.delete(`/patients/${id}/`);
    return response.data;
  },

  // Update patient status
  updatePatientStatus: async (id, status) => {
    const response = await api.patch(`/patients/${id}/status/`, { status });
    return response.data;
  },

  // Get feedback entries for a patient (latest first)
  getPatientFeedback: async (id) => {
    const response = await api.get(`/patients/${id}/feedback/`);
    return response.data?.results || response.data;
  },

  // Create feedback entry for a patient
  createPatientFeedback: async (id, payload) => {
    const response = await api.post(`/patients/${id}/feedback/`, payload);
    return response.data;
  },

  // Extract CBC parameters from uploaded report
  extractCBC: async (id) => {
    const response = await api.get(`/patients/${id}/extract-cbc/`);
    return response.data;
  },

  // Run CBC diagnosis for a patient
  diagnosePatient: async (id, cbcParams) => {
    const response = await api.post(`/patients/${id}/diagnose/`, cbcParams);
    return response.data;
  },

  // Get existing diagnosis result for a patient
  getDiagnosisResult: async (id) => {
    const response = await api.get(`/patients/${id}/diagnose/`);
    return response.data;
  },

  // Get ML model availability status
  getMLModelStatus: async () => {
    const response = await api.get('/ml-models/status/');
    return response.data;
  },
};

export default api;
