// Ported from https://github.com/bustle/cf-sentry/blob/df072afda307c64691701ebae2116ecfd60ad648/sentry.js

const CLIENT_NAME = "byk-cf-sentry";
const CLIENT_VERSION = "1.0.0";
const RETRIES = 5;
const BUILT_IN_KEYS = new Set(["name", "message", "stack"]);

export interface SentryConfig {
  dsn: string;
  app: string;
  env?: string;
  release?: string;
  tags?: Record<string, string>;
}

export class Sentry {
  projectId: string;
  key: string;
  origin: string;
  app: string;
  env: string;
  release?: string;
  serverName: string;
  tags: Record<string, string>;

  constructor(config: SentryConfig) {
    // The "DSN" will be in the form: https://<SENTRY_KEY>@sentry.io/<SENTRY_PROJECT_ID>
    const dsn = new URL(config.dsn);
    this.projectId = dsn.pathname.slice(1);
    this.key = dsn.username;
    this.origin = dsn.origin;

    this.app = config.app;
    this.env = config.env || "development";
    this.release = config.release;

    this.serverName = `${this.app}-${this.env}`;

    this.tags = {app: this.app, ...(config.tags || {})};
  }

  // The log() function takes an Error object and the current request
  //
  // Eg, from a worker:
  //
  // addEventListener('fetch', event => {
  //   event.respondWith(async () => {
  //     try {
  //       throw new Error('Oh no!')
  //     } catch (e) {
  //       await log(e, event.request)
  //     }
  //     return new Response('Logged!')
  //   })
  // })

  async log(err: Error, request: Request) {
    const body = JSON.stringify(this.toSentryEvent(err, request));

    for (let i = 0; i <= RETRIES; i++) {
      const res = await fetch(
        `https://sentry.io/api/${this.projectId}/store/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Sentry-Auth": [
              "Sentry sentry_version=7",
              `sentry_client=${CLIENT_NAME}/${CLIENT_VERSION}`,
              `sentry_key=${this.key}`,
            ].join(", "),
          },
          body,
        },
      );
      if (res.status === 200) {
        return;
      }
      // We couldn't send to Sentry, try to log the response at least
      console.error({
        httpStatus: res.status,
        ...((await res.json()) as Object),
      }); // eslint-disable-line no-console
    }
  }
  toSentryEvent(err: any, request: Request) {
    const errType = err.name || (err.contructor || {}).name;
    const frames = parse(err);
    const extraKeys = Object.keys(err).filter((key) => !BUILT_IN_KEYS.has(key));
    const url = new URL(request.url);
    return {
      event_id: uuidv4(),
      message: errType + ": " + (err.message || "<no message>"),
      exception: {
        values: [
          {
            type: errType,
            value: err.message,
            stacktrace: frames.length ? {frames: frames.reverse()} : undefined,
          },
        ],
      },
      extra: extraKeys.length
        ? {
            [errType]: extraKeys.reduce(
              (obj, key) => ({...obj, [key]: err[key]}),
              {},
            ),
          }
        : undefined,
      tags: this.tags,
      platform: "javascript",
      environment: this.env,
      server_name: this.serverName,
      timestamp: Date.now() / 1000,
      request: {
        method: request.method,
        url: request.url,
        query_string: url.search,
        headers: request.headers,
        data: request.body,
      },
      release: this.release,
    };
  }
}

function parse(err: Error) {
  return (err.stack || "")
    .split("\n")
    .slice(1)
    .map((line) => {
      if (line.match(/^\s*[-]{4,}$/)) {
        return {filename: line};
      }

      // From https://github.com/felixge/node-stack-trace/blob/1ec9ba43eece124526c273c917104b4226898932/lib/stack-trace.js#L42
      const lineMatch = line.match(
        /at (?:(.+)\s+\()?(?:(.+?):(\d+)(?::(\d+))?|([^)]+))\)?/,
      );
      if (!lineMatch) {
        return;
      }

      return {
        function: lineMatch[1] || undefined,
        filename: lineMatch[2] || undefined,
        lineno: +lineMatch[3] || undefined,
        colno: +lineMatch[4] || undefined,
        in_app: lineMatch[5] !== "native" || undefined,
      };
    })
    .filter(Boolean);
}

function uuidv4() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes].map((b) => ("0" + b.toString(16)).slice(-2)).join(""); // to hex
}
