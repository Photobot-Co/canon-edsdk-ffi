import koffi from "koffi";
import os from "os";
import path from "path";
import { CameraNewImage, EdsdkFfi } from "./types";
import {
  EDS_ACCESS_WRITE,
  EDS_CAMERA_COMMAND_PRESS_SHUTTER_BUTTON,
  EDS_CAMERA_COMMAND_SHUTTER_BUTTON_COMPLETELY,
  EDS_CAMERA_COMMAND_SHUTTER_BUTTON_OFF,
  EDS_DRIVE_MODE_CONTINUOUS,
  EDS_ERR_OK,
  EDS_FILE_CREATE_DISPOSITION_CREATE_ALWAYS,
  EDS_OBJECT_EVENT_ALL,
  EDS_OBJECT_EVENT_DIR_ITEM_REQUEST_TRANSFER,
  EDS_PROPERTY_EVENT_ALL,
  EDS_PROP_ID_DRIVE_MODE,
  EDS_PROP_ID_SAVE_TO,
  EDS_SAVE_TO_HOST,
  EDS_STATE_EVENT_ALL,
} from "./constants";
import { EdsDirectoryItemInfo, makeArrayPointer } from "./ffi";

export class CameraModule {
  /**
   * A boolean which is set to true when the camera connection is open
   */
  private _opened = false;

  /**
   * Listeners for new images from the camera
   */
  private _newImageListeners = new Set<(newImage: CameraNewImage) => void>();

  /**
   * A koffi registered callback for property change events
   */
  private _handlePropertyEventChange:
    | koffi.IKoffiRegisteredCallback
    | undefined = undefined;

  /**
   * A koffi registered callback for object change events
   */
  private _handleObjectEventChange: koffi.IKoffiRegisteredCallback | undefined =
    undefined;

  /**
   * A koffi registered callback for camera state change events
   */
  private _handleStateEventChange: koffi.IKoffiRegisteredCallback | undefined =
    undefined;

  constructor(
    public ffi: EdsdkFfi,
    private _cameraRef: unknown,
  ) {}

  async open(): Promise<void> {
    // Retain the camera reference to avoid it getting collected
    this.ffi.EdsRetain(this._cameraRef);

    // Add the property event callback
    this._handlePropertyEventChange = koffi.register(
      (
        inEvent: number,
        inPropertyID: number,
        inParam: number,
        _inContext: unknown,
      ) => {
        console.log(
          `Property event - inEvent: 0x${inEvent.toString(
            16,
          )} - inPropertyID: 0x${inPropertyID.toString(
            16,
          )} - inParam: 0x${inParam.toString(16)}`,
        );
        return EDS_ERR_OK;
      },
      koffi.pointer(this.ffi.definitions.EdsPropertyEventHandler),
    );
    await this.ffi.EdsSetPropertyEventHandler(
      this._cameraRef,
      EDS_PROPERTY_EVENT_ALL,
      this._handlePropertyEventChange,
      null,
    );

    // Add the object event callback
    this._handleObjectEventChange = koffi.register(
      (inEvent: number, inRef: unknown, _inContext: unknown) => {
        console.log(`Object event - inEvent: 0x${inEvent.toString(16)}`);

        switch (inEvent) {
          /**
           * Notifies that there are objects on a camera to be transferred to a computer.
           * This event is generated after remote release from a computer or local release
           * from a camera.
           *
           * If this event is received, objects indicated in the event data must be downloaded.
           *
           * Furthermore, if the application does not require the objects, instead of downloading
           * them, execute EdsDownloadCancel and release resources held by the camera.
           */
          case EDS_OBJECT_EVENT_DIR_ITEM_REQUEST_TRANSFER:
            console.log("Got photo at at", Date.now());
            this._handleImageDownload(inRef);
            break;
        }
        return EDS_ERR_OK;
      },
      koffi.pointer(this.ffi.definitions.EdsObjectEventHandler),
    );
    await this.ffi.EdsSetObjectEventHandler(
      this._cameraRef,
      EDS_OBJECT_EVENT_ALL,
      this._handleObjectEventChange,
      null,
    );

    // Add the camera state event callback
    this._handleStateEventChange = koffi.register(
      (inEvent: number, inEventData: unknown, _inContext: unknown) => {
        console.log(
          `State event - inEvent: 0x${inEvent.toString(
            16,
          )} - inEventData: ${inEventData}`,
        );
        return EDS_ERR_OK;
      },
      koffi.pointer(this.ffi.definitions.EdsStateEventHandler),
    );
    await this.ffi.EdsSetCameraStateEventHandler(
      this._cameraRef,
      EDS_STATE_EVENT_ALL,
      this._handleStateEventChange,
      null,
    );

    // Open the camera session
    const openSessionResult = await this.ffi.EdsOpenSession(this._cameraRef);
    if (openSessionResult !== EDS_ERR_OK) {
      throw new Error(
        `Unable to open camera session. Result: ${openSessionResult}`,
      );
    }

    // Setup the camera with the settings we need to ensure it can be used
    // Set the camera property to save photos to the host to avoid needing an SDK card
    await this.ffi.EdsSetPropertyData(
      this._cameraRef,
      EDS_PROP_ID_SAVE_TO,
      0,
      koffi.sizeof(this.ffi.definitions.EdsUInt32),
      koffi.as(
        [EDS_SAVE_TO_HOST],
        koffi.pointer(this.ffi.definitions.EdsUInt32),
      ),
    );
    // Set the drive mode
    await this.ffi.EdsSetPropertyData(
      this._cameraRef,
      EDS_PROP_ID_DRIVE_MODE,
      0,
      koffi.sizeof(this.ffi.definitions.EdsUInt32),
      koffi.as(
        [EDS_DRIVE_MODE_CONTINUOUS],
        koffi.pointer(this.ffi.definitions.EdsUInt32),
      ),
    );

    // Set the capacity of the host so the camera knows there's space
    await this.ffi.EdsSetCapacity(this._cameraRef, {
      numberOfFreeClusters: 0x7fffffff,
      bytesPerSector: 0x1000,
      reset: true,
    });

    // We now have an open connection
    this._opened = true;
  }

