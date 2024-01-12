import { EdsDeviceInfo, makeArrayPointer } from "./ffi";
import { EdsdkFfi, CameraInfo } from "./types";
import { CameraModule } from "./CameraModule";
import { EDS_ERR_OK } from "./constants";

// How often to call the EdsGetEvent method to trigger events to be passed through
const EVENT_LOOP_INTERVAL_MS = 10;

export class EdsdkModule {
  // This will store the references to the open cameras so they can be used later using the port number as a key
  private _openCameras = new Map<string, CameraModule>();

  // The handle which is used for the event loop interval
  private _eventLoopIntervalHandle: ReturnType<typeof setInterval> | null =
    null;

  constructor(public ffi: EdsdkFfi) {}

  /**
   * Terminate the module
   */
  public async terminate(): Promise<void> {
    // Close all cameras in the open cameras map
    await Promise.all(
      Array.from(this._openCameras.values()).map((cameraModule) =>
        cameraModule.close(),
      ),
    );
    this._openCameras.clear();

    // Stop the event loop
    this._stopEventLoop();
  }

  /**
   * List the cameras that are currently connected
   */
  public async listAsync(): Promise<CameraInfo[]> {
    // Get the list of cameras
    const { cameras, releaseCamerasList } = await this._listCamerasAsync();

    // Map to remove the camera reference
    const camerasInfo = cameras.map(
      ({ cameraRef: _, ...cameraInfo }) => cameraInfo,
    );

    // Release the camera list to ensure the memory is freed
    await releaseCamerasList();

    // Return the camera info list
    return camerasInfo;
  }

  /**
   * Opens a connection to a camera
   */
  public async openAsync(cameraInfo: CameraInfo): Promise<void> {
    // If the camera is already open then just return as there's nothing to do
    if (this._openCameras.has(cameraInfo.portName)) {
      return;
    }

    // Get the list of cameras
    const { cameras, releaseCamerasList } = await this._listCamerasAsync();

    // Find the camera with the matching camera info
    const foundCamera = cameras.find((c) => c.portName === cameraInfo.portName);
    if (!foundCamera) {
      throw new Error(
        `Unable to find camera at port name ${cameraInfo.portName}`,
      );
    }

    // Create a new CameraModule for the given camera
    const cameraModule = new CameraModule(this.ffi, foundCamera.cameraRef);

    // Open the camera using the module
    await cameraModule.open();

    // Ensure the event loop is started
    this._startEventLoop();

    // Release the camera list as we no longer need it and the camera we're connected to will be retained
    await releaseCamerasList();

    // Store an instance of the camera
    this._openCameras.set(cameraInfo.portName, cameraModule);
  }

  /**
   * Closes the connection to the camera
   */
  public async closeAsync(cameraInfo: CameraInfo): Promise<boolean> {
    // Get the open camera reference, returning early if the camera is already closed
    const camera = this._openCameras.get(cameraInfo.portName);
    if (!camera) {
      return false;
    }

    // Close the camera connection
    await camera.close();

    // Remove the camera from the open ref map
    this._openCameras.delete(cameraInfo.portName);

    // If there are no longer any open cameras then stop the event loop
    if (this._openCameras.size === 0) {
      this._stopEventLoop();
    }

    // Return true to show we closed the camera
    return true;
  }

  /**
   * Trigger a capture on the given camera
   */
  public async triggerCaptureAsync(cameraInfo: CameraInfo): Promise<void> {
    // Get the open camera reference, throwing an error if not open
    const camera = this._openCameras.get(cameraInfo.portName);
    if (!camera) {
      throw new Error(
        `Camera must be opened before attempting to trigger a capture`,
      );
    }

    await camera.triggerCaptureAsync();
  }

  /**
   * Start the event loop, if it isn't already
   */
  private _startEventLoop() {
    // Nothing to do if we're already running
    if (this._eventLoopIntervalHandle) {
      return;
    }

    this._eventLoopIntervalHandle = setInterval(() => {
      this.ffi.EdsGetEvent();
    }, EVENT_LOOP_INTERVAL_MS);
  }

  /**
   * Stop the event loop if it's started
   */
  private _stopEventLoop() {
    if (this._eventLoopIntervalHandle) {
      clearInterval(this._eventLoopIntervalHandle);
      this._eventLoopIntervalHandle = null;
    }
  }

  /**
   * Queries the SDK and returns an array of cameras that are currently connected. This includes
   * the details and a cameraRef which can be used to connect to it.
   *
   * NOTE: You must call the releaseCamerasList() method when we're done to avoid a memory leak
   */
  private async _listCamerasAsync(): Promise<{
    cameras: (CameraInfo & { cameraRef: unknown })[];
    releaseCamerasList: () => Promise<void>;
  }> {
    // Create a new list to retrieve results into
    const listPointer = makeArrayPointer();

    // Get the cameras and put them into a list with the pointer
    const listResult = await this.ffi.EdsGetCameraList(listPointer);
    if (listResult !== EDS_ERR_OK) {
      throw new Error(`Unable to get the camera list. Result: ${listResult}`);
    }
    const cameraList = listPointer[0];

    // Get the number of cameras which were detected
    const countPointer = makeArrayPointer();
    const countResult = await this.ffi.EdsGetChildCount(
      cameraList,
      countPointer,
    );
    if (countResult !== EDS_ERR_OK) {
      throw new Error(`Unable to get the camera count. Result: ${countResult}`);
    }
    const count = countPointer[0] as number;

    // For each camera, get the device info and return the camera info array
    const cameras: (CameraInfo & { cameraRef: unknown })[] = [];
    for (let cameraIndex = 0; cameraIndex < count; cameraIndex += 1) {
      const cameraRefPointer = makeArrayPointer();
      const getChildResult = await this.ffi.EdsGetChildAtIndex(
        cameraList,
        cameraIndex,
        cameraRefPointer,
      );
      if (getChildResult !== EDS_ERR_OK) {
        throw new Error(
          `Unable to get the camera at index ${cameraIndex}. Result: ${getChildResult}`,
        );
      }
      const cameraRef = cameraRefPointer[0];

      const deviceInfoPointer = makeArrayPointer();
      const getDeviceInfoResult = await this.ffi.EdsGetDeviceInfo(
        cameraRef,
        deviceInfoPointer,
      );
      if (getDeviceInfoResult !== EDS_ERR_OK) {
        throw new Error(
          `Unable to get the camera info at index ${cameraIndex}. Result: ${getDeviceInfoResult}`,
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

    return {
      cameras,
      releaseCamerasList: async () => {
        // Release the camera list
        this.ffi.EdsRelease(cameraList);
      },
    };
  }
}
