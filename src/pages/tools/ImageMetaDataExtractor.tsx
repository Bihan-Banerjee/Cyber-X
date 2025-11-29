import { useState, useRef } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Upload, X, Image as ImageIcon, MapPin, Camera, Calendar, Copy, Check, Download, ExternalLink } from "lucide-react";

interface MetadataResult {
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

const ImageMetadataExtractor = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<MetadataResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file');
        return;
      }
      setUploadedFile(file);
      setResult(null);
      setError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExtract = async () => {
    if (!uploadedFile) return;

    setIsExtracting(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', uploadedFile);

      const response = await fetch("http://localhost:3001/api/scan/image-metadata", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Extraction failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to extract metadata");
    } finally {
      setIsExtracting(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const downloadMetadata = () => {
    if (!result) return;

    let content = `Image Metadata Report\n`;
    content += `=====================\n\n`;
    content += `File Name: ${result.fileName}\n`;
    content += `File Size: ${result.fileSize}\n`;
    content += `Image Type: ${result.imageType}\n`;
    content += `Dimensions: ${result.dimensions.width}x${result.dimensions.height}\n\n`;

    if (result.exif) {
      content += `EXIF Data:\n`;
      content += `-----------\n`;
      Object.entries(result.exif).forEach(([key, value]) => {
        if (value) content += `${key}: ${value}\n`;
      });
      content += `\n`;
    }

    if (result.gps) {
      content += `GPS Location:\n`;
      content += `-------------\n`;
      content += `Latitude: ${result.gps.latitude}\n`;
      content += `Longitude: ${result.gps.longitude}\n`;
      if (result.gps.altitude) content += `Altitude: ${result.gps.altitude}m\n`;
      if (result.gps.timestamp) content += `Timestamp: ${result.gps.timestamp}\n`;
      content += `Maps URL: ${result.gps.mapsUrl}\n`;
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metadata_${result.fileName.replace(/\.[^/.]+$/, '')}_${Date.now()}.txt`;
    a.click();
  };

  return (
    <CyberpunkCard title="IMAGE METADATA EXTRACTOR">
      <div className="space-y-6">
        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              UPLOAD IMAGE
            </label>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/tiff,image/webp,image/heic"
                onChange={handleFileSelect}
                className="hidden"
                id="image-file-input"
              />
              <label
                htmlFor="image-file-input"
                className="flex-1 flex items-center justify-center gap-2 p-6 bg-black/50 border-2 border-dashed border-cyber-cyan/30 rounded cursor-pointer hover:border-cyber-cyan/50 transition-colors"
              >
                <Upload className="w-6 h-6 text-cyber-cyan" />
                <div className="text-center">
                  <p className="text-cyber-cyan text-sm font-semibold">
                    {uploadedFile ? uploadedFile.name : "Click to upload image"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Supports JPEG, PNG, TIFF, WebP, HEIC
                  </p>
                </div>
              </label>
              {uploadedFile && (
                <button
                  onClick={handleRemoveFile}
                  className="p-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-red-400" />
                </button>
              )}
            </div>
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="glass-panel rounded p-4">
              <h3 className="text-sm font-bold text-cyber-cyan mb-3">IMAGE PREVIEW</h3>
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full max-h-64 object-contain rounded border border-cyber-cyan/30"
              />
            </div>
          )}

          <Button
            onClick={handleExtract}
            disabled={isExtracting || !uploadedFile}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isExtracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                EXTRACTING METADATA...
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 h-4 w-4" />
                EXTRACT METADATA
              </>
            )}
          </Button>

          <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
            <p className="font-semibold text-cyber-cyan mb-1">ℹ️ Image Metadata Extraction</p>
            <p>Extracts EXIF, GPS, and camera data from images. Reveals camera settings, timestamps, geolocation, and more. All processing is done locally - images are not stored.</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {result && (
          <div className="border-t border-cyber-red/30 pt-6 space-y-6">
            {/* File Info */}
            <div className="glass-panel rounded p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan">FILE INFORMATION</h3>
                <Button
                  onClick={downloadMetadata}
                  className="px-3 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs"
                  size="sm"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Export
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 mb-1">File Name</p>
                  <p className="text-sm text-cyber-cyan font-semibold break-all">{result.fileName}</p>
                </div>
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 mb-1">File Size</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.fileSize}</p>
                </div>
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 mb-1">Image Type</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.imageType}</p>
                </div>
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 mb-1">Dimensions</p>
                  <p className="text-sm text-cyber-cyan font-semibold">
                    {result.dimensions.width} × {result.dimensions.height}
                  </p>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-400">
                Processing time: {result.processingTime}ms
              </div>
            </div>

            {/* EXIF Data */}
            {result.exif && (
              <div className="glass-panel rounded p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Camera className="w-5 h-5 text-cyber-cyan" />
                  <h3 className="text-lg font-bold text-cyber-cyan">EXIF DATA</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  {result.exif.make && (
                    <div className="p-3 bg-black/30 rounded">
                      <p className="text-xs text-gray-500 mb-1">Camera Make</p>
                      <p className="text-sm text-cyber-cyan font-semibold">{result.exif.make}</p>
                    </div>
                  )}
                  {result.exif.model && (
                    <div className="p-3 bg-black/30 rounded">
                      <p className="text-xs text-gray-500 mb-1">Camera Model</p>
                      <p className="text-sm text-cyber-cyan font-semibold">{result.exif.model}</p>
                    </div>
                  )}
                  {result.exif.dateTime && (
                    <div className="p-3 bg-black/30 rounded">
                      <p className="text-xs text-gray-500 mb-1">Date Taken</p>
                      <p className="text-sm text-cyber-cyan font-semibold">{result.exif.dateTime}</p>
                    </div>
                  )}
                  {result.exif.exposureTime && (
                    <div className="p-3 bg-black/30 rounded">
                      <p className="text-xs text-gray-500 mb-1">Exposure Time</p>
                      <p className="text-sm text-cyber-cyan font-semibold">{result.exif.exposureTime}</p>
                    </div>
                  )}
                  {result.exif.fNumber && (
                    <div className="p-3 bg-black/30 rounded">
                      <p className="text-xs text-gray-500 mb-1">F-Number</p>
                      <p className="text-sm text-cyber-cyan font-semibold">{result.exif.fNumber}</p>
                    </div>
                  )}
                  {result.exif.iso && (
                    <div className="p-3 bg-black/30 rounded">
                      <p className="text-xs text-gray-500 mb-1">ISO</p>
                      <p className="text-sm text-cyber-cyan font-semibold">{result.exif.iso}</p>
                    </div>
                  )}
                  {result.exif.focalLength && (
                    <div className="p-3 bg-black/30 rounded">
                      <p className="text-xs text-gray-500 mb-1">Focal Length</p>
                      <p className="text-sm text-cyber-cyan font-semibold">{result.exif.focalLength}</p>
                    </div>
                  )}
                  {result.exif.flash && (
                    <div className="p-3 bg-black/30 rounded">
                      <p className="text-xs text-gray-500 mb-1">Flash</p>
                      <p className="text-sm text-cyber-cyan font-semibold">{result.exif.flash}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* GPS Location */}
            {result.gps && (
              <div className="glass-panel rounded p-4">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-red-400" />
                  <h3 className="text-lg font-bold text-red-400">GPS LOCATION (Security Risk!)</h3>
                </div>

                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded mb-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-400 font-semibold mb-1">Privacy Warning</p>
                      <p className="text-xs text-gray-400">
                        This image contains GPS coordinates revealing the exact location where it was taken. Sharing images with location data can compromise your privacy and security.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-black/30 rounded">
                    <p className="text-xs text-gray-500 mb-1">Latitude</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-cyber-cyan font-mono">{result.gps.latitude.toFixed(6)}</p>
                      <button
                        onClick={() => copyToClipboard(result.gps!.latitude.toString(), "lat")}
                        className="p-1 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                      >
                        {copiedField === "lat" ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-cyber-cyan" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-black/30 rounded">
                    <p className="text-xs text-gray-500 mb-1">Longitude</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-cyber-cyan font-mono">{result.gps.longitude.toFixed(6)}</p>
                      <button
                        onClick={() => copyToClipboard(result.gps!.longitude.toString(), "lng")}
                        className="p-1 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                      >
                        {copiedField === "lng" ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-cyber-cyan" />
                        )}
                      </button>
                    </div>
                  </div>
                  {result.gps.altitude && (
                    <div className="p-3 bg-black/30 rounded">
                      <p className="text-xs text-gray-500 mb-1">Altitude</p>
                      <p className="text-sm text-cyber-cyan font-mono">{result.gps.altitude}m</p>
                    </div>
                  )}
                  {result.gps.timestamp && (
                    <div className="p-3 bg-black/30 rounded">
                      <p className="text-xs text-gray-500 mb-1">GPS Timestamp</p>
                      <p className="text-sm text-cyber-cyan font-semibold">{result.gps.timestamp}</p>
                    </div>
                  )}
                </div>

                <a
                  href={result.gps.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full p-3 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 border border-cyber-cyan/30 rounded transition-colors"
                >
                  <MapPin className="w-4 h-4 text-cyber-cyan" />
                  <span className="text-sm text-cyber-cyan font-semibold">VIEW ON GOOGLE MAPS</span>
                  <ExternalLink className="w-3 h-3 text-cyber-cyan" />
                </a>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="glass-panel rounded p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-bold text-yellow-400">SECURITY WARNINGS</h3>
                </div>
                <div className="space-y-2">
                  {result.warnings.map((warning, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                      <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-yellow-400">{warning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default ImageMetadataExtractor;