  async close(): Promise<void> {
    // Nothing to do if we're not already open
    if (!this._opened) {
      return;
    }

    // Unsubscribe from the callbacks
    this.ffi.EdsSetPropertyEventHandler(
      this._cameraRef,
      EDS_PROPERTY_EVENT_ALL,
      null,
      null,
    );
    this.ffi.EdsSetObjectEventHandler(
      this._cameraRef,
      EDS_OBJECT_EVENT_ALL,
      null,
      null,
    );
    this.ffi.EdsSetCameraStateEventHandler(
      this._cameraRef,
      EDS_STATE_EVENT_ALL,
      null,
      null,
    );

    // Unregister and forget the koffi callbacks to free up slots
    if (this._handlePropertyEventChange) {
      koffi.unregister(this._handlePropertyEventChange);
      this._handlePropertyEventChange = undefined;
    }
    if (this._handleObjectEventChange) {
      koffi.unregister(this._handleObjectEventChange);
      this._handleObjectEventChange = undefined;
    }
    if (this._handleStateEventChange) {
      koffi.unregister(this._handleStateEventChange);
      this._handleStateEventChange = undefined;
    }

    // Close the camera session
    await this.ffi.EdsCloseSession(this._cameraRef);

    // Release the camera ref
    this.ffi.EdsRelease(this._cameraRef);

    // We have now closed the connection
    this._opened = true;
  }

  /**
   * Trigger a capture on the given camera
   */
  public async triggerCaptureAsync(): Promise<void> {
    console.log("Triggering at", Date.now());

    // Press the shutter button down completely
    this.ffi.EdsSendCommand(
      this._cameraRef,
      EDS_CAMERA_COMMAND_PRESS_SHUTTER_BUTTON,
      EDS_CAMERA_COMMAND_SHUTTER_BUTTON_COMPLETELY,
    );

    await new Promise((resolve) => setTimeout(resolve, 400));

    // Un-press the shutter button
    this.ffi.EdsSendCommand(
      this._cameraRef,
      EDS_CAMERA_COMMAND_PRESS_SHUTTER_BUTTON,
      EDS_CAMERA_COMMAND_SHUTTER_BUTTON_OFF,
    );

    console.log("Triggered at", Date.now());
  }

  /**
   * Add a listener for new camera images
   */
  public addNewImageListener(
    listener: (newImage: CameraNewImage) => void,
  ): () => void {
    this._newImageListeners.add(listener);

    // Unsubscribe
    return () => {
      this._newImageListeners.delete(listener);
    };
  }

  /**
   * Downloads the given item
   */
  private async _handleImageDownload(directoryItem: unknown): Promise<boolean> {
    // Get directory item information
    const directoryItemInfoPointer = makeArrayPointer();
    const getDirectoryItemInfoResult = this.ffi.EdsGetDirectoryItemInfo(
      directoryItem,
      directoryItemInfoPointer,
    );
    if (getDirectoryItemInfoResult !== EDS_ERR_OK) {
      throw new Error(
        `Unable to get directory item info. Result: ${getDirectoryItemInfoResult}`,
      );
    }
    const directoryItemInfo =
      directoryItemInfoPointer[0] as EdsDirectoryItemInfo;

    // Find a place to put the file
    const filePath = path.join(os.tmpdir(), directoryItemInfo.szFileName);

    // Create a file stream for the destination
    const streamPointer = makeArrayPointer();
    const createFileStreamResult = this.ffi.EdsCreateFileStream(
      filePath,
      EDS_FILE_CREATE_DISPOSITION_CREATE_ALWAYS,
      EDS_ACCESS_WRITE,
      streamPointer,
    );
    if (createFileStreamResult !== EDS_ERR_OK) {
      throw new Error(
        `Unable to create file stream. Result: ${createFileStreamResult}`,
      );
    }
    const stream = streamPointer[0];

    // Download the image
    const downloadResult = this.ffi.EdsDownload(
      directoryItem,
      directoryItemInfo.size,
      stream,
    );
    if (downloadResult !== EDS_ERR_OK) {
      throw new Error(`Unable to download image. Result: ${downloadResult}`);
    }

    // Issue a notification that the download is complete
    const downloadCompleteResult = this.ffi.EdsDownloadComplete(directoryItem);
    if (downloadCompleteResult !== EDS_ERR_OK) {
      console.warn(
        `Unable to mark download as complete. Result ${downloadCompleteResult}`,
      );
    }

    // Release the stream
    this.ffi.EdsRelease(stream);

    // Call the listeners with the new file information
    if (this._newImageListeners.size > 0) {
      // Call all listeners
      const newImage: CameraNewImage = {
        path: filePath,
        filename: directoryItemInfo.szFileName,
        size: directoryItemInfo.size,
        dateTime: directoryItemInfo.dateTime,
      };
      for (const listener of this._newImageListeners.values()) {
        listener(newImage);
      }
    } else {
      console.warn(
        `Got new image, but there were no listeners. Did you forget to all one before triggering?`,
      );
    }

    // Return success
    return true;
  }
}
