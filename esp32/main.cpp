/*********************************************************************************/
/*                                                                               */
/*   POCKET LOCKER - FIRMWARE INTEGRAL PARA ESP32 (CONTROL PEATONAL / GARAJE)    */
/*   Versión: 5.5 - Dual Bluetooth Monolítico Optimizado (BLE NUS + Classic SPP) */
/*                                                                               */
/*   Todo el firmware en un único script autónomo y legible:                     */
/*   1. Configuración de Hardware, Pines y Tiempos de Regla.                     */
/*   2. Controlador de Relés y Máquina de Estados (5000ms pulso + 5s cooldown).  */
/*   3. Base de Datos NVS de Usuarios y Control por MAC Física.                  */
/*   4. Criptografía HMAC-SHA256, Nonces y Protección Anti-Fuerza Bruta.         */
/*   5. Servidor Bluetooth Dual: Classic SPP + Nordic UART Service (BLE).        */
/*   6. Dispatcher Unificado de Comandos y Ciclo Loop no bloqueante.             */
/*                                                                               */
/*********************************************************************************/

#include <Arduino.h>
#include <BluetoothSerial.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <Preferences.h>
#include <mbedtls/md.h>
#include "esp_spp_api.h"
#include <stdarg.h>
#include <string.h>
#include <ctype.h>

// =============================================================================
// SECCIÓN 1: CONFIGURACIÓN DE HARDWARE, CONSTANTES Y TIEMPOS OFICIALES
// =============================================================================

#define PIN_RELE_PORTON   26  // GPIO relé del portón de garaje
#define PIN_RELE_PUERTA   27  // GPIO relé de la puerta peatonal

// Lógica de activación de relés (módulos optoacoplados con lógica inversa activa en LOW)
// MODO_LEDS_PRUEBA=1 -> LEDs de prueba (GPIO -> resistencia -> LED -> GND), activos en ALTO.
// MODO_LEDS_PRUEBA=0 -> modulo de reles real (activo en BAJO). Por defecto: reles.
// Se activa con el entorno de PlatformIO 'esp32dev_leds' (ver platformio.ini).
#ifndef MODO_LEDS_PRUEBA
#define MODO_LEDS_PRUEBA 0
#endif

#if MODO_LEDS_PRUEBA
#define RELE_ACTIVAR      HIGH
#define RELE_DESACTIVAR   LOW
#else
#define RELE_ACTIVAR      LOW
#define RELE_DESACTIVAR   HIGH
#endif

static const char* const BT_DEVICE_NAME  = "PLBT";
static const char* const ADMIN_PIN       = "2415";

// UUIDs del servicio Nordic UART (NUS) para BLE
#define NUS_SERVICE_UUID  "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define NUS_RX_UUID       "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"  // App -> ESP32 Write
#define NUS_TX_UUID       "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"  // ESP32 -> App Notify

// Espacios de nombres NVS
static const char* const NVS_NAMESPACE   = "pocket_lk";
static const char* const NVS_KEY_PIN     = "sec_pin";
static const char* const NVS_USERS_NS    = "plk_users";
static const char* const NVS_LOGS_NS     = "plk_app_logs";

// Tiempos reglamentarios (milisegundos)
static const unsigned long DURACION_PULSO_MS   = 5000;  // Pulso de 5 segundos
static const unsigned long TIEMPO_COOLDOWN_MS  = 5000;  // Exclusión mutua / enfriamiento 5s
static const unsigned long NONCE_VALIDITY_MS   = 15000; // Validez de desafío HMAC 15s
static const unsigned long TIMEOUT_SERIAL_MS   = 1500;  // Timeout de trama serie Bluetooth

#define BUFFER_SIZE 160
#define MAX_USUARIOS 50
#define MAX_APP_LOGS 25

struct AppLogDB {
  uint32_t timestamp;
  char nivel[8];
  char mensaje[80];
};

// Enumeraciones y tipos
enum class EstadoRele {
  INACTIVO,
  PULSO_ACTIVO,
  ENFRIAMIENTO
};

struct ControlRele {
  uint8_t pin;
  EstadoRele estado;
  unsigned long tiempoInicioPulso;
  unsigned long tiempoInicioCooldown;
  const char* nombre;
};

struct UsuarioDB {
  char mac[18];
  char nombre[24];
  bool peatonal;
  bool garaje;
  int diasValidez;
  uint32_t timestampRegistro;
  bool bloqueado;
  bool activo;
};

enum CanalActivo { CANAL_NINGUNO, CANAL_CLASSIC, CANAL_BLE };

// =============================================================================
// SECCIÓN 2: CONTROLADOR DE RELÉS Y MÁQUINA DE ESTADOS
// =============================================================================

ControlRele relePorton = { PIN_RELE_PORTON, EstadoRele::INACTIVO, 0, 0, "GARAJE" };
ControlRele relePuerta = { PIN_RELE_PUERTA, EstadoRele::INACTIVO, 0, 0, "PEATONAL" };

