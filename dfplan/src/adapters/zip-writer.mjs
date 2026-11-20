/** Native ZIP Store writer: UTF-8 names, CRC32, central directory; no libraries or network. */
const encoder = new TextEncoder();
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function header(size) {
  const bytes = new Uint8Array(size);
  return { bytes, view: new DataView(bytes.buffer) };
}
/** @param {Array<{path:string,content:string}>} files */
export function createZipBlob(files) {
  if (!Array.isArray(files) || files.length > 65535)
    throw Error("ZIP Store requires at most 65535 files.");
  const parts = [],
    directory = [],
    names = new Set();
  let offset = 0,
    directorySize = 0;
  for (const file of files) {
    const path = String(file.path).normalize("NFC");
    if (
      !path ||
      path.startsWith("/") ||
      path.includes("\\") ||
      path.includes("\0") ||
      path.includes(":") ||
      path.split("/").some((p) => !p || p === "." || p === "..") ||
      names.has(path.toLowerCase())
    )
      throw Error("Unsafe or duplicate ZIP path.");
    names.add(path.toLowerCase());
    const name = encoder.encode(path),
      data = encoder.encode(file.content);
    if (
      name.length > 65535 ||
      data.length > 0xffffffff ||
      offset + 30 + name.length + data.length > 0xffffffff
    )
      throw Error("ZIP64 is not supported.");
    const crc = crc32(data),
      local = header(30),
      central = header(46);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true);
    local.view.setUint16(12, 0x21, true);
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, data.length, true);
    local.view.setUint32(22, data.length, true);
    local.view.setUint16(26, name.length, true);
    central.view.setUint32(0, 0x02014b50, true);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0x0800, true);
    central.view.setUint16(14, 0x21, true);
    central.view.setUint32(16, crc, true);
    central.view.setUint32(20, data.length, true);
    central.view.setUint32(24, data.length, true);
    central.view.setUint16(28, name.length, true);
    central.view.setUint32(42, offset, true);
    parts.push(local.bytes, name, data);
    directory.push(central.bytes, name);
    offset += 30 + name.length + data.length;
    directorySize += 46 + name.length;
  }
  if (offset + directorySize + 22 > 0xffffffff)
    throw Error("ZIP64 is not supported.");
  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, files.length, true);
  end.view.setUint16(10, files.length, true);
  end.view.setUint32(12, directorySize, true);
  end.view.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end.bytes], {
    type: "application/zip",
  });
}
export async function computeSha256Hex(
  text,
  subtle = globalThis.crypto?.subtle,
) {
  if (!subtle) return "UNAVAILABLE_SHA256_INSECURE_CONTEXT";
  try {
    const digest = await subtle.digest("SHA-256", encoder.encode(text));
    return Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  } catch {
    return "UNAVAILABLE_SHA256_DIGEST_FAILED";
  }
}
/** SHA covers UTF-8 bytes of every payload, excluding the self-referential manifest. */
export async function finalizeHandoverFiles(files, hash = computeSha256Hex) {
  const entry = files.find((file) => file.path === "manifest.json");
  if (!entry) throw Error("Missing manifest.");
  const manifest = JSON.parse(entry.content),
    payload = files.filter((file) => file.path !== "manifest.json");
  manifest.files = await Promise.all(
    payload.map(async (file) => {
      const value = await hash(file.content),
        ok = /^[a-f0-9]{64}$/.test(value);
      return {
        path: file.path,
        sha256: ok ? value : null,
        hashStatus: ok ? "sha256" : value,
        bytes: encoder.encode(file.content).length,
      };
    }),
  );
  return [
    ...payload,
    { path: "manifest.json", content: JSON.stringify(manifest, null, 2) },
  ];
}
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
