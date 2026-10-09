// ships-go-3d runs on the same host as this page (so it also works when the
// site is opened from another device on the LAN), on port VITE_API_PORT
// (default 3000, the same as the 2D backend). VITE_API_URL overrides both.
export const API_URL =
  import.meta.env.VITE_API_URL ??
  `${location.protocol}//${location.hostname}:${import.meta.env.VITE_API_PORT ?? '3000'}`

export const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws'

/** A failed request, with the server's messages when it sent any. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly messages: string[],
  ) {
    super(messages.join(' ') || `Request failed (${status})`)
  }
}

export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(API_URL + path, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: options.body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, ['Could not reach the server.'])
  }
  const text = await response.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Not JSON: fall through with no data.
  }
  if (!response.ok) {
    const errors = (data as { errors?: unknown } | null)?.errors
    throw new ApiError(
      response.status,
      Array.isArray(errors) ? errors.map(String) : [`Request failed (${response.status})`],
    )
  }
  return data as T
}
