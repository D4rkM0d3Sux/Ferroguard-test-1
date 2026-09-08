import React, { useState } from 'react';
import { X, Copy, Check, Cpu, Code2, CircuitBoard, HelpCircle, ShieldAlert, Zap, Calculator } from 'lucide-react';
import { ESP8266_ARDUINO_CODE, ESP8266_PINOUT, VOLTAGE_DIVIDER_GUIDES } from '../utils/arduinoSketch';

interface ArduinoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArduinoGuideModal: React.FC<ArduinoGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'wiring' | 'divider_calc' | 'code' | 'protocol'>('wiring');
  const [copied, setCopied] = useState(false);

  // Interactive Voltage Divider Calculator State
  const [supplyVoltage, setSupplyVoltage] = useState<number>(12);
  const [r1Kohm, setR1Kohm] = useState<number>(10);
  const [r2Kohm, setR2Kohm] = useState<number>(3.9);

  if (!isOpen) return null;

  const calculatedVout = Number(((supplyVoltage * r2Kohm) / (r1Kohm + r2Kohm)).toFixed(2));
  const isSafeForNodeMCU = calculatedVout >= 2.4 && calculatedVout <= 3.4;
  const isDangerouslyHigh = calculatedVout > 3.6;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(ESP8266_ARDUINO_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-mono uppercase tracking-wider text-slate-100">
                  Hardware BOM & Firmware Wiring Guide
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  LJ12A3-4-Z/BX + L298N
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                NodeMCU ESP8266 • Inductive Proximity Sensor • L298N Driver • Relay Module • Level Shifter
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/90 px-5 text-xs font-mono overflow-x-auto">
          <button
            onClick={() => setActiveTab('wiring')}
            className={`py-3 px-4 border-b-2 font-semibold flex items-center gap-2 transition-colors shrink-0 ${
              activeTab === 'wiring'
                ? 'border-cyan-400 text-cyan-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CircuitBoard className="w-4 h-4" /> BOM & Pinout Schematic
          </button>

          <button
            onClick={() => setActiveTab('divider_calc')}
            className={`py-3 px-4 border-b-2 font-semibold flex items-center gap-2 transition-colors shrink-0 ${
              activeTab === 'divider_calc'
                ? 'border-cyan-400 text-cyan-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calculator className="w-4 h-4" /> 12V→3.3V Divider Calculator
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`py-3 px-4 border-b-2 font-semibold flex items-center gap-2 transition-colors shrink-0 ${
              activeTab === 'code'
                ? 'border-cyan-400 text-cyan-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" /> Arduino Sketch (.ino)
          </button>

          <button
            onClick={() => setActiveTab('protocol')}
            className={`py-3 px-4 border-b-2 font-semibold flex items-center gap-2 transition-colors shrink-0 ${
              activeTab === 'protocol'
                ? 'border-cyan-400 text-cyan-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" /> Serial & HTTP API
          </button>
        </div>

        {/* Modal Body with Scroll */}
        <div className="p-5 overflow-y-auto flex-1 text-slate-300 text-xs">
          
          {/* TAB 1: BOM & WIRING */}
          {activeTab === 'wiring' && (
            <div className="flex flex-col gap-5">
              {/* School / Capstone Setup Banner */}
              <div className="bg-cyan-950/60 border border-cyan-700/80 p-4 rounded-lg flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-900 text-cyan-200 text-[10px] font-mono font-bold uppercase border border-cyan-600">
                    School / Science Fair Setup
                  </span>
                  <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider font-mono">
                    Operating Without Physical Reject Bins
                  </h4>
                </div>
                <p className="text-slate-200 text-xs leading-relaxed">
                  In school projects and educational lab demonstrations where pneumatic pushers or automated reject chutes are not fitted, the system operates via <strong>Auto-Halt Inspection Interlock</strong>:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-1 font-mono text-[11px]">
                  <div className="p-2.5 rounded bg-slate-900/90 border border-slate-700/80">
                    <span className="text-cyan-400 font-bold block mb-1">1. Instant Detection</span>
                    <span className="text-slate-300">LJ12A3-4-Z/BX detects metal specimen and pulls Pin D1 LOW via hardware interrupt.</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900/90 border border-slate-700/80">
                    <span className="text-amber-400 font-bold block mb-1">2. Motor Cutoff via L298N</span>
                    <span className="text-slate-300">NodeMCU halts L298N ENA (PWM=0) immediately. Buzzer sounds, D7 LED flashes.</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900/90 border border-slate-700/80">
                    <span className="text-emerald-400 font-bold block mb-1">3. Manual Pick & Resume</span>
                    <span className="text-slate-300">Student pulls the metal piece off the belt by hand and clicks "Resume" to restart.</span>
                  </div>
                </div>
                <span className="text-[11px] text-cyan-300/90 font-mono mt-0.5">
                  💡 Tip: The 5V Relay Module (Pin D5) can be connected to a 12V warning beacon/strobe or high-output buzzer to create an eye-catching visual alarm!
                </span>
              </div>

              {/* Materials Card */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono mb-2.5 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" /> Bill of Materials Checklist
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 font-mono text-xs">
                  <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800 flex flex-col justify-between">
                    <span className="text-cyan-300 font-bold">NodeMCU ESP8266</span>
                    <span className="text-[11px] text-slate-400 mt-1">ESP-12E Wi-Fi Dev Board, 3.3V logic levels</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800 flex flex-col justify-between">
                    <span className="text-cyan-300 font-bold">LJ12A3-4-Z/BX Sensor</span>
                    <span className="text-[11px] text-slate-400 mt-1">M12 Inductive Proximity, NPN Normally Open, 4mm range</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800 flex flex-col justify-between">
                    <span className="text-cyan-300 font-bold">L298N Motor Driver</span>
                    <span className="text-[11px] text-slate-400 mt-1">Dual H-Bridge Driver powering conveyor DC Gear Motor</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800 flex flex-col justify-between">
                    <span className="text-cyan-300 font-bold">Relay Module</span>
                    <span className="text-[11px] text-slate-400 mt-1">5V/12V Optocoupler Relay on D5 for pneumatic reject solenoid</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800 flex flex-col justify-between">
                    <span className="text-cyan-300 font-bold">Resistors / Level Shifter</span>
                    <span className="text-[11px] text-slate-400 mt-1">10kΩ & 3.9kΩ voltage divider stepping 12V output to 3.3V</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800 flex flex-col justify-between">
                    <span className="text-cyan-300 font-bold">DC Gear Motor + Frame</span>
                    <span className="text-[11px] text-slate-400 mt-1">Conveyor mechanical roller assembly & belt</span>
                  </div>
                </div>
              </div>

              {/* Wire-by-Wire Pinout Table */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                  NodeMCU ESP8266 Interconnect Pinout
                </h4>
                <div className="rounded-lg border border-slate-800 overflow-hidden">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <th className="py-2.5 px-3">PIN</th>
                        <th className="py-2.5 px-3">HARDWARE MODULE</th>
                        <th className="py-2.5 px-3">SPECIFIC WIRE / TERMINAL</th>
                        <th className="py-2.5 px-3">ELECTRICAL LOGIC & NOTES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                      {ESP8266_PINOUT.map((item) => (
                        <tr key={item.pin} className="hover:bg-slate-800/50">
                          <td className="py-2.5 px-3 text-cyan-400 font-bold">{item.pin}</td>
                          <td className="py-2.5 px-3 text-slate-200 font-semibold">{item.hardware}</td>
                          <td className="py-2.5 px-3 text-amber-300">{item.wiringInstructions}</td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">{item.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sensor Color Code Card */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-2.5">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  LJ12A3-4-Z/BX Sensor Wire Color Standard:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                  <div className="p-3 bg-slate-900 rounded border border-amber-900/50">
                    <span className="font-bold text-amber-500 block mb-1">BROWN WIRE (VCC)</span>
                    <span className="text-slate-400 text-[11px]">Connect to +12V DC External Supply (+6V to 36V max).</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded border border-blue-900/50">
                    <span className="font-bold text-blue-400 block mb-1">BLUE WIRE (GND)</span>
                    <span className="text-slate-400 text-[11px]">Connect to 0V Common Ground (GND shared with NodeMCU).</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded border border-slate-700">
                    <span className="font-bold text-slate-100 block mb-1">BLACK WIRE (OUT)</span>
                    <span className="text-slate-400 text-[11px]">
                      NPN Open Collector. Connect to Voltage Divider / Shifter, then to NodeMCU Pin D1!
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VOLTAGE DIVIDER CALCULATOR */}
          {activeTab === 'divider_calc' && (
            <div className="flex flex-col gap-5">
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-cyan-400" />
                  Sensor Voltage Stepping: 12V to Safe 3.3V Logic
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The NodeMCU ESP8266 GPIO pins operate strictly on <strong className="text-cyan-400">3.3V maximum</strong>. Connecting a 12V sensor directly to Pin D1 will permanently burn out the microcontroller. A simple two-resistor voltage divider or a bi-directional logic level shifter safely steps the signal down.
                </p>

                {/* Interactive Calculator Form */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 font-mono">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Sensor Supply Voltage (Vin):</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={supplyVoltage}
                        onChange={(e) => setSupplyVoltage(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                        min={5}
                        max={36}
                      />
                      <span className="text-slate-500">V</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Top Resistor (R1):</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={r1Kohm}
                        onChange={(e) => setR1Kohm(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                        step={0.5}
                      />
                      <span className="text-slate-500">kΩ</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Bottom Resistor (R2):</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={r2Kohm}
                        onChange={(e) => setR2Kohm(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                        step={0.1}
                      />
                      <span className="text-slate-500">kΩ</span>
                    </div>
                  </div>
                </div>

                {/* Calculation Result */}
                <div className="mt-3 p-3 rounded-lg border flex items-center justify-between font-mono bg-slate-900 border-slate-800">
                  <div>
                    <span className="text-slate-400 text-xs">Calculated Output to Pin D1 (Vout): </span>
                    <span className={`text-base font-bold ${isDangerouslyHigh ? 'text-red-400' : isSafeForNodeMCU ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {calculatedVout} Volts
                    </span>
                  </div>

                  <div>
                    {isDangerouslyHigh ? (
                      <span className="px-2.5 py-1 bg-red-950 text-red-300 border border-red-800 rounded text-[11px] font-bold animate-pulse">
                        DANGER: EXCEEDS 3.6V (RISK OF DAMAGE)
                      </span>
                    ) : isSafeForNodeMCU ? (
                      <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[11px] font-bold">
                        SAFE 3.3V LOGIC LEVEL
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-amber-950 text-amber-300 border border-amber-800 rounded text-[11px] font-bold">
                        LOW VOLTAGE (MAY BE UNRELIABLE)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Standard Resistor Pairing Reference */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                  Standard Verified Resistor Combinations
                </h4>
                <div className="space-y-2 font-mono text-xs">
                  {VOLTAGE_DIVIDER_GUIDES.map((guide, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-cyan-400 font-bold">Supply: {guide.sensorSupplyVolts}V DC</span>
                        <span className="text-emerald-400 font-bold">R1 = {guide.r1_top}, R2 = {guide.r2_bottom} → {guide.voltageOutput}V Output</span>
                      </div>
                      <pre className="text-[10px] text-slate-400 bg-slate-900/80 p-2 rounded border border-slate-800/80 overflow-x-auto">
                        {guide.diagram}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ARDUINO CODE */}
          {activeTab === 'code' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">
                  Target Sketch: <code className="text-cyan-400">NodeMCU_LJ12A3_Conveyor.ino</code>
                </span>
                <button
                  id="copy-arduino-code-btn"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-xs font-mono flex items-center gap-1.5 transition-colors shadow-md"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied to Clipboard!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Arduino Sketch
                    </>
                  )}
                </button>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-[480px]">
                <pre>{ESP8266_ARDUINO_CODE}</pre>
              </div>
            </div>
          )}

          {/* TAB 4: PROTOCOL */}
          {activeTab === 'protocol' && (
            <div className="flex flex-col gap-4 font-mono text-xs">
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
                  Serial & G-Code Commands (115200 Baud)
                </h4>
                <div className="space-y-2 text-slate-300">
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-emerald-400 font-bold">START</span> — Runs DC motor via L298N (ENA PWM)
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-amber-400 font-bold">STOP</span> — Halts conveyor motor
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-cyan-400 font-bold">SPEED:&lt;0-255&gt;</span> — Sets PWM duty cycle on ENA (e.g. <code>SPEED:175</code>)
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-amber-400 font-bold">REJECT</span> — Energizes Relay Module (Pin D5)
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-red-400 font-bold">ESTOP</span> — Latches safety shutoff
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">NodeMCU ESP8266 + LJ12A3-4-Z/BX + L298N Configuration Verified</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-semibold transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
