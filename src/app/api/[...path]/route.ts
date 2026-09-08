const MESSAGE =
  'API is not configured on Vercel. Deploy the Nest API (Render/Railway) and set API_REWRITE_TARGET to that public origin.'

function unavailable() {
  return Response.json({ message: MESSAGE }, { status: 503 })
}

export const GET = unavailable
export const POST = unavailable
export const PUT = unavailable
export const PATCH = unavailable
export const DELETE = unavailable
export const OPTIONS = unavailable
