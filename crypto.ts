import {createHmac} from "crypto";
import crc8 from "crc/lib/es6/calculators/crc8";

const getCRC8 = (data: number[]): number => crc8(new Int8Array(data));

// Copied from https://github.com/uuidjs/uuid/blob/3a033f6bab6bb3780ece6d645b902548043280bc/src/parse.js
// Just removed the validator as we don't care about that (and Pocket access tokens violate that)
const parseUUID = (uuid: string): Uint8Array => {
  let v;
  const arr = new Uint8Array(16); // Parse ########-....-....-....-............

  arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
  arr[1] = (v >>> 16) & 0xff;
  arr[2] = (v >>> 8) & 0xff;
  arr[3] = v & 0xff; // Parse ........-####-....-....-............

  arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 0xff; // Parse ........-....-####-....-............

  arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 0xff; // Parse ........-....-....-####-............

  arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 0xff; // Parse ........-....-....-....-############
  // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)

  arr[10] = ((v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000) & 0xff;
  arr[11] = (v / 0x100000000) & 0xff;
  arr[12] = (v >>> 24) & 0xff;
  arr[13] = (v >>> 16) & 0xff;
  arr[14] = (v >>> 8) & 0xff;
  arr[15] = v & 0xff;
  return arr;
};

// Copied from https://github.com/uuidjs/uuid/blob/3a033f6bab6bb3780ece6d645b902548043280bc/src/stringify.js
/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
const byteToHex: string[] = [];

for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).substring(1));
}

export const stringifyUUID = (arr: number[], offset = 0): string => {
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  return (
    byteToHex[arr[offset + 0]] +
    byteToHex[arr[offset + 1]] +
    byteToHex[arr[offset + 2]] +
    byteToHex[arr[offset + 3]] +
    "-" +
    byteToHex[arr[offset + 4]] +
    byteToHex[arr[offset + 5]] +
    "-" +
    byteToHex[arr[offset + 6]] +
    byteToHex[arr[offset + 7]] +
    "-" +
    byteToHex[arr[offset + 8]] +
    byteToHex[arr[offset + 9]] +
    "-" +
    byteToHex[arr[offset + 10]] +
    byteToHex[arr[offset + 11]] +
    byteToHex[arr[offset + 12]] +
    byteToHex[arr[offset + 13]] +
    byteToHex[arr[offset + 14]] +
    byteToHex[arr[offset + 15]]
  ).toLowerCase();
};

export const encrypt = (token: string, key: string): string => {
  const binKey = parseUUID(key);
  const missingChars = 36 - token.length; // Pad for valid UUID length
  const padded = token + "0".repeat(missingChars);
  if (binKey.length !== 16) {
    throw new Error(`Invalid key length: ${binKey.length}`);
  }
  const xored = Array.from(parseUUID(padded), (x, i) => x ^ binKey[i]);
  xored.push(getCRC8(xored));
  return Buffer.from(xored).toString("base64");
};

export const decrypt = (token: string, key: string): string => {
  const binKey = parseUUID(key);
  if (binKey.length !== 16) {
    throw new Error(`Invalid key length: ${binKey.length}`);
  }
  const data = Array.from(Buffer.from(token, "base64"));
  const checksum = data.pop();
  if (checksum !== getCRC8(data)) {
    throw new Error("Checksum error.");
  }
  return stringifyUUID(data.map((x, i) => x ^ binKey[i])).replace(/0+$/, "");
};

export const signature = (contents: string, secret: string) => {
  const hmac = createHmac("sha256", secret);
  hmac.update("some data to hash");
  return hmac.digest("hex");
};
