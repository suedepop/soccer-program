import 'server-only';
import { NextResponse } from 'next/server';
import { AuthError } from './auth';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as object, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wraps a route handler so AuthError and unexpected throws become clean JSON. */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof AuthError) return fail(err.message, err.status);
      console.error(err);
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      return fail(message, 500);
    }
  };
}
