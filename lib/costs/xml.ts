import "server-only";

/**
 * A small XML reader, enough for FatturaPA: elements by their local name
 * (the "p:" or "ns2:" prefix dropped), their text, nothing else. No DTDs, no
 * external entities - nothing in an uploaded file can make it fetch or expand.
 */
export type XmlElement = {
  name: string;
  children: XmlElement[];
  text: string;
};

export function decodeXmlBytes(bytes: Buffer) {
  let data = bytes;
  if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) data = data.subarray(3);
  const prolog = data.subarray(0, 200).toString("latin1");
  const encoding = prolog.match(/encoding=["']([\w-]+)["']/i)?.[1]?.toLowerCase();
  if (encoding && /^(iso-8859-1|iso-8859-15|latin1|windows-1252|cp1252)$/.test(encoding)) {
    return new TextDecoder("windows-1252").decode(data);
  }
  return new TextDecoder("utf-8").decode(data);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function unescape(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const value = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
    }
    return ENTITIES[code] ?? whole;
  });
}

export function parseXml(source: string): XmlElement {
  const root: XmlElement = { name: "#root", children: [], text: "" };
  const stack: XmlElement[] = [root];
  const pattern = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([\w:.-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    const current = stack[stack.length - 1];
    if (match[1] !== undefined) {
      current.text += match[1];
    } else if (match[3]) {
      const name = match[3].includes(":") ? match[3].slice(match[3].indexOf(":") + 1) : match[3];
      if (match[2]) {
        if (stack.length > 1) stack.pop();
      } else {
        const element: XmlElement = { name, children: [], text: "" };
        current.children.push(element);
        if (!match[5]) stack.push(element);
      }
    } else if (match[6] !== undefined) {
      current.text += unescape(match[6]);
    }
  }

  return root;
}

export function child(element: XmlElement | undefined, name: string) {
  return element?.children.find((item) => item.name === name);
}

export function childrenNamed(element: XmlElement | undefined, name: string) {
  return element?.children.filter((item) => item.name === name) ?? [];
}

/** The text at a path of names, "DatiGenerali/DatiGeneraliDocumento/Numero". */
export function textAt(element: XmlElement | undefined, path: string) {
  let cursor = element;
  for (const name of path.split("/")) cursor = child(cursor, name);
  const text = cursor?.text.trim();
  return text ? text : null;
}

export function findFirst(element: XmlElement, name: string): XmlElement | undefined {
  if (element.name === name) return element;
  for (const item of element.children) {
    const found = findFirst(item, name);
    if (found) return found;
  }
  return undefined;
}