void inicializarPinesSeguros() {
  digitalWrite(PIN_RELE_PORTON, RELE_DESACTIVAR);
  pinMode(PIN_RELE_PORTON, OUTPUT);
  digitalWrite(PIN_RELE_PORTON, RELE_DESACTIVAR);

  digitalWrite(PIN_RELE_PUERTA, RELE_DESACTIVAR);
  pinMode(PIN_RELE_PUERTA, OUTPUT);
  digitalWrite(PIN_RELE_PUERTA, RELE_DESACTIVAR);

  Serial.println(F("[HARDWARE] Pines de relé inicializados de forma segura."));
}

void actualizarEstadoRele(ControlRele &rele) {
  unsigned long ahora = millis();
  switch (rele.estado) {
    case EstadoRele::INACTIVO:
      break;

    case EstadoRele::PULSO_ACTIVO:
      if (ahora - rele.tiempoInicioPulso >= DURACION_PULSO_MS) {
        digitalWrite(rele.pin, RELE_DESACTIVAR);
        rele.estado = EstadoRele::ENFRIAMIENTO;
        rele.tiempoInicioCooldown = ahora;
        Serial.printf("[RELE %s] Pulso concluido (5000ms) -> Iniciando enfriamiento\n", rele.nombre);
      }
      break;

    case EstadoRele::ENFRIAMIENTO:
      if (ahora - rele.tiempoInicioCooldown >= TIEMPO_COOLDOWN_MS) {
        rele.estado = EstadoRele::INACTIVO;
        Serial.printf("[RELE %s] Enfriamiento finalizado (5000ms) -> Listo para operar\n", rele.nombre);
      }
      break;
  }
}

void procesarMaquinaEstados() {
  actualizarEstadoRele(relePorton);
  actualizarEstadoRele(relePuerta);
}

// =============================================================================
// SECCIÓN 3: BASE DE DATOS DE USUARIOS Y GESTIÓN NVS
// =============================================================================

static Preferences preferences;
char currentClientMac[18] = "00:00:00:00:00:00";
UsuarioDB tablaUsuarios[MAX_USUARIOS];
size_t totalUsuarios = 0;
char secretKey[32] = "2415";

static uint32_t epochBase = 0;
static unsigned long millisBase = 0;
uint32_t obtenerEpoch();

void cargarCredencialesNVS() {
  preferences.begin(NVS_NAMESPACE, false);
  String storedPin = preferences.getString(NVS_KEY_PIN, ADMIN_PIN);
  strncpy(secretKey, storedPin.c_str(), sizeof(secretKey) - 1);
  secretKey[sizeof(secretKey) - 1] = '\0';
  preferences.end();
  Serial.printf("[NVS] PIN cargado desde memoria segura.\n");
}

void cargarUsuariosNVS() {
  preferences.begin(NVS_USERS_NS, true);
  totalUsuarios = preferences.getUInt("count", 0);
  if (totalUsuarios > MAX_USUARIOS) totalUsuarios = MAX_USUARIOS;

  for (size_t i = 0; i < totalUsuarios; i++) {
    char key[16];
    snprintf(key, sizeof(key), "u_%u", (unsigned int)i);
    preferences.getBytes(key, &tablaUsuarios[i], sizeof(UsuarioDB));
  }
  preferences.end();
  Serial.printf("[NVS] Cargados %u usuarios registrados.\n", (unsigned int)totalUsuarios);
}

void guardarUsuariosNVS() {
  preferences.begin(NVS_USERS_NS, false);
  preferences.putUInt("count", totalUsuarios);
  for (size_t i = 0; i < totalUsuarios; i++) {
    char key[16];
    snprintf(key, sizeof(key), "u_%u", (unsigned int)i);
    preferences.putBytes(key, &tablaUsuarios[i], sizeof(UsuarioDB));
  }
  preferences.end();
  Serial.printf("[NVS] Guardados %u usuarios en memoria flash.\n", (unsigned int)totalUsuarios);
}

AppLogDB tablaAppLogs[MAX_APP_LOGS];
size_t totalAppLogs = 0;

void cargarAppLogsNVS() {
  preferences.begin(NVS_LOGS_NS, true);
  totalAppLogs = preferences.getUInt("count", 0);
  if (totalAppLogs > MAX_APP_LOGS) totalAppLogs = MAX_APP_LOGS;

  for (size_t i = 0; i < totalAppLogs; i++) {
    char key[16];
    snprintf(key, sizeof(key), "l_%u", (unsigned int)i);
    preferences.getBytes(key, &tablaAppLogs[i], sizeof(AppLogDB));
  }
  preferences.end();
  Serial.printf("[NVS] Cargados %u logs de error de la app desde flash.\n", (unsigned int)totalAppLogs);
}

