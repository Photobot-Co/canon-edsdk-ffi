import koffi from "koffi";
import promisify from "util.promisify";

// Creates a function with the given def which returns a promise
const createAsyncFunc = (lib: koffi.IKoffiLib, def: string) => {
  const func = lib.func(def);
  return (...args: unknown[]): Promise<unknown> =>
    promisify(func.async)(...args);
};

export const setupFunctions = (edsdk: koffi.IKoffiLib) => {
  /**
   * Initializes the libraries.
   * When using the EDSDK libraries, you must call this API once before using EDSDK APIs.
   */
  const EdsInitializeSDK = edsdk.func("EdsError EdsInitializeSDK()");

  /**
   * Terminates use of the libraries.
   * This function muse be called when ending the SDK.
   * Calling this function releases all resources allocated by the libraries.
   */
  const EdsTerminateSDK = edsdk.func("EdsError EdsTerminateSDK()");

  /**
   * Decrements the reference counter to an object. When the reference counter reaches 0,
   * the object is released.
   */
  const EdsRelease = edsdk.func("EdsUInt32 EdsRelease(EdsBaseRef inRef)");

  /**
   * Gets camera list objects.
   */
  const EdsGetCameraList = createAsyncFunc(
    edsdk,
    "EdsError EdsGetCameraList(_Out_ EdsCameraListRef* outCameraListRef)",
  );

  /**
   * Gets the number of child objects of the designated object.
   * Example: Number of files in a directory
   */
  const EdsGetChildCount = createAsyncFunc(
    edsdk,
    "EdsError EdsGetChildCount(EdsBaseRef inRef, _Out_ EdsUInt32* outCount)",
  );

  /**
   * Gets an indexed child object of the designated object.
   */
  const EdsGetChildAtIndex = createAsyncFunc(
    edsdk,
    "EdsError EdsGetChildAtIndex(EdsBaseRef inRef, EdsInt32 inIndex, _Out_ EdsBaseRef* outRef)",
  );

  /**
   * Gets device information, such as the device name.
   * Because device information of remote cameras is stored on the host computer, you can use this
   * API before the camera object initiates communication (that is, before a session is opened).
   */
  const EdsGetDeviceInfo = createAsyncFunc(
    edsdk,
    "EdsError EdsGetDeviceInfo(EdsCameraRef inCameraRef, _Out_ EdsDeviceInfo* outDeviceInfo)",
  );

  return {
    EdsInitializeSDK,
    EdsTerminateSDK,
    EdsRelease,
    EdsGetCameraList,
    EdsGetChildCount,
    EdsGetChildAtIndex,
    EdsGetDeviceInfo,
  };
};
