import {POCKET_ADD_URL} from "../constants";
import {signature, decrypt} from "../crypto";

// Adapted from https://stackoverflow.com/a/66481918/90297
const textToHTML = (text: string): string =>
  `<pre>${text.replace(
    /[\u0000-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u00FF]/g,
    (c) => "&#" + ("000" + c.charCodeAt(0)).slice(-4) + ";",
  )}</pre>`;

const makeHTML = (title: string, body: string) =>
  `<!DOCTYPE html>\n<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title></head><body>${body}</body></html>`;
const SUBJECT_CLEANER = /^((Re|Fwd?):\s*)+/i;

type IPocketLetterEnv = {
  POCKET_CONSUMER_KEY: string;
  POCKET_TOKEN_KEY: string;
  SIGNING_SECRET: string;
  DATA: KVNamespace;
};

class LinkFinder {
  textMatcher =
    /(?:read|view) (?:\w+ )*(?:browser|online|web(?: ?page)?)|webpage|Share/i;
  href: string | null = null;
  found = false;
  textBuffer: string[] = [];

  element(link: Element) {
    if (this.found) {
      return;
    }

    this.textBuffer = [];
    this.href = link.getAttribute("href");
  }

  text(textChunk: Text) {
    if (this.found || !this.href) {
      return;
    }

    this.textBuffer.push(textChunk.text);

    if (!textChunk.lastInTextNode) {
      return;
    }

    const text = this.textBuffer.join("");
    if (this.textMatcher.test(text)) {
      this.found = true;
    } else {
      this.href = null;
    }
  }
}

class Cleaner {
  element(el: Element) {
    el.remove();
  }
}

class Unwrapper {
  element(el: Element) {
    el.removeAndKeepContent();
  }
}

async function processHTML(
  html: string,
): Promise<{html: string; directLink: string | null}> {
  const res = new Response(html);
  const finder = new LinkFinder();
  const cleaner = new Cleaner();

  const sink = new HTMLRewriter()
    .on('a[href^="http"]', finder)
    .on('[data-smartmail$="_signature"]', cleaner)
    .on(".gmail_quote>.gmail_attr", cleaner)
    .on(".gmail_quote", new Unwrapper())
    .transform(res);
  return {
    html: await sink.text(),
    directLink: finder.found ? (finder.href as string) : null,
  };
}

async function storeLetter(
  {env, request}: {env: IPocketLetterEnv; request: Request},
  contents: string,
): Promise<string> {
  const fileName = `${await signature(contents, env.SIGNING_SECRET)}`;
  await env.DATA.put(fileName, contents);
  const url = new URL(request.url);
  url.pathname = `/letter/${fileName}`;
  url.search = "";

  return url.toString();
}

export const onRequest: PagesFunction<IPocketLetterEnv> = async ({
  request,
  env,
}) => {
  const data = await request.formData();
  const title = (data.get("subject") as string).replace(SUBJECT_CLEANER, "");
  const rawHtml = makeHTML(
    title,
    (data.get("html") as string) || textToHTML(data.get("text") as string),
  );
  const [fromName] = JSON.parse(data.get("envelope") as string)["to"][0].split(
    "@",
    1,
  );
  const pocketToken = decrypt(fromName, env.POCKET_TOKEN_KEY);
  const {html, directLink} = await processHTML(rawHtml);

  const url = directLink || (await storeLetter({env, request}, html));
  console.log("Saving url:", url);

  const postData = {
    url,
    title,
    tags: "pocketletter",
    access_token: pocketToken,
    consumer_key: env.POCKET_CONSUMER_KEY,
  };

  const req = await fetch(POCKET_ADD_URL, {
    headers: {"Content-Type": "application/json"},
    method: "POST",
    body: JSON.stringify(postData),
  });

  return new Response(req.body, {
    status: req.status,
    statusText: req.statusText,
  });
};
