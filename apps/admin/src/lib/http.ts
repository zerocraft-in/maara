import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_REQUEST"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const ERROR_STATUS: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_REQUEST: 400,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export function requestIdFrom(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function apiError(
  code: ApiErrorCode,
  requestId: string,
  options?: { retryAfter?: number },
) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
  });

  if (options?.retryAfter !== undefined) {
    headers.set("Retry-After", String(options.retryAfter));
  }

  return NextResponse.json(
    { error: { code, requestId } },
    { status: ERROR_STATUS[code], headers },
  );
}

export function apiSuccess<T>(data: T, requestId: string, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Request-Id", requestId);
  return NextResponse.json(data, { ...init, headers });
}

export function errorCode(error: unknown): ApiErrorCode {
  const message = error instanceof Error ? error.message : "";
  if (message === "Unauthenticated") return "UNAUTHENTICATED";
  if (message === "Forbidden") return "FORBIDDEN";
  if (message === "Not found") return "NOT_FOUND";
  return "INTERNAL_ERROR";
}
