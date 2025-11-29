import { performance } from 'node:perf_hooks';
import sharp from 'sharp';

export interface MetadataResult {
  fileName: string;
  fileSize: string;
  imageType: string;
  dimensions: {
    width: number;
    height: number;
  };
  exif?: {
    make?: string;
    model?: string;
    dateTime?: string;
    exposureTime?: string;
    fNumber?: string;
    iso?: string;
    focalLength?: string;
    flash?: string;
    whiteBalance?: string;
    orientation?: string;
  };
  gps?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    timestamp?: string;
    mapsUrl: string;
  };
  thumbnail?: string;
  warnings: string[];
  processingTime: number;
}

/**
 * Convert GPS coordinates from DMS to decimal
 */
function dmsToDecimal(degrees: number, minutes: number, seconds: number, direction: string): number {
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  return decimal;
}

/**
 * Extract image metadata
 */
export async function extractImageMetadata(
  fileBuffer: Buffer,
  fileName: string
): Promise<MetadataResult> {
  const startTime = performance.now();
  
  try {
    const metadata = await sharp(fileBuffer).metadata();
    
    const warnings: string[] = [];
    
    // Basic file info
    const fileSize = (fileBuffer.length / 1024).toFixed(2) + ' KB';
    const imageType = metadata.format?.toUpperCase() || 'Unknown';
    const dimensions = {
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
    
    // Extract EXIF data
    let exifData: MetadataResult['exif'] | undefined;
    if (metadata.exif) {
      const exif = metadata.exif as any;
      
      exifData = {
        make: exif.Make?.toString(),
        model: exif.Model?.toString(),
        dateTime: exif.DateTime?.toString() || exif.DateTimeOriginal?.toString(),
        exposureTime: exif.ExposureTime ? `1/${Math.round(1 / exif.ExposureTime)}` : undefined,
        fNumber: exif.FNumber ? `f/${exif.FNumber}` : undefined,
        iso: exif.ISOSpeedRatings?.toString() || exif.PhotographicSensitivity?.toString(),
        focalLength: exif.FocalLength ? `${exif.FocalLength}mm` : undefined,
        flash: exif.Flash !== undefined ? (exif.Flash === 0 ? 'No Flash' : 'Flash Fired') : undefined,
        whiteBalance: exif.WhiteBalance !== undefined ? (exif.WhiteBalance === 0 ? 'Auto' : 'Manual') : undefined,
        orientation: exif.Orientation?.toString(),
      };
      
      if (exifData.make || exifData.model) {
        warnings.push('Image contains camera information that may identify the device used');
      }
      
      if (exifData.dateTime) {
        warnings.push('Image contains timestamp information revealing when it was taken');
      }
    }
    
    // Extract GPS data
    let gpsData: MetadataResult['gps'] | undefined;
    if (metadata.exif) {
      const exif = metadata.exif as any;
      
      if (exif.GPSLatitude && exif.GPSLongitude) {
        const latDMS = exif.GPSLatitude;
        const lngDMS = exif.GPSLongitude;
        const latRef = exif.GPSLatitudeRef || 'N';
        const lngRef = exif.GPSLongitudeRef || 'E';
        
        const latitude = dmsToDecimal(latDMS[0], latDMS[1], latDMS[2], latRef);
        const longitude = dmsToDecimal(lngDMS[0], lngDMS[1], lngDMS[2], lngRef);
        
        gpsData = {
          latitude,
          longitude,
          altitude: exif.GPSAltitude,
          timestamp: exif.GPSTimeStamp?.join(':'),
          mapsUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
        };
        
        warnings.push('CRITICAL: Image contains GPS coordinates revealing exact location!');
        warnings.push('Remove GPS metadata before sharing to protect privacy');
      }
    }
    
    if (warnings.length === 0) {
      warnings.push('No sensitive metadata detected in this image');
    }
    
    const processingTime = Math.round(performance.now() - startTime);
    
    return {
      fileName,
      fileSize,
      imageType,
      dimensions,
      exif: exifData,
      gps: gpsData,
      warnings,
      processingTime,
    };
  } catch (error: any) {
    throw new Error(`Failed to extract metadata: ${error.message}`);
  }
}
