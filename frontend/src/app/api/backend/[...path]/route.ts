import { NextRequest } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8080";

export const runtime = "nodejs";
export const maxDuration = 60;

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const baseUrl = BACKEND_URL.replace(/\/+$/, "");
  const subPath = path.join("/").replace(/^\/+/, "");
  const target = new URL(`${baseUrl}/${subPath}`);
  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  const response = await fetch(target, init);
  const body = await response.arrayBuffer();
  const responseHeaders = new Headers(response.headers);

  // The body is re-emitted by this route, so forwarding the upstream encoding
  // would make browsers try to decompress it a second time.
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  if (setCookies.length > 0) {
    responseHeaders.delete("set-cookie");
    setCookies.forEach((cookie) => {
      responseHeaders.append("set-cookie", cookie);
    });
  }

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
