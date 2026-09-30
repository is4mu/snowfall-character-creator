import { createHash } from "node:crypto";

export function gitBlobShaHex(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("bytes must be a Uint8Array");
  }

  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8");
  return createHash("sha1")
    .update(header)
    .update(bytes)
    .digest("hex");
}

export async function fetchVerifiedAssetBytes(
  asset,
  {
    fetchImpl = globalThis.fetch,
  } = {},
) {
  if (!asset?.url || !asset?.blobSha || !asset?.path) {
    throw new TypeError(
      "asset must contain path, url, and blobSha",
    );
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetchImpl must be a function");
  }

  const response = await fetchImpl(asset.url);
  if (!response?.ok) {
    throw new Error(
      `Failed to download ${asset.path}: HTTP ${response?.status ?? "unknown"}`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const actualBlobSha = gitBlobShaHex(bytes);

  if (actualBlobSha !== asset.blobSha) {
    throw new Error(
      `Git blob SHA mismatch for ${asset.path}: expected ${asset.blobSha}, got ${actualBlobSha}`,
    );
  }

  return {
    path: asset.path,
    url: asset.url,
    expectedBlobSha: asset.blobSha,
    actualBlobSha,
    bytes,
  };
}

export async function fetchVerifiedAssetText(
  asset,
  options = {},
) {
  const verified = await fetchVerifiedAssetBytes(
    asset,
    options,
  );

  return {
    ...verified,
    text: new TextDecoder().decode(verified.bytes),
  };
}
