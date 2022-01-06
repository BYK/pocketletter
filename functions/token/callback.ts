import {
  POCKET_OAUTH_AUTHORIZE_URL,
  CODE_COOKIE_NAME,
  MAILING_DOMAIN,
  IPocketLetterEnv,
} from "../../constants";

export const onRequest: PagesFunction<IPocketLetterEnv> = async ({
  request,
  env,
}) => {
  const cookies = Object.fromEntries(
    request.headers
      .get("Cookie")
      ?.split("; ")
      ?.map((cookie) => cookie.split("=")) || [],
  );
  const code = cookies[CODE_COOKIE_NAME];
  if (!code) {
    throw new Error("No request token found in cookies.");
  }
  const response = await fetch(POCKET_OAUTH_AUTHORIZE_URL, {
    method: "POST",
    body: JSON.stringify({
      consumer_key: env.POCKET_CONSUMER_KEY,
      code,
    }),
    headers: {
      "content-type": "application/json;charset=UTF-8",
      "X-Accept": "application/json",
    },
  });

  const {username, access_token} = await response.json();
  const alias = username.toLowerCase();
  await env.ALIASES.put(alias, access_token);
  const address = `${alias}@${MAILING_DOMAIN}`;

  return new Response(
    `Hi ${username}, your just registered your PocketLetter address: ${address}`,
    {
      headers: {
        "Set-Cookie": `${CODE_COOKIE_NAME}=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      },
    },
  );
};
