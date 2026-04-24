/**
 * ZodBodyPipe — validates a request body against a zod schema.
 *
 * Usage:
 *   @Post('hydrate')
 *   hydrate(@Body(new ZodBodyPipe(hydratePatientSchema)) input: HydratePatientInput) {...}
 *
 * Returns 400 on parse failure with a structured `{ issues: [...] }` body.
 * We roll a tiny pipe rather than pulling in class-validator to keep the
 * dep surface small — zod is already used for config + tests.
 */
import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

export class ZodBodyPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'invalid request body',
        issues: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          code: i.code,
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
