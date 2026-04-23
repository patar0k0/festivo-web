declare module "open-location-code" {
  export interface OpenLocationCodeCodeArea {
    latitudeCenter: number;
    longitudeCenter: number;
  }

  export class OpenLocationCode {
    decode(code: string): OpenLocationCodeCodeArea;
  }
}
