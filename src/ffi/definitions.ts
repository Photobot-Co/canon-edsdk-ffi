import koffi from "koffi";

const EDS_MAX_NAME = 256;

export const setupDefinitions = () => {
  // Basic Types
  const EdsInt32 = koffi.alias("EdsInt32", "int");
  const EdsUInt32 = koffi.alias("EdsUInt32", "unsigned int");
  const EdsChar = koffi.alias("EdsChar", "char");

  // Error types
  const EdsError = koffi.alias("EdsError", "EdsUInt32");

  // Reference Types
  const EdsBaseRef = koffi.pointer("EdsBaseRef", koffi.opaque(), 1);
  const EdsCameraListRef = koffi.alias("EdsCameraListRef", "EdsBaseRef");
  const EdsCameraRef = koffi.alias("EdsCameraRef", "EdsBaseRef");
  const EdsVolumeRef = koffi.alias("EdsVolumeRef", "EdsBaseRef");
  const EdsDirectoryItemRef = koffi.alias("EdsDirectoryItemRef", "EdsBaseRef");
  const EdsStreamRef = koffi.alias("EdsStreamRef", "EdsBaseRef");
  const EdsImageRef = koffi.alias("EdsImageRef", "EdsStreamRef");
  const EdsEvfImageRef = koffi.alias("EdsEvfImageRef", "EdsBaseRef");

  // Device Info
  const EdsDeviceInfo = koffi.struct("EdsDeviceInfo", {
    szPortName: koffi.array("EdsChar", EDS_MAX_NAME),
    szDeviceDescription: koffi.array("EdsChar", EDS_MAX_NAME),
    deviceSubType: "EdsUInt32",
    reserved: "EdsUInt32",
  });

  // Camera commands
  const EdsCameraCommand = koffi.alias("EdsCameraCommand", "EdsUInt32");

  return {
    EdsInt32,
    EdsUInt32,
    EdsChar,

    EdsError,

    EdsBaseRef,
    EdsCameraListRef,
    EdsCameraRef,
    EdsVolumeRef,
    EdsDirectoryItemRef,
    EdsStreamRef,
    EdsImageRef,
    EdsEvfImageRef,

    EdsDeviceInfo,

    EdsCameraCommand,
  };
};
