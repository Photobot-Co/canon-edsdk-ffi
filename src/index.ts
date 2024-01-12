import { getFfi } from "./ffi";
import { EdsdkModule } from "./EdsdkModule";
import { EDS_ERR_OK } from "./constants";

interface LoadedLibInternal {
  module: EdsdkModule;
  _terminate: () => void;
}

/**
 * Do the actual loading of the library
 */
export const loadInternal = async (): Promise<LoadedLibInternal> => {
  // Get the library. This will fail if the shared library cannot be found
  const ffi = getFfi();

  // Initialize the SDK and throw an error if it fails
  const initResult = await ffi.EdsInitializeSDK();
  if (initResult !== EDS_ERR_OK) {
    throw new Error(`Unable to initialize the EDSDK. Result: ${initResult}`);
  }

  // Create the EdsdkModule which wraps the ffi and provides a nice interface
  const module = new EdsdkModule(ffi);

  const _terminate = () => {
    module.terminate();
    ffi.EdsTerminateSDK();
  };

  // Return the methods and raw ffi
  return {
    module,
    _terminate,
  };
};

// Store a copy of the loaded library so it's a singleton
let loadedLib: LoadedLibInternal | undefined;

/**
 * Load the library and return the interface and methods
 */
export const loadEdsdk = async (): Promise<EdsdkModule> => {
  if (!loadedLib) {
    loadedLib = await loadInternal();
  }
  return loadedLib.module;
};

export const unloadEdsdk = async () => {
  if (loadedLib) {
    loadedLib._terminate();
    loadedLib = undefined;
  }
};

export * from "./types";
