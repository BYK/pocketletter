import {POCKET_ADD_URL} from "../constants";
import {signature, decrypt} from "../crypto";

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
    /view (?:\w+ )*in (?:\w+ )*browser|(?:read|view) (?:\w+ )*online|view (?:\w+ )*as (?:a )?web ?page|webpage/i;
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

async function extractDirectLink(html: string): Promise<string | null> {
  const res = new Response(html);
  const finder = new LinkFinder();

  const sink = new HTMLRewriter().on('a[href^="http"]', finder).transform(res);
  await sink.blob();

  return finder.found ? (finder.href as string) : null;
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
  const html = makeHTML(title, data.get("html") as string);
  const [fromName] = JSON.parse(data.get("envelope") as string)["to"][0].split(
    "@",
    1,
  );
  const pocketToken = decrypt(fromName, env.POCKET_TOKEN_KEY);

  const url =
    (await extractDirectLink(html)) ||
    (await storeLetter({env, request}, html));
  console.log("Saving url:", url);

  const postData = {
    url,
    title,
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
