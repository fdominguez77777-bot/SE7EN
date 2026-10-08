import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common'
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core'

import { DB_UNREACHABLE_MESSAGE, isTransientDbError } from './transient-db'

@Catch()
export class TransientDbFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler')

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const adapter = this.adapterHost.httpAdapter
    const response = host.switchToHttp().getResponse()
    if (isTransientDbError(exception)) {
      this.logger.error(exception)
      if (!adapter.isHeadersSent(response)) {
        adapter.reply(
          response,
          { statusCode: 503, message: DB_UNREACHABLE_MESSAGE },
          503,
        )
      }
      return
    }
    new BaseExceptionFilter(adapter).catch(exception, host)
  }
}
