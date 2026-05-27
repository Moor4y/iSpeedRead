import type { BookMetadata, Chunk } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(
  /\/$/,
  ""
);

function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: string }).error)
        : res.statusText;
    throw new Error(message || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchBooks(): Promise<BookMetadata[]> {
  return fetchJson<BookMetadata[]>(apiUrl("/api/books"));
}

export async function fetchChunk(
  bookId: string,
  index: number
): Promise<Chunk> {
  return fetchJson<Chunk>(apiUrl(`/api/books/${bookId}/chunk/${index}`));
}

export function getApiBaseDisplay(): string {
  return API_BASE || "(proxy → localhost:5000)";
}
