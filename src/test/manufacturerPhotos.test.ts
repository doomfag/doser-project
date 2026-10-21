import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  manufacturerPhotos,
  manufacturerPhotosFor,
  isManufacturerPhoto,
  verifiedManufacturerImage,
  photoPresentationGroups,
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
    holder: (photo.holderCnpj ?? "38391432000143") + " - test holder",
  },
} as Medicine;
// Synthetic RIFF/WebP header, used only for byte/hash validation, never shown as a product.
const bytes = Buffer.from("RIFF0000WEBPTEST");
const base64 = bytes.toString("base64");
const expected = {
  bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  contentType: "image/webp" as const,
};

describe("manufacturer photo manifest and identity", () => {
  it("covers 100 distinct registrations with at least three distinct vetted raster images each", () => {
    expect(manufacturerPhotos.length).toBeGreaterThanOrEqual(300);
    expect(new Set(manufacturerPhotos.map((p) => p.id)).size).toBe(
      manufacturerPhotos.length,
    );
    expect(new Set(manufacturerPhotos.map((p) => p.sha256)).size).toBe(
      manufacturerPhotos.length,
    );
    expect(manufacturerPhotos.every(isManufacturerPhoto)).toBe(true);
    expect(manufacturerPhotos.every((p) => p.src === new URL(p.src).href)).toBe(
      true,
    );
    const registrations = new Set(
      manufacturerPhotos.map((p) => p.registration),
    );
    expect(registrations.size).toBe(100);
    for (const registration of registrations)
      expect(
        manufacturerPhotos.filter((p) => p.registration === registration)
          .length,
      ).toBeGreaterThanOrEqual(3);
  });
  it("uses registration, brand, ingredient and holder together", () => {
    expect(manufacturerPhotosFor(medicine)).toHaveLength(
      manufacturerPhotos.filter((p) => p.registration === photo.registration)
        .length,
    );
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
  it("supports pinned PNG and JPEG downloads, and rejects a MIME/signature mismatch", async () => {
    for (const [mime, bytes] of [
      [
        "image/png",
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 1, 2, 3, 4]),
      ],
      [
        "image/jpeg",
        Buffer.from([255, 216, 255, 224, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]),
      ],
    ] as const) {
      const expected = {
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        contentType: mime,
      };
      expect(
        await verifiedManufacturerImage(bytes.toString("base64"), expected),
      ).toBe("data:" + mime + ";base64," + bytes.toString("base64"));
      await expect(
        verifiedManufacturerImage(bytes.toString("base64"), {
          ...expected,
          contentType: "image/webp",
        }),
      ).rejects.toThrow();
    }
  });
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
  it("shares one download between the main image and its thumbnail", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(CapacitorHttp.get).mockClear().mockResolvedValue({
      data: base64,
      url: photo.src,
      status: 200,
      headers: {},
    });
    const p = { ...photo, ...expected, id: "fixture-shared-download" };
    await Promise.all([manufacturerImageSource(p), manufacturerImageSource(p)]);
    expect(CapacitorHttp.get).toHaveBeenCalledTimes(1);
  });
  it("limits concurrent native image requests to three", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    let running = 0,
      maximum = 0;
    vi.mocked(CapacitorHttp.get)
      .mockClear()
      .mockImplementation(async () => {
        running++;
        maximum = Math.max(maximum, running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
        return { data: base64, url: photo.src, status: 200, headers: {} };
      });
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        manufacturerImageSource({
          ...photo,
          ...expected,
          id: "fixture-concurrency-" + i,
        }),
      ),
    );
    expect(maximum).toBe(3);
    expect(CapacitorHttp.get).toHaveBeenCalledTimes(8);
  });
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

describe("presentation grouping", () => {
  it("groups angles of the same barcode but keeps concentrations and packages separate", () => {
    const photos = [
      {
        ...photo,
        id: "a",
        ean: "7891058017507",
        productTitle: "Fixture 10 mg, 20 tablets",
      },
      {
        ...photo,
        id: "b",
        ean: "7891058017507",
        productTitle: "Fixture 10 mg, 20 tablets",
        sha256: "b".repeat(64),
      },
      {
        ...photo,
        id: "c",
        ean: "7891058017811",
        productTitle: "Fixture 50 mg, 10 tablets",
        sha256: "c".repeat(64),
      },
    ];
    const groups = photoPresentationGroups(photos);
    expect(groups).toHaveLength(2);
    expect(groups[0].photos.map((p) => p.id)).toEqual(["a", "b"]);
    expect(groups[1].label).toBe("Fixture 50 mg, 10 tablets");
  });
});
