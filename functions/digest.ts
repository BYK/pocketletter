import {POCKET_ADD_URL} from "../constants";
import {signature, decrypt} from "../crypto";

const makeHTML = (title: string, body: string) =>
  `<!DOCTYPE html>\n<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title></head><body>${body}</body></html>`;
const SUBJECT_CLEANER = /^((Re|Fwd):\s*)+/i;

export const onRequest: PagesFunction<{
  POCKET_CONSUMER_KEY: string;
  POCKET_TOKEN_KEY: string;
  SIGNING_SECRET: string;
  DATA: KVNamespace;
}> = async ({request, env}) => {
  const data = await request.formData();
  const title = (data.get("subject") as string).replace(SUBJECT_CLEANER, "");
  const html = makeHTML(title, data.get("html") as string);
  const [fromName] = JSON.parse(data.get("envelope") as string)["to"][0].split(
    "@",
    1,
  );
  const fileName = `${await signature(html, env.SIGNING_SECRET)}.html`;
  const pocketToken = decrypt(fromName, env.POCKET_TOKEN_KEY);

  // direct_link = BrowserLinkGetter()
  // direct_link.feed(file_contents)
  // if direct_link.found:
  //     url = direct_link.link
  //     print("Found direct link:", url)
  // else:

  await env.DATA.put(fileName, html);
  const url = new URL(request.url);
  url.pathname = `/letter/${fileName}`;
  url.search = "";

  const postData = {
    url: url.toString(),
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