void guardarAppLog(const char* nivel, const char* mensaje) {
  if (nivel == nullptr || mensaje == nullptr) return;

  AppLogDB nuevoLog;
  nuevoLog.timestamp = obtenerEpoch();
  strncpy(nuevoLog.nivel, nivel, sizeof(nuevoLog.nivel) - 1);
  nuevoLog.nivel[sizeof(nuevoLog.nivel) - 1] = '\0';
  strncpy(nuevoLog.mensaje, mensaje, sizeof(nuevoLog.mensaje) - 1);
  nuevoLog.mensaje[sizeof(nuevoLog.mensaje) - 1] = '\0';

  if (totalAppLogs < MAX_APP_LOGS) {
    tablaAppLogs[totalAppLogs++] = nuevoLog;
  } else {
    for (size_t i = 0; i < MAX_APP_LOGS - 1; i++) {
      tablaAppLogs[i] = tablaAppLogs[i + 1];
    }
    tablaAppLogs[MAX_APP_LOGS - 1] = nuevoLog;
  }

  preferences.begin(NVS_LOGS_NS, false);
  preferences.putUInt("count", totalAppLogs);
  for (size_t i = 0; i < totalAppLogs; i++) {
    char key[16];
    snprintf(key, sizeof(key), "l_%u", (unsigned int)i);
    preferences.putBytes(key, &tablaAppLogs[i], sizeof(AppLogDB));
  }
  preferences.end();
  Serial.printf("[NVS LOG GUARDADO] [%s] %s\n", nuevoLog.nivel, nuevoLog.mensaje);
}

void borrarAppLogs() {
  preferences.begin(NVS_LOGS_NS, false);
  preferences.clear();
  preferences.end();
  totalAppLogs = 0;
  Serial.println(F("[NVS] Logs de la app borrados de memoria flash."));
}

uint32_t obtenerEpoch() {
  if (epochBase == 0) return 0;
  return epochBase + ((millis() - millisBase) / 1000);
}

void sincronizarTiempo(uint32_t ts) {
  if (ts > 1000000000) {
    epochBase = ts;
    millisBase = millis();
    Serial.printf("[RTC] Reloj interno sincronizado con timestamp: %u\n", (unsigned int)ts);
  }
}

int buscarUsuarioPorMac(const char* mac) {
  if (mac == nullptr || strlen(mac) == 0) return -1;
  for (size_t i = 0; i < totalUsuarios; i++) {
    if (tablaUsuarios[i].activo && strcasecmp(tablaUsuarios[i].mac, mac) == 0) {
      return (int)i;
    }
  }
  return -1;
}

void verificarExpiraciones() {
  uint32_t ahora = obtenerEpoch();
  if (ahora == 0) return;

  for (size_t i = 0; i < totalUsuarios; i++) {
    if (tablaUsuarios[i].activo && !tablaUsuarios[i].bloqueado && tablaUsuarios[i].diasValidez > 0) {
      uint32_t segundosTranscurridos = ahora - tablaUsuarios[i].timestampRegistro;
      uint32_t limiteSegundos = (uint32_t)tablaUsuarios[i].diasValidez * 86400;
      if (segundosTranscurridos >= limiteSegundos) {
        tablaUsuarios[i].bloqueado = true;
        Serial.printf("[ACCESO] Usuario %s (MAC: %s) ha expirado automáticamente.\n",
          tablaUsuarios[i].nombre, tablaUsuarios[i].mac);
      }
    }
  }
}

bool parsearPin(const char* pin, bool &p, bool &g, int &dias) {
  if (pin == nullptr) return false;
  if (strncasecmp(pin, "2S0BP", 5) != 0) return false;

  char charP = pin[5];
  if (charP != '0' && charP != '1') return false;

  char charG = pin[6];
  if (charG != 'G' && charG != 'g') return false;

  char charValG = pin[7];
  if (charValG != '0' && charValG != '1') return false;

  p = (charP == '1');
  g = (charValG == '1');
  if (!p && !g) return false;

  const char* restoDias = pin + 8;
  if (strlen(restoDias) == 0) {
    dias = 0;
  } else {
    if (strlen(restoDias) > 2) return false;
    for (size_t i = 0; i < strlen(restoDias); i++) {
      if (!isdigit(restoDias[i])) return false;
    }
    dias = atoi(restoDias);
    if (dias <= 0 || dias > 99) return false;
  }
  return true;
}

bool registrarUsuario(const char* nombre, const char* pin, bool &pOut, bool &gOut, int &diasOut) {
  bool p = false, g = false;
  int dias = 0;
  if (!parsearPin(pin, p, g, dias)) return false;

  int idx = buscarUsuarioPorMac(currentClientMac);
  if (idx < 0) {
    if (totalUsuarios < MAX_USUARIOS) {
      idx = totalUsuarios++;
    } else {
      return false;
    }
  }

  strncpy(tablaUsuarios[idx].mac, currentClientMac, sizeof(tablaUsuarios[idx].mac) - 1);
  tablaUsuarios[idx].mac[sizeof(tablaUsuarios[idx].mac) - 1] = '\0';

  strncpy(tablaUsuarios[idx].nombre, nombre, sizeof(tablaUsuarios[idx].nombre) - 1);
  tablaUsuarios[idx].nombre[sizeof(tablaUsuarios[idx].nombre) - 1] = '\0';

  tablaUsuarios[idx].peatonal = p;
  tablaUsuarios[idx].garaje = g;
  tablaUsuarios[idx].diasValidez = dias;
  tablaUsuarios[idx].timestampRegistro = obtenerEpoch();
  tablaUsuarios[idx].bloqueado = false;
  tablaUsuarios[idx].activo = true;

  guardarUsuariosNVS();

  pOut = p;
  gOut = g;
  diasOut = dias;
  return true;
}

