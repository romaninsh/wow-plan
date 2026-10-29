// Packs public/agent-skills/<name>/ into dist/agent-skills/<name>.zip at build time, for agents
// that take a skill as an upload (claude.ai's Skills settings). The folder stays the one source:
// Claude Code users copy SKILL.md as it is, and the zip can't drift from it. Plain JS run by
// Vite under Node; skill-zip.d.mts gives the config its type.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data) {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function files(dir) {
  return readdirSync(dir).sort().flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/** A zip of `entries` ([name, bytes]), stored without compression: small text files. */
export function zip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header
    local.setUint16(4, 20, true); // version needed
    local.setUint16(8, 0, true); // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true); // central directory header
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // end of central directory
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) { out.set(p, at); at += p.length; }
  return out;
}

/** Emits agent-skills/<name>.zip for every folder under public/agent-skills/. */
export function skillZips(publicDir = "public") {
  return {
    name: "skill-zips",
    apply: "build",
    generateBundle() {
      const root = join(publicDir, "agent-skills");
      for (const skill of readdirSync(root)) {
        const dir = join(root, skill);
        if (!statSync(dir).isDirectory()) continue;
        const entries = files(dir).map((path) => [
          `${skill}/${relative(dir, path)}`,
          new Uint8Array(readFileSync(path)),
        ]);
        this.emitFile({ type: "asset", fileName: `agent-skills/${skill}.zip`, source: zip(entries) });
      }
    },
  };
}
