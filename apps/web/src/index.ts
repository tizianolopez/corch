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
} from './api/client'
