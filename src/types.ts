import type { getFfi } from "./ffi";

export type EdsdkFfi = ReturnType<typeof getFfi>;

export interface CameraInfo {
  portName: string;
  deviceDescription: string;
  deviceSubType: number;
}

export interface CameraModule {
  startEventLoop(): void;
  stopEventLoop(): void;
  listAsync(): Promise<CameraInfo[]>;
  openAsync(cameraInfo: CameraInfo): Promise<void>;
  closeAsync(cameraInfo: CameraInfo): Promise<boolean>;
  triggerCaptureAsync(cameraInfo: CameraInfo): Promise<void>;
}
