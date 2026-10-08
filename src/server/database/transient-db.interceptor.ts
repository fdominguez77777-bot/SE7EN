import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Observable, retry, throwError, timer } from 'rxjs'

import { isTransientDbError } from './transient-db'

@Injectable()
export class TransientDbRetryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method?: string }>()
    if ((request.method ?? 'GET').toUpperCase() !== 'GET') {
      return next.handle()
    }
    return next.handle().pipe(
      retry({
        count: 1,
        delay: (error) =>
          isTransientDbError(error) ? timer(400) : throwError(() => error),
      }),
    )
  }
}
