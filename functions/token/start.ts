import {
  POCKET_OAUTH_REQUEST_URL,
  POCKET_AUTH_URL,
  CODE_COOKIE_NAME,
} from "../../constants";

const REDIRECT_URI = "https://pocketletter.pages.dev/token/callback";

export const onRequest: PagesFunction<{
  POCKET_CONSUMER_KEY: string;
}> = async ({env}) => {
  const {code} = await (
    await fetch(POCKET_OAUTH_REQUEST_URL, {
      method: "POST",
      body: JSON.stringify({
        consumer_key: env.POCKET_CONSUMER_KEY,
        redirect_uri: REDIRECT_URI,
      }),
      headers: {
        "content-type": "application/json;charset=UTF-8",
        "X-Accept": "application/json",
      },
    })
  ).json();

  const redirectUrl = new URL(POCKET_AUTH_URL);
  redirectUrl.searchParams.append("request_token", code);
  redirectUrl.searchParams.append("redirect_uri", REDIRECT_URI);

  return new Response("", {
    status: 302,
    headers: {
      "Set-Cookie": `${CODE_COOKIE_NAME}=${code}; path=/token; secure; HttpOnly; SameSite=Lax`,
      Location: redirectUrl.toString(),
    },
  });
};
