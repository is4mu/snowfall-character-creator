import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchVerifiedAssetBytes,
  gitBlobShaHex,
} from "../pinned-asset-loader.mjs";

test("Git blob SHA matches Git object semantics", () => {
  assert.equal(
    gitBlobShaHex(new Uint8Array()),
    "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
  );

  assert.equal(
    gitBlobShaHex(new TextEncoder().encode("hello\n")),
    "ce013625030ba8dba906f756967f9e9ca394464a",
  );
});

test("verified fetch accepts exact pinned bytes", async () => {
  const bytes = new TextEncoder().encode("hello\n");
  const result = await fetchVerifiedAssetBytes(
    {
      path: "fixture.txt",
      url: "https://example.invalid/fixture.txt",
      blobSha: "ce013625030ba8dba906f756967f9e9ca394464a",
    },
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
      }),
    },
  );

  assert.equal(
    result.actualBlobSha,
    "ce013625030ba8dba906f756967f9e9ca394464a",
  );
  assert.deepEqual(Array.from(result.bytes), Array.from(bytes));
});

test("verified fetch rejects bytes that do not match the pinned blob", async () => {
  const bytes = new TextEncoder().encode("changed\n");

  await assert.rejects(
    () =>
      fetchVerifiedAssetBytes(
        {
          path: "fixture.txt",
          url: "https://example.invalid/fixture.txt",
          blobSha: "ce013625030ba8dba906f756967f9e9ca394464a",
        },
        {
          fetchImpl: async () => ({
            ok: true,
            status: 200,
            arrayBuffer: async () => bytes.buffer,
          }),
        },
      ),
    /Git blob SHA mismatch/,
  );
});

test("verified fetch does not hide network failures", async () => {
  await assert.rejects(
    () =>
      fetchVerifiedAssetBytes(
        {
          path: "fixture.txt",
          url: "https://example.invalid/fixture.txt",
          blobSha: "ce013625030ba8dba906f756967f9e9ca394464a",
        },
        {
          fetchImpl: async () => ({
            ok: false,
            status: 503,
          }),
        },
      ),
    /HTTP 503/,
  );
});
