export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: Record<string, string> = {}
  ) {
    super(message)
  }
}
export async function api<T = unknown>(
  url: string,
  method: string = 'GET',
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const cookie = document.cookie
    .split('; ')
    .find((value) => value.startsWith('XSRF-TOKEN='))
    ?.slice(11)
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    signal,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { 'X-XSRF-TOKEN': decodeURIComponent(cookie) } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const json = await response.json().catch(() => null)
  if (!response.ok) {
    const details: Record<string, string> = {}
    for (const item of json?.errors ?? []) if (item.field) details[item.field] = item.message
    throw new ApiError(
      Object.values(details)[0] ??
        json?.error?.message ??
        json?.message ??
        (response.status === 409
          ? 'This item changed. Reload the latest state before trying again.'
          : response.status === 403
            ? 'You no longer have permission to do this.'
            : 'The request could not finish. Please try again.'),
      response.status,
      details
    )
  }
  if (!json)
    throw new ApiError('Your session may have changed. Sign in again, then retry the request.', 401)
  return json as T
}
