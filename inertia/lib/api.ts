import { requestJson } from '../../shared/ui_feedback.ts'
export {
  ApiError,
  feedbackError,
  responseError,
  safeMessage,
  type ActionResult,
} from '../../shared/ui_feedback.ts'
export function api<T = unknown>(
  url: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const token = document.cookie
    .split('; ')
    .find((value) => value.startsWith('XSRF-TOKEN='))
    ?.slice(11)
  return requestJson<T>(url, method, body, signal, token ? decodeURIComponent(token) : undefined)
}
