
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const httpContext = context.switchToHttp();

    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const { method, originalUrl } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;

          this.logger.log(
            `${method} ${originalUrl} ${response.statusCode} - ${duration}ms`,
          );
        },
        error: (error: unknown) => {
          const duration = Date.now() - startTime;

          this.logger.error(
            `${method} ${originalUrl} ${response.statusCode} - ${duration}ms`,
            error instanceof Error ? error.stack : undefined,
          );
        },
      }),
    );
  }
}
