import koffi from "koffi";
import { EdsdkFfi } from "./types";
import {
  EDS_CAMERA_COMMAND_PRESS_SHUTTER_BUTTON,
  EDS_CAMERA_COMMAND_SHUTTER_BUTTON_COMPLETELY,
  EDS_CAMERA_COMMAND_SHUTTER_BUTTON_OFF,
  EDS_ERR_OK,
  EDS_OBJECT_EVENT_ALL,
  EDS_PROPERTY_EVENT_ALL,
  EDS_PROP_ID_SAVE_TO,
  EDS_SAVE_TO_HOST,
  EDS_STATE_EVENT_ALL,
} from "./constants";
import { makeArrayPointer } from "./ffi";

export class CameraModule {
  private _opened = false;
  private _handlePropertyEventChange:
    | koffi.IKoffiRegisteredCallback
    | undefined = undefined;
  private _handleObjectEventChange: koffi.IKoffiRegisteredCallback | undefined =
    undefined;
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
      (inEvent: unknown, _inRef: unknown, _inContext: unknown) => {
        console.log(`Object event - inEvent: ${inEvent}`);
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
      (inEvent: unknown, inEventData: unknown, _inContext: unknown) => {
        console.log(
          `State event - inEvent: ${inEvent} - inEventData: ${inEventData}`,
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
    const propertyDataTypePointer = makeArrayPointer();
    const propertySizePointer = makeArrayPointer();
    await this.ffi.EdsGetPropertySize(
      this._cameraRef,
      EDS_PROP_ID_SAVE_TO,
      0,
      propertyDataTypePointer,
      propertySizePointer,
    );
    await this.ffi.EdsSetPropertyData(
      this._cameraRef,
      EDS_PROP_ID_SAVE_TO,
      0,
      propertySizePointer[0],
      koffi.as(
        [EDS_SAVE_TO_HOST],
        koffi.pointer(this.ffi.definitions.EdsInt32),
      ),
    );

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
    // Set the capacity of the host so the camera knows there's space
    await this.ffi.EdsSetCapacity(this._cameraRef, {
      numberOfFreeClusters: 0x7fffffff,
      bytesPerSector: 0x1000,
      reset: true,
    });

    // Press the shutter button down completely
    await this.ffi.EdsSendCommand(
      this._cameraRef,
      EDS_CAMERA_COMMAND_PRESS_SHUTTER_BUTTON,
      EDS_CAMERA_COMMAND_SHUTTER_BUTTON_COMPLETELY,
    );

    // Un-press the shutter button
    await this.ffi.EdsSendCommand(
      this._cameraRef,
      EDS_CAMERA_COMMAND_PRESS_SHUTTER_BUTTON,
      EDS_CAMERA_COMMAND_SHUTTER_BUTTON_OFF,
    );
  }
}