bool desbloquearUsuario(const char* mac) {
  int idx = buscarUsuarioPorMac(mac);
  if (idx >= 0) {
    tablaUsuarios[idx].bloqueado = false;
    if (tablaUsuarios[idx].diasValidez > 0) {
      tablaUsuarios[idx].timestampRegistro = obtenerEpoch();
    }
    guardarUsuariosNVS();
    return true;
  }
  return false;
}

bool actualizarUsuario(const char* mac, int dias, bool peatonal, bool garaje) {
  int idx = buscarUsuarioPorMac(mac);
  if (idx >= 0) {
    tablaUsuarios[idx].diasValidez = (dias >= 0 && dias <= 99) ? dias : 0;
    tablaUsuarios[idx].peatonal = peatonal;
    tablaUsuarios[idx].garaje = garaje;
    tablaUsuarios[idx].bloqueado = false;
    tablaUsuarios[idx].timestampRegistro = obtenerEpoch();
    guardarUsuariosNVS();
    return true;
  }
  return false;
}

bool eliminarUsuario(const char* mac) {
  int idx = buscarUsuarioPorMac(mac);
  if (idx >= 0) {
    for (size_t i = idx; i < totalUsuarios - 1; i++) {
      tablaUsuarios[i] = tablaUsuarios[i + 1];
    }
    totalUsuarios--;
    guardarUsuariosNVS();
    return true;
  }
  return false;
}

// =============================================================================
// SECCIÓN 4: CRIPTOGRAFÍA HMAC-SHA256 Y NONCES
// =============================================================================

char currentChallenge[33] = {0};
unsigned long challengeIssuedAt = 0;
bool challengeActive = false;
uint8_t fallosConsecutivos = 0;

void generarNuevoChallenge() {
  uint32_t r1 = esp_random();
  uint32_t r2 = esp_random();
  uint32_t r3 = esp_random();
  uint32_t r4 = esp_random();

  snprintf(currentChallenge, sizeof(currentChallenge), "%08x%08x%08x%08x", r1, r2, r3, r4);
  challengeIssuedAt = millis();
  challengeActive = true;
  Serial.printf("[CHALLENGE] Nonce generado: %s\n", currentChallenge);
}

void verificarExpiracionChallenge() {
  unsigned long ahora = millis();
  if (challengeActive && (ahora - challengeIssuedAt > NONCE_VALIDITY_MS)) {
    challengeActive = false;
    currentChallenge[0] = '\0';
    Serial.printf("[CHALLENGE] Nonce expirado.\n");
  }
}

void calcularHmacSha256(const char* key, const char* data, char* outputHex) {
  uint8_t hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)key, strlen(key));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)data, strlen(data));
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);

  for (size_t i = 0; i < 32; i++) {
    sprintf(outputHex + (i * 2), "%02x", hmacResult[i]);
  }
  outputHex[64] = '\0';
}

bool validarHmacSha256(const char* nonce, const char* comando, const char* hmacRecibido) {
  if (nonce == nullptr || comando == nullptr || hmacRecibido == nullptr) return false;

  char payload[96];
  snprintf(payload, sizeof(payload), "%s:%s", nonce, comando);

  char hmacCalculado[65];
  calcularHmacSha256(secretKey, payload, hmacCalculado);

  if (strlen(hmacCalculado) != 64 || strlen(hmacRecibido) != 64) return false;

  uint8_t resultado = 0;
  for (size_t i = 0; i < 64; i++) {
    resultado |= (hmacCalculado[i] ^ hmacRecibido[i]);
  }
  return (resultado == 0);
}

void registrarFalloSeguridad() {
  fallosConsecutivos++;
  unsigned long delayMs = min((int)(fallosConsecutivos * 400), 3000);
  vTaskDelay(delayMs / portTICK_PERIOD_MS);
}

void resetearFallosSeguridad() {
  fallosConsecutivos = 0;
}

// =============================================================================
// SECCIÓN 5: SERVIDORES BLUETOOTH DUAL (CLASSIC SPP + BLE NUS)
// =============================================================================

BluetoothSerial ESP_BT;
CanalActivo canalActual = CANAL_NINGUNO;

bool bleClientConnected = false;
static BLECharacteristic *pTxCharacteristic = NULL;

void procesarComandoEntrante(const char* rawCmd);

void responderBluetooth(const char* mensaje) {
  if (mensaje == nullptr) return;
  ESP_BT.print(mensaje);
  Serial.print(F("[BT TX ->] "));
  Serial.print(mensaje);
}

void bleResponder(const char* msg) {
  if (msg == nullptr) return;
  if (bleClientConnected && pTxCharacteristic != NULL) {
    pTxCharacteristic->setValue((uint8_t*)msg, strlen(msg));
    pTxCharacteristic->notify();
    Serial.print(F("[BLE TX ->] "));
    Serial.print(msg);
  }
}

void responderCanal(const char* msg) {
  if (canalActual == CANAL_CLASSIC) {
    responderBluetooth(msg);
  } else if (canalActual == CANAL_BLE) {
    bleResponder(msg);
  } else {
    // Si no hay canal activo fijado, emitir por el que tenga cliente conectado
    if (bleClientConnected) {
      bleResponder(msg);
    } else {
      responderBluetooth(msg);
    }
  }
}

