
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const message =
      this.reflector.getAllAndOverride<string>(
        'response_message',
        [context.getHandler(), context.getClass()],
      ) || 'Request successful';

    return next.handle().pipe(
      map((data) => ({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
