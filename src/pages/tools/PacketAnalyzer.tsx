import { useState, useRef } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, Network, Download, Copy, Check, Upload, X } from "lucide-react";

interface PacketLayer {
  protocol: string;
  fields: Record<string, any>;
}

interface Packet {
  id: number;
  timestamp: string;
  source: string;
  destination: string;
  protocol: string;
  length: number;
  info: string;
  layers: PacketLayer[];
  rawHex: string;
}

interface AnalysisResult {
  totalPackets: number;
  packets: Packet[];
  statistics: {
    protocols: Record<string, number>;
    topSources: Array<{ ip: string; count: number }>;
    topDestinations: Array<{ ip: string; count: number }>;
    avgPacketSize: number;
    duration: number;
  };
  scanDuration: number;
}

type SortField = "id" | "protocol" | "length" | "time";
type SortDirection = "asc" | "desc";

const PACKETS_PER_PAGE = 15;

const PacketAnalyzer = () => {
  const [pcapData, setPcapData] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Sort & Filter states
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [protocolFilter, setProtocolFilter] = useState("");
  const [ipFilter, setIpFilter] = useState("");

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setPcapData(""); // Clear manual input when file is selected
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setResult(null);
    setError(null);
    setCurrentPage(1);
    setSelectedPacket(null);

    try {
      let dataToSend = pcapData;

      // If file is uploaded, read it
      if (uploadedFile) {
        const reader = new FileReader();
        dataToSend = await new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(uploadedFile);
        });
      }

      const response = await fetch("http://localhost:3001/api/scan/packet-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pcapData: dataToSend || "sample", // Send "sample" if empty
          timeoutMs: 30000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Analysis failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to analyze packets");
    } finally {
      setIsAnalyzing(false);
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

  const downloadResults = () => {
    if (!result) return;

    const csv = [
      "ID,Timestamp,Source,Destination,Protocol,Length,Info",
      ...result.packets.map(p => 
        `${p.id},"${p.timestamp}","${p.source}","${p.destination}",${p.protocol},${p.length},"${p.info}"`
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `packet_analysis_${Date.now()}.csv`;
    a.click();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const getProcessedPackets = (): Packet[] => {
    if (!result) return [];

    let packets = [...result.packets];

    // Filter by protocol
    if (protocolFilter) {
      packets = packets.filter((p) =>
        p.protocol.toLowerCase().includes(protocolFilter.toLowerCase())
      );
    }

    // Filter by IP
    if (ipFilter) {
      packets = packets.filter((p) =>
        p.source.includes(ipFilter) || p.destination.includes(ipFilter)
      );
    }

    // Sort
    packets.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "id":
          comparison = a.id - b.id;
          break;
        case "protocol":
          comparison = a.protocol.localeCompare(b.protocol);
          break;
        case "length":
          comparison = a.length - b.length;
          break;
        case "time":
          comparison = a.timestamp.localeCompare(b.timestamp);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return packets;
  };

  const processedPackets = getProcessedPackets();
  const totalPages = Math.ceil(processedPackets.length / PACKETS_PER_PAGE);
  const startIndex = (currentPage - 1) * PACKETS_PER_PAGE;
  const endIndex = startIndex + PACKETS_PER_PAGE;
  const paginatedPackets = processedPackets.slice(startIndex, endIndex);

  const goToNextPage = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
  const goToPrevPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return <span className="ml-1 text-cyber-red">{sortDirection === "asc" ? "↑" : "↓"}</span>;
  };

  const getProtocolColor = (protocol: string) => {
    const colors: Record<string, string> = {
      TCP: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      UDP: "bg-green-500/20 text-green-400 border-green-500/50",
      HTTP: "bg-purple-500/20 text-purple-400 border-purple-500/50",
      HTTPS: "bg-purple-500/20 text-purple-400 border-purple-500/50",
      DNS: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      ICMP: "bg-orange-500/20 text-orange-400 border-orange-500/50",
      ARP: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
    };
    return colors[protocol] || "bg-gray-500/20 text-gray-400 border-gray-500/50";
  };

  return (
    <CyberpunkCard title="PACKET ANALYZER">
      <div className="space-y-6">
        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              UPLOAD PCAP FILE
            </label>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pcap,.pcapng,.cap,.txt"
                onChange={handleFileSelect}
                className="hidden"
                id="pcap-file-input"
              />
              <label
                htmlFor="pcap-file-input"
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-black/50 border-2 border-dashed border-cyber-cyan/30 rounded cursor-pointer hover:border-cyber-cyan/50 transition-colors"
              >
                <Upload className="w-5 h-5 text-cyber-cyan" />
                <span className="text-cyber-cyan text-sm">
                  {uploadedFile ? uploadedFile.name : "Click to upload PCAP file"}
                </span>
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

          {/* Manual Input */}
          {!uploadedFile && (
            <>
              <div className="text-xs text-gray-500 text-center">OR</div>
              <div>
                <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                  PASTE PCAP DATA (Base64 or Hex)
                </label>
                <Textarea
                  value={pcapData}
                  onChange={(e) => setPcapData(e.target.value)}
                  placeholder="Paste PCAP data here..."
                  className="bg-black/50 border-cyber-red/30 text-cyber-cyan font-mono text-xs h-24"
                  disabled={isAnalyzing}
                />
              </div>
            </>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ANALYZING PACKETS...
              </>
            ) : (
              <>
                <Network className="mr-2 h-4 w-4" />
                {!pcapData && !uploadedFile ? "ANALYZE SAMPLE DATA" : "ANALYZE PACKETS"}
              </>
            )}
          </Button>

          <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
            <p className="font-semibold text-cyber-cyan mb-1">ℹ️ Packet Analysis</p>
            <p>Upload a PCAP file or paste packet data to analyze network traffic. Supports TCP, UDP, HTTP, DNS, ICMP, and more. Leave empty to analyze sample traffic data.</p>
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
            {/* Statistics */}
            <div className="glass-panel rounded p-6">
              <h3 className="text-lg font-bold text-cyber-cyan mb-4">CAPTURE STATISTICS</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-center">
                  <Network className="w-6 h-6 text-cyber-cyan mx-auto mb-1" />
                  <p className="text-2xl font-bold text-cyber-cyan">{result.totalPackets}</p>
                  <p className="text-xs text-cyber-cyan">Total Packets</p>
                </div>
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-green-400">{result.statistics.avgPacketSize}</p>
                  <p className="text-xs text-green-400">Avg Size (bytes)</p>
                </div>
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-purple-400">{Object.keys(result.statistics.protocols).length}</p>
                  <p className="text-xs text-purple-400">Protocols</p>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-yellow-400">{result.statistics.duration}s</p>
                  <p className="text-xs text-yellow-400">Duration</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-sm font-bold text-cyber-cyan mb-2">Protocol Distribution:</p>
                  {Object.entries(result.statistics.protocols).map(([proto, count]) => (
                    <div key={proto} className="flex items-center justify-between text-xs mb-1">
                      <span className={`px-2 py-0.5 rounded font-bold border ${getProtocolColor(proto)}`}>
                        {proto}
                      </span>
                      <span className="text-gray-400">{count} packets</span>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-black/30 rounded">
                  <p className="text-sm font-bold text-cyber-cyan mb-2">Top Sources:</p>
                  {result.statistics.topSources.map((src, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs mb-1">
                      <span className="text-cyber-cyan font-mono">{src.ip}</span>
                      <span className="text-gray-400">{src.count} packets</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Rest of the component remains the same... */}
            {/* Packets List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                  PACKET LIST ({processedPackets.length})
                </h3>
                <div className="flex gap-2">
                  <Button
                    onClick={downloadResults}
                    className="px-3 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs"
                    size="sm"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Export CSV
                  </Button>
                  {totalPages > 1 && (
                    <span className="text-sm text-gray-400 flex items-center">
                      Page {currentPage} of {totalPages}
                    </span>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-cyber-cyan tracking-wider flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3" />
                    SORT BY:
                  </span>
                  {(["id", "time", "protocol", "length"] as SortField[]).map((field) => (
                    <button
                      key={field}
                      onClick={() => handleSort(field)}
                      className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                        sortField === field ? "bg-cyber-cyan text-black font-bold" : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                      }`}
                    >
                      {field.charAt(0).toUpperCase() + field.slice(1)}{getSortIcon(field)}
                    </button>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3 h-3 text-cyber-cyan flex-shrink-0" />
                    <input
                      value={protocolFilter}
                      onChange={(e) => { setProtocolFilter(e.target.value); setCurrentPage(1); }}
                      placeholder="Filter by protocol..."
                      className="flex-1 bg-black/50 border border-cyber-cyan/30 text-cyber-cyan text-xs h-8 px-2 rounded"
                    />
                  </div>
                  <input
                    value={ipFilter}
                    onChange={(e) => { setIpFilter(e.target.value); setCurrentPage(1); }}
                    placeholder="Filter by IP address..."
                    className="bg-black/50 border border-cyber-cyan/30 text-cyber-cyan text-xs h-8 px-2 rounded"
                  />
                </div>
              </div>

              {/* Packets Table */}
              <div className="space-y-2">
                {paginatedPackets.map((packet) => (
                  <div
                    key={packet.id}
                    onClick={() => setSelectedPacket(packet)}
                    className={`p-3 rounded cursor-pointer transition-colors ${
                      selectedPacket?.id === packet.id ? "bg-cyber-cyan/10 border border-cyber-cyan" : "bg-black/30 hover:bg-black/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">#{packet.id}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getProtocolColor(packet.protocol)}`}>
                          {packet.protocol}
                        </span>
                        <span className="text-xs text-gray-400">{packet.length} bytes</span>
                      </div>
                      <span className="text-xs text-gray-500">{packet.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-cyan-400 font-mono">{packet.source}</span>
                      <span className="text-gray-500">→</span>
                      <span className="text-purple-400 font-mono">{packet.destination}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 truncate">{packet.info}</p>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-cyber-red/20">
                  <Button onClick={goToPrevPage} disabled={currentPage === 1} className="px-3 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 disabled:opacity-30" size="sm">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-cyber-cyan">Page {currentPage} of {totalPages}</span>
                  <Button onClick={goToNextPage} disabled={currentPage === totalPages} className="px-3 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 disabled:opacity-30" size="sm">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Packet Details */}
            {selectedPacket && (
              <div className="glass-panel rounded p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-cyber-cyan">PACKET #{selectedPacket.id} DETAILS</h3>
                  <button
                    onClick={() => copyToClipboard(selectedPacket.rawHex, "hex")}
                    className="p-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                  >
                    {copiedField === "hex" ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-cyber-cyan" />
                    )}
                  </button>
                </div>

                {selectedPacket.layers.map((layer, idx) => (
                  <div key={idx} className="mb-4 p-3 bg-black/30 rounded">
                    <h4 className="text-sm font-bold text-cyber-cyan mb-2">{layer.protocol} Layer</h4>
                    <div className="space-y-1">
                      {Object.entries(layer.fields).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2 text-xs">
                          <span className="text-gray-500 min-w-[120px]">{key}:</span>
                          <span className="text-cyber-cyan font-mono flex-1">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="p-3 bg-black/30 rounded">
                  <h4 className="text-sm font-bold text-cyber-cyan mb-2">Raw Data (Hex)</h4>
                  <pre className="text-xs text-gray-400 font-mono break-all whitespace-pre-wrap">
                    {selectedPacket.rawHex}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default PacketAnalyzer;
