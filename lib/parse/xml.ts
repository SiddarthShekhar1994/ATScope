/**
 * Minimal, dependency-free XML tree parser. WordprocessingML is well-formed and
 * small, so a recursive tokenizer is all we need.
 */
export interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text?: string;
}

export function parseXml(src: string): XmlNode {
  const root: XmlNode = { tag: '#root', attrs: {}, children: [] };
  const stack: XmlNode[] = [root];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      pushText(stack[stack.length - 1], src.slice(i));
      break;
    }
    if (lt > i) pushText(stack[stack.length - 1], src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt + 9);
      pushText(stack[stack.length - 1], src.slice(lt + 9, end === -1 ? n : end), true);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (src.startsWith('<?', lt) || src.startsWith('<!', lt)) {
      const end = src.indexOf('>', lt);
      i = end === -1 ? n : end + 1;
      continue;
    }
    const gt = findTagEnd(src, lt);
    const inner = src.slice(lt + 1, gt);
    i = gt + 1;
    if (inner.startsWith('/')) {
      const name = inner.slice(1).trim();
      // Pop to the matching open tag (tolerant of stray closers).
      for (let s = stack.length - 1; s > 0; s--) {
        if (stack[s].tag === name) {
          stack.length = s;
          break;
        }
      }
      continue;
    }
    const selfClosing = inner.endsWith('/');
    const body = selfClosing ? inner.slice(0, -1) : inner;
    const spaceIdx = body.search(/\s/);
    const tag = spaceIdx === -1 ? body : body.slice(0, spaceIdx);
    const attrs: Record<string, string> = {};
    if (spaceIdx !== -1) {
      const attrSrc = body.slice(spaceIdx);
      const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(attrSrc))) attrs[m[1]] = decodeEntities(m[3] ?? m[4] ?? '');
    }
    const node: XmlNode = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root;
}

function findTagEnd(src: string, from: number): number {
  let quote: string | null = null;
  for (let i = from + 1; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '>') return i;
  }
  return src.length - 1;
}

function pushText(parent: XmlNode, text: string, raw = false) {
  if (text.length === 0) return;
  parent.children.push({ tag: '#text', attrs: {}, children: [], text: raw ? text : decodeEntities(text) });
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

export function findAll(node: XmlNode, tag: string, out: XmlNode[] = [], stopAt?: Set<string>): XmlNode[] {
  for (const c of node.children) {
    if (c.tag === tag) out.push(c);
    if (stopAt && stopAt.has(c.tag)) continue;
    if (c.children.length) findAll(c, tag, out, stopAt);
  }
  return out;
}

export function findFirst(node: XmlNode, tag: string): XmlNode | undefined {
  for (const c of node.children) {
    if (c.tag === tag) return c;
    const deep = findFirst(c, tag);
    if (deep) return deep;
  }
  return undefined;
}

export function childByTag(node: XmlNode, tag: string): XmlNode | undefined {
  return node.children.find((c) => c.tag === tag);
}
