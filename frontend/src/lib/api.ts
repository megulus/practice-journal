/**
 * Kantelo API client.
 *
 * Wraps fetch with Bearer token injection from Clerk and provides typed
 * methods for every endpoint. See docs/kantelo-schema-api.md for the
 * canonical API spec.
 */
import type {
  // User & Settings
  User,
  UserSettings,
  UserSettingsUpdate,
  // Instruments
  Instrument,
  InstrumentCreate,
  InstrumentUpdate,
  // Pieces & Spots
  Piece,
  PieceDetail,
  PieceCreate,
  PieceUpdate,
  Spot,
  SpotCreate,
  SpotUpdate,
  SpotHistory,
  // Templates / Sessions / Sections / Blocks
  Template,
  TemplateListItem,
  TemplateCreate,
  TemplateUpdate,
  TemplateSession,
  TemplateSessionCreate,
  TemplateSessionUpdate,
  Section,
  SectionCreate,
  SectionUpdate,
  Block,
  BlockCreate,
  BlockUpdate,
  ReorderRequest,
  DuplicateRequest,
  DefaultSpotAdd,
  DefaultSpotReorder,
  // Practice
  PracticeLog,
  PracticeStartRequest,
  PracticeLogUpdate,
  ReflectionUpdate,
  SectionLog,
  SectionLogUpdate,
  SectionLogCreate,
  BlockLog,
  BlockLogUpdate,
  BlockLogCreate,
  AddSpotRequest,
  CollapseToPieceRequest,
  FinishResponse,
  // Today
  TodayResponse,
  // Progress
  HistoryPeriod,
  HistoryResponse,
  HeatmapResponse,
  ComparisonResponse,
  RatingsResponse,
  // Suggestions
  PreSessionResponse,
  InSessionResponse,
  SuggestionDismissRequest,
  SuggestionInteractionCreate,
  SuggestionInteractionRead,
  // Library
  CuratedBlock,
  RecentBlock,
  LibraryRepertoireResponse,
} from './types'

// `??` (not `||`) so an explicitly *empty* NEXT_PUBLIC_API_URL means
// "relative / same-origin" (calls go to the frontend's own origin, e.g. behind
// a reverse proxy or a cloud preview URL). Only an unset value falls back to
// localhost. See README "API calls fail on preview URLs or behind a proxy".
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

/**
 * Custom error thrown for non-2xx responses. Includes the HTTP status
 * and any error detail returned by the backend.
 */
export class APIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public detail?: unknown
  ) {
    super(`API error ${status}: ${statusText}`)
    this.name = 'APIError'
  }
}

// ---------------------------------------------------------------------------
// Internal: fetch wrapper with auth + JSON handling
// ---------------------------------------------------------------------------

/** Clerk-compatible token getter; `skipCache` forces a fresh token. */
export type GetToken = (options?: {
  skipCache?: boolean
}) => Promise<string | null>

