// Cloudflare Pages / Workers entry point.
//
// 1. /api/* is forwarded to the backend named in the API_ORIGIN variable
//    (for example https://minerva-be.onrender.com). The browser then talks to
//    one origin only, so the session cookie stays first-party and Safari does
//    not block it. Leave API_ORIGIN unset to serve static files only.
// 2. Any other unknown path falls back to index.html for the Vue router.

const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host']

async function proxyToApi(request, apiOrigin) {
  const incoming = new URL(request.url)
  const target = new URL(incoming.pathname + incoming.search, apiOrigin)

  const headers = new Headers(request.headers)
  for (const name of HOP_BY_HOP) headers.delete(name)
  // The backend rate-limits logins by the first X-Forwarded-For entry.
  // Overwrite it with the real client IP so a caller cannot spoof it.
  const clientIp = request.headers.get('cf-connecting-ip')
  if (clientIp) headers.set('x-forwarded-for', clientIp)
  headers.set('x-forwarded-host', incoming.host)
  headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''))

  return fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (env.API_ORIGIN && (url.pathname === '/api' || url.pathname.startsWith('/api/'))) {
      return proxyToApi(request, env.API_ORIGIN)
    }

    const response = await env.ASSETS.fetch(request)
    if (response.status !== 404) return response

    url.pathname = '/index.html'
    return env.ASSETS.fetch(new Request(url, request))
  },
}
