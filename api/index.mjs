import worker from '../worker/index.mjs';

// Vercel's rewrite keeps the original endpoint in this reserved parameter.
// All credentials come from runtime environment variables, never frontend code.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const route = url.searchParams.get('__cham_route');
    if (route !== null) {
      url.pathname = '/api/' + route;
      url.searchParams.delete('__cham_route');
    }
    const headers = new Headers(request.headers);
    // Vercel overwrites x-forwarded-for at its edge; ignore client CF headers.
    headers.set('cf-connecting-ip', headers.get('x-forwarded-for') || 'unknown');
    const forwarded = new Request(url, new Request(request, { headers }));
    return worker.fetch(forwarded, {
      CHAM_SESSION_SECRET: process.env.CHAM_SESSION_SECRET,
      CHAM_AI_PROVIDER: process.env.CHAM_AI_PROVIDER,
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
      CLOUDFLARE_IMAGE_MODEL: process.env.CLOUDFLARE_IMAGE_MODEL,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_IMAGE_MODEL: process.env.GEMINI_IMAGE_MODEL,
      CHAM_AI_OWNER_UID: process.env.CHAM_AI_OWNER_UID,
    });
  },
};
