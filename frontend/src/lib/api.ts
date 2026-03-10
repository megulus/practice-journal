import type {
  BlockType,
  Instrument,
  UserInstrument,
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
  Suggestion,
  SuggestionsProgressResponse,
  SuggestionAction,
  UserSettings,
  UserSettingsUpdate,
  SuggestionInteractionCreate,
} from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Factory function to create API client with auth token
function createFetchAPI(getToken?: () => Promise<string | null>) {
  async function fetchAPI(endpoint: string, options?: RequestInit): Promise<void>
  async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T>
  async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T | void> {
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
      return
    }

    return response.json()
  }
  return fetchAPI
}

// Create authenticated API client (to be used in components with useAuth)
export function createAuthenticatedAPI(getToken: () => Promise<string | null>) {
  const authFetchAPI = createFetchAPI(getToken)
  
  return {
    // User Instruments (user's instrument selections)
    getUserInstruments: () =>
      authFetchAPI<UserInstrument[]>('/api/user/instruments/'),

    // Combined endpoint - gets user instruments AND available in one call (faster)
    getUserInstrumentsWithAvailable: () =>
      authFetchAPI<{ user_instruments: UserInstrument[]; available_instruments: Instrument[] }>(
        '/api/user/instruments/with-available'
      ),

    addUserInstrument: (instrumentId: number) =>
      authFetchAPI<UserInstrument>('/api/user/instruments/', {
        method: 'POST',
        body: JSON.stringify({ instrument_id: instrumentId }),
      }),

    removeUserInstrument: (id: number, confirm = false) =>
      authFetchAPI<{ status: string; deleted_templates: number }>(
        `/api/user/instruments/${id}${confirm ? '?confirm=true' : ''}`,
        { method: 'DELETE' }
      ),

    updateUserInstrument: (id: number, data: { display_order?: number }) =>
      authFetchAPI<UserInstrument>(`/api/user/instruments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    // Available Instruments (system + shareable)
    getAvailableInstruments: () =>
      authFetchAPI<Instrument[]>('/api/instruments/available'),

    getInstrument: (id: number) =>
      authFetchAPI<Instrument>(`/api/instruments/${id}`),

    // Block Types
    getBlockTypes: () =>
      authFetchAPI<BlockType[]>('/api/block-types/'),

    // Templates
    getTemplates: (userInstrumentId?: number, includeArchived?: boolean) => {
      const params = new URLSearchParams()
      if (userInstrumentId) params.set('user_instrument_id', String(userInstrumentId))
      if (includeArchived) params.set('include_archived', 'true')
      const qs = params.toString()
      return authFetchAPI<PracticeTemplate[]>(`/api/templates/${qs ? `?${qs}` : ''}`)
    },

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

    // Section types (for freeform section name suggestions)
    getSectionTypes: () =>
      authFetchAPI<string[]>('/api/logs/section-types'),

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

    // Suggestions
    getSessionSuggestions: (instrumentId?: number) =>
      authFetchAPI<Suggestion[]>(
        `/api/suggestions/${instrumentId ? `?instrument_id=${instrumentId}` : ''}`
      ),

    getSuggestionsProgress: (instrumentId?: number) =>
      authFetchAPI<SuggestionsProgressResponse>(
        `/api/suggestions/progress${instrumentId ? `?instrument_id=${instrumentId}` : ''}`
      ),

    dismissSuggestion: (suggestionKey: string) =>
      authFetchAPI<{ status: string; suggestion_key: string }>(
        `/api/suggestions/dismiss/${suggestionKey}`,
        { method: 'POST' }
      ),

    acceptSuggestion: (suggestionKey: string, action: SuggestionAction) =>
      authFetchAPI<{ status: string; suggestion_key: string; exercise: Exercise }>(
        `/api/suggestions/accept/${suggestionKey}`,
        {
          method: 'POST',
          body: JSON.stringify(action),
        }
      ),

    recordInteraction: (data: SuggestionInteractionCreate) =>
      authFetchAPI<void>('/api/suggestions/interactions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Settings
    getSettings: () =>
      authFetchAPI<UserSettings>('/api/settings/'),

    updateSettings: (data: UserSettingsUpdate) =>
      authFetchAPI<UserSettings>('/api/settings/', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  }
}
