export interface FetchedPage {
  url: string;
  title: string;
  text: string;
  isWeChat: boolean;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractById(html: string, id: string): string {
  let idIdx = html.indexOf(`id="${id}"`);
  if (idIdx === -1) idIdx = html.indexOf(`id='${id}'`);
  if (idIdx === -1) return '';

  const beforeId = html.slice(0, idIdx);
  const tagStart = beforeId.lastIndexOf('<');
  if (tagStart === -1) return '';

  const tagNameMatch = html.slice(tagStart + 1).match(/^([a-zA-Z][a-zA-Z0-9]*)/);
  if (!tagNameMatch) return '';
  const tagName = tagNameMatch[1].toLowerCase();

  const openEnd = html.indexOf('>', tagStart);
  if (openEnd === -1) return '';
  const contentStart = openEnd + 1;

  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  let depth = 1;
  let pos = contentStart;
  while (depth > 0 && pos < html.length) {
    const nextOpen = html.indexOf(openTag, pos);
    const nextClose = html.indexOf(closeTag, pos);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + openTag.length;
    } else {
      depth--;
      if (depth === 0) return html.slice(contentStart, nextClose);
      pos = nextClose + closeTag.length;
    }
  }
  return html.slice(contentStart, Math.min(contentStart + 8000, html.length));
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) return stripHtml(m[1]).trim().slice(0, 100);
  const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
  if (og) return og[1].trim();
  return '';
}

export async function fetchAndParseUrl(url: string): Promise<FetchedPage> {
  const isWeChat = url.includes('mp.weixin.qq.com');

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
  });

  if (!response.ok) throw new Error(`请求失败：HTTP ${response.status}`);

  const html = await response.text();
  let title = '';
  let text = '';

  if (isWeChat) {
    const titleEl = extractById(html, 'activity-name');
    title = titleEl ? stripHtml(titleEl).trim() : extractTitle(html);
    const contentEl = extractById(html, 'js_content');
    text = contentEl ? stripHtml(contentEl) : '';
  } else {
    title = extractTitle(html);
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const src = articleMatch?.[1] ?? mainMatch?.[1] ?? bodyMatch?.[1] ?? html;
    text = stripHtml(src);
  }

  if (!text) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    text = bodyMatch ? stripHtml(bodyMatch[1]) : stripHtml(html);
  }

  text = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n')
    .slice(0, 6000);

  return { url, title: title || url, text, isWeChat };
}
