export interface EdsDeviceInfo {
  szPortName: string;
  szDeviceDescription: string;
  deviceSubType: number;
  reserved: number;
}

export interface EdsDirectoryItemInfo {
  size: number;
  isFolder: boolean;
  groupID: number;
  option: number;
  szFileName: string;
  format: number;
  dateTime: number;
}
