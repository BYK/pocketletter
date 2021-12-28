export const onRequest: PagesFunction<{
  DATA: KVNamespace;
}> = async ({env, params}) => {
  const data = await env.DATA.get(params.id as string);

  return new Response(data, {
    status: 200,
    headers: {
      "Content-type": "text/html",
    },
  });
};