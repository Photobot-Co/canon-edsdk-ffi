import { EdsDeviceInfo, getFfi, makeArrayPointer } from "./ffi";
import { CameraInfo, CameraModule } from "./types";

const EDS_ERR_OK = 0;

/**
 * Do the actual loading of the library
 */
export const loadInternal = async (): Promise<
  CameraModule & { ffi: ReturnType<typeof getFfi> }
> => {
  // Get the library. This will fail if the shared library cannot be found
  const ffi = getFfi();

  // Initialize the SDK and throw an error if it fails
  const initResult = await ffi.EdsInitializeSDK();
  if (initResult !== EDS_ERR_OK) {
    throw new Error(`Unable to initialize the EDSDK. Result: ${initResult}`);
  }

  /**
   * List the cameras that are currently connected
   */
  const listAsync = async (): Promise<CameraInfo[]> => {
    // Create a new list to retrieve results into
    const listPointer = makeArrayPointer();

    // Get the cameras and put them into a list with the pointer
    const listResult = await ffi.EdsGetCameraList(listPointer);
    if (listResult !== EDS_ERR_OK) {
      throw new Error(`Unable to get the camera list. Result: ${listResult}`);
    }
    const list = listPointer[0];

    // Get the number of cameras which were detected
    const countPointer = makeArrayPointer();
    const countResult = await ffi.EdsGetChildCount(list, countPointer);
    if (countResult !== EDS_ERR_OK) {
      throw new Error(`Unable to get the camera count. Result: ${countResult}`);
    }
    const count = countPointer[0] as number;

    // For each camera, get the device info and return the camera info array
    const cameras: CameraInfo[] = [];
    for (let cameraIndex = 0; cameraIndex < count; cameraIndex += 1) {
      const cameraRefPointer = makeArrayPointer();
      const getChildResult = await ffi.EdsGetChildAtIndex(
        list,
        cameraIndex,
        cameraRefPointer,
      );
      if (getChildResult !== EDS_ERR_OK) {
        throw new Error(
          `Unable to get the camera at index ${cameraIndex}. Result: ${countResult}`,
        );
      }
      const cameraRef = cameraRefPointer[0];

      const deviceInfoPointer = makeArrayPointer();
      const getDeviceInfoResult = await ffi.EdsGetDeviceInfo(
        cameraRef,
        deviceInfoPointer,
      );
      if (getDeviceInfoResult !== EDS_ERR_OK) {
        throw new Error(
          `Unable to get the camera info at index ${cameraIndex}. Result: ${countResult}`,
        );
      }
      const deviceInfo = deviceInfoPointer[0] as EdsDeviceInfo;

      cameras.push({
        portName: deviceInfo.szPortName,
        deviceDescription: deviceInfo.szDeviceDescription,
        deviceSubType: deviceInfo.deviceSubType,
        cameraRef,
      });
    }
    return cameras;
  };

  // Return the methods and raw ffi
  return {
    ffi,
    listAsync,
  };
};

// Store a copy of the loaded library so it's a singleton
let loadedLib: (CameraModule & { ffi: ReturnType<typeof getFfi> }) | undefined;

/**
 * Load the library and return the interface and methods
 */
export const load = async () => {
  if (!loadedLib) {
    loadedLib = await loadInternal();
  }
  return loadedLib;
};

export * from "./types";
