import type { IncomingMessage, ServerResponse } from 'http'

import { handleNestRequest } from '@/server/next-handler'

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '6mb',
    externalResolver: true,
  },
  maxDuration: 30,
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleNestRequest(req, res)
}
