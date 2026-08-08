import net from "node:net";

const listenPort = Number(process.env.PROXY_PORT ?? 3001);
const upstreamPort = Number(process.env.DEV_PORT ?? 3000);

const server = net.createServer((client) => {
  const upstream = net.connect({ host: "::1", port: upstreamPort });
  client.pipe(upstream).pipe(client);
  upstream.on("error", () => client.destroy());
});

server.listen(listenPort, "0.0.0.0", () => {
  console.log(`Docker dev proxy listening on 0.0.0.0:${listenPort}`);
});
