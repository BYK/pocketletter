import {POCKET_OAUTH_AUTHORIZE_URL, CODE_COOKIE_NAME} from "../../constants";

export const onRequest: PagesFunction<{
  POCKET_CONSUMER_KEY: string;
}> = async ({request, env}) => {
  const cookies = Object.fromEntries(
    request.headers
      .get("Cookie")
      ?.split("; ")
      ?.map((cookie) => cookie.split("=") || []),
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

  return new Response(`Hi ${username}, your access token is ${access_token}`, {
    headers: {
      "Set-Cookie": `${CODE_COOKIE_NAME}=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    },
  });
};
