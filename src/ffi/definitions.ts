import koffi from "koffi";

const EDS_MAX_NAME = 256;

export const setupDefinitions = () => {
  // Basic Types
  const EdsVoid = koffi.alias("EdsVoid", "void");
  const EdsInt32 = koffi.alias("EdsInt32", "int");
  const EdsUInt32 = koffi.alias("EdsUInt32", "unsigned int");
  const EdsChar = koffi.alias("EdsChar", "char");
  const EdsBool = koffi.alias("EdsBool", "bool");

  // Error types
  const EdsError = koffi.alias("EdsError", "EdsUInt32");

  // Property IDs
  const EdsPropertyID = koffi.alias("EdsPropertyID", "EdsUInt32");

  // Data types
  const EdsDataType = koffi.alias("EdsDataType", "EdsUInt32");

  // Reference Types
  const EdsBaseRef = koffi.pointer("EdsBaseRef", koffi.opaque(), 1);
  const EdsCameraListRef = koffi.alias("EdsCameraListRef", "EdsBaseRef");
  const EdsCameraRef = koffi.alias("EdsCameraRef", "EdsBaseRef");
  const EdsVolumeRef = koffi.alias("EdsVolumeRef", "EdsBaseRef");
  const EdsDirectoryItemRef = koffi.alias("EdsDirectoryItemRef", "EdsBaseRef");
  const EdsStreamRef = koffi.alias("EdsStreamRef", "EdsBaseRef");
  const EdsImageRef = koffi.alias("EdsImageRef", "EdsStreamRef");
  const EdsEvfImageRef = koffi.alias("EdsEvfImageRef", "EdsBaseRef");

  // Events
  const EdsPropertyEvent = koffi.alias("EdsPropertyEvent", "EdsUInt32");
  const EdsObjectEvent = koffi.alias("EdsObjectEvent", "EdsUInt32");
  const EdsStateEvent = koffi.alias("EdsStateEvent", "EdsUInt32");

  // Event handler
  const EdsPropertyEventHandler = koffi.proto(
    "EdsError __stdcall EdsPropertyEventHandler(EdsPropertyEvent inEvent, EdsPropertyID inPropertyID, EdsUInt32 inParam, EdsVoid* inContext)",
  );
  const EdsObjectEventHandler = koffi.proto(
    "EdsError __stdcall EdsObjectEventHandler(EdsObjectEvent inEvent, EdsBaseRef inRef, EdsVoid* inContext)",
  );
  const EdsStateEventHandler = koffi.proto(
    "EdsError __stdcall EdsStateEventHandler(EdsStateEvent inEvent, EdsUInt32 inEventData, EdsVoid* inContext)",
  );

  // Device Info
  const EdsDeviceInfo = koffi.struct("EdsDeviceInfo", {
    szPortName: koffi.array("EdsChar", EDS_MAX_NAME),
    szDeviceDescription: koffi.array("EdsChar", EDS_MAX_NAME),
    deviceSubType: "EdsUInt32",
    reserved: "EdsUInt32",
  });

  // Capacity
  const EdsCapacity = koffi.struct("EdsCapacity", {
    numberOfFreeClusters: "EdsInt32",
    bytesPerSector: "EdsInt32",
    reset: "EdsBool",
  });

  // Camera commands
  const EdsCameraCommand = koffi.alias("EdsCameraCommand", "EdsUInt32");

  return {
    EdsVoid,
    EdsInt32,
    EdsUInt32,
    EdsChar,
    EdsBool,

    EdsError,

    EdsPropertyID,

    EdsDataType,

    EdsBaseRef,
    EdsCameraListRef,
    EdsCameraRef,
    EdsVolumeRef,
    EdsDirectoryItemRef,
    EdsStreamRef,
    EdsImageRef,
    EdsEvfImageRef,

    EdsPropertyEvent,
    EdsObjectEvent,
    EdsStateEvent,

    EdsPropertyEventHandler,
    EdsObjectEventHandler,
    EdsStateEventHandler,

    EdsDeviceInfo,

    EdsCapacity,

    EdsCameraCommand,
  };
};
