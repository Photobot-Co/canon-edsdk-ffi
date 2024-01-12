import inquirer from "inquirer";
import PressToContinuePrompt from "inquirer-press-to-continue";
import type { KeyDescriptor } from "inquirer-press-to-continue";
import { loadEdsdk, unloadEdsdk } from "./src";

inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);

async function main() {
  const edsdk = await loadEdsdk();

  const cameras = await edsdk.listAsync();
  console.log("Got cameras", cameras);

  if (cameras.length > 0) {
    const cameraInfo = cameras[0];
    console.log("Opening...");
    await edsdk.openAsync(cameraInfo);
    console.log("Opened");

    await inquirer.prompt<{ key: KeyDescriptor }>({
      name: "key",
      type: "press-to-continue",
      enter: true,
      pressToContinueMessage: "Press enter to capture...\n",
    });

    console.log("Capturing...");
    await edsdk.triggerCaptureAsync(cameraInfo);
    console.log("Captured");

    console.log("Waiting for 5 seconds");
    for (let i = 0; i < 50; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("Closing...");
    await edsdk.closeAsync(cameraInfo);
    console.log("Closed");
  }

  await unloadEdsdk();
}

main();
