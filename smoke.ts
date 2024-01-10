import { load } from "./src";

async function main() {
  const edsdk = await load();
  const cameras = await edsdk.listAsync();
  console.log("Got cameras", cameras);
}

main();
