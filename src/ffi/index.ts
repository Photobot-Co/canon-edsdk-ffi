import koffi from "koffi";
import { setupDefinitions } from "./definitions";
import { setupFunctions } from "./functions";

const POSSIBLE_EDSDK_PATHS = [
  "EDSDK",
  "vendor/EDSDK.framework/EDSDK",
  "/opt/homebrew/lib/EDSDK",
  "/usr/local/lib/EDSDK",
];

let ffi:
  | ({ definitions: ReturnType<typeof setupDefinitions> } & ReturnType<
      typeof setupFunctions
    >)
  | undefined;

/**
 * Get the library, setting it up if needed
 */
export const getFfi = () => {
  // Return the lib right away if we've setup before
  if (ffi) {
    return ffi;
  }

  // Load the shared edsdk library
  let edsdk: koffi.IKoffiLib | undefined;
  for (const libPath of POSSIBLE_EDSDK_PATHS) {
    try {
      edsdk = koffi.load(libPath);
      console.debug(`Loaded library from ${libPath}`);
      break;
    } catch (e) {
      console.debug(`Unable to load edsdk from ${libPath}. Trying next...`);
    }
  }
  // Throw an error if it couldn't be loaded
  if (!edsdk) {
    throw new Error("Unable to load edsdk. Make sure it is installed");
  }

  // Define the definitions first as they're used by the functions
  const definitions = setupDefinitions();

  // Setup the FFI functions that can be called
  const functions = setupFunctions(edsdk);

  // Store and return everything
  ffi = { definitions, ...functions };
  return ffi;
};

export const makeArrayPointer = (
  values: unknown[] = [],
): (unknown | null)[] => [...values, null];

export * from "./types";
