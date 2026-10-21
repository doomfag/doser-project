import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  manufacturerPhotos,
  manufacturerPhotosFor,
  isManufacturerPhoto,
  verifiedManufacturerImage,
} from "../domain/manufacturerPhotos";
import type { Medicine } from "../domain/catalog";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { manufacturerImageSource } from "../data/manufacturerPhotoCache";
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => true) },
  CapacitorHttp: { get: vi.fn() },
}));

const photo = manufacturerPhotos[0];
const medicine = {
  id: "anvisa-186200008",
  name: photo.name,
  ingredient: photo.ingredient,
  registration: {
    number: photo.registration,
    holder: "38391432000143 - OPELLA HEALTHCARE BRAZIL LTDA",
  },
} as Medicine;
// Synthetic RIFF/WebP header, used only for byte/hash validation, never shown as a product.
const bytes = Buffer.from("RIFF0000WEBPTEST");
const base64 = bytes.toString("base64");
const expected = {
  bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
};

describe("manufacturer photo manifest and identity", () => {
  it("contains only vetted official WebP sources, unique IDs and no redistributed binaries", () => {
    expect(manufacturerPhotos).toHaveLength(15);
    expect(new Set(manufacturerPhotos.map((p) => p.id)).size).toBe(15);
    expect(manufacturerPhotos.every(isManufacturerPhoto)).toBe(true);
    expect(new Set(manufacturerPhotos.map((p) => p.registration)).size).toBe(5);
  });
  it("uses registration, brand, ingredient and holder together", () => {
    expect(manufacturerPhotosFor(medicine)).toHaveLength(3);
    for (const changed of [
      { name: "DORFLEX UNO" },
      { ingredient: "dipirona monoidratada" },
      {
        registration: {
          number: "000000001",
          holder: medicine.registration!.holder,
        },
      },
      {
        registration: {
          number: photo.registration,
          holder: "Other manufacturer",
        },
      },
      { registration: undefined },
    ])
      expect(
        manufacturerPhotosFor({ ...medicine, ...changed } as Medicine),
      ).toEqual([]);
  });
  it("does not transfer the image to generic medicines or a similar brand", () => {
    expect(
      manufacturerPhotosFor({ ...medicine, name: "dipirona genérica" }),
    ).toEqual([]);
    expect(
      manufacturerPhotosFor({ ...medicine, name: "DORFLEX EXTRA" }),
    ).toEqual([]);
  });
  it("rejects unapproved hosts, redirects as URLs, credentials and non-image paths", () => {
    for (const src of [
      "http://www.dorflex.com.br/dam/jcr:x/test.webp",
      "https://evil.example/image.webp",
      "https://user:pass@www.dorflex.com.br/dam/jcr:x/test.webp",
      "data:image/webp;base64,AAAA",
      "https://www.dorflex.com.br/dam/jcr:x/test.svg",
      photo.src + "?redirect=evil",
    ]) {
      expect(isManufacturerPhoto({ ...photo, src })).toBe(false);
    }
    expect(
      isManufacturerPhoto({
        ...photo,
        sourcePage: "https://www.novalgina.com.br/produtos/other",
      }),
    ).toBe(false);
  });
});
describe("private native image validation", () => {
  it("accepts line-wrapped base64 returned by the Android native plugin", async () => {
    const androidData = base64.match(/.{1,8}/g)!.join("\n") + "\n";
    expect(await verifiedManufacturerImage(androidData, expected)).toBe(
      "data:image/webp;base64," + base64,
    );
  });
  it("returns a local image only after signature, size and SHA-256 match", async () => {
    expect(await verifiedManufacturerImage(base64, expected)).toBe(
      "data:image/webp;base64," + base64,
    );
  });
  it("withdraws an image whose source bytes changed", async () => {
    const changed = Buffer.from(bytes);
    changed[14] ^= 1;
    await expect(
      verifiedManufacturerImage(changed.toString("base64"), expected),
    ).rejects.toThrow("mudou");
  });
  it("rejects HTML responses, truncation, oversized and invalid base64 input", async () => {
    for (const data of [
      Buffer.from("<html>error</html>").toString("base64"),
      base64.slice(0, 8),
      "A".repeat(1_333_340),
      "data:text/html,evil",
      null,
    ])
      await expect(verifiedManufacturerImage(data, expected)).rejects.toThrow();
  });
});

describe("native photo transport", () => {
  it("validates native downloads with redirects disabled, even without IndexedDB", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(CapacitorHttp.get).mockResolvedValue({
      data: base64 + "\n",
      url: photo.src,
      status: 200,
      headers: {},
    });
    expect(await manufacturerImageSource({ ...photo, ...expected })).toBe(
      "data:image/webp;base64," + base64,
    );
    expect(CapacitorHttp.get).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: photo.src,
        disableRedirects: true,
        responseType: "arraybuffer",
        connectTimeout: 12000,
        readTimeout: 15000,
      }),
    );
  });
  it("does not display an error response, redirect or changed native download", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    for (const response of [
      { data: base64, url: photo.src, status: 404, headers: {} },
      {
        data: base64,
        url: "https://evil.example/image",
        status: 200,
        headers: {},
      },
      { data: base64, url: photo.src, status: 200, headers: {} },
    ]) {
      vi.mocked(CapacitorHttp.get).mockResolvedValue(response);
      await expect(manufacturerImageSource(photo)).rejects.toThrow();
    }
  });
  it("uses the original allowed URL on web without invoking the native bridge", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(CapacitorHttp.get).mockClear();
    expect(await manufacturerImageSource(photo)).toBe(photo.src);
    expect(CapacitorHttp.get).not.toHaveBeenCalled();
  });
});
