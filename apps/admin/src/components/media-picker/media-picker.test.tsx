/** @vitest-environment jsdom */

import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaPicker } from "./media-picker";

const { registerMediaFile, deleteMediaFile, renameMediaFile } = vi.hoisted(() => ({
  registerMediaFile: vi.fn().mockResolvedValue({ ok: true }),
  deleteMediaFile: vi.fn(),
  renameMediaFile: vi.fn(),
}));

vi.mock("@/app/(dashboard)/content/files/actions", () => ({
  registerMediaFile,
  deleteMediaFile,
  renameMediaFile,
}));

class SuccessfulUploadRequest {
  static instances: SuccessfulUploadRequest[] = [];
  status = 200;
  requestUrl = "";
  headers: Record<string, string> = {};
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;

  constructor() {
    SuccessfulUploadRequest.instances.push(this);
  }

  open(_method: string, url: string) {
    this.requestUrl = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send() {
    queueMicrotask(() => this.onload?.());
  }
}

describe("MediaPicker upload input", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              uploadUrl: "https://r2.example.test/signed-put",
              key: "assets/public/products/cdn-public.png",
              contentType: "image/png",
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ files: [], nextCursor: null, hasMore: false }),
        });
      }),
    );
    vi.stubGlobal("XMLHttpRequest", SuccessfulUploadRequest);
    registerMediaFile.mockClear();
    SuccessfulUploadRequest.instances = [];
  });

  it("selects files through the public product upload control and preserves the folder", async () => {
    render(
      <MediaPicker
        open
        folder="products"
        onOpenChange={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    const input = document.getElementById("picker-upload-input");
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input).toHaveProperty("multiple", true);

    const file = new File(["cdn smoke"], "cdn-public.png", { type: "image/png" });
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => {
      const postCall = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST");
      expect(postCall).toBeDefined();
      expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
        filename: "cdn-public.png",
        contentType: "image/png",
        folder: "products",
      });
    });

    await waitFor(() => {
      expect(SuccessfulUploadRequest.instances).toHaveLength(1);
      expect(SuccessfulUploadRequest.instances[0]).toMatchObject({
        requestUrl: "https://r2.example.test/signed-put",
        headers: { "Content-Type": "image/png" },
      });
      expect(registerMediaFile).toHaveBeenCalledWith({
        key: "assets/public/products/cdn-public.png",
        name: "cdn-public.png",
        contentType: "image/png",
        sizeBytes: file.size,
        url: "r2://assets/public/products/cdn-public.png",
      });
    });
  });
});
