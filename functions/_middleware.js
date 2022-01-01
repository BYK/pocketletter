import {Sentry} from "../sentry";

const errorHandler = async (event) => {
  const {next, request, env} = event;
  try {
    return await next();
  } catch (err) {
    const sentry = new Sentry({
      dsn: env.SENTRY_DSN,
      app: "pocketletter",
      env: "production",
    });
    event.waitUntil(sentry.log(err, request));
    return new Response(`${err.message}\n${err.stack}`, {status: 500});
  }
};

export const onRequest = [errorHandler];
