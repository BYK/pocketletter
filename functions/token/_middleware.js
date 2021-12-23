const errorHandler = async ({next}) => {
  try {
    return await next();
  } catch (err) {
    return new Response(`${err.message}\n${err.stack}`, {status: 500});
  }
};

export const onRequest = [errorHandler];