function createFetchAPI(getToken?: GetToken, onAuthFailure?: () => void) {
  async function attempt(
    endpoint: string,
    options: RequestInit | undefined,
    skipCache: boolean
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (options?.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers[key] = value
        }
      })
    }

    if (getToken) {
      try {
        const token = await getToken(skipCache ? { skipCache: true } : undefined)
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
      } catch (error) {
        console.warn('Failed to get auth token:', error)
      }
    }

    return fetch(`${API_URL}${endpoint}`, { ...options, headers })
  }

  async function fetchAPI(endpoint: string, options?: RequestInit): Promise<void>
  async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T>
  async function fetchAPI<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T | void> {
    let response = await attempt(endpoint, options, false)

    // A 401 is often a transient stale-token race on cold load (Clerk's short-
    // lived session token hadn't refreshed yet). Force-refresh the token and
    // retry once; only a persistent 401 is treated as a real auth failure.
    if (response.status === 401 && getToken) {
      response = await attempt(endpoint, options, true)
      if (response.status === 401) {
        onAuthFailure?.()
      }
    }

    if (!response.ok) {
      let detail: unknown
      try {
        detail = await response.json()
      } catch {
        // Body might not be JSON
      }
      throw new APIError(response.status, response.statusText, detail)
    }

    if (response.status === 204) {
      return
    }

    return response.json() as Promise<T>
  }
  return fetchAPI
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createAuthenticatedAPI(
  getToken: GetToken,
  onAuthFailure?: () => void
) {
  const f = createFetchAPI(getToken, onAuthFailure)

  return {
    // -----------------------------------------------------------------
    // User
    // -----------------------------------------------------------------
    getMe: () => f<User>('/api/user/me'),

    // -----------------------------------------------------------------
    // Settings
    // -----------------------------------------------------------------
    getSettings: () => f<UserSettings>('/api/settings'),
    updateSettings: (data: UserSettingsUpdate) =>
      f<UserSettings>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    // -----------------------------------------------------------------
    // Instruments
    // -----------------------------------------------------------------
    listInstruments: () => f<Instrument[]>('/api/instruments'),

    createInstrument: (data: InstrumentCreate) =>
      f<Instrument>('/api/instruments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateInstrument: (id: number, data: InstrumentUpdate) =>
      f<Instrument>(`/api/instruments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteInstrument: (id: number) =>
      f<void>(`/api/instruments/${id}`, { method: 'DELETE' }),

    // -----------------------------------------------------------------
    // Pieces (repertoire library)
    // -----------------------------------------------------------------
    listPieces: (instrumentId: number) =>
      f<Piece[]>(`/api/instruments/${instrumentId}/pieces`),

    createPiece: (instrumentId: number, data: PieceCreate) =>
      f<Piece>(`/api/instruments/${instrumentId}/pieces`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getPiece: (id: number, opts?: { includeRetiredSpots?: boolean }) =>
      f<PieceDetail>(
        `/api/pieces/${id}${qs({ include_retired_spots: opts?.includeRetiredSpots })}`
      ),

    updatePiece: (id: number, data: PieceUpdate) =>
      f<Piece>(`/api/pieces/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deletePiece: (id: number) =>
      f<void>(`/api/pieces/${id}`, { method: 'DELETE' }),

    // -----------------------------------------------------------------
    // Spots
    // -----------------------------------------------------------------
    createSpot: (pieceId: number, data: SpotCreate) =>
      f<Spot>(`/api/pieces/${pieceId}/spots`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateSpot: (id: number, data: SpotUpdate) =>
      f<Spot>(`/api/spots/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    retireSpot: (id: number) =>
      f<Spot>(`/api/spots/${id}/retire`, { method: 'POST' }),

    unretireSpot: (id: number) =>
      f<Spot>(`/api/spots/${id}/unretire`, { method: 'POST' }),

    deleteSpot: (id: number) =>
      f<void>(`/api/spots/${id}`, { method: 'DELETE' }),

    reorderSpots: (pieceId: number, spotIds: number[]) =>
      f<Spot[]>(`/api/pieces/${pieceId}/spots/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ spot_ids: spotIds }),
      }),

    getSpotHistory: (id: number) =>
      f<SpotHistory>(`/api/spots/${id}/history`),

    // -----------------------------------------------------------------
    // Templates
    // -----------------------------------------------------------------
    listTemplates: (instrumentId: number) =>
      f<TemplateListItem[]>(`/api/instruments/${instrumentId}/templates`),

    createTemplate: (instrumentId: number, data: TemplateCreate) =>
      f<Template>(`/api/instruments/${instrumentId}/templates`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getTemplate: (id: number) => f<Template>(`/api/templates/${id}`),

    updateTemplate: (id: number, data: TemplateUpdate) =>
      f<Template>(`/api/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteTemplate: (id: number) =>
      f<void>(`/api/templates/${id}`, { method: 'DELETE' }),

    duplicateTemplate: (id: number, data: DuplicateRequest = {}) =>
      f<Template>(`/api/templates/${id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // -----------------------------------------------------------------
    // Template sessions (rotation units)
    // -----------------------------------------------------------------
    createTemplateSession: (templateId: number, data: TemplateSessionCreate) =>
      f<TemplateSession>(`/api/templates/${templateId}/sessions`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateTemplateSession: (id: number, data: TemplateSessionUpdate) =>
      f<TemplateSession>(`/api/sessions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteTemplateSession: (id: number) =>
      f<void>(`/api/sessions/${id}`, { method: 'DELETE' }),

    reorderTemplateSessions: (templateId: number, orderedIds: number[]) =>
      f<void>(`/api/templates/${templateId}/sessions/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ ordered_ids: orderedIds } as ReorderRequest),
      }),

    // -----------------------------------------------------------------
    // Sections
    // -----------------------------------------------------------------
    createSection: (sessionId: number, data: SectionCreate) =>
      f<Section>(`/api/sessions/${sessionId}/sections`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateSection: (id: number, data: SectionUpdate) =>
      f<Section>(`/api/sections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteSection: (id: number) =>
      f<void>(`/api/sections/${id}`, { method: 'DELETE' }),

    reorderSections: (sessionId: number, orderedIds: number[]) =>
      f<void>(`/api/sessions/${sessionId}/sections/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ ordered_ids: orderedIds } as ReorderRequest),
      }),

    // -----------------------------------------------------------------
    // Blocks (standard + repertoire)
    // -----------------------------------------------------------------
    createBlock: (sectionId: number, data: BlockCreate) =>
      f<Block>(`/api/sections/${sectionId}/blocks`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateBlock: (id: number, data: BlockUpdate) =>
      f<Block>(`/api/blocks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteBlock: (id: number) =>
      f<void>(`/api/blocks/${id}`, { method: 'DELETE' }),

    reorderBlocks: (sectionId: number, orderedIds: number[]) =>
      f<void>(`/api/sections/${sectionId}/blocks/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ ordered_ids: orderedIds } as ReorderRequest),
      }),

    // Default spots on a repertoire block
    addDefaultSpot: (blockId: number, spotId: number) =>
      f<Block>(`/api/blocks/${blockId}/default-spots`, {
        method: 'POST',
        body: JSON.stringify({ spot_id: spotId } as DefaultSpotAdd),
      }),

    removeDefaultSpot: (blockId: number, spotId: number) =>
      f<void>(`/api/blocks/${blockId}/default-spots/${spotId}`, {
        method: 'DELETE',
      }),

    reorderDefaultSpots: (blockId: number, spotIds: number[]) =>
      f<Block>(`/api/blocks/${blockId}/default-spots/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ spot_ids: spotIds } as DefaultSpotReorder),
      }),

    // -----------------------------------------------------------------
    // Library (curated blocks, recently used, repertoire pieces)
    // -----------------------------------------------------------------
    browseCuratedBlocks: (params: {
      instrument: string
      sectionType?: string
      q?: string
    }) =>
      f<CuratedBlock[]>(
        `/api/library/blocks${qs({
          instrument: params.instrument,
          section_type: params.sectionType,
          q: params.q,
        })}`
      ),

    listRecentBlocks: (instrumentId: number, limit = 10) =>
      f<RecentBlock[]>(
        `/api/library/recent${qs({ instrument_id: instrumentId, limit })}`
      ),

    listRepertoirePieces: (instrumentId: number, includeRetired = false) =>
      f<LibraryRepertoireResponse>(
        `/api/library/repertoire${qs({
          instrument_id: instrumentId,
          include_retired: includeRetired,
        })}`
      ),

    // -----------------------------------------------------------------
    // Today
    // -----------------------------------------------------------------
    getToday: () => f<TodayResponse>('/api/today'),

    getTodayForInstrument: (instrumentId: number) =>
      f<TodayResponse>(`/api/today/${instrumentId}`),

    // -----------------------------------------------------------------
    // Practice session lifecycle
    // -----------------------------------------------------------------
    startPractice: (data: PracticeStartRequest) =>
      f<PracticeLog>('/api/practice/start', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getPractice: (logId: number) => f<PracticeLog>(`/api/practice/${logId}`),

    updatePractice: (logId: number, data: PracticeLogUpdate) =>
      f<PracticeLog>(`/api/practice/${logId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    updateSectionLog: (
      logId: number,
      sectionLogId: number,
      data: SectionLogUpdate
    ) =>
      f<SectionLog>(
        `/api/practice/${logId}/sections/${sectionLogId}`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      ),

    updateBlockLog: (
      logId: number,
      blockLogId: number,
      data: BlockLogUpdate
    ) =>
      f<BlockLog>(`/api/practice/${logId}/blocks/${blockLogId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    addFreeformSection: (logId: number, data: SectionLogCreate) =>
      f<SectionLog>(`/api/practice/${logId}/sections`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    addFreeformBlock: (
      logId: number,
      sectionLogId: number,
      data: BlockLogCreate
    ) =>
      f<BlockLog>(
        `/api/practice/${logId}/sections/${sectionLogId}/blocks`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),

    // Repertoire-specific session actions
    addSpotMidSession: (
      logId: number,
      blockLogId: number,
      data: AddSpotRequest
    ) =>
      f<BlockLog>(`/api/practice/${logId}/blocks/${blockLogId}/spots`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    collapseToPiece: (
      logId: number,
      blockLogId: number,
      data: CollapseToPieceRequest = {}
    ) =>
      f<BlockLog>(
        `/api/practice/${logId}/blocks/${blockLogId}/collapse-to-piece`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      ),

    expandToSpots: (logId: number, blockLogId: number) =>
      f<BlockLog[]>(
        `/api/practice/${logId}/blocks/${blockLogId}/expand-to-spots`,
        { method: 'PUT' }
      ),

    finishPractice: (logId: number) =>
      f<FinishResponse>(`/api/practice/${logId}/finish`, { method: 'POST' }),

    saveReflection: (logId: number, data: ReflectionUpdate) =>
      f<PracticeLog>(`/api/practice/${logId}/reflection`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    // -----------------------------------------------------------------
    // Progress (history + insights)
    // -----------------------------------------------------------------
    getHistory: (params?: {
      instrumentId?: number
      period?: HistoryPeriod
      cursor?: string
      limit?: number
    }) =>
      f<HistoryResponse>(
        `/api/progress/history${qs({
          instrument_id: params?.instrumentId,
          period: params?.period,
          cursor: params?.cursor,
          limit: params?.limit,
        })}`
      ),

    getHistoryDetail: (logId: number) =>
      f<PracticeLog>(`/api/progress/history/${logId}`),

    getHeatmap: (instrumentId: number, year?: number) =>
      f<HeatmapResponse>(
        `/api/progress/insights/heatmap${qs({
          instrument_id: instrumentId,
          year,
        })}`
      ),

    getComparison: (instrumentId: number) =>
      f<ComparisonResponse>(
        `/api/progress/insights/comparison${qs({ instrument_id: instrumentId })}`
      ),

    getRatings: (instrumentId: number, weeks = 4) =>
      f<RatingsResponse>(
        `/api/progress/insights/ratings${qs({
          instrument_id: instrumentId,
          weeks,
        })}`
      ),

    // -----------------------------------------------------------------
    // Suggestions
    // -----------------------------------------------------------------
    getPreSessionSuggestion: (instrumentId: number) =>
      f<PreSessionResponse>(
        `/api/suggestions/pre-session${qs({ instrument_id: instrumentId })}`
      ),

    getInSessionSuggestions: (logId: number) =>
      f<InSessionResponse>(`/api/suggestions/in-session/${logId}`),

    dismissSuggestion: (data: SuggestionDismissRequest) =>
      f<void>('/api/suggestions/dismiss', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    recordSuggestionInteraction: (data: SuggestionInteractionCreate) =>
      f<SuggestionInteractionRead>('/api/suggestions/interact', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  }
}

export type KanteloAPI = ReturnType<typeof createAuthenticatedAPI>
