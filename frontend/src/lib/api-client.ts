/**
 * API Client - Type-safe API wrapper
 * Enterprise-grade HTTP client with automatic retry, error handling, and type safety
 */

import type {
  Infrastructure,
  MapDataResponse,
  StatisticsResponse,
  TimeSeriesResponse,
  Job,
  JobSchedule,
  ApiError,
} from '@/types/api';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

interface RequestOptions extends RequestInit {
  token?: string;
  params?: Record<string, string | number | boolean | undefined>;
}

class HttpClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Execute HTTP request with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { token, params, ...fetchOptions } = options;

    const url = this.buildUrl(endpoint, params);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      // Handle non-JSON responses (like CSV exports)
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/json')) {
        if (!response.ok) {
          throw new ApiClientError(
            'Request failed',
            response.status,
            await response.text()
          );
        }
        return response as any; // Return raw response for non-JSON
      }

      const data = await response.json();

      if (!response.ok) {
        const error = data as ApiError;
        throw new ApiClientError(
          error.error || error.message || 'Request failed',
          response.status,
          data
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }

      // Network error or other issues
      throw new ApiClientError(
        error instanceof Error ? error.message : 'Network error',
        undefined,
        error
      );
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    body?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(
    endpoint: string,
    body?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// ============================================================================
// API CLIENT
// ============================================================================

export class ApiClient {
  private http: HttpClient;

  constructor(baseUrl: string = API_BASE_URL) {
    this.http = new HttpClient(baseUrl);
  }

  // ==========================================================================
  // INFRASTRUCTURES
  // ==========================================================================

  async getInfrastructures(token: string): Promise<{ infrastructures: Infrastructure[] }> {
    return this.http.get('/infrastructures', { token });
  }

  async getInfrastructure(id: string, token: string): Promise<Infrastructure> {
    return this.http.get(`/infrastructures/${id}`, { token });
  }

  async getMapData(infrastructureId: string, token: string, limit?: number): Promise<MapDataResponse> {
    const url = limit 
      ? `/infrastructures/${infrastructureId}/map-data?limit=${limit}`
      : `/infrastructures/${infrastructureId}/map-data?limit=10000`; // Default limit to prevent loading too many points
    return this.http.get(url, { token });
  }

  async getStatistics(infrastructureId: string, token: string): Promise<StatisticsResponse> {
    return this.http.get(`/infrastructures/${infrastructureId}/statistics`, { token });
  }

  // ==========================================================================
  // DEFORMATIONS
  // ==========================================================================

  async getTimeSeries(pointId: string, token: string): Promise<TimeSeriesResponse> {
    return this.http.get(`/deformations/time-series/${pointId}`, { token });
  }

  async exportDeformations(
    params: {
      infrastructureId: string;
      format: 'csv' | 'geojson' | 'json';
      startDate?: string;
      endDate?: string;
      pointIds?: string;
      includeMetadata?: boolean;
    },
    token: string
  ): Promise<Response> {
    return this.http.get('/deformations/export', { token, params });
  }

  // ==========================================================================
  // JOBS
  // ==========================================================================

  async getJobs(token: string): Promise<{ jobs: Job[] }> {
    return this.http.get('/jobs', { token });
  }

  async getJob(id: string, token: string): Promise<Job> {
    return this.http.get(`/jobs/${id}`, { token });
  }

  async createInsarJob(
    infrastructureId: string,
    options: {
      looks?: string;
      includeDEM?: boolean;
      includeIncMap?: boolean;
      includeLosDisplacement?: boolean;
    },
    token: string
  ): Promise<{ message: string; job: Job }> {
    return this.http.post('/jobs/process-insar', { infrastructureId, ...options }, { token });
  }

  async retryJob(id: string, token: string): Promise<{ message: string; job: Job }> {
    return this.http.post(`/jobs/${id}/retry`, undefined, { token });
  }

  // ==========================================================================
  // SCHEDULES
  // ==========================================================================

  async getSchedules(token: string): Promise<{ schedules: JobSchedule[]; count: number }> {
    return this.http.get('/schedules', { token });
  }

  async getInfrastructureSchedules(
    infrastructureId: string,
    token: string
  ): Promise<{ schedules: JobSchedule[]; count: number }> {
    return this.http.get(`/schedules/infrastructure/${infrastructureId}`, { token });
  }

  async createSchedule(
    data: {
      infrastructureId: string;
      name: string;
      frequencyDays: number;
      options?: Record<string, any>;
    },
    token: string
  ): Promise<{ message: string; schedule: JobSchedule }> {
    return this.http.post('/schedules', data, { token });
  }

  async updateSchedule(
    id: string,
    data: Partial<Pick<JobSchedule, 'name' | 'frequency_days' | 'is_active' | 'options'>>,
    token: string
  ): Promise<{ message: string; schedule: JobSchedule }> {
    return this.http.patch(`/schedules/${id}`, data, { token });
  }

  async deleteSchedule(id: string, token: string): Promise<{ message: string }> {
    return this.http.delete(`/schedules/${id}`, { token });
  }

  async pauseSchedule(id: string, token: string): Promise<{ message: string }> {
    return this.http.post(`/schedules/${id}/pause`, undefined, { token });
  }

  async resumeSchedule(id: string, token: string): Promise<{ message: string }> {
    return this.http.post(`/schedules/${id}/resume`, undefined, { token });
  }

  // ==========================================================================
  // VELOCITY
  // ==========================================================================

  async calculateVelocity(
    infrastructureId: string,
    token: string
  ): Promise<{ message: string; results: any }> {
    return this.http.post(`/velocity/calculate/${infrastructureId}`, undefined, { token });
  }

  async getPointVelocity(pointId: string, token: string): Promise<any> {
    return this.http.get(`/velocity/point/${pointId}`, { token });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const apiClient = new ApiClient();
