import {POCKET_ADD_URL} from "../constants";
import {signature, decrypt} from "../cryptoUtils";

const makeHTML = (title: string, body: string) =>
  `<!DOCTYPE html>\n<html><head><meta charset="utf-8"/><title>${title}</title></head><body>${body}</body></html>`;
const SUBJECT_CLEANER = /^((Re|Fwd):\s*)+/i;

const store = async (storage: KVNamespace, contents: string, name: string) => {
  await storage.put(name, contents);
  return `https://pocketletter.pages.dev/letter/${name}`;
};

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
  const fileName = `${signature(html, env.SIGNING_SECRET)}.html`;
  const pocketToken = decrypt(fromName, env.POCKET_TOKEN_KEY);

  // direct_link = BrowserLinkGetter()
  // direct_link.feed(file_contents)
  // if direct_link.found:
  //     url = direct_link.link
  //     print("Found direct link:", url)
  // else:
  const url = await store(env.DATA, html, fileName);

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
