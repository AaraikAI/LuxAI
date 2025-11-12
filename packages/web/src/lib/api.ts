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

  // KYC endpoints
  kyc = {
    initiate: (data: any) => this.client.post('/kyc/initiate', data),
    checkStatus: (data: any) => this.client.post('/kyc/status', data),
    uploadDocument: (data: any) => this.client.post('/kyc/document', data),
    getMyStatus: () => this.client.get('/kyc/me'),
  };

  // Aviation endpoints
  aviation = {
    getProvider: () => this.client.get('/aviation/provider'),
    submitRFQ: (data: any) => this.client.post('/aviation/rfq', data),
    getQuote: (rfqId: string) => this.client.get(`/aviation/quote/${rfqId}`),
    searchEmptyLegs: (params: any) => this.client.post('/aviation/empty-legs/search', params),
    getAircraft: () => this.client.get('/aviation/aircraft'),
    bookFlight: (quoteId: string) => this.client.post('/aviation/book', { quoteId }),
    calculateCarbon: (data: any) => this.client.post('/aviation/carbon-calculator', data),
  };

  // Approval endpoints
  approvals = {
    create: (data: any) => this.client.post('/approvals', data),
    getPending: () => this.client.get('/approvals/pending'),
    getHistory: (itineraryId: string) => this.client.get(`/approvals/itinerary/${itineraryId}`),
    processDecision: (approvalId: string, decision: any) =>
      this.client.post(`/approvals/${approvalId}/decision`, decision),
    checkBudget: (itineraryId: string, budgetCap?: number) =>
      this.client.get(`/approvals/budget-check/${itineraryId}`, {
        params: budgetCap ? { budgetCap } : undefined,
      }),
    initiateWorkflow: (data: any) => this.client.post('/approvals/workflow/initiate', data),
  };

  // Vendor endpoints
  vendors = {
    onboard: (data: any) => this.client.post('/vendors/onboard', data),
    getProfile: () => this.client.get('/vendors/profile'),
    createDeal: (data: any) => this.client.post('/vendors/deals', data),
    getDeals: () => this.client.get('/vendors/deals'),
    getAnalytics: () => this.client.get('/vendors/analytics'),
    searchVault: (filters: any) => this.client.get('/vendors/vault/search', { params: filters }),
  };

  // Payment endpoints
  payments = {
    createIntent: (data: any) => this.client.post('/payments/intent', data),
    confirmPayment: (id: string) => this.client.post(`/payments/intent/${id}/confirm`),
    releaseEscrow: (id: string) => this.client.post(`/payments/escrow/${id}/release`),
    refund: (id: string, data: any) => this.client.post(`/payments/refund/${id}`, data),
    getHistory: () => this.client.get('/payments/history'),
  };

  // Sustainability endpoints
  sustainability = {
    calculate: (data: any) => this.client.post('/sustainability/calculate', data),
    getReport: (itineraryId: string) => this.client.get(`/sustainability/report/${itineraryId}`),
    purchaseOffset: (data: any) => this.client.post('/sustainability/offset/purchase', data),
  };

  // Live Updates endpoints
  liveUpdates = {
    create: (data: any) => this.client.post('/live-updates', data),
    update: (id: string, data: any) => this.client.patch(`/live-updates/${id}`, data),
    end: (id: string) => this.client.delete(`/live-updates/${id}`),
    getByItinerary: (itineraryId: string) => this.client.get(`/live-updates/itinerary/${itineraryId}`),
  };

  // DocuSign endpoints
  docusign = {
    createEnvelope: (data: any) => this.client.post('/docusign/envelope', data),
    getStatus: (id: string) => this.client.get(`/docusign/envelope/${id}/status`),
    download: (id: string) => this.client.get(`/docusign/envelope/${id}/download`),
    voidEnvelope: (id: string, reason: string) => this.client.post(`/docusign/envelope/${id}/void`, { reason }),
  };

  // Health check
  health = () => this.client.get('/health');
}

export const api = new ApiClient();
