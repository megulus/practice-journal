import type {
  BlockType,
  Instrument,
  PracticeTemplate,
  PracticeDay,
  PracticeLog,
  PracticeLogCreate,
  AnalyticsSummary,
} from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Factory function to create API client with auth token
function createFetchAPI(getToken?: () => Promise<string | null>) {
  return async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Add any existing headers from options
    if (options?.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers[key] = value
        }
      })
    }

    // Add Authorization header if we have a token getter
    if (getToken) {
      try {
        const token = await getToken()
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
      } catch (error) {
        console.warn('Failed to get auth token:', error)
      }
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    return response.json()
  }
}

// Create authenticated API client (to be used in components with useAuth)
export function createAuthenticatedAPI(getToken: () => Promise<string | null>) {
  const authFetchAPI = createFetchAPI(getToken)
  
  return {
    // Instruments
    getInstruments: () =>
      authFetchAPI<Instrument[]>('/api/instruments/'),

    getInstrument: (id: number) =>
      authFetchAPI<Instrument>(`/api/instruments/${id}`),

    copyInstrument: (id: number) =>
      authFetchAPI<Instrument>(`/api/instruments/${id}/copy`, { method: 'POST' }),

    // Block Types
    getBlockTypes: () =>
      authFetchAPI<BlockType[]>('/api/block-types/'),

    // Templates
    getTemplates: (instrumentId?: number) =>
      authFetchAPI<PracticeTemplate[]>(
        `/api/templates/${instrumentId ? `?instrument_id=${instrumentId}` : ''}`
      ),

    getTemplate: (id: number) =>
      authFetchAPI<PracticeTemplate>(`/api/templates/${id}`),

    copyTemplate: (id: number) =>
      authFetchAPI<PracticeTemplate>(`/api/templates/${id}/copy`, { method: 'POST' }),

    getPracticeDay: (templateId: number, dayNumber: number) =>
      authFetchAPI<PracticeDay>(`/api/templates/${templateId}/days/${dayNumber}`),

    // Logs
    createLog: (data: PracticeLogCreate) =>
      authFetchAPI<PracticeLog>('/api/logs/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getLogs: (templateId?: number, limit = 50) =>
      authFetchAPI<PracticeLog[]>(
        `/api/logs/${templateId ? `?template_id=${templateId}&limit=${limit}` : `?limit=${limit}`}`
      ),

    getLog: (id: number) =>
      authFetchAPI<PracticeLog>(`/api/logs/${id}`),

    // Analytics
    getAnalytics: (templateId?: number) =>
      authFetchAPI<AnalyticsSummary>(
        `/api/analytics/${templateId ? `?template_id=${templateId}` : ''}`
      ),
  }
}
