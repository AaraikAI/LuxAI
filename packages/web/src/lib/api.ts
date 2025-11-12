import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '@/stores/authStore';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        if (error.response?.status === 401) {
          useAuthStore.getState().logout();
        }
        return Promise.reject(error.response?.data?.error || error);
      }
    );
  }

  // Auth endpoints
  auth = {
    register: (data: any) => this.client.post('/auth/register', data),
    login: (data: any) => this.client.post('/auth/login', data),
    verify: (token: string) => this.client.post('/auth/verify', { token }),
  };

  // Itinerary endpoints
  itineraries = {
    generate: (data: any) => this.client.post('/itineraries/generate', data),
    list: () => this.client.get('/itineraries'),
    get: (id: string) => this.client.get(`/itineraries/${id}`),
    updateStatus: (id: string, status: string) =>
      this.client.patch(`/itineraries/${id}/status`, { status }),
  };

  // Health check
  health = () => this.client.get('/health');
}

export const api = new ApiClient();
