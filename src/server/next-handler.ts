import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'
import { ExpressAdapter } from '@nestjs/platform-express'
import express, { type Express } from 'express'
import type { IncomingMessage, ServerResponse } from 'http'

import { AppModule } from './app.module'
import { configureApp } from './configure-app'

let nestExpress: Express | null = null
let nestBoot: Promise<Express> | null = null

function nestPath(url: string | undefined, query?: Record<string, unknown>): string | undefined {
  if (!url) {
    return url
  }
  const q = url.indexOf('?')
  const path = q === -1 ? url : url.slice(0, q)
  let queryString = q === -1 ? '' : url.slice(q)
  if (!queryString && query) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (key === 'path') {
        continue
      }
      const values = Array.isArray(value) ? value : [value]
      for (const item of values) {
        if (item == null || item === '') {
          continue
        }
        params.append(key, String(item))
      }
    }
    const encoded = params.toString()
    if (encoded) {
      queryString = `?${encoded}`
    }
  }
  const stripped =
    path === '/api' ? '/' : path.startsWith('/api/') ? path.slice(4) : path
  return `${stripped}${queryString}`
}

async function bootstrapNest(): Promise<Express> {
  if (nestExpress) {
    return nestExpress
  }
  if (!nestBoot) {
    nestBoot = (async () => {
      const instance = express()
      const app = await NestFactory.create(
        AppModule,
        new ExpressAdapter(instance),
        { bodyParser: true, logger: ['error'] },
      )
      configureApp(app)
      await app.init()
      nestExpress = instance
      return instance
    })().catch((error) => {
      nestBoot = null
      throw error
    })
  }
  return nestBoot
}

function apiErrorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error)
  if (/password authentication failed/i.test(text) || /28P01/.test(text)) {
    return 'Postgres rejected DATABASE_PASSWORD. Set the real local postgres password in .env and restart npm run dev.'
  }
  if (/ECONNREFUSED/i.test(text)) {
    return 'Cannot reach Postgres on DATABASE_HOST/DATABASE_PORT. Start PostgreSQL and retry.'
  }
  if (/database .* does not exist/i.test(text)) {
    return 'DATABASE_NAME does not exist. Create the bidder_platform database and run npm run migration:run.'
  }
  return text || 'API failed to start'
}

export async function handleNestRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const server = await bootstrapNest()
    req.url = nestPath(req.url, (req as { query?: Record<string, unknown> }).query)
    server(req, res)
  } catch (error) {
    const message = apiErrorMessage(error)
    console.error(error)
    if (!res.headersSent) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ message }))
    }
  }
}
