import {
  POCKET_OAUTH_REQUEST_URL,
  POCKET_AUTH_URL,
  CODE_COOKIE_NAME,
} from "../../constants";

const getRedirectURI = (request: Request) => {
  const url = new URL(request.url);
  url.pathname = "/token/callback";
  url.search = "";
  return url.toString();
};

export const onRequest: PagesFunction<{
  POCKET_CONSUMER_KEY: string;
}> = async ({request, env}) => {
  const redirect_uri = getRedirectURI(request);
  const {code} = await (
    await fetch(POCKET_OAUTH_REQUEST_URL, {
      method: "POST",
      body: JSON.stringify({
        redirect_uri,
        consumer_key: env.POCKET_CONSUMER_KEY,
      }),
      headers: {
        "content-type": "application/json;charset=UTF-8",
        "X-Accept": "application/json",
      },
    })
  ).json();

  const pocketAuthUrl = new URL(POCKET_AUTH_URL);
  pocketAuthUrl.searchParams.append("request_token", code);
  pocketAuthUrl.searchParams.append("redirect_uri", redirect_uri);

  return new Response("", {
    status: 302,
    headers: {
      "Set-Cookie": `${CODE_COOKIE_NAME}=${code}; path=/token; secure; HttpOnly; SameSite=Lax`,
      Location: pocketAuthUrl.toString(),
    },
  });
};
