import { writeFile } from "node:fs/promises";
import path from "node:path";

const addresses = ["1.1.1.1", "1.2.3.4", "8.8.8.8"];

type MmdbValue = string | number | { [key: string]: MmdbValue };

function encode(value: MmdbValue): Buffer {
  if (typeof value === "number") {
    const result = Buffer.alloc(5);
    result[0] = (6 << 5) | 4;
    result.writeUInt32BE(value, 1);
    return result;
  }
  if (typeof value === "string") {
    const bytes = Buffer.from(value);
    if (bytes.length >= 285) throw new Error("Fixture string exceeds the supported MMDB size");
    const header =
      bytes.length < 29 ? [(2 << 5) | bytes.length] : [(2 << 5) | 29, bytes.length - 29];
    return Buffer.concat([Buffer.from(header), bytes]);
  }
  const entries = Object.entries(value);
  return Buffer.concat([
    Buffer.from([(7 << 5) | entries.length]),
    ...entries.flatMap(([key, entry]) => [encode(key), encode(entry)]),
  ]);
}

function createMmdb(): Buffer {
  const nodes: [number | null, number | null][] = [[null, null]];
  const data: Buffer[] = [];
  const leaves = new Map<number, number>();
  let dataSize = 0;
  for (const address of addresses) {
    const record = encode({
      country_code: "US",
      country_name: "Fixture country",
      country: { iso_code: "US", names: { en: "Fixture country" } },
      autonomous_system_number: 64512,
      autonomous_system_organization: "Fixture ASN",
    });
    data.push(record);
    const bits = address
      .split(".")
      .flatMap((part) => Array.from({ length: 8 }, (_, bit) => (Number(part) >> (7 - bit)) & 1));
    let node = 0;
    bits.forEach((bit, depth) => {
      const current = nodes[node];
      if (!current) throw new Error("Missing fixture tree node");
      const side = bit === 0 ? 0 : 1;
      if (depth === 31) {
        leaves.set(node * 2 + side, dataSize);
      } else {
        let next = current[side];
        if (next === null) {
          next = nodes.length;
          nodes.push([null, null]);
          current[side] = next;
        }
        node = next;
      }
    });
    dataSize += record.length;
  }

  const tree = Buffer.alloc(nodes.length * 6);
  nodes.forEach((node, index) => {
    for (const side of [0, 1] as const) {
      const leaf = leaves.get(index * 2 + side);
      const pointer = leaf === undefined ? (node[side] ?? nodes.length) : nodes.length + 16 + leaf;
      tree.writeUIntBE(pointer, index * 6 + side * 3, 3);
    }
  });
  const metadata = encode({
    binary_format_major_version: 2,
    binary_format_minor_version: 0,
    build_epoch: Math.floor(Date.now() / 1000),
    database_type: "Echo synthetic fixture",
    ip_version: 4,
    node_count: nodes.length,
    record_size: 24,
  });
  return Buffer.concat([
    tree,
    Buffer.alloc(16),
    ...data,
    Buffer.from("abcdef4d61784d696e642e636f6d", "hex"),
    metadata,
  ]);
}

function createXdb(ipVersion: 4 | 6): Buffer {
  const ipBytes = ipVersion === 4 ? 4 : 16;
  const indexSize = ipBytes * 2 + 6;
  const ips =
    ipVersion === 4
      ? addresses.map((ip) => Buffer.from(ip.split(".").map(Number)))
      : [Buffer.from("20010db8000000000000000000000001", "hex")];
  const region = Buffer.from("Fixture country|Fixture state|Fixture city|Fixture ISP|US");
  const start = 256 + 256 * 256 * 8;
  const dataOffset = start + ips.length * indexSize;
  const result = Buffer.alloc(dataOffset + region.length);
  result.writeUInt16LE(3, 0);
  result.writeUInt32LE(Math.floor(Date.now() / 1000), 4);
  result.writeUInt32LE(start, 8);
  result.writeUInt32LE(start + (ips.length - 1) * indexSize, 12);
  result.writeUInt16LE(ipVersion, 16);
  result.writeUInt16LE(4, 18);
  ips.forEach((ip, index) => {
    const vector = 256 + ip.readUInt16BE(0) * 8;
    const pointer = start + index * indexSize;
    result.writeUInt32LE(pointer, vector);
    result.writeUInt32LE(pointer, vector + 4);
    const encoded = ipVersion === 4 ? Buffer.from(ip).reverse() : ip;
    encoded.copy(result, pointer);
    encoded.copy(result, pointer + ipBytes);
    result.writeUInt16LE(region.length, pointer + ipBytes * 2);
    result.writeUInt32LE(dataOffset, pointer + ipBytes * 2 + 2);
  });
  region.copy(result, dataOffset);
  return result;
}

export async function writeFixtureDatabases(directory: string): Promise<void> {
  const mmdb = createMmdb();
  await Promise.all([
    writeFile(path.join(directory, "ip2region_v4.xdb"), createXdb(4)),
    writeFile(path.join(directory, "ip2region_v6.xdb"), createXdb(6)),
    ...[
      "iplocate-asn.mmdb",
      "iplocate-country.mmdb",
      "ip-location-db-asn.mmdb",
      "ip-location-db-city.mmdb",
      "circl-country-asn.mmdb",
    ].map((filename) => writeFile(path.join(directory, filename), mmdb)),
  ]);
}
