export const ESP8266_ARDUINO_CODE = `/*
 * ====================================================================
 * ESP8266 School Baggage Security Inspection Conveyor Controller
 * 
 * Target Microcontroller: NodeMCU ESP8266 (ESP-12E Module)
 * Sensors & Actuators:
 *  - Metal Sensor: LJ12A3-4-Z/BX Inductive Proximity Sensor (NPN NO) on Pin D1 (GPIO5)
 *  - Bag Counter:  E18-D80NK Infrared Photoelectric Sensor on Pin D6 (GPIO12)
 *  - Motor Driver: L298N Dual H-Bridge (ENA=D2/GPIO4, IN1=D3/GPIO0, IN2=D4/GPIO2)
 *  - Alarm System: 5V Relay Module switching Active 5V Buzzer + Red LED on Pin D5 (GPIO14)
 *  - Indicator:    Onboard LED (Pin D7 / GPIO13)
 * ====================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

// --- PIN DEFINITIONS (NodeMCU ESP8266) ---
// 1. Metal Detection (LJ12A3-4-Z/BX Signal via 10k/4.7k voltage divider)
const int PIN_SENSOR_LJ12A3   = D1;  // GPIO5: Interrupt digital input (NPN NO -> goes LOW on metal)

// 2. Bag Optical Counter (E18-D80NK IR Sensor)
const int PIN_SENSOR_E18_IR   = D6;  // GPIO12: Digital input (goes LOW when a bag blocks the beam)

// 3. L298N Motor Driver Control
const int PIN_MOTOR_ENA       = D2;  // GPIO4: PWM Speed regulation (0 to 255)
const int PIN_MOTOR_IN1       = D3;  // GPIO0: Direction Control 1
const int PIN_MOTOR_IN2       = D4;  // GPIO2: Direction Control 2

// 4. Alarm & Safety Actuators
const int PIN_ALARM_RELAY     = D5;  // GPIO14: 5V Relay Module (Controls 5V Active Buzzer & Warning LED)
const int PIN_STATUS_LED      = D7;  // GPIO13: Visual Status LED

// --- RELAY POLARITY ---
// Most standard optocoupler relay boards are Active-LOW (LOW = Relay ON/Energized)
const bool RELAY_ACTIVE_LOW   = true;
#define RELAY_ON  (RELAY_ACTIVE_LOW ? LOW : HIGH)
#define RELAY_OFF (RELAY_ACTIVE_LOW ? HIGH : LOW)

// --- WiFi Credentials (Optional: Leave default to run in USB Serial or AP mode) ---
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
ESP8266WebServer server(80);

// --- System State & Counters ---
volatile bool metalDetectedFlag = false;
volatile unsigned long lastMetalInterrupt = 0;
const unsigned long DEBOUNCE_MS = 80;

// Bag counter state tracking
volatile bool bagDetectedFlag = false;
volatile unsigned long lastBagInterrupt = 0;
const unsigned long BAG_DEBOUNCE_MS = 250; // Prevent multi-triggering on single bag creases

int motorSpeedPwm     = 180;         // Conveyor baseline speed (0-255)
bool isRunning        = true;        // Conveyor motor run state
bool isForward        = true;        // Belt direction
bool eStopActive      = false;       // Emergency stop flag
bool autoStopOnMetal  = true;        // School Safety Interlock: Automatically halt belt when metal detected
bool alarmActive      = false;       // Buzzer & strobe status

unsigned long totalBagsCount  = 0;   // Physical bags counted by E18-D80NK
unsigned long cleanBagsCount  = 0;   // Bags screened clear of metal
unsigned long metalBagsCount  = 0;   // Bags flagged with metallic objects
unsigned long lastTelemetryBroadcast = 0;

// ====================================================================
// HARDWARE INTERRUPT HANDLERS
// ====================================================================

// Interrupt 1: LJ12A3-4-Z/BX Metal Detection (NPN NO pulls to GND when metal enters 4mm field)
ICACHE_RAM_ATTR void handleMetalInterrupt() {
  unsigned long now = millis();
  if (now - lastMetalInterrupt > DEBOUNCE_MS) {
    metalDetectedFlag = true;
    lastMetalInterrupt = now;
  }
}

// Interrupt 2: E18-D80NK Bag Entrance Beam Break (Pulls to GND when a bag interrupts IR beam)
ICACHE_RAM_ATTR void handleBagInterrupt() {
  unsigned long now = millis();
  if (now - lastBagInterrupt > BAG_DEBOUNCE_MS) {
    bagDetectedFlag = true;
    lastBagInterrupt = now;
  }
}

// ====================================================================
// SETUP
// ====================================================================
void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println();
  Serial.println(F("================================================================="));
  Serial.println(F(" ESP8266 SCHOOL BAGGAGE INSPECTION CONVEYOR FIRMWARE ONLINE"));
  Serial.println(F(" LJ12A3-4-Z/BX (D1) | E18-D80NK IR (D6) | L298N (D2/D3/D4) | RELAY (D5)"));
  Serial.println(F("================================================================="));

  // 1. Metal Sensor (D1) with internal pull-up
  pinMode(PIN_SENSOR_LJ12A3, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_SENSOR_LJ12A3), handleMetalInterrupt, FALLING);

  // 2. E18-D80NK Bag Sensor (D6) with internal pull-up
  pinMode(PIN_SENSOR_E18_IR, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_SENSOR_E18_IR), handleBagInterrupt, FALLING);

  // 3. L298N Motor Driver Pins
  pinMode(PIN_MOTOR_ENA, OUTPUT);
  pinMode(PIN_MOTOR_IN1, OUTPUT);
  pinMode(PIN_MOTOR_IN2, OUTPUT);

  // 4. Relay Module & Indicator LEDs
  pinMode(PIN_ALARM_RELAY, OUTPUT);
  digitalWrite(PIN_ALARM_RELAY, RELAY_OFF);

  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  // Configure ESP8266 PWM range to standard 0-255
  analogWriteRange(255);
  updateMotor();

  // 5. Connect to WiFi or fallback to Soft-AP
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print(F("Connecting to WiFi"));
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 12) {
    delay(350);
    Serial.print(F("."));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print(F("WiFi Connected! IP Address: "));
    Serial.println(WiFi.localIP());
  } else {
    WiFi.softAP("NodeMCU-Checkpoint", "12345678");
    Serial.println();
    Serial.print(F("Running in AP Mode! Connect to SSID 'NodeMCU-Checkpoint' IP: "));
    Serial.println(WiFi.softAPIP());
  }

  setupHttpServer();
  Serial.println(F("{\\"system\\":\\"READY\\",\\"baudRate\\":115200}"));
}

// ====================================================================
// MOTOR CONTROL
// ====================================================================
void updateMotor() {
  if (eStopActive || !isRunning) {
    analogWrite(PIN_MOTOR_ENA, 0);
    digitalWrite(PIN_MOTOR_IN1, LOW);
    digitalWrite(PIN_MOTOR_IN2, LOW);
  } else {
    analogWrite(PIN_MOTOR_ENA, motorSpeedPwm);
    if (isForward) {
      digitalWrite(PIN_MOTOR_IN1, HIGH);
      digitalWrite(PIN_MOTOR_IN2, LOW);
    } else {
      digitalWrite(PIN_MOTOR_IN1, LOW);
      digitalWrite(PIN_MOTOR_IN2, HIGH);
    }
  }
}

// Alarm ON: activates 5V relay (buzzer sounds & LED turns ON)
void soundAlarm(bool active) {
  alarmActive = active;
  digitalWrite(PIN_ALARM_RELAY, active ? RELAY_ON : RELAY_OFF);
  digitalWrite(PIN_STATUS_LED, active ? HIGH : LOW);
}

// ====================================================================
// MAIN RUN LOOP
// ====================================================================
void loop() {
  server.handleClient();
  handleSerialCommands();

  unsigned long currentMillis = millis();

  // 1. Check if E18-D80NK IR Sensor detected a new bag entering conveyor
  if (bagDetectedFlag) {
    bagDetectedFlag = false;
    totalBagsCount++;
    cleanBagsCount++; // assume clean until metal sensor says otherwise

    // Emit live event over USB Serial for the web app
    Serial.print(F("{\\"event\\":\\"BAG_PASSED\\",\\"totalBags\\":"));
    Serial.print(totalBagsCount);
    Serial.print(F(",\\"cleanBags\\":"));
    Serial.print(cleanBagsCount);
    Serial.println(F("}"));
  }

  // 2. Check if LJ12A3 Metal Sensor detected concealed metal in bag
  if (metalDetectedFlag) {
    metalDetectedFlag = false;
    metalBagsCount++;
    if (cleanBagsCount > 0) cleanBagsCount--; // adjust cleared count

    // Fire alarm buzzer/relay
    soundAlarm(true);

    // School Safety Interlock: Automatically halt conveyor for physical inspection
    if (autoStopOnMetal) {
      isRunning = false;
      updateMotor();
    }

    // Emit live metal alert event over Serial to web app
    Serial.print(F("{\\"event\\":\\"METAL_DETECTED\\",\\"raw\\":880,\\"count\\":"));
    Serial.print(metalBagsCount);
    Serial.print(F(",\\"totalBags\\":"));
    Serial.print(totalBagsCount);
    Serial.println(F("}"));
  }

  // 3. Periodic Status Broadcast over USB Serial (every 250ms)
  if (currentMillis - lastTelemetryBroadcast >= 250) {
    lastTelemetryBroadcast = currentMillis;
    sendTelemetryJson();
  }
}

// Broadcast live telemetry packet in JSON format
void sendTelemetryJson() {
  bool metalPresent = (digitalRead(PIN_SENSOR_LJ12A3) == LOW);
  bool bagPresent   = (digitalRead(PIN_SENSOR_E18_IR) == LOW);
  int simulatedAdc  = metalPresent ? 880 : 150;

  Serial.print(F("{\\"signal\\":"));
  Serial.print(simulatedAdc);
  Serial.print(F(",\\"running\\":"));
  Serial.print(isRunning ? F("true") : F("false"));
  Serial.print(F(",\\"speed\\":"));
  Serial.print(motorSpeedPwm);
  Serial.print(F(",\\"dir\\":\\""));
  Serial.print(isForward ? F("forward") : F("reverse"));
  Serial.print(F("\\",\\"estop\\":"));
  Serial.print(eStopActive ? F("true") : F("false"));
  Serial.print(F(",\\"alarmActive\\":"));
  Serial.print(alarmActive ? F("true") : F("false"));
  Serial.print(F(",\\"metalCount\\":"));
  Serial.print(metalBagsCount);
  Serial.print(F(",\\"totalBags\\":"));
  Serial.print(totalBagsCount);
  Serial.print(F(",\\"metalSensor\\":"));
  Serial.print(metalPresent ? F("true") : F("false"));
  Serial.print(F(",\\"bagSensor\\":"));
  Serial.print(bagPresent ? F("true") : F("false"));
  Serial.println(F("}"));
}

// ====================================================================
// SERIAL COMMAND PROCESSOR (Web Serial API in Chrome/Edge)
// ====================================================================
void handleSerialCommands() {
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\\n');
    line.trim();
    if (line.length() == 0) return;

    if (line == "START" || line == "RESUME") {
      if (!eStopActive) {
        soundAlarm(false); // Silences alarm buzzer
        isRunning = true;
        updateMotor();
      }
    } else if (line == "STOP") {
      isRunning = false;
      updateMotor();
    } else if (line == "ESTOP") {
      eStopActive = true;
      isRunning = false;
      soundAlarm(true);
      updateMotor();
    } else if (line == "RESET_ESTOP") {
      eStopActive = false;
      soundAlarm(false);
      updateMotor();
    } else if (line == "ALARM_OFF" || line == "SILENCE") {
      soundAlarm(false);
    } else if (line.startsWith("SPEED:")) {
      int spd = line.substring(6).toInt();
      motorSpeedPwm = constrain(spd, 0, 255);
      updateMotor();
    } else if (line == "DIR:FWD") {
      isForward = true;
      updateMotor();
    } else if (line == "DIR:REV") {
      isForward = false;
      updateMotor();
    } else if (line == "RESET_COUNTERS") {
      metalBagsCount = 0;
      totalBagsCount = 0;
      cleanBagsCount = 0;
      soundAlarm(false);
    }
  }
}

// ====================================================================
// HTTP REST API (for Wi-Fi control)
// ====================================================================
void setCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void setupHttpServer() {
  server.on("/api/status", HTTP_GET, []() {
    setCors();
    bool metalPresent = (digitalRead(PIN_SENSOR_LJ12A3) == LOW);
    String json = "{\\"running\\":" + String(isRunning ? "true" : "false") +
                  ",\\"speed\\":" + String(motorSpeedPwm) +
                  ",\\"direction\\":\\"" + (isForward ? "forward" : "reverse") + "\\"" +
                  ",\\"estop\\":" + String(eStopActive ? "true" : "false") +
                  ",\\"alarmActive\\":" + String(alarmActive ? "true" : "false") +
                  ",\\"sensorTriggered\\":" + String(metalPresent ? "true" : "false") +
                  ",\\"metalCount\\":" + String(metalBagsCount) +
                  ",\\"totalBags\\":" + String(totalBagsCount) + "}";
    server.send(200, "application/json", json);
  });

  server.on("/api/conveyor/start", HTTP_POST, []() {
    setCors();
    if (!eStopActive) {
      soundAlarm(false);
      isRunning = true;
      updateMotor();
    }
    server.send(200, "application/json", "{\\"status\\":\\"started\\"}");
  });

  server.on("/api/conveyor/stop", HTTP_POST, []() {
    setCors();
    isRunning = false;
    updateMotor();
    server.send(200, "application/json", "{\\"status\\":\\"stopped\\"}");
  });

  server.on("/api/alarm/silence", HTTP_POST, []() {
    setCors();
    soundAlarm(false);
    server.send(200, "application/json", "{\\"status\\":\\"silenced\\"}");
  });

  server.begin();
}
`;

