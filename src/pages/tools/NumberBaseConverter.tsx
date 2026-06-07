import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";

const isValidBin = (s: string) => /^[01]*$/.test(s);
const isValidOct = (s: string) => /^[0-7]*$/.test(s);
const isValidDec = (s: string) => /^[0-9]*$/.test(s);
const isValidHex = (s: string) => /^[0-9a-fA-F]*$/.test(s);

const NumberBaseConverter = () => {
  const [bin, setBin] = useState("");
  const [oct, setOct] = useState("");
  const [dec, setDec] = useState("");
  const [hex, setHex] = useState("");
  const [ascii, setAscii] = useState("");
  const [error, setError] = useState("");

  const updateAll = (value: number | null, source: string) => {
    setError("");
    if (value === null || isNaN(value) || !isFinite(value)) {
      if (source !== "bin") setBin("");
      if (source !== "oct") setOct("");
      if (source !== "dec") setDec("");
      if (source !== "hex") setHex("");
      if (source !== "ascii") setAscii("");
      return;
    }
    if (source !== "bin") setBin(value.toString(2));
    if (source !== "oct") setOct(value.toString(8));
    if (source !== "dec") setDec(value.toString(10));
    if (source !== "hex") setHex(value.toString(16).toUpperCase());
    if (source !== "ascii") {
      setAscii(value >= 0 && value <= 127 ? String.fromCharCode(value) : "N/A");
    }
  };

  const handleBin = (v: string) => {
    setBin(v);
    if (!v) { setOct(""); setDec(""); setHex(""); setAscii(""); setError(""); return; }
    if (!isValidBin(v)) { setError("Invalid binary (0-1 only)"); return; }
    updateAll(parseInt(v, 2), "bin");
  };

  const handleOct = (v: string) => {
    setOct(v);
    if (!v) { setBin(""); setDec(""); setHex(""); setAscii(""); setError(""); return; }
    if (!isValidOct(v)) { setError("Invalid octal (0-7 only)"); return; }
    updateAll(parseInt(v, 8), "oct");
  };

  const handleDec = (v: string) => {
    setDec(v);
    if (!v) { setBin(""); setOct(""); setHex(""); setAscii(""); setError(""); return; }
    if (!isValidDec(v)) { setError("Invalid decimal (0-9 only)"); return; }
    updateAll(parseInt(v, 10), "dec");
  };

  const handleHex = (v: string) => {
    setHex(v);
    if (!v) { setBin(""); setOct(""); setDec(""); setAscii(""); setError(""); return; }
    if (!isValidHex(v)) { setError("Invalid hex (0-9, A-F only)"); return; }
    updateAll(parseInt(v, 16), "hex");
  };

  const handleAscii = (v: string) => {
    setAscii(v);
    if (!v) { setBin(""); setOct(""); setDec(""); setHex(""); setError(""); return; }
    if (v.length > 1) { setError("Enter a single ASCII character"); return; }
    const code = v.charCodeAt(0);
    if (code > 127) { setError("Character outside ASCII range (0-127)"); return; }
    setBin(code.toString(2));
    setOct(code.toString(8));
    setDec(code.toString(10));
    setHex(code.toString(16).toUpperCase());
    setError("");
  };

  const fields = [
    { label: "BINARY", sublabel: "base 2", value: bin, onChange: handleBin, placeholder: "01001000", color: "text-blue-400" },
    { label: "OCTAL", sublabel: "base 8", value: oct, onChange: handleOct, placeholder: "110", color: "text-purple-400" },
    { label: "DECIMAL", sublabel: "base 10", value: dec, onChange: handleDec, placeholder: "72", color: "text-cyber-cyan" },
    { label: "HEXADECIMAL", sublabel: "base 16", value: hex, onChange: handleHex, placeholder: "48", color: "text-yellow-400" },
  ];

  return (
    <CyberpunkCard title="NUMBER BASE CONVERTER">
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.label} className="glass-panel rounded p-4">
              <label className="block text-xs text-cyber-cyan tracking-wider mb-1">
                {f.label} <span className="text-gray-500">({f.sublabel})</span>
              </label>
              <input
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                placeholder={f.placeholder}
                spellCheck={false}
                className={`w-full bg-black/50 border border-cyber-cyan/30 ${f.color} rounded p-2 text-lg font-mono focus:outline-none focus:border-cyber-cyan/60`}
              />
            </div>
          ))}
        </div>

        <div className="glass-panel rounded p-4">
          <label className="block text-xs text-cyber-cyan tracking-wider mb-1">ASCII CHARACTER</label>
          <div className="flex items-center gap-4">
            <input
              value={ascii}
              onChange={(e) => handleAscii(e.target.value)}
              placeholder="H"
              maxLength={1}
              className="w-20 bg-black/50 border border-cyber-cyan/30 text-green-400 rounded p-2 text-2xl font-mono text-center focus:outline-none focus:border-cyber-cyan/60"
            />
            {dec && (
              <div className="text-sm text-gray-400 font-mono">
                ASCII code: <span className="text-cyber-cyan">{dec}</span>
                {ascii && ascii !== "N/A" && (
                  <> | Printable: <span className="text-green-400">{ascii}</span></>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">{error}</p>
        )}

        <div className="glass-panel rounded p-3">
          <p className="text-xs text-cyber-cyan font-bold tracking-wider mb-2">QUICK REFERENCE</p>
          <div className="grid grid-cols-4 gap-2 text-xs font-mono text-gray-400">
            <div>A = 65 = 41h = 101b</div>
            <div>Z = 90 = 5Ah = 1011010b</div>
            <div>a = 97 = 61h = 1100001b</div>
            <div>0 = 48 = 30h = 110000b</div>
            <div>SP = 32 = 20h = 100000b</div>
            <div>NUL = 0 = 0h = 0b</div>
            <div>LF = 10 = Ah = 1010b</div>
            <div>CR = 13 = Dh = 1101b</div>
          </div>
        </div>
      </div>
    </CyberpunkCard>
  );
};

export default NumberBaseConverter;
