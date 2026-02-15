import { useState, useRef } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertCircle, Upload, X, FileText, Eye, EyeOff, Download, Copy, Check } from "lucide-react";

interface HideResult {
  success: boolean;
  message: string;
  outputDocument: string;
  documentName: string;
  dataSize: number;
  technique: string;
  processingTime: number;
}

interface ExtractResult {
  success: boolean;
  message: string;
  extractedData: string;
  dataSize: number;
  technique: string;
  processingTime: number;
}

const DocumentSteganography = () => {
  const [mode, setMode] = useState<"hide" | "extract">("hide");
  const [coverDocument, setCoverDocument] = useState<File | null>(null);
  const [stegoDocument, setStegoDocument] = useState<File | null>(null);
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

  const handleCoverDocumentSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.oasis.opendocument.text', 'text/plain'];
      if (!validTypes.includes(file.type)) {
        setError('Please upload a valid document file (PDF, DOC, DOCX, ODT, TXT)');
        return;
      }
      setCoverDocument(file);
      setError(null);
    }
  };

  const handleStegoDocumentSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.oasis.opendocument.text', 'text/plain'];
      if (!validTypes.includes(file.type)) {
        setError('Please upload a valid document file (PDF, DOC, DOCX, ODT, TXT)');
        return;
      }
      setStegoDocument(file);
      setError(null);
    }
  };

  const handleHideData = async () => {
    if (!coverDocument || !secretMessage.trim()) return;

    setIsProcessing(true);
    setHideResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('coverDocument', coverDocument);
      formData.append('secretMessage', secretMessage);
      if (password) formData.append('password', password);

      const response = await fetch("http://localhost:5000/api/scan/doc-stego-hide", {
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
      setError(err.message || "Failed to hide data in document");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtractData = async () => {
    if (!stegoDocument) return;

    setIsProcessing(true);
    setExtractResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('stegoDocument', stegoDocument);
      if (password) formData.append('password', password);

      const response = await fetch("http://localhost:5000/api/scan/doc-stego-extract", {
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
      setError(err.message || "Failed to extract data from document");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadStegoDocument = () => {
    if (!hideResult?.outputDocument) return;

    const link = document.createElement('a');
    link.href = hideResult.outputDocument;
    link.download = hideResult.documentName;
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
    setCoverDocument(null);
    setStegoDocument(null);
    setSecretMessage("");
    setPassword("");
    setHideResult(null);
    setExtractResult(null);
    setError(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
    if (stegoInputRef.current) stegoInputRef.current.value = "";
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (ext === 'doc' || ext === 'docx') return '📝';
    if (ext === 'odt') return '📃';
    if (ext === 'txt') return '📋';
    return '📁';
  };

  return (
    <CyberpunkCard title="DOCUMENT STEGANOGRAPHY">
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
            {/* Cover Document Upload */}
            <div>
              <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                COVER DOCUMENT
              </label>
              <div className="flex gap-2">
                <input
                  ref={coverInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.odt,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,text/plain"
                  onChange={handleCoverDocumentSelect}
                  className="hidden"
                  id="cover-doc-input"
                />
                <label
                  htmlFor="cover-doc-input"
                  className="flex-1 flex items-center justify-center gap-2 p-4 bg-black/50 border-2 border-dashed border-cyber-cyan/30 rounded cursor-pointer hover:border-cyber-cyan/50 transition-colors"
                >
                  <Upload className="w-5 h-5 text-cyber-cyan" />
                  <div className="text-center">
                    {coverDocument ? (
                      <p className="text-cyber-cyan text-sm">
                        {getFileIcon(coverDocument.name)} {coverDocument.name}
                      </p>
                    ) : (
                      <>
                        <p className="text-cyber-cyan text-sm font-semibold">Upload cover document</p>
                        <p className="text-xs text-gray-500">PDF, DOC, DOCX, ODT, TXT</p>
                      </>
                    )}
                  </div>
                </label>
                {coverDocument && (
                  <button
                    onClick={() => setCoverDocument(null)}
                    className="p-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-red-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Secret Message */}
            <div>
              <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                SECRET MESSAGE
              </label>
              <Textarea
                value={secretMessage}
                onChange={(e) => setSecretMessage(e.target.value)}
                placeholder="Enter the secret message to hide in document..."
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
              disabled={isProcessing || !coverDocument || !secretMessage.trim()}
              className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  HIDING DATA...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  HIDE MESSAGE IN DOCUMENT
                </>
              )}
            </Button>
          </div>
        ) : (
          // EXTRACT MODE
          <div className="space-y-4">
            {/* Stego Document Upload */}
            <div>
              <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                STEGO DOCUMENT (Document with hidden data)
              </label>
              <div className="flex gap-2">
                <input
                  ref={stegoInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.odt,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,text/plain"
                  onChange={handleStegoDocumentSelect}
                  className="hidden"
                  id="stego-doc-input"
                />
                <label
                  htmlFor="stego-doc-input"
                  className="flex-1 flex items-center justify-center gap-2 p-4 bg-black/50 border-2 border-dashed border-cyber-cyan/30 rounded cursor-pointer hover:border-cyber-cyan/50 transition-colors"
                >
                  <Upload className="w-5 h-5 text-cyber-cyan" />
                  <div className="text-center">
                    {stegoDocument ? (
                      <p className="text-cyber-cyan text-sm">
                        {getFileIcon(stegoDocument.name)} {stegoDocument.name}
                      </p>
                    ) : (
                      <>
                        <p className="text-cyber-cyan text-sm font-semibold">Upload stego document</p>
                        <p className="text-xs text-gray-500">PDF, DOC, DOCX, ODT, TXT</p>
                      </>
                    )}
                  </div>
                </label>
                {stegoDocument && (
                  <button
                    onClick={() => setStegoDocument(null)}
                    className="p-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-red-400" />
                  </button>
                )}
              </div>
            </div>

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
              disabled={isProcessing || !stegoDocument}
              className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  EXTRACTING DATA...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  EXTRACT HIDDEN MESSAGE
                </>
              )}
            </Button>
          </div>
        )}

        {/* Info Box */}
        <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
          <p className="font-semibold text-cyber-cyan mb-1">ℹ️ Document Steganography</p>
          <p>Hides data in document metadata and whitespace using text steganography techniques. The hidden data is imperceptible and preserved through document viewing. Works with PDF, DOC, DOCX, ODT, and TXT formats.</p>
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
                  <p className="text-xl font-bold text-cyber-cyan">{hideResult.technique}</p>
                  <p className="text-xs text-cyber-cyan">Technique Used</p>
                </div>
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-purple-400">{hideResult.processingTime}ms</p>
                  <p className="text-xs text-purple-400">Processing Time</p>
                </div>
              </div>

              <p className="text-sm text-gray-400 mb-4">{hideResult.message}</p>

              <div className="p-4 bg-black/30 rounded mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyber-cyan" />
                  <div>
                    <p className="text-sm font-bold text-cyber-cyan">{hideResult.documentName}</p>
                    <p className="text-xs text-gray-400">Stego document ready for download</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={downloadStegoDocument}
                className="w-full bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30"
              >
                <Download className="mr-2 h-4 w-4" />
                DOWNLOAD STEGO DOCUMENT
              </Button>
            </div>
          </div>
        )}

        {/* Extract Result */}
        {extractResult && (
          <div className="border-t border-cyber-red/30 pt-6 space-y-4">
            <div className="glass-panel rounded p-6">
              <h3 className="text-lg font-bold text-cyber-cyan mb-4">DATA EXTRACTED SUCCESSFULLY</h3>

              <div className="grid md:grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-green-400">{extractResult.dataSize}</p>
                  <p className="text-xs text-green-400">Bytes Extracted</p>
                </div>
                <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-center">
                  <p className="text-xl font-bold text-cyber-cyan">{extractResult.technique}</p>
                  <p className="text-xs text-cyber-cyan">Technique Detected</p>
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

export default DocumentSteganography;
