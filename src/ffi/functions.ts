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
   * Increments the reference counter of existing objects.
   */
  const EdsRetain = edsdk.func("EdsUInt32 EdsRetain(EdsBaseRef inRef)");

  /**
   * Decrements the reference counter to an object. When the reference counter reaches 0,
   * the object is released.
   */
  const EdsRelease = edsdk.func("EdsUInt32 EdsRelease(EdsBaseRef inRef)");

  /**
   * This function acquires an event from camera.
   * In console application, please call this function regularly to acquire the event from a camera.
   */
  const EdsGetEvent = edsdk.func("EdsError EdsGetEvent()");

  /**
   * Registers a callback function for receiving status change notification events for property
   * states on a camera.
   */
  const EdsSetPropertyEventHandler = edsdk.func(
    "EdsError EdsSetPropertyEventHandler(EdsCameraRef inCameraRef, EdsPropertyEvent inEvent, EdsPropertyEventHandler* inPropertyEventHandler, EdsVoid* inContext)",
  );

  /**
   * Registers a callback function for receiving status change notification events for objects on
   * a remote camera.
   * Here, object means volumes representing memory cards, files and directories, and shot images
   * stored in memory, in particular.
   */
  const EdsSetObjectEventHandler = edsdk.func(
    "EdsError EdsSetObjectEventHandler(EdsCameraRef inCameraRef, EdsObjectEvent inEvent, EdsObjectEventHandler* inObjectEventHandler, EdsVoid* inContext)",
  );

  /**
   * Registers a callback function for receiving status change notification events for property
   * states on a camera.
   */
  const EdsSetCameraStateEventHandler = edsdk.func(
    "EdsError EdsSetCameraStateEventHandler(EdsCameraRef inCameraRef, EdsStateEvent inEvent, EdsStateEventHandler* inStateEventHandler, EdsVoid* inContext)",
  );

  /**
   * Gets camera list objects.
   */
  const EdsGetCameraList = edsdk.func(
    "EdsError EdsGetCameraList(_Out_ EdsCameraListRef* outCameraListRef)",
  );

  /**
   * Gets the number of child objects of the designated object.
   * Example: Number of files in a directory
   */
  const EdsGetChildCount = edsdk.func(
    "EdsError EdsGetChildCount(EdsBaseRef inRef, _Out_ EdsUInt32* outCount)",
  );

  /**
   * Gets an indexed child object of the designated object.
   */
  const EdsGetChildAtIndex = edsdk.func(
    "EdsError EdsGetChildAtIndex(EdsBaseRef inRef, EdsInt32 inIndex, _Out_ EdsBaseRef* outRef)",
  );

  const EdsSetCapacity = edsdk.func(
    "EdsError EdsSetCapacity(EdsCameraRef inCameraRef, EdsCapacity inCapacity)",
  );

  /**
   * Gets device information, such as the device name.
   * Because device information of remote cameras is stored on the host computer, you can use this
   * API before the camera object initiates communication (that is, before a session is opened).
   */
  const EdsGetDeviceInfo = edsdk.func(
    "EdsError EdsGetDeviceInfo(EdsCameraRef inCameraRef, _Out_ EdsDeviceInfo* outDeviceInfo)",
  );

  const EdsGetPropertySize = edsdk.func(
    "EdsError EdsGetPropertySize(EdsBaseRef inRef, EdsPropertyID inPropertyID, EdsInt32 inParam, _Out_ EdsDataType* outDataType, _Out_ EdsUInt32* outSize)",
  );

  /**
   * Sets property data for the object designated in inRef.
   */
  const EdsSetPropertyData = edsdk.func(
    "EdsError EdsSetPropertyData(EdsBaseRef inRef, EdsPropertyID inPropertyID, EdsInt32 inParam, EdsUInt32 inPropertySize, const EdsVoid* inPropertyData)",
  );

  /**
   * Establishes a logical connection with a remote camera.
   * Use this API after getting the camera's EdsCamera object.
   */
  const EdsOpenSession = edsdk.func(
    "EdsError EdsOpenSession(EdsCameraRef inCameraRef)",
  );

  /**
   * Closes a logical connection with a remote camera.
   */
  const EdsCloseSession = edsdk.func(
    "EdsError EdsCloseSession(EdsCameraRef inCameraRef)",
  );

  /**
   * Sends a command such as "Shoot" to a remote camera.
   */
  const EdsSendCommand = createAsyncFunc(
    edsdk,
    "EdsError EdsSendCommand(EdsCameraRef inCameraRef, EdsCameraCommand inCommand, EdsInt32 inParam)",
  );

  /**
   * Gets information about the directory or file objects on the memory card (volume) in a remote camera.
   */
  const EdsGetDirectoryItemInfo = edsdk.func(
    "EdsError EdsGetDirectoryItemInfo(EdsDirectoryItemRef inDirItemRef, _Out_ EdsDirectoryItemInfo* outDirItemInfo)",
  );

  /**
   * Creates a new file on a host computer (or opens an existing file) and creates a
   * file stream for access to the file.
   *
   * If a new file is designated before executing this API, the file is actually created
   * following the timing of writing by means of EdsWrite or the like with respect to an open stream.
   */
  const EdsCreateFileStream = edsdk.func(
    "EdsError EdsCreateFileStream(const EdsChar* inFileName, EdsFileCreateDisposition inCreateDisposition, EdsAccess inDesiredAccess, _Out_ EdsStreamRef* outStream)",
  );

  /**
   * Downloads a file on a remote camera (in the camera memory or on a memory card) to the host computer.
   * The downloaded file is sent directly to a file stream created in advance.
   * When dividing the file being retrieved, call this API repeatedly.
   * Also in this case, make the data block size a multiple of 512 (bytes), excluding the final block.
   */
  const EdsDownload = edsdk.func(
    "EdsError EdsDownload(EdsDirectoryItemRef inDirItemRef, EdsUInt64 inReadSize, _Out_ EdsStreamRef outStream)",
  );

  /**
   * Must be called when downloading of directory items is complete.
   * Executing this API makes the camera recognize that file transmission is complete.
   * This operation need not be executed when using EdsDownloadThumbnail.
   */
  const EdsDownloadComplete = edsdk.func(
    "EdsError EdsDownloadComplete(EdsDirectoryItemRef inDirItemRef)",
  );

  /**
   * Must be executed when downloading of a directory item is canceled.
   * Calling this API makes the camera cancel file transmission.
   * It also releases resources.
   * This operation need not be executed when using EdsDownloadThumbnail.
   */
  const EdsDownloadCancel = edsdk.func(
    "EdsError EdsDownloadCancel(EdsDirectoryItemRef inDirItemRef)",
  );

  return {
    EdsInitializeSDK,
    EdsTerminateSDK,
    EdsRetain,
    EdsRelease,
    EdsGetEvent,
    EdsSetPropertyEventHandler,
    EdsSetObjectEventHandler,
    EdsSetCameraStateEventHandler,
    EdsGetCameraList,
    EdsGetChildCount,
    EdsGetChildAtIndex,
    EdsSetCapacity,
    EdsGetDeviceInfo,
    EdsGetPropertySize,
    EdsSetPropertyData,
    EdsOpenSession,
    EdsCloseSession,
    EdsSendCommand,
    EdsGetDirectoryItemInfo,
    EdsCreateFileStream,
    EdsDownload,
    EdsDownloadComplete,
    EdsDownloadCancel,
  };
};
