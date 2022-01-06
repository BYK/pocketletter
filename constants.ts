export const POCKET_OAUTH_REQUEST_URL =
  "https://getpocket.com/v3/oauth/request";
export const POCKET_OAUTH_AUTHORIZE_URL =
  "https://getpocket.com/v3/oauth/authorize";
export const POCKET_AUTH_URL = "https://getpocket.com/auth/authorize";
export const POCKET_ADD_URL = "https://getpocket.com/v3/add";

export const MAILING_DOMAIN = "to.pocketletter.cc";

export const SIGNING_METHOD = "SHA256";
export const CODE_COOKIE_NAME = "code";

export type IPocketLetterEnv = {
  POCKET_CONSUMER_KEY: string;
  POCKET_TOKEN_KEY: string;
  SIGNING_SECRET: string;
  DATA: KVNamespace;
  ALIASES: KVNamespace;
};
