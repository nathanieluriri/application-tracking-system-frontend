"use client";

import { useCallback, useRef, useState } from "react";

export type UploadStatus =
  | "idle"
  | "uploading"
  | "success"
  | "error"
  | "canceled";

export interface UploadResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
}

export interface UseUploadOptions {
  /** BFF path, e.g. "/api/applications". Never call the backend directly. */
  url: string;
  method?: "POST" | "PUT" | "PATCH";
}

export interface UseUploadReturn<T> {
  progress: number; // 0..100
  determinate: boolean; // false when total size is unknown
  status: UploadStatus;
  error: string | null;
  /**
   * Sends the FormData with real upload progress. Resolves with { ok, status, data }
   * for ANY completed HTTP response (so callers can read error bodies on 4xx/5xx).
   * Rejects only on a true network error. Abort resolves with ok:false, status:0.
   */
  upload: (body: FormData) => Promise<UploadResult<T>>;
  cancel: () => void;
  reset: () => void;
}

/**
 * Upload with a real percentage via XMLHttpRequest (the Fetch API cannot report
 * upload progress). Posts through the app's own /api BFF.
 */
export function useUploadWithProgress<T = unknown>({
  url,
  method = "POST",
}: UseUploadOptions): UseUploadReturn<T> {
  const [progress, setProgress] = useState(0);
  const [determinate, setDeterminate] = useState(true);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const reset = useCallback(() => {
    setProgress(0);
    setDeterminate(true);
    setStatus("idle");
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    xhrRef.current?.abort();
  }, []);

  const upload = useCallback(
    (body: FormData) =>
      new Promise<UploadResult<T>>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        setStatus("uploading");
        setError(null);
        setProgress(0);
        setDeterminate(true);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setDeterminate(true);
            setProgress(Math.round((e.loaded / e.total) * 100));
          } else {
            setDeterminate(false);
          }
        };

        xhr.onload = () => {
          let data: T | null = null;
          try {
            data = JSON.parse(xhr.responseText) as T;
          } catch {
            data = null;
          }
          const ok = xhr.status >= 200 && xhr.status < 300;
          if (ok) {
            setStatus("success");
            setProgress(100);
          } else {
            setStatus("error");
            const msg =
              (data as unknown as { message?: string } | null)?.message ??
              `Request failed (${xhr.status})`;
            setError(msg);
          }
          resolve({ ok, status: xhr.status, data });
        };

        xhr.onerror = () => {
          setStatus("error");
          setError("Network error during upload");
          reject(new Error("Network error during upload"));
        };

        xhr.onabort = () => {
          setStatus("canceled");
          setError(null);
          resolve({ ok: false, status: 0, data: null });
        };

        xhr.open(method, url);
        xhr.withCredentials = true; // forward auth cookies through the BFF
        xhr.setRequestHeader("accept", "application/json");
        xhr.send(body);
      }),
    [url, method],
  );

  return { progress, determinate, status, error, upload, cancel, reset };
}
