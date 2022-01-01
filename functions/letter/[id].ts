export const onRequest: PagesFunction<{
  DATA: KVNamespace;
}> = async ({env, params}) => {
  const data = await env.DATA.get(params.id as string);

  return data
    ? new Response(data, {
        status: 200,
        headers: {
          "Content-type": "text/html; charset=utf-8",
        },
      })
    : new Response("404 Not Found", {status: 404});
};
