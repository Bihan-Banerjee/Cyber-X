import { useState, useRef } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertCircle, Upload, X, Eye, EyeOff, Download, Copy, Check } from "lucide-react";

interface HideResult {
  success: boolean;
  message: string;
  outputImage: string;
  dataSize: number;
  capacity: number;
  processingTime: number;
}

interface ExtractResult {
  success: boolean;
  message: string;
  extractedData: string;
  dataSize: number;
  processingTime: number;
}

const ImageSteganography = () => {
  const [mode, setMode] = useState<"hide" | "extract">("hide");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [stegoImage, setStegoImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [stegoPreview, setStegoPreview] = useState<string | null>(null);
  const [secretMessage, setSecretMessage] = useState("");
  const [password, setPassword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [hideResult, setHideResult] = useState<HideResult | null>(null);
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const stegoInputRef = useRef<HTMLInputElement>(null);

  const handleCoverImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file');
        return;
      }
      setCoverImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setCoverPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleStegoImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file');
        return;
      }
      setStegoImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setStegoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleHideData = async () => {
    if (!coverImage || !secretMessage.trim()) return;

    setIsProcessing(true);
    setHideResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('coverImage', coverImage);
      formData.append('secretMessage', secretMessage);
      if (password) formData.append('password', password);

      const response = await fetch("http://localhost:5000/api/scan/stego-hide", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to hide data");
      }

      const data = await response.json();
      setHideResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to hide data in image");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtractData = async () => {
    if (!stegoImage) return;

    setIsProcessing(true);
    setExtractResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('stegoImage', stegoImage);
      if (password) formData.append('password', password);

      const response = await fetch("http://localhost:5000/api/scan/stego-extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to extract data");
      }

      const data = await response.json();
      setExtractResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to extract data from image");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadStegoImage = () => {
    if (!hideResult?.outputImage) return;

    const link = document.createElement('a');
    link.href = hideResult.outputImage;
    link.download = `stego_${Date.now()}.png`;
    link.click();
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

  const resetForm = () => {
    setCoverImage(null);
    setStegoImage(null);
    setCoverPreview(null);
    setStegoPreview(null);
    setSecretMessage("");
    setPassword("");
    setHideResult(null);
    setExtractResult(null);
    setError(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
    if (stegoInputRef.current) stegoInputRef.current.value = "";
  };

  return (
    <CyberpunkCard title="IMAGE STEGANOGRAPHY">
      <div className="space-y-6">
        {/* Mode Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => { setMode("hide"); resetForm(); }}
            className={`flex-1 px-4 py-2 rounded font-bold tracking-wide transition-colors ${
              mode === "hide" ? "bg-cyber-cyan text-black" : "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30"
            }`}
          >
            <EyeOff className="w-4 h-4 inline mr-2" />
            HIDE DATA
          </button>
          <button
            onClick={() => { setMode("extract"); resetForm(); }}
            className={`flex-1 px-4 py-2 rounded font-bold tracking-wide transition-colors ${
              mode === "extract" ? "bg-cyber-cyan text-black" : "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30"
            }`}
          >
            <Eye className="w-4 h-4 inline mr-2" />
            EXTRACT DATA
          </button>
        </div>

        {mode === "hide" ? (
          // HIDE MODE
          <div className="space-y-4">
            {/* Cover Image Upload */}
            <div>
              <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                COVER IMAGE
              </label>
              <div className="flex gap-2">
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleCoverImageSelect}
                  className="hidden"
                  id="cover-image-input"
                />
                <label
                  htmlFor="cover-image-input"
                  className="flex-1 flex items-center justify-center gap-2 p-4 bg-black/50 border-2 border-dashed border-cyber-cyan/30 rounded cursor-pointer hover:border-cyber-cyan/50 transition-colors"
                >
                  <Upload className="w-5 h-5 text-cyber-cyan" />
                  <span className="text-cyber-cyan text-sm">
                    {coverImage ? coverImage.name : "Upload cover image (PNG/JPEG)"}
                  </span>
                </label>
                {coverImage && (
                  <button
                    onClick={() => { setCoverImage(null); setCoverPreview(null); }}
                    className="p-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-red-400" />
                  </button>
                )}
              </div>
            </div>

            {coverPreview && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-sm font-bold text-cyber-cyan mb-2">Cover Image Preview</h3>
                <img src={coverPreview} alt="Cover" className="w-full max-h-48 object-contain rounded border border-cyber-cyan/30" />
              </div>
            )}

            {/* Secret Message */}
            <div>
              <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                SECRET MESSAGE
              </label>
              <Textarea
                value={secretMessage}
                onChange={(e) => setSecretMessage(e.target.value)}
                placeholder="Enter the secret message to hide..."
                className="bg-black/50 border-cyber-red/30 text-cyber-cyan font-mono h-32"
                disabled={isProcessing}
              />
              <p className="text-xs text-gray-500 mt-1">
                Characters: {secretMessage.length} | Bytes: {new Blob([secretMessage]).size}
              </p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                PASSWORD (Optional - for encryption)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password to encrypt message"
                  className="w-full bg-black/50 border border-cyber-red/30 text-cyber-cyan px-3 py-2 rounded"
                  disabled={isProcessing}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <Button
              onClick={handleHideData}
              disabled={isProcessing || !coverImage || !secretMessage.trim()}
              className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  HIDING DATA...
                </>
              ) : (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  HIDE MESSAGE IN IMAGE
                </>
              )}
            </Button>
          </div>
        ) : (
          // EXTRACT MODE
          <div className="space-y-4">
            {/* Stego Image Upload */}
            <div>
              <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                STEGO IMAGE (Image with hidden data)
              </label>
              <div className="flex gap-2">
                <input
                  ref={stegoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleStegoImageSelect}
                  className="hidden"
                  id="stego-image-input"
                />
                <label
                  htmlFor="stego-image-input"
                  className="flex-1 flex items-center justify-center gap-2 p-4 bg-black/50 border-2 border-dashed border-cyber-cyan/30 rounded cursor-pointer hover:border-cyber-cyan/50 transition-colors"
                >
                  <Upload className="w-5 h-5 text-cyber-cyan" />
                  <span className="text-cyber-cyan text-sm">
                    {stegoImage ? stegoImage.name : "Upload stego image (PNG/JPEG)"}
                  </span>
                </label>
                {stegoImage && (
                  <button
                    onClick={() => { setStegoImage(null); setStegoPreview(null); }}
                    className="p-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-red-400" />
                  </button>
                )}
              </div>
            </div>

            {stegoPreview && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-sm font-bold text-cyber-cyan mb-2">Stego Image Preview</h3>
                <img src={stegoPreview} alt="Stego" className="w-full max-h-48 object-contain rounded border border-cyber-cyan/30" />
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                PASSWORD (If encrypted)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password if message was encrypted"
                  className="w-full bg-black/50 border border-cyber-red/30 text-cyber-cyan px-3 py-2 rounded"
                  disabled={isProcessing}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <Button
              onClick={handleExtractData}
              disabled={isProcessing || !stegoImage}
              className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  EXTRACTING DATA...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  EXTRACT HIDDEN MESSAGE
                </>
              )}
            </Button>
          </div>
        )}

        {/* Info Box */}
        <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
          <p className="font-semibold text-cyber-cyan mb-1">ℹ️ LSB Steganography</p>
          <p>Uses Least Significant Bit (LSB) technique to hide data in image pixels. The hidden data is imperceptible to human eyes. Optional password encryption adds extra security. Works best with PNG format (lossless).</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {/* Hide Result */}
        {hideResult && (
          <div className="border-t border-cyber-red/30 pt-6 space-y-4">
            <div className="glass-panel rounded p-6">
              <h3 className="text-lg font-bold text-cyber-cyan mb-4">DATA HIDDEN SUCCESSFULLY</h3>

              <div className="grid md:grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-green-400">{hideResult.dataSize}</p>
                  <p className="text-xs text-green-400">Bytes Hidden</p>
                </div>
                <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-center">
                  <p className="text-2xl font-bold text-cyber-cyan">{hideResult.capacity}</p>
                  <p className="text-xs text-cyber-cyan">Total Capacity</p>
                </div>
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-purple-400">{hideResult.processingTime}ms</p>
                  <p className="text-xs text-purple-400">Processing Time</p>
                </div>
              </div>

              <p className="text-sm text-gray-400 mb-4">{hideResult.message}</p>

              <div className="mb-4">
                <h4 className="text-sm font-bold text-cyber-cyan mb-2">Stego Image Preview</h4>
                <img src={hideResult.outputImage} alt="Stego" className="w-full max-h-64 object-contain rounded border border-cyber-cyan/30" />
              </div>

              <Button
                onClick={downloadStegoImage}
                className="w-full bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30"
              >
                <Download className="mr-2 h-4 w-4" />
                DOWNLOAD STEGO IMAGE
              </Button>
            </div>
          </div>
        )}

        {/* Extract Result */}
        {extractResult && (
          <div className="border-t border-cyber-red/30 pt-6 space-y-4">
            <div className="glass-panel rounded p-6">
              <h3 className="text-lg font-bold text-cyber-cyan mb-4">DATA EXTRACTED SUCCESSFULLY</h3>

              <div className="grid md:grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-green-400">{extractResult.dataSize}</p>
                  <p className="text-xs text-green-400">Bytes Extracted</p>
                </div>
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-purple-400">{extractResult.processingTime}ms</p>
                  <p className="text-xs text-purple-400">Processing Time</p>
                </div>
              </div>

              <p className="text-sm text-gray-400 mb-4">{extractResult.message}</p>

              <div className="p-4 bg-black/30 rounded">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-cyber-cyan">EXTRACTED MESSAGE</h4>
                  <button
                    onClick={() => copyToClipboard(extractResult.extractedData, "extracted")}
                    className="p-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                  >
                    {copiedField === "extracted" ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-cyber-cyan" />
                    )}
                  </button>
                </div>
                <pre className="text-sm text-cyber-cyan font-mono whitespace-pre-wrap break-all">
                  {extractResult.extractedData}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default ImageSteganography;
