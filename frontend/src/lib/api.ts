import type {
  BlockType,
  Instrument,
  PracticeTemplate,
  PracticeDay,
  PracticeLog,
  PracticeLogCreate,
  AnalyticsSummary,
  TemplateCreate,
  TemplateUpdate,
  DayUpdate,
  BlockCreate,
  BlockUpdate,
  BlockReorder,
  ExerciseCreate,
  ExerciseUpdate,
  ExerciseBlock,
  Exercise,
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

    if (response.status === 204) {
      return undefined as T
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

    // Template CRUD
    createTemplate: (data: TemplateCreate) =>
      authFetchAPI<PracticeTemplate>('/api/templates/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateTemplate: (id: number, data: TemplateUpdate) =>
      authFetchAPI<PracticeTemplate>(`/api/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteTemplate: (id: number) =>
      authFetchAPI<void>(`/api/templates/${id}`, { method: 'DELETE' }),

    // Day CRUD
    updateDay: (templateId: number, dayNumber: number, data: DayUpdate) =>
      authFetchAPI<PracticeDay>(`/api/templates/${templateId}/days/${dayNumber}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    // Block CRUD
    createBlock: (templateId: number, dayNumber: number, data: BlockCreate) =>
      authFetchAPI<ExerciseBlock>(`/api/templates/${templateId}/days/${dayNumber}/blocks`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateBlock: (templateId: number, dayNumber: number, blockId: number, data: BlockUpdate) =>
      authFetchAPI<ExerciseBlock>(`/api/templates/${templateId}/days/${dayNumber}/blocks/${blockId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    reorderBlocks: (templateId: number, dayNumber: number, data: BlockReorder) =>
      authFetchAPI<void>(`/api/templates/${templateId}/days/${dayNumber}/blocks/reorder`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteBlock: (templateId: number, dayNumber: number, blockId: number) =>
      authFetchAPI<void>(`/api/templates/${templateId}/days/${dayNumber}/blocks/${blockId}`, {
        method: 'DELETE',
      }),

    // Exercise CRUD
    createExercise: (templateId: number, dayNumber: number, blockId: number, data: ExerciseCreate) =>
      authFetchAPI<Exercise>(`/api/templates/${templateId}/days/${dayNumber}/blocks/${blockId}/exercises`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateExercise: (templateId: number, dayNumber: number, blockId: number, exerciseId: number, data: ExerciseUpdate) =>
      authFetchAPI<Exercise>(`/api/templates/${templateId}/days/${dayNumber}/blocks/${blockId}/exercises/${exerciseId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteExercise: (templateId: number, dayNumber: number, blockId: number, exerciseId: number) =>
      authFetchAPI<void>(`/api/templates/${templateId}/days/${dayNumber}/blocks/${blockId}/exercises/${exerciseId}`, {
        method: 'DELETE',
      }),

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
