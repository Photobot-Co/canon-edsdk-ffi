import koffi from "koffi";
import { EdsDeviceInfo, getFfi, makeArrayPointer } from "./ffi";
import { CameraInfo, CameraModule } from "./types";

const EVENT_LOOP_INTERVAL_MS = 10;

const EDS_ERR_OK = 0;

const EDS_PROPERTY_EVENT_ALL = 0x100;
const EDS_OBJECT_EVENT_ALL = 0x200;
const EDS_STATE_EVENT_ALL = 0x300;

const EDS_PROP_ID_SAVE_TO = 0xb;
const EDS_SAVE_TO_HOST = 2;

// const EDS_CAMERA_COMMAND_TAKE_PICTURE = 0x0;
const EDS_CAMERA_COMMAND_PRESS_SHUTTER_BUTTON = 0x4;
const EDS_CAMERA_COMMAND_SHUTTER_BUTTON_OFF = 0x0;
const EDS_CAMERA_COMMAND_SHUTTER_BUTTON_COMPLETELY = 0x3;

interface OpenCameraRef {
  cameraRef: unknown;
  callbacks: unknown[];
  destroy: () => Promise<void>;
}

export type LoadedLib = CameraModule & { ffi: ReturnType<typeof getFfi> };
export type LoadedLibInternal = LoadedLib & { _terminate: () => void };

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

  let eventLoopIntervalHandle: ReturnType<typeof setInterval> | null = null;
  const startEventLoop = () => {
    // Nothing to do if we're already running
    if (eventLoopIntervalHandle) {
      return;
    }

    eventLoopIntervalHandle = setInterval(() => {
      ffi.EdsGetEvent();
    }, EVENT_LOOP_INTERVAL_MS);
  };
  const stopEventLoop = () => {
    if (eventLoopIntervalHandle) {
      clearInterval(eventLoopIntervalHandle);
      eventLoopIntervalHandle = null;
    }
  };

  // This will store the references to the open cameras so they can be used later
  const openCameraRefs = new Map<string, OpenCameraRef>();

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

      ffi.EdsRetain(cameraRef);

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

    // Register the callbacks for the camera state changes
    const handlePropertyEventChange = koffi.register(
      (
        inEvent: unknown,
        inPropertyID: unknown,
        inParam: unknown,
        _inContext: unknown,
      ) => {
        console.log(
          `Property event - inEvent: ${inEvent} - inPropertyID: ${inPropertyID} - inParam: ${inParam}`,
        );
        return EDS_ERR_OK;
      },
      koffi.pointer(ffi.definitions.EdsPropertyEventHandler),
    );
    await ffi.EdsSetPropertyEventHandler(
      cameraInfo.cameraRef,
      EDS_PROPERTY_EVENT_ALL,
      handlePropertyEventChange,
      null,
    );

    const handleObjectEventChange = koffi.register(
      (inEvent: unknown, _inRef: unknown, _inContext: unknown) => {
        console.log(`Object event - inEvent: ${inEvent}`);
        return EDS_ERR_OK;
      },
      koffi.pointer(ffi.definitions.EdsObjectEventHandler),
    );
    await ffi.EdsSetObjectEventHandler(
      cameraInfo.cameraRef,
      EDS_OBJECT_EVENT_ALL,
      handleObjectEventChange,
      null,
    );

    const handleStateEventChange = koffi.register(
      (inEvent: unknown, inEventData: unknown, _inContext: unknown) => {
        console.log(
          `State event - inEvent: ${inEvent} - inEventData: ${inEventData}`,
        );
        return EDS_ERR_OK;
      },
      koffi.pointer(ffi.definitions.EdsStateEventHandler),
    );
    await ffi.EdsSetCameraStateEventHandler(
      cameraInfo.cameraRef,
      EDS_STATE_EVENT_ALL,
      handleStateEventChange,
      null,
    );

    // Open the camera session
    const openSessionResult = await ffi.EdsOpenSession(cameraInfo.cameraRef);
    if (openSessionResult !== EDS_ERR_OK) {
      throw new Error(
        `Unable to open camera session. Result: ${openSessionResult}`,
      );
    }

    // Set the camera property to save photos to the host to avoid needing an SDK card
    const propertyDataTypePointer = makeArrayPointer();
    const propertySizePointer = makeArrayPointer();
    await ffi.EdsGetPropertySize(
      cameraInfo.cameraRef,
      EDS_PROP_ID_SAVE_TO,
      0,
      propertyDataTypePointer,
      propertySizePointer,
    );
    await ffi.EdsSetPropertyData(
      cameraInfo.cameraRef,
      EDS_PROP_ID_SAVE_TO,
      0,
      propertySizePointer[0],
      koffi.as([EDS_SAVE_TO_HOST], koffi.pointer(ffi.definitions.EdsInt32)),
    );

    // Ensure the event loop is started
    startEventLoop();

    // Store an instance of the camera
    openCameraRefs.set(cameraInfo.portName, {
      cameraRef: cameraInfo.cameraRef,
      callbacks: [
        handlePropertyEventChange,
        handleObjectEventChange,
        handleStateEventChange,
      ],
      destroy: async () => {
        // Unsubscribe from the callbacks
        ffi.EdsSetPropertyEventHandler(
          cameraInfo.cameraRef,
          EDS_STATE_EVENT_ALL,
          null,
          null,
        );
        ffi.EdsSetObjectEventHandler(
          cameraInfo.cameraRef,
          EDS_STATE_EVENT_ALL,
          null,
          null,
        );
        ffi.EdsSetCameraStateEventHandler(
          cameraInfo.cameraRef,
          EDS_STATE_EVENT_ALL,
          null,
          null,
        );

        koffi.unregister(handlePropertyEventChange);
        koffi.unregister(handleObjectEventChange);
        koffi.unregister(handleStateEventChange);

        // Exit the camera
        await ffi.EdsCloseSession(cameraInfo.cameraRef);
        // Release the camera ref
        ffi.EdsRelease(cameraInfo.cameraRef);
      },
    });
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
    await camera.destroy();

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

    // Set the capacity of the host so the camera knows there's space
    await ffi.EdsSetCapacity(camera.cameraRef, {
      numberOfFreeClusters: 0x7fffffff,
      bytesPerSector: 0x1000,
      reset: true,
    });

    // Press the shutter button down completely
    await ffi.EdsSendCommand(
      camera.cameraRef,
      EDS_CAMERA_COMMAND_PRESS_SHUTTER_BUTTON,
      EDS_CAMERA_COMMAND_SHUTTER_BUTTON_COMPLETELY,
    );

    // Un-press the shutter button
    await ffi.EdsSendCommand(
      camera.cameraRef,
      EDS_CAMERA_COMMAND_PRESS_SHUTTER_BUTTON,
      EDS_CAMERA_COMMAND_SHUTTER_BUTTON_OFF,
    );
  };

  const _terminate = () => {
    stopEventLoop();
    ffi.EdsTerminateSDK();
  };

  // Return the methods and raw ffi
  return {
    ffi,
    startEventLoop,
    stopEventLoop,
    listAsync,
    openAsync,
    closeAsync,
    triggerCaptureAsync,
    _terminate,
  };
};

// Store a copy of the loaded library so it's a singleton
let loadedLib: LoadedLibInternal | undefined;

/**
 * Load the library and return the interface and methods
 */
export const loadEdsdk = async (): Promise<LoadedLib> => {
  if (!loadedLib) {
    loadedLib = await loadInternal();
  }
  return loadedLib;
};

export const unloadEdsdk = async () => {
  if (loadedLib) {
    loadedLib._terminate();
    loadedLib = undefined;
  }
};

export * from "./types";