export interface PinMapping {
  pin: string;
  gpio: string;
  functionName: string;
  hardware: string;
  wiringInstructions: string;
  notes: string;
}

export const ESP8266_PINOUT: PinMapping[] = [
  {
    pin: 'D1',
    gpio: 'GPIO 5',
    functionName: 'Metal Sensor Input',
    hardware: 'LJ12A3-4-Z/BX Inductive Proximity Sensor',
    wiringInstructions: 'Black wire (Signal) -> 10kΩ/4.7kΩ Voltage Divider -> Pin D1',
    notes: 'NPN NO: Sinks to GND when metal enters within 4mm. Resistor divider steps 12V output down to safe 3.3V.'
  },
  {
    pin: 'D6',
    gpio: 'GPIO 12',
    functionName: 'Bag Counter Input',
    hardware: 'E18-D80NK Infrared Photoelectric Sensor',
    wiringInstructions: 'Black wire (Signal) -> Pin D6 (ESP8266 internal pull-up enabled)',
    notes: 'NPN Open-Collector: Sinks to GND when a student bag breaks the infrared beam. Increments Total Screened Bags.'
  },
  {
    pin: 'D2',
    gpio: 'GPIO 4',
    functionName: 'Conveyor Speed (PWM)',
    hardware: 'L298N Motor Driver - ENA (Enable A)',
    wiringInstructions: 'Remove L298N black ENA jumper -> Connect ENA pin to Pin D2',
    notes: 'Provides analogWrite (0-255) PWM duty cycle to vary conveyor speed.'
  },
  {
    pin: 'D3',
    gpio: 'GPIO 0',
    functionName: 'Motor Direction A',
    hardware: 'L298N Motor Driver - IN1',
    wiringInstructions: 'NodeMCU Pin D3 -> L298N IN1',
    notes: 'Forward: IN1=HIGH, IN2=LOW. Reverse: IN1=LOW, IN2=HIGH.'
  },
  {
    pin: 'D4',
    gpio: 'GPIO 2',
    functionName: 'Motor Direction B',
    hardware: 'L298N Motor Driver - IN2',
    wiringInstructions: 'NodeMCU Pin D4 -> L298N IN2',
    notes: 'Paired with IN1 for directional switching.'
  },
  {
    pin: 'D5',
    gpio: 'GPIO 14',
    functionName: 'Security Alarm & Siren',
    hardware: '5V 1-Channel Relay Module (Optocoupler)',
    wiringInstructions: 'NodeMCU Pin D5 -> Relay IN. Relay switches 5V Active Buzzer & Red LED.',
    notes: 'Active-LOW trigger. Automatically energizes upon metal detection to sound buzzer and illuminate red alarm LED.'
  },
  {
    pin: 'D7',
    gpio: 'GPIO 13',
    functionName: 'Onboard Status LED',
    hardware: 'Status Indicator LED',
    wiringInstructions: 'Pin D7 -> 220Ω -> LED (+) -> GND',
    notes: 'Flashes in sync with metal alerts and system heartbeat.'
  },
  {
    pin: 'VIN',
    gpio: '5V Power In',
    functionName: 'ESP8266 Board Power',
    hardware: '5V from L298N 5V Terminal or Buck Converter',
    wiringInstructions: 'L298N 5V Out -> NodeMCU VIN (or powered via USB cable)',
    notes: 'When L298N receives 12V with the 5V-EN jumper on, its 5V terminal supplies regulated power for the ESP8266.'
  },
  {
    pin: 'GND',
    gpio: 'Common Ground',
    functionName: 'System Ground Bus',
    hardware: 'Shared Ground for All Modules',
    wiringInstructions: 'Connect NodeMCU GND, L298N GND, 12V Supply GND, LJ12A3 Blue wire, and E18-D80NK Blue wire together',
    notes: 'CRITICAL: All power supplies and sensors must share a common ground reference.'
  }
];

