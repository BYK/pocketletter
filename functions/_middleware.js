import Toucan from "toucan-js";

const errorHandler = async (event) => {
  const {next, request, env} = event;
  const sentry = new Toucan({
    dsn: env.SENTRY_DSN,
    // Includes 'waitUntil', which is essential for Sentry logs to be delivered. Also includes 'request' -- no need to set it separately.
    context: event,
    allowedHeaders: ["user-agent"],
    env: "production",
  });
  event.data.sentry = sentry;
  try {
    return await next();
  } catch (err) {
    sentry.captureException(err);
    return new Response(`${err.message}\n${err.stack}`, {status: 500});
  }
};

export const onRequest = [errorHandler];
