/**
 * @corchetes/web — Cliente Next.js de Corchetes
 */

export const WEB_APP_NAME = 'Corchetes'

export { apiClient, ApiClientError } from './api/client'
export type {
  StartSessionResponse,
  HintRevealResponse,
  HintMatrixResponse,
  HintResponse,
  CompleteSessionPayload,
  CompleteSessionResponse,
  MergeSessionResponse,
  UserStatsResponse,
  UserHistoryItem,
  UserHistoryResponse,
} from './api/client'

export { AuthDrawer } from './components/AuthDrawer'
export type { AuthDrawerProps } from './components/AuthDrawer'

export {
  supabase,
  signInWithMagicLink,
  signInWithGoogle,
  signOutUser,
  getCurrentUser,
  onAuthStateChange,
} from './lib/supabase'

