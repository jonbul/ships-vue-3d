import { locale, t } from '@/i18n'

// ships-go-3d runs on the same host as this page (so it also works when the
// site is opened from another device on the LAN), on port VITE_API_PORT
// (default 3000, the same as the 2D backend). VITE_API_URL overrides both.
export const API_URL =
  import.meta.env.VITE_API_URL ??
  `${location.protocol}//${location.hostname}:${import.meta.env.VITE_API_PORT ?? '3000'}`

export const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws'

/** A link that helps the user fix an error themselves. */
export interface HelpLink {
  href: string
  text: string
}

/** A failed request, with the server's messages when it sent any. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly messages: string[],
    readonly help?: HelpLink,
  ) {
    super(messages.join(' ') || t.value.http.requestFailed(status))
  }
}

/**
 * The request never got an answer. The usual cause on this deployment is a
 * certificate the browser doesn't trust for the API's address - e.g. the
 * site opened by IP while the certificate names the domain. A page can be
 * clicked through, but its fetch() calls to another origin (the API's port)
 * fail silently, so the way out is to open the API once and accept it there.
 */
function unreachable(): ApiError {
  return new ApiError(0, [t.value.http.unreachable(API_URL), t.value.http.certificate], {
    href: `${API_URL}/status`,
    text: t.value.http.open(`${API_URL}/status`),
  })
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
      // The server answers errors in this language.
      headers: {
        'Accept-Language': locale.value,
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw unreachable()
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
      Array.isArray(errors) ? errors.map(String) : [t.value.http.requestFailed(response.status)],
    )
  }
  return data as T
}