export interface ResistorDividerGuide {
  sensorSupplyVolts: number;
  r1_top: string;
  r2_bottom: string;
  voltageOutput: number;
  diagram: string;
}

export const VOLTAGE_DIVIDER_GUIDES: ResistorDividerGuide[] = [
  {
    sensorSupplyVolts: 12,
    r1_top: '10 kΩ',
    r2_bottom: '4.7 kΩ (or 3.9 kΩ)',
    voltageOutput: 3.32,
    diagram: 'Sensor Black (12V) ──[ 10kΩ ]──┬── NodeMCU D1 (3.3V safe)\n                                      │\n                                   [ 4.7kΩ ]\n                                      │\n                                     GND'
  },
  {
    sensorSupplyVolts: 12,
    r1_top: '20 kΩ',
    r2_bottom: '6.8 kΩ',
    voltageOutput: 3.04,
    diagram: 'Sensor Black (12V) ──[ 20kΩ ]──┬── NodeMCU D1 (3.0V safe)\n                                      │\n                                   [ 6.8kΩ ]\n                                      │\n                                     GND'
  },
  {
    sensorSupplyVolts: 5,
    r1_top: '10 kΩ',
    r2_bottom: '20 kΩ',
    voltageOutput: 3.33,
    diagram: 'Sensor Black (5V) ──[ 10kΩ ]──┬── NodeMCU D1 (3.3V)\n                                     │\n                                  [ 20kΩ ]\n                                     │\n                                    GND'
  }
];
