import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Copy, Check, ExternalLink, Trash2, Plus, AlertCircle, Download } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
interface DorkTemplate {
  name: string;
  category: string;
  description: string;
  dork: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  displayUrl: string;
}

interface OSINTSearchResult {
  query: string;
  totalResults: number;
  results: SearchResult[];
  searchDuration: number;
}

const GoogleDorkGenerator = () => {
  const [generatedDork, setGeneratedDork] = useState("");
  const [copiedDork, setCopiedDork] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<OSINTSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Custom dork builder
  const [customSite, setCustomSite] = useState("");
  const [customFiletype, setCustomFiletype] = useState("");
  const [customIntitle, setCustomIntitle] = useState("");
  const [customInurl, setCustomInurl] = useState("");
  const [customIntext, setCustomIntext] = useState("");
  const [customExclude, setCustomExclude] = useState("");
  
  // Pre-made templates
  const dorkTemplates: DorkTemplate[] = [
    {
      name: "Exposed Login Pages",
      category: "Security",
      description: "Find login pages and admin panels",
      dork: 'intitle:"index of" "admin" OR "login"'
    },
    {
      name: "SQL Database Files",
      category: "Database",
      description: "Find exposed SQL database files",
      dork: 'filetype:sql intext:"INSERT INTO" "password"'
    },
    {
      name: "Configuration Files",
      category: "Files",
      description: "Find exposed config files",
      dork: 'filetype:env OR filetype:config OR filetype:ini'
    },
    {
      name: "Email Lists",
      category: "OSINT",
      description: "Find email addresses",
      dork: '@gmail.com OR @outlook.com filetype:xls OR filetype:csv'
    },
    {
      name: "Backup Files",
      category: "Files",
      description: "Find backup files and archives",
      dork: 'intitle:"index of" (backup OR .bak OR .zip OR .tar)'
    },
    {
      name: "API Keys",
      category: "Security",
      description: "Find exposed API keys",
      dork: 'intext:"api_key" OR intext:"apikey" filetype:json OR filetype:txt'
    },
    {
      name: "Network Devices",
      category: "IoT",
      description: "Find exposed network devices",
      dork: 'inurl:"ViewerFrame?Mode=" OR inurl:"webs.cgi"'
    },
    {
      name: "Log Files",
      category: "Files",
      description: "Find server log files",
      dork: 'filetype:log intext:"error" OR intext:"warning"'
    },
    {
      name: "Directory Listings",
      category: "Files",
      description: "Find open directory listings",
      dork: 'intitle:"index of" "parent directory"'
    },
    {
      name: "Social Media Profiles",
      category: "OSINT",
      description: "Find social media profiles",
      dork: 'site:linkedin.com OR site:twitter.com OR site:facebook.com'
    },
    {
      name: "PDF Documents",
      category: "Documents",
      description: "Find PDF documents",
      dork: 'filetype:pdf intext:"confidential" OR intext:"internal"'
    },
    {
      name: "Database Dumps",
      category: "Database",
      description: "Find database dump files",
      dork: 'filetype:sql "dump" OR "backup"'
    },
    {
      name: "Webcams",
      category: "IoT",
      description: "Find publicly accessible webcams",
      dork: 'inurl:view/index.shtml OR inurl:ViewerFrame?Mode='
    },
    {
      name: "Error Messages",
      category: "Security",
      description: "Find pages with error messages",
      dork: 'intext:"sql syntax error" OR intext:"mysql error"'
    },
    {
      name: "WordPress Sites",
      category: "CMS",
      description: "Find WordPress installations",
      dork: 'inurl:wp-content OR inurl:wp-admin'
    },
    {
      name: "phpinfo Pages",
      category: "Security",
      description: "Find exposed phpinfo pages",
      dork: 'intitle:"phpinfo()" OR inurl:phpinfo.php'
    },
  ];

  const buildCustomDork = () => {
    const parts: string[] = [];
    
    if (customSite) parts.push(`site:${customSite}`);
    if (customFiletype) parts.push(`filetype:${customFiletype}`);
    if (customIntitle) parts.push(`intitle:"${customIntitle}"`);
    if (customInurl) parts.push(`inurl:${customInurl}`);
    if (customIntext) parts.push(`intext:"${customIntext}"`);
    if (customExclude) parts.push(`-${customExclude}`);
    
    const dork = parts.join(' ');
    setGeneratedDork(dork);
  };

  const applyTemplate = (template: DorkTemplate) => {
    setGeneratedDork(template.dork);
  };

  const copyDork = async () => {
    try {
      await navigator.clipboard.writeText(generatedDork);
      setCopiedDork(true);
      setTimeout(() => setCopiedDork(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const searchGoogle = () => {
    if (generatedDork) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(generatedDork)}`, '_blank');
    }
  };

  const performOSINTSearch = async () => {
    if (!generatedDork) return;

    setIsSearching(true);
    setSearchResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/osint-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: generatedDork }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Search failed");
      }

      const data = await response.json();
      setSearchResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to perform OSINT search");
    } finally {
      setIsSearching(false);
    }
  };

  const downloadResults = () => {
    if (!searchResult) return;

    const csv = [
      "Title,URL,Snippet",
      ...searchResult.results.map(r => 
        `"${r.title}","${r.url}","${r.snippet.replace(/"/g, '""')}"`
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `osint_results_${Date.now()}.csv`;
    a.click();
  };

  const clearForm = () => {
    setCustomSite("");
    setCustomFiletype("");
    setCustomIntitle("");
    setCustomInurl("");
    setCustomIntext("");
    setCustomExclude("");
    setGeneratedDork("");
    setSearchResult(null);
    setError(null);
  };

  return (
    <CyberpunkCard title="GOOGLE DORK GENERATOR & OSINT SCRAPER">
      <div className="space-y-6">
        {/* Custom Dork Builder */}
        <div className="glass-panel rounded p-6">
          <h3 className="text-lg font-bold text-cyber-cyan mb-4">CUSTOM DORK BUILDER</h3>
          
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-cyber-cyan mb-2 tracking-wide">
                SITE (site:)
              </label>
              <Input
                value={customSite}
                onChange={(e) => setCustomSite(e.target.value)}
                placeholder="example.com"
                className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-cyber-cyan mb-2 tracking-wide">
                FILE TYPE (filetype:)
              </label>
              <Input
                value={customFiletype}
                onChange={(e) => setCustomFiletype(e.target.value)}
                placeholder="pdf, doc, xls, sql"
                className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-cyber-cyan mb-2 tracking-wide">
                IN TITLE (intitle:)
              </label>
              <Input
                value={customIntitle}
                onChange={(e) => setCustomIntitle(e.target.value)}
                placeholder="admin login"
                className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-cyber-cyan mb-2 tracking-wide">
                IN URL (inurl:)
              </label>
              <Input
                value={customInurl}
                onChange={(e) => setCustomInurl(e.target.value)}
                placeholder="admin"
                className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-cyber-cyan mb-2 tracking-wide">
                IN TEXT (intext:)
              </label>
              <Input
                value={customIntext}
                onChange={(e) => setCustomIntext(e.target.value)}
                placeholder="password"
                className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-cyber-cyan mb-2 tracking-wide">
                EXCLUDE (-)
              </label>
              <Input
                value={customExclude}
                onChange={(e) => setCustomExclude(e.target.value)}
                placeholder="wordpress"
                className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={buildCustomDork}
              className="flex-1 bg-cyber-cyan hover:bg-cyber-cyan/80 text-black font-bold"
            >
              <Plus className="w-4 h-4 mr-2" />
              GENERATE DORK
            </Button>
            <Button
              onClick={clearForm}
              className="px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Generated Dork Display */}
        {generatedDork && (
          <div className="glass-panel rounded p-6">
            <h3 className="text-sm font-bold text-cyber-cyan mb-3">GENERATED DORK</h3>
            
            <div className="p-4 bg-black/50 rounded border border-cyber-cyan/30 mb-4">
              <code className="text-cyber-cyan text-sm font-mono break-all">
                {generatedDork}
              </code>
            </div>

            <div className="grid md:grid-cols-3 gap-2">
              <Button
                onClick={searchGoogle}
                className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/50"
              >
                <Search className="w-4 h-4 mr-2" />
                SEARCH GOOGLE
              </Button>
              <Button
                onClick={performOSINTSearch}
                disabled={isSearching}
                className="bg-cyber-red hover:bg-cyber-deepRed text-white font-bold"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    SCRAPING...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    OSINT SCRAPE
                  </>
                )}
              </Button>
              <Button
                onClick={copyDork}
                className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30"
              >
                {copiedDork ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                COPY
              </Button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {/* Search Results */}
        {searchResult && (
          <div className="glass-panel rounded p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-cyber-cyan">OSINT SEARCH RESULTS</h3>
                <p className="text-xs text-gray-400">
                  {searchResult.totalResults} results found in {searchResult.searchDuration}ms
                </p>
              </div>
              <Button
                onClick={downloadResults}
                className="px-3 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs"
                size="sm"
              >
                <Download className="w-3 h-3 mr-1" />
                Export CSV
              </Button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {searchResult.results.map((result, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-black/30 rounded border border-cyber-cyan/20 hover:border-cyber-cyan/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-cyber-cyan hover:text-cyber-cyan/80 flex items-center gap-1"
                    >
                      {result.title}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-xs text-green-400 font-mono mb-2">{result.displayUrl}</p>
                  <p className="text-xs text-gray-400">{result.snippet}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pre-made Templates */}
        <div className="glass-panel rounded p-6">
          <h3 className="text-lg font-bold text-cyber-cyan mb-4">PRE-MADE DORK TEMPLATES</h3>
          
          <div className="grid md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
            {dorkTemplates.map((template, idx) => (
              <div
                key={idx}
                className="p-4 bg-black/30 rounded border border-cyber-cyan/20 hover:border-cyber-cyan/50 transition-colors cursor-pointer"
                onClick={() => applyTemplate(template)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-bold text-cyber-cyan">{template.name}</h4>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/50">
                    {template.category}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{template.description}</p>
                <code className="text-xs text-green-400 font-mono break-all">
                  {template.dork}
                </code>
              </div>
            ))}
          </div>
        </div>

        {/* Operators Reference */}
        <div className="glass-panel rounded p-6">
          <h3 className="text-lg font-bold text-cyber-cyan mb-4">GOOGLE DORK OPERATORS</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="p-3 bg-black/30 rounded">
                <code className="text-cyber-cyan font-bold">site:</code>
                <p className="text-xs text-gray-400 mt-1">Limit results to a specific website</p>
              </div>
              <div className="p-3 bg-black/30 rounded">
                <code className="text-cyber-cyan font-bold">filetype:</code>
                <p className="text-xs text-gray-400 mt-1">Search for specific file types</p>
              </div>
              <div className="p-3 bg-black/30 rounded">
                <code className="text-cyber-cyan font-bold">intitle:</code>
                <p className="text-xs text-gray-400 mt-1">Search in page title</p>
              </div>
              <div className="p-3 bg-black/30 rounded">
                <code className="text-cyber-cyan font-bold">inurl:</code>
                <p className="text-xs text-gray-400 mt-1">Search in URL</p>
              </div>
              <div className="p-3 bg-black/30 rounded">
                <code className="text-cyber-cyan font-bold">intext:</code>
                <p className="text-xs text-gray-400 mt-1">Search in page content</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="p-3 bg-black/30 rounded">
                <code className="text-cyber-cyan font-bold">-</code>
                <p className="text-xs text-gray-400 mt-1">Exclude terms from search</p>
              </div>
              <div className="p-3 bg-black/30 rounded">
                <code className="text-cyber-cyan font-bold">OR</code>
                <p className="text-xs text-gray-400 mt-1">Search for this OR that</p>
              </div>
              <div className="p-3 bg-black/30 rounded">
                <code className="text-cyber-cyan font-bold">" "</code>
                <p className="text-xs text-gray-400 mt-1">Exact phrase match</p>
              </div>
              <div className="p-3 bg-black/30 rounded">
                <code className="text-cyber-cyan font-bold">*</code>
                <p className="text-xs text-gray-400 mt-1">Wildcard for unknown words</p>
              </div>
              <div className="p-3 bg-black/30 rounded">
                <code className="text-cyber-cyan font-bold">cache:</code>
                <p className="text-xs text-gray-400 mt-1">View Google's cached version</p>
              </div>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-400 mb-1">⚠️ Ethical Use Only</p>
              <p className="text-xs text-gray-400">
                Google Dorking is a powerful OSINT technique. Use these queries responsibly and only on systems you have permission to test. Unauthorized access or data theft is illegal. Scraping respects robots.txt and rate limits.
              </p>
            </div>
          </div>
        </div>
      </div>
    </CyberpunkCard>
  );
};

export default GoogleDorkGenerator;
