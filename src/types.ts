export interface CameraInfo {
  portName: string;
  deviceDescription: string;
  deviceSubType: number;
  cameraRef: unknown;
}

export interface CameraModule {
  listAsync(): Promise<CameraInfo[]>;
  openAsync(cameraInfo: CameraInfo): Promise<void>;
  closeAsync(cameraInfo: CameraInfo): Promise<boolean>;
  triggerCaptureAsync(cameraInfo: CameraInfo): Promise<void>;
}
