import { EdsDeviceInfo, getFfi, makeArrayPointer } from "./ffi";
import { CameraInfo, CameraModule } from "./types";

const EDS_ERR_OK = 0;
const EDS_CAMERA_COMMAND_PRESS_SHUTTER_BUTTON = 0x00000004;
const EDS_CAMERA_COMMAND_SHUTTER_BUTTON_OFF = 0x00000000;
const EDS_CAMERA_COMMAND_SHUTTER_BUTTON_COMPLETELY = 0x00000003;

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

  // This will store the references to the open cameras so they can be used later
  const openCameraRefs = new Map<string, unknown>();

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

    // Release the camera list
    ffi.EdsRelease(list);

    // Return the camera list
    return cameras;
  };

  /**
   * Opens a connection to a camera
   */
  const openAsync = async (cameraInfo: CameraInfo): Promise<void> => {
    // If the camera is already open then just return as there's nothing to do
    if (openCameraRefs.has(cameraInfo.portName)) {
      return;
    }

    // Open the camera session
    const openSessionResult = await ffi.EdsOpenSession(cameraInfo.cameraRef);
    if (openSessionResult !== EDS_ERR_OK) {
      throw new Error(
        `Unable to open camera session. Result: ${openSessionResult}`,
      );
    }

    // Store an instance of the camera
    openCameraRefs.set(cameraInfo.portName, cameraInfo.cameraRef);
  };

  /**
   * Closes the connection to the camera
   */
  const closeAsync = async (cameraInfo: CameraInfo): Promise<boolean> => {
    // Get the open camera reference, returning early if the camera is already closed
    const camera = openCameraRefs.get(cameraInfo.portName);
    if (!camera) {
      return false;
    }

    // Exit the camera
    await ffi.EdsCloseSession(camera);

    // Release the camera ref
    ffi.EdsRelease(cameraInfo.cameraRef);

    // Remove the camera from the open ref map
    openCameraRefs.delete(cameraInfo.portName);

    // Return true to show we closed the camera
    return true;
  };

  /**
   * Trigger a capture on the given camera
   */
  const triggerCaptureAsync = async (cameraInfo: CameraInfo): Promise<void> => {
    // Get the open camera reference, throwing an error if not open
    const camera = openCameraRefs.get(cameraInfo.portName);
    if (!camera) {
      throw new Error(
        `Camera must be opened before attempting to trigger a capture`,
      );
    }

    // Press the shutter button down completely
    await ffi.EdsSendCommand(
      camera,
      EDS_CAMERA_COMMAND_PRESS_SHUTTER_BUTTON,
      EDS_CAMERA_COMMAND_SHUTTER_BUTTON_COMPLETELY,
    );

    // Un-press the shutter button
    await ffi.EdsSendCommand(
      camera,
      EDS_CAMERA_COMMAND_PRESS_SHUTTER_BUTTON,
      EDS_CAMERA_COMMAND_SHUTTER_BUTTON_OFF,
    );
  };

  // Return the methods and raw ffi
  return {
    ffi,
    listAsync,
    openAsync,
    closeAsync,
    triggerCaptureAsync,
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
