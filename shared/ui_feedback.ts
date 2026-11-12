export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: Record<string, string> = {},
    public code = ''
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get retryable() {
    return (
      this.status === 0 ||
      this.status === 429 ||
      this.status >= 500 ||
      this.code === 'E_INVALID_RESPONSE'
    )
  }
}

const knownMessages: Record<string, string> = {
  'This invitation is no longer pending':
    'This invitation is no longer pending. Check its current status.',
  'This invitation was already used': 'This invitation has already been accepted.',
  'Workspace owner cannot be removed': 'The workspace owner cannot be removed.',
  'Input-only documents cannot select source files':
    'Choose file-based writing before adding sources.',
  'Input-only writing cannot select files': 'Choose file-based writing before adding sources.',
  'The current document version changed': 'The draft changed. Review the latest saved version.',

  'A newer version exists. Keep your local content and compare it before saving again.':
    'A newer version is available. Download your local draft before loading it.',
  'Complete project information, source preparation and editorial checks before review':
    'Complete the checklist before submitting for review.',
  'Inputs changed. Start a new request.': 'The writing inputs changed. Generate a new draft.',
  'A selected source could not be prepared. Retry source preparation, then generate again.':
    'A source needs attention. Retry its preparation before generating.',
  'Prepare the selected sources or explicitly select input-only writing':
    'Prepare your sources, or choose to write without files.',
  'Save and reload the latest version before generating': 'Save your changes before generating.',
  'This issue changed. Reload it before retrying.': 'This issue changed. Reopen it before saving.',
  'This document changed. Keep your input and reload its latest metadata.':
    'The project information changed. Keep your input and reopen the latest information.',
  'The source selection changed. Reload it before retrying.':
    'The sources changed. Check the latest selection before saving.',
  'Approve the exact current version before final export':
    'Approve this version before downloading the final PDF.',
  'Approval changed before rendering':
    'Approval changed. Review this version before exporting again.',
  'Approval changed during rendering':
    'Approval changed. Review this version before exporting again.',
  'This final export is no longer approved':
    'This PDF is no longer approved. Review the current version.',
  'Save the current draft before exporting': 'Save your draft before exporting.',
  'Review and approval are required in a shared workspace':
    'This workspace now requires review and approval before export.',
  'The draft changed. Request a new PDF.': 'The draft changed. Request a new PDF.',
  'Save a version before previewing': 'Save your draft before previewing it.',
  'The saved version changed during preview': 'The draft changed. Open the preview again.',
  'Submit this exact version for review before approving': 'Submit this version for review first.',
  'Acknowledge every current evidence warning before approval':
    'Confirm each evidence warning before approving.',
  'This version is already approved': 'This version is already approved.',
  'Source preparation is already pending': 'This file is already being prepared.',
  'This file is already prepared with the current configuration': 'This file is ready.',
  'Choose a supported file up to 10 MB': 'Choose a supported file up to 10 MB.',
  'Choose a PNG or JPEG image up to 10 MB': 'Choose a PNG or JPEG image up to 10 MB.',
  'An image is unavailable for this document. Remove it or upload it again.':
    'An image is unavailable for this document. Remove it or upload it again.',
  'Invalid calendar deadline': 'Choose a valid deadline.',
  'Invalid issue description content': 'Check the issue description and try again.',
  'Invalid project information document': 'Check the project information and try again.',
  'Document is too large': 'The draft is too large. Shorten it before saving.',
  'Unsupported export image': 'An image cannot be included in this PDF. Check your sources.',
  'Export image is too large': 'An image is too large to export. Use a smaller source image.',
  'A pending invitation already exists. Resend or revoke it.':
    'An invitation is already pending. Resend it from Members.',
  'This account is already a member': 'This person is already a member.',
  'OpenRouter authentication failed. Check the server API key, restart the server and retry.':
    'Draft generation is unavailable. Ask your workspace administrator for help.',
  'OpenRouter has insufficient credits. Add credits to the configured account and retry.':
    'Draft generation is unavailable. Ask your workspace administrator for help.',
  'OpenRouter denied this model request. Check the account and model permissions.':
    'Draft generation is unavailable. Ask your workspace administrator for help.',
  'The configured OpenRouter model is unavailable. Check the server model setting.':
    'Draft generation is unavailable. Ask your workspace administrator for help.',
  'OpenRouter is rate limiting requests. Wait a moment and retry.':
    'Draft generation is busy. Wait a moment and try again.',
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function safeMessage(value: unknown, fallback: string) {
  return typeof value === 'string' && Object.hasOwn(knownMessages, value)
    ? knownMessages[value]
    : fallback
}

function fieldMessage(message: unknown) {
  if (typeof message !== 'string') return 'Check this value.'
  if (/required/i.test(message)) return 'This field is required.'
  if (/email/i.test(message)) return 'Enter a valid email address.'
  if (/at (?:least|min)|minimum/i.test(message)) return 'This value is too short.'
  if (/at most|max|too long/i.test(message)) return 'This value is too long.'
  return safeMessage(message, 'Check this value.')
}

export function responseError(status: number, body: unknown): ApiError {
  const json = record(body)
  const error = record(json.error)
  const details: Record<string, string> = {}
  if (status === 422 && Array.isArray(json.errors)) {
    for (const value of json.errors) {
      const item = record(value)
      if (typeof item.field === 'string' && /^[\w.[\]-]+$/.test(item.field))
        Object.defineProperty(details, item.field, {
          // Publication messages are fixed server strings that never echo content.
          value:
            error.code === 'E_PUBLICATION_CONTENT' &&
            typeof item.message === 'string' &&
            item.message.length <= 200
              ? item.message
              : fieldMessage(item.message),
          enumerable: true,
          configurable: true,
        })
    }
  }
  const fallback =
    status === 401 || status === 419
      ? 'Your session expired. Sign in again to continue.'
      : status === 403
        ? 'You do not have permission to do this.'
        : status === 404 || status === 410
          ? 'This item is no longer available.'
          : status === 409
            ? 'This item changed. Keep your input and check the latest version.'
            : status === 413
              ? 'This file is too large. Choose a file up to 10 MB.'
              : status === 422
                ? 'Check your input and try again.'
                : status === 429
                  ? 'Too many requests. Wait a moment and try again.'
                  : 'This could not finish. Please try again.'
  return new ApiError(
    status >= 500 ? fallback : safeMessage(error.message ?? json.message, fallback),
    status,
    details,
    typeof error.code === 'string' ? error.code : ''
  )
}

export function feedbackError(
  reason: unknown,
  fallback = 'This could not finish. Please try again.'
) {
  if (reason instanceof ApiError) return reason
  return new ApiError(fallback, 500)
}

export type ActionResult = { ok: true } | { ok: false; error: ApiError }

export async function requestJson<T = unknown>(
  url: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
  csrfToken?: string
): Promise<T> {
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    signal,
    headers: {
      Accept: 'application/json',
      ...(body === undefined || multipart ? {} : { 'Content-Type': 'application/json' }),
      ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
    },
    ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
  }).catch((reason: unknown) => {
    if (reason instanceof DOMException && reason.name === 'AbortError') throw reason
    throw new ApiError('Connection lost. Check your internet and try again.', 0)
  })
  const json: unknown = await response.json().catch(() => null)
  if (!response.ok) throw responseError(response.status, json)
  if (response.redirected && new URL(response.url).pathname.includes('/login'))
    throw responseError(401, null)
  if (json === null || typeof json !== 'object' || Array.isArray(json))
    throw new ApiError(
      'The response could not be read. Your input is still here. Try again.',
      response.status,
      {},
      'E_INVALID_RESPONSE'
    )
  return json as T
}
