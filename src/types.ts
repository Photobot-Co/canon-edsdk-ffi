export interface CameraInfo {
  portName: string;
  deviceDescription: string;
  deviceSubType: number;
  cameraRef: unknown;
}

export interface CameraModule {
  listAsync(): Promise<CameraInfo[]>;
}