void responderCanalF(const char* fmt, ...) {
  char buffer[192];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buffer, sizeof(buffer), fmt, args);
  va_end(args);
  responderCanal(buffer);
}

// Callbacks BLE
class BleServerCallbacksHandler: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    bleClientConnected = true;
    canalActual = CANAL_BLE;
    Serial.println(F("[BLE] Cliente conectado"));
  }

  void onDisconnect(BLEServer* pServer) {
    bleClientConnected = false;
    if (canalActual == CANAL_BLE) canalActual = CANAL_NINGUNO;
    Serial.println(F("[BLE] Cliente desconectado"));
    delay(400);
    pServer->startAdvertising();
    Serial.println(F("[BLE] Advertising reiniciado"));
  }
};

class BleRxCallbacksHandler: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    std::string rxValue = pCharacteristic->getValue();
    if (rxValue.length() > 0) {
      canalActual = CANAL_BLE;
      procesarComandoEntrante(rxValue.c_str());
    }
  }
};

void inicializarBLE() {
  BLEDevice::init(BT_DEVICE_NAME);
  BLEServer *pBleServer = BLEDevice::createServer();
  pBleServer->setCallbacks(new BleServerCallbacksHandler());

  BLEService *pService = pBleServer->createService(NUS_SERVICE_UUID);

  pTxCharacteristic = pService->createCharacteristic(
    NUS_TX_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
    NUS_RX_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pRxCharacteristic->setCallbacks(new BleRxCallbacksHandler());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(NUS_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println(F("[BLE] Servidor Nordic UART activo"));
}

// Callbacks Classic SPP
void btCallback(esp_spp_cb_event_t event, esp_spp_cb_param_t *param) {
  if (event == ESP_SPP_SRV_OPEN_EVT) {
    canalActual = CANAL_CLASSIC;
    snprintf(currentClientMac, sizeof(currentClientMac), "%02X:%02X:%02X:%02X:%02X:%02X",
      param->srv_open.rem_bda[0], param->srv_open.rem_bda[1], param->srv_open.rem_bda[2],
      param->srv_open.rem_bda[3], param->srv_open.rem_bda[4], param->srv_open.rem_bda[5]);
    Serial.printf("[BT Classic] Conectado cliente MAC: %s\n", currentClientMac);
  } else if (event == ESP_SPP_CLOSE_EVT) {
    if (canalActual == CANAL_CLASSIC) canalActual = CANAL_NINGUNO;
    Serial.printf("[BT Classic] Desconectado cliente (era MAC: %s)\n", currentClientMac);
    strncpy(currentClientMac, "00:00:00:00:00:00", sizeof(currentClientMac) - 1);
    currentClientMac[sizeof(currentClientMac) - 1] = '\0';
  }
}

void inicializarBluetooth() {
  ESP_BT.register_callback(btCallback);
  ESP_BT.setPin(secretKey);

  if (ESP_BT.begin(BT_DEVICE_NAME)) {
    Serial.printf("[BT Classic] Servidor SPP activo con nombre: '%s'\n", BT_DEVICE_NAME);
  } else {
    Serial.println(F("[BT ERROR] No se pudo inicializar la pila Bluetooth Classic!"));
  }
}

// =============================================================================
// SECCIÓN 6: DISPATCHER DE COMANDOS Y PROCESAMIENTO
// =============================================================================

bool solicitarApertura(ControlRele &rele, const char* callerPin) {
  unsigned long ahora = millis();

  // 1. Exclusión mutua de 5000ms
  if (relePorton.estado == EstadoRele::PULSO_ACTIVO || relePuerta.estado == EstadoRele::PULSO_ACTIVO) {
    responderCanal("ERR:EN_EJECUCION\n");
    return false;
  }

  // 2. Comprobación de enfriamiento
  if (rele.estado == EstadoRele::ENFRIAMIENTO) {
    unsigned long restante = TIEMPO_COOLDOWN_MS - (ahora - rele.tiempoInicioCooldown);
    unsigned long seg = (restante / 1000) + 1;
    responderCanalF("ERR:COOLDOWN:%lu\n", seg);
    return false;
  }

  // 3. Comprobación de permisos
  verificarExpiraciones();
  bool esAdmin = (callerPin != nullptr && strcmp(callerPin, ADMIN_PIN) == 0);

  if (!esAdmin) {
    int idx = buscarUsuarioPorMac(currentClientMac);
    if (idx >= 0) {
      if (tablaUsuarios[idx].bloqueado) {
        responderCanal("ERR:BLOQUEADO\n");
        return false;
      }
      if (rele.pin == PIN_RELE_PUERTA && !tablaUsuarios[idx].peatonal) {
        responderCanal("ERR:SIN_PERMISO_PEATONAL\n");
        return false;
      }
      if (rele.pin == PIN_RELE_PORTON && !tablaUsuarios[idx].garaje) {
        responderCanal("ERR:SIN_PERMISO_GARAJE\n");
        return false;
      }
    } else if (callerPin != nullptr) {
      bool p = false, g = false;
      int dias = 0;
      if (parsearPin(callerPin, p, g, dias)) {
        if (rele.pin == PIN_RELE_PUERTA && !p) {
          responderCanal("ERR:SIN_PERMISO_PEATONAL\n");
          return false;
        }
        if (rele.pin == PIN_RELE_PORTON && !g) {
          responderCanal("ERR:SIN_PERMISO_GARAJE\n");
          return false;
        }
      } else {
        responderCanal("ERR:PIN_INVALIDO\n");
        return false;
      }
    } else {
      responderCanal("ERR:AUTH_REQUERIDA\n");
      return false;
    }
  }

  // 4. Activación física del relé (pulso 5000ms)
  digitalWrite(rele.pin, RELE_ACTIVAR);
  rele.tiempoInicioPulso = ahora;
  rele.estado = EstadoRele::PULSO_ACTIVO;

  Serial.printf("[ACCION] Apertura autorizada y ejecutada para: %s\n", rele.nombre);
  responderCanalF("OK:%s\n", rele.nombre);
  return true;
}

void despacharAperturaPuerta(const char* cmd, const char* callerPin) {
  if (strcmp(cmd, "P") == 0 || strcmp(cmd, "E") == 0 || strcmp(cmd, "PUERTA") == 0) {
    solicitarApertura(relePuerta, callerPin);
  } else if (strcmp(cmd, "G") == 0 || strcmp(cmd, "H") == 0 || strcmp(cmd, "PORTON") == 0 || strcmp(cmd, "GARAJE") == 0) {
    solicitarApertura(relePorton, callerPin);
  } else if (strcmp(cmd, "PING") == 0) {
    responderCanal("OK:PONG\n");
  } else {
    responderCanal("ERR:COMANDO_DESCONOCIDO\n");
  }
}

void procesarComandoEntrante(const char* rawCmd) {
  while (*rawCmd == ' ' || *rawCmd == '\r' || *rawCmd == '\n') rawCmd++;
  if (strlen(rawCmd) == 0) return;

  char cmdLimpio[BUFFER_SIZE];
  strncpy(cmdLimpio, rawCmd, sizeof(cmdLimpio) - 1);
  cmdLimpio[sizeof(cmdLimpio) - 1] = '\0';
  size_t len = strlen(cmdLimpio);
  while (len > 0 && (cmdLimpio[len - 1] == ' ' || cmdLimpio[len - 1] == '\r' || cmdLimpio[len - 1] == '\n')) {
    cmdLimpio[--len] = '\0';
  }
  if (len == 0) return;

  Serial.printf("[COMANDO RX] \"%s\"\n", cmdLimpio);

  // 1. Solicitud de Challenge criptográfico (HMAC-SHA256)
  if (strcmp(cmdLimpio, "PLK:REQ_CHALLENGE") == 0 || strcmp(cmdLimpio, "REQ:CHALLENGE") == 0) {
    generarNuevoChallenge();
    responderCanalF("PLK:CHALLENGE:%s\n", currentChallenge);
    return;
  }

  // 2. Sincronización horaria y estado
  if (strncmp(cmdLimpio, "PLK:SYNC:", 9) == 0) {
    const char* tsStr = cmdLimpio + 9;
    uint32_t ts = strtoul(tsStr, NULL, 10);
    sincronizarTiempo(ts);

    int idx = buscarUsuarioPorMac(currentClientMac);
    if (idx >= 0) {
      int diasRestantes = -1;
      if (tablaUsuarios[idx].diasValidez > 0) {
        uint32_t ahora = obtenerEpoch();
        uint32_t transcurrido = ahora - tablaUsuarios[idx].timestampRegistro;
        uint32_t limite = tablaUsuarios[idx].diasValidez * 86400;
        if (transcurrido < limite) {
          diasRestantes = (int)((limite - transcurrido) / 86400) + 1;
        } else {
          diasRestantes = 0;
        }
      }
      responderCanalF("INFO:%s:%d:%d:%d\n",
        tablaUsuarios[idx].bloqueado ? "BLOQUEADO" : "ACTIVO",
        diasRestantes,
        tablaUsuarios[idx].peatonal ? 1 : 0,
        tablaUsuarios[idx].garaje ? 1 : 0
      );
    } else {
      responderCanal("INFO:DESCONOCIDO:-1:1:1\n");
    }
    return;
  }

  // 3. Registro de cliente
  if (strncmp(cmdLimpio, "PLK:REG:", 8) == 0) {
    const char* p1 = cmdLimpio + 8;
    const char* sep = strchr(p1, ':');
    if (sep != nullptr) {
      char nombre[24];
      size_t lenNombre = sep - p1;
      if (lenNombre >= sizeof(nombre)) lenNombre = sizeof(nombre) - 1;
      strncpy(nombre, p1, lenNombre);
      nombre[lenNombre] = '\0';

      const char* pin = sep + 1;
      bool esAdmin = (strcmp(pin, ADMIN_PIN) == 0);

      if (esAdmin) {
        responderCanal("OK:REGISTRADO:ADMIN\n");
        return;
      }

      bool p = false, g = false;
      int dias = 0;
      if (registrarUsuario(nombre, pin, p, g, dias)) {
        responderCanalF("OK:REGISTRADO:USER:%d:%d:%d\n", p ? 1 : 0, g ? 1 : 0, dias);
      } else {
        if (totalUsuarios >= MAX_USUARIOS) {
          responderCanal("ERR:DB_LLENA\n");
        } else {
          responderCanal("ERR:PIN_INVALIDO\n");
        }
      }
    }
    return;
  }

  // 3b. Registro de Logs remotos de la App Móvil en memoria NVS del ESP32
  if (strncmp(cmdLimpio, "PLK:LOG:", 8) == 0) {
    const char* logData = cmdLimpio + 8;
    const char* sep = strchr(logData, ':');
    if (sep != nullptr) {
      char nivel[8];
      size_t lenNivel = sep - logData;
      if (lenNivel >= sizeof(nivel)) lenNivel = sizeof(nivel) - 1;
      strncpy(nivel, logData, lenNivel);
      nivel[lenNivel] = '\0';

      const char* mensaje = sep + 1;
      guardarAppLog(nivel, mensaje);
      responderCanal("OK:LOG_GUARDADO\n");
      return;
    }
  }

  // 4. Comandos de Administrador
  if (strncmp(cmdLimpio, "PLK:ADMIN:", 10) == 0) {
    const char* adminCmd = cmdLimpio + 10;

    if (strcmp(adminCmd, "LIST") == 0) {
      verificarExpiraciones();
      uint32_t ahora = obtenerEpoch();
      for (size_t i = 0; i < totalUsuarios; i++) {
        if (tablaUsuarios[i].activo) {
          int diasRestantes = -1;
          if (tablaUsuarios[i].diasValidez > 0) {
            uint32_t transcurrido = ahora - tablaUsuarios[i].timestampRegistro;
            uint32_t limite = tablaUsuarios[i].diasValidez * 86400;
            if (transcurrido < limite) {
              diasRestantes = (int)((limite - transcurrido) / 86400) + 1;
            } else {
              diasRestantes = 0;
            }
          }
          responderCanalF("USER:%s:%s:%d:%d:%d:%s\n",
            tablaUsuarios[i].mac,
            tablaUsuarios[i].nombre,
            tablaUsuarios[i].peatonal ? 1 : 0,
            tablaUsuarios[i].garaje ? 1 : 0,
            diasRestantes,
            tablaUsuarios[i].bloqueado ? "BLOQUEADO" : "ACTIVO"
          );
        }
      }
      responderCanal("END:USERS\n");
      return;
    }

    if (strncmp(adminCmd, "UNBLOCK:", 8) == 0) {
      const char* mac = adminCmd + 8;
      if (desbloquearUsuario(mac)) {
        responderCanal("OK:UNBLOCKED\n");
      } else {
        responderCanal("ERR:USUARIO_NO_ENCONTRADO\n");
      }
      return;
    }

    if (strncmp(adminCmd, "SET:", 4) == 0) {
      char params[64];
      strncpy(params, adminCmd + 4, sizeof(params) - 1);
      params[sizeof(params) - 1] = '\0';

      char* lastColon = strrchr(params, ':');
      if (lastColon) {
        *lastColon = '\0';
        char* gStr = lastColon + 1;
        char* secondLast = strrchr(params, ':');
        if (secondLast) {
          *secondLast = '\0';
          char* pStr = secondLast + 1;
          char* thirdLast = strrchr(params, ':');
          if (thirdLast) {
            *thirdLast = '\0';
            char* diasStr = thirdLast + 1;
            char* mac = params;

            int d = atoi(diasStr);
            bool peatonal = (atoi(pStr) == 1);
            bool garaje = (atoi(gStr) == 1);

            if (actualizarUsuario(mac, d, peatonal, garaje)) {
              responderCanal("OK:USER_UPDATED\n");
            } else {
              responderCanal("ERR:USUARIO_NO_ENCONTRADO\n");
            }
            return;
          }
        }
      }
      responderCanal("ERR:PARAMETROS_INVALIDOS\n");
      return;
    }

    if (strncmp(adminCmd, "DEL:", 4) == 0) {
      const char* mac = adminCmd + 4;
      if (eliminarUsuario(mac)) {
        responderCanal("OK:USER_DELETED\n");
      } else {
        responderCanal("ERR:USUARIO_NO_ENCONTRADO\n");
      }
      return;
    }

    if (strcmp(adminCmd, "LOGS") == 0) {
      for (size_t i = 0; i < totalAppLogs; i++) {
        responderCanalF("LOG:%u:%s:%s\n",
          (unsigned int)tablaAppLogs[i].timestamp,
          tablaAppLogs[i].nivel,
          tablaAppLogs[i].mensaje
        );
      }
      responderCanal("END:LOGS\n");
      return;
    }

    if (strcmp(adminCmd, "CLEAR_LOGS") == 0) {
      borrarAppLogs();
      responderCanal("OK:LOGS_CLEARED\n");
      return;
    }
  }

  // 5. Autenticación HMAC-SHA256: "PLK:AUTH:<HMAC_HEX>:<CMD>"
  if (strncmp(cmdLimpio, "PLK:AUTH:", 9) == 0) {
    if (!challengeActive) {
      responderCanal("ERR:CHALLENGE_EXPIRED\n");
      return;
    }

    const char* hmacInicio = cmdLimpio + 9;
    const char* separador = strchr(hmacInicio, ':');

    if (separador != nullptr) {
      size_t hmacLen = separador - hmacInicio;
      char hmacRecibido[65];
      if (hmacLen < sizeof(hmacRecibido)) {
        strncpy(hmacRecibido, hmacInicio, hmacLen);
        hmacRecibido[hmacLen] = '\0';
        const char* cmd = separador + 1;

        if (validarHmacSha256(currentChallenge, cmd, hmacRecibido)) {
          challengeActive = false;
          currentChallenge[0] = '\0';
          resetearFallosSeguridad();
          despacharAperturaPuerta(cmd, secretKey);
          return;
        } else {
          challengeActive = false;
          currentChallenge[0] = '\0';
          registrarFalloSeguridad();
          responderCanal("ERR:AUTH_INVALIDA\n");
          return;
        }
      }
    }
  }

  // 6. Protocolo directo con PIN: "PLK:<PIN>:<CMD>"
  if (strncmp(cmdLimpio, "PLK:", 4) == 0) {
    const char* pinInicio = cmdLimpio + 4;
    const char* separador = strchr(pinInicio, ':');

    if (separador != nullptr) {
      size_t pinLen = separador - pinInicio;
      char pinRecibido[32];
      if (pinLen < sizeof(pinRecibido)) {
        strncpy(pinRecibido, pinInicio, pinLen);
        pinRecibido[pinLen] = '\0';
        const char* cmd = separador + 1;

        bool esAdmin = (strcmp(pinRecibido, ADMIN_PIN) == 0);
        bool pVal = false, gVal = false;
        int diasVal = 0;
        bool pinValido = esAdmin || parsearPin(pinRecibido, pVal, gVal, diasVal);

        if (pinValido) {
          resetearFallosSeguridad();
          despacharAperturaPuerta(cmd, pinRecibido);
          return;
        } else {
          registrarFalloSeguridad();
          responderCanal("ERR:AUTH_FALLIDA\n");
          return;
        }
      }
    }
  }

  // 7. Diagnósticos permitidos
  if (strcmp(cmdLimpio, "PING") == 0) {
    responderCanal("OK:PONG\n");
  } else if (strcmp(cmdLimpio, "STATUS") == 0) {
    responderCanalF("STATUS:GARAJE=%s,PEATONAL=%s\n",
      relePorton.estado == EstadoRele::INACTIVO ? "LISTO" : "OCUPADO",
      relePuerta.estado == EstadoRele::INACTIVO ? "LISTO" : "OCUPADO"
    );
  } else {
    responderCanal("ERR:AUTH_REQUERIDA\n");
  }
}

static char rxBuffer[BUFFER_SIZE];
static size_t rxIndex = 0;
static unsigned long ultimoByteRecibidoMs = 0;

void procesarEntradaBluetoothClassic() {
  unsigned long ahora = millis();
  if (rxIndex > 0 && (ahora - ultimoByteRecibidoMs > TIMEOUT_SERIAL_MS)) {
    rxIndex = 0;
  }

  while (ESP_BT.available()) {
    char c = (char)ESP_BT.read();
    ultimoByteRecibidoMs = millis();

    if (c == '\n' || c == '\r') {
      if (rxIndex > 0) {
        rxBuffer[rxIndex] = '\0';
        canalActual = CANAL_CLASSIC;
        procesarComandoEntrante(rxBuffer);
        rxIndex = 0;
      }
    } else {
      if (rxIndex < (BUFFER_SIZE - 1)) {
        rxBuffer[rxIndex++] = c;
      } else {
        rxIndex = 0;
        responderCanal("ERR:BUFFER_OVERFLOW\n");
      }
    }
  }
}

// =============================================================================
// SECCIÓN 7: SETUP Y LOOP PRINCIPALES
// =============================================================================

void setup() {
  // 1. Inicializar pines de hardware de forma segura para evitar pulsos fantasma
  inicializarPinesSeguros();

  // 2. Puerto serie para depuración y telemetría
  Serial.begin(115200);
#if MODO_LEDS_PRUEBA
  Serial.println(F("[AVISO] MODO_LEDS_PRUEBA activo: salidas activas en ALTO. NO conectar el modulo de reles."));
#endif
  Serial.println();
  Serial.println(F("================================================="));
  Serial.println(F("[POCKET LOCKER] Firmware v5.5 - Dual BT Monolitico"));
  Serial.println(F("================================================="));

  // 3. Cargar credenciales y base de datos NVS
  cargarCredencialesNVS();
  cargarUsuariosNVS();
  cargarAppLogsNVS();

  // 4. Iniciar servidores de comunicación (Classic primero y luego BLE)
  inicializarBluetooth();
  inicializarBLE();

  Serial.println(F("[SISTEMA] Dispositivo listo para recibir comandos seguros."));
}

void loop() {
  // 1. Ejecutar máquina de estados de relés (pulso 5000ms y enfriamiento 5s)
  procesarMaquinaEstados();

  // 2. Comprobar tiempo de vida del challenge HMAC
  verificarExpiracionChallenge();

  // 3. Procesar buffer serie de Bluetooth Clásico
  procesarEntradaBluetoothClassic();

  // 4. Ceder tiempo al planificador FreeRTOS y a la pila de radio
  vTaskDelay(1 / portTICK_PERIOD_MS);
}

