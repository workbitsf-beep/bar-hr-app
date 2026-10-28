import "server-only";

/**
 * The XML inside a signed invoice (.xml.p7m, CAdES). The signature wraps the
 * file in a PKCS#7 envelope; the invoice is its encapsulated content, an
 * OCTET STRING that some signing tools split into chunks. Signatures are not
 * verified - the SDI did that when it accepted the invoice.
 */
export function unwrapP7m(input: Buffer): Buffer {
  let der = input;
  // Some tools save the envelope as base64 text.
  const head = input.subarray(0, 2).toString("latin1");
  if (head === "MI" || head === "MC") {
    der = Buffer.from(input.toString("latin1").replace(/[^A-Za-z0-9+/=]/g, ""), "base64");
  }

  try {
    const root = readNode(der, 0);
    const content = findEncapsulatedContent(der, root);
    if (content) return content;
  } catch {
    // Fall through to the plain search below.
  }

  // Last resort: the XML is readable inside the envelope as it is.
  const text = der.toString("latin1");
  const start = text.indexOf("<?xml");
  const close = text.search(/<\/[\w-]*:?FatturaElettronica>/);
  if (start >= 0 && close > start) {
    const endTag = text.slice(close).match(/^<\/[\w-]*:?FatturaElettronica>/)?.[0] ?? "";
    return der.subarray(start, close + endTag.length);
  }
  throw new Error("Firma digitale non leggibile.");
}

type Node = {
  tag: number;
  constructed: boolean;
  /** Where the content starts and ends; end is exclusive. */
  start: number;
  end: number;
  /** Where the whole node, header included, ends. */
  next: number;
};

function readNode(buffer: Buffer, offset: number): Node {
  const tag = buffer[offset];
  const constructed = (tag & 0x20) !== 0;
  let cursor = offset + 1;
  if ((tag & 0x1f) === 0x1f) {
    while (buffer[cursor] & 0x80) cursor += 1;
    cursor += 1;
  }
  const first = buffer[cursor];
  cursor += 1;

  if (first === 0x80) {
    // Indefinite length: children up to the end-of-contents marker.
    const start = cursor;
    let child = cursor;
    while (!(buffer[child] === 0 && buffer[child + 1] === 0)) {
      child = readNode(buffer, child).next;
      if (child >= buffer.length) throw new Error("truncated");
    }
    return { tag, constructed, start, end: child, next: child + 2 };
  }

  let length = first;
  if (first & 0x80) {
    const bytes = first & 0x7f;
    length = 0;
    for (let index = 0; index < bytes; index += 1) length = length * 256 + buffer[cursor + index];
    cursor += bytes;
  }
  const end = cursor + length;
  if (end > buffer.length) throw new Error("truncated");
  return { tag, constructed, start: cursor, end, next: end };
}

function children(buffer: Buffer, node: Node) {
  const list: Node[] = [];
  let offset = node.start;
  while (offset < node.end) {
    const child = readNode(buffer, offset);
    list.push(child);
    offset = child.next;
  }
  return list;
}

/** An OCTET STRING's bytes, chunks joined when it was split. */
function octets(buffer: Buffer, node: Node): Buffer {
  if (!node.constructed) return buffer.subarray(node.start, node.end);
  return Buffer.concat(children(buffer, node).map((child) => octets(buffer, child)));
}

function findEncapsulatedContent(buffer: Buffer, root: Node): Buffer | null {
  // ContentInfo { contentType, [0] SignedData }
  const [, explicit] = children(buffer, root);
  if (!explicit) return null;
  const [signedData] = children(buffer, explicit);
  // SignedData { version, digestAlgorithms, encapContentInfo, ... }
  const encap = children(buffer, signedData)[2];
  if (!encap) return null;
  const [, wrapped] = children(buffer, encap);
  if (!wrapped) return null;
  const [content] = children(buffer, wrapped);
  return content ? octets(buffer, content) : null;
}
