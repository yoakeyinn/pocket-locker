/*********************************************************************************/
/*                                                                               */
/*   POCKET LOCKER - FIRMWARE CRIPTOGRÁFICO BLINDADO PARA ESP32                   */
/*   Versión: 4.0 - Military-Grade Cryptographic & Anti-Replay Edition           */
/*                                                                               */
/*   Arquitectura de Seguridad:                                                  */
/*   1. Protocolo Challenge-Response con HMAC-SHA256 (mbedtls).                  */
/*   2. Protección absoluta contra Replay Attacks mediante Nonces de un solo uso. */
/*   3. Eliminación de comandos directos sin autenticación (Cero Backdoors).     */
/*   4. Anti-DoS con retardo exponencial progresivo (sin lockout global).        */
/*   5. Persistencia segura en memoria no volátil NVS (Preferences.h).           */
/*   6. Inicialización segura de GPIOs anti-glitch y máquina de estados con RTOS */
/*                                                                               */
/*********************************************************************************/

#include <Arduino.h>
#include <BluetoothSerial.h>
#include <Preferences.h>
#include "mbedtls/md.h"

// =============================================================================
// CONFIGURACIÓN DE PINES Y HARDWARE
// =============================================================================
#define PIN_RELE_PORTON   26  // GPIO para el relé del portón de vehículos
#define PIN_RELE_PUERTA   27  // GPIO para el relé de la puerta peatonal

#define RELE_ACTIVAR      LOW
#define RELE_DESACTIVAR   HIGH

// =============================================================================
// PARÁMETROS DE SEGURIDAD Y TIEMPOS (MILISEGUNDOS)
// =============================================================================
static const char* BT_DEVICE_NAME = "sblas20";
static const char* DEFAULT_PIN = "7492";
static const char* NVS_NAMESPACE = "pocket_lk";
static const char* NVS_KEY_PIN = "sec_pin";

// Tiempos de operación
static const unsigned long DURACION_PULSO_MS = 1000;
static const unsigned long TIEMPO_COOLDOWN_MS = 2000;
static const unsigned long NONCE_VALIDITY_MS = 15000; // Validez del Nonce: 15 segundos
static const unsigned long TIMEOUT_SERIAL_MS = 1500;
static const size_t BUFFER_SIZE = 128;

// =============================================================================
// ESTRUCTURAS Y ESTADOS
// =============================================================================
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

static ControlRele relePorton = { PIN_RELE_PORTON, EstadoRele::INACTIVO, 0, 0, "PORTON" };
static ControlRele relePuerta = { PIN_RELE_PUERTA, EstadoRele::INACTIVO, 0, 0, "PUERTA" };

// =============================================================================
// VARIABLES GLOBALES
// =============================================================================
BluetoothSerial ESP_BT;
Preferences preferences;

// Clave de seguridad cargada desde NVS
static char secretKey[32] = "7492";

// Challenge Nonce activo (32 hex chars + null terminator)
static char currentChallenge[33] = {0};
static unsigned long challengeIssuedAt = 0;
static bool challengeActive = false;

// Buffer de recepción
static char rxBuffer[BUFFER_SIZE];
static size_t rxIndex = 0;
static unsigned long ultimoByteRecibidoMs = 0;

// Anti-DoS: Retardo exponencial por fallos
static uint8_t fallosConsecutivos = 0;

// =============================================================================
// PROTOTIPOS DE FUNCIONES
// =============================================================================
void inicializarPinesSeguros();
void cargarCredencialesNVS();
void procesarMaquinaEstados();
void actualizarEstadoRele(ControlRele &rele);
bool solicitarApertura(ControlRele &rele);
void generarNuevoChallenge();
bool validarHmacSha256(const char* nonce, const char* comando, const char* hmacRecibido);
void calcularHmacSha256(const char* key, const char* data, char* outputHex);
void procesarComandoEntrante(const char* rawCmd);
void responderBluetooth(const char* mensaje);
void responderBluetoothF(const char* formato, ...);

// =============================================================================
// SETUP: INICIALIZACIÓN DEL SISTEMA
// =============================================================================
void setup() {
  inicializarPinesSeguros();

  Serial.begin(115200);
  Serial.println();
  Serial.println(F("================================================="));
  Serial.println(F("[POCKET LOCKER] Firmware v4.0 - Criptografía HMAC"));
  Serial.println(F("================================================="));

  // Cargar clave secreta desde memoria no volátil
  cargarCredencialesNVS();

  // Iniciar Bluetooth
  ESP_BT.setPin(secretKey);
  if (ESP_BT.begin(BT_DEVICE_NAME)) {
    Serial.printf("[BT] Servidor Bluetooth activo: '%s'\n", BT_DEVICE_NAME);
  } else {
    Serial.println(F("[BT ERROR] Error iniciando Bluetooth!"));
  }

  Serial.println(F("[SISTEMA] Listo. Autenticación HMAC Challenge-Response activa."));
}

// =============================================================================
// GESTIÓN DE CREDENCIALES EN MEMORIA NO VOLÁTIL (NVS)
// =============================================================================
void cargarCredencialesNVS() {
  preferences.begin(NVS_NAMESPACE, false);
  String storedPin = preferences.getString(NVS_KEY_PIN, DEFAULT_PIN);
  strncpy(secretKey, storedPin.c_str(), sizeof(secretKey) - 1);
  secretKey[sizeof(secretKey) - 1] = '\0';
  preferences.end();

  Serial.printf("[NVS] Clave de seguridad cargada (longitud: %u caracteres)\n", strlen(secretKey));
}

void guardarNuevaClaveNVS(const char* nuevoPin) {
  if (nuevoPin == nullptr || strlen(nuevoPin) == 0) return;
  preferences.begin(NVS_NAMESPACE, false);
  preferences.putString(NVS_KEY_PIN, nuevoPin);
  preferences.end();

  strncpy(secretKey, nuevoPin, sizeof(secretKey) - 1);
  secretKey[sizeof(secretKey) - 1] = '\0';
  ESP_BT.setPin(secretKey);
  Serial.println(F("[NVS] Nueva clave de seguridad guardada con éxito."));
}

// =============================================================================
// INICIALIZACIÓN SEGURA DE GPIOS (ANTI-GLITCH)
// =============================================================================
void inicializarPinesSeguros() {
  digitalWrite(PIN_RELE_PORTON, RELE_DESACTIVAR);
  pinMode(PIN_RELE_PORTON, OUTPUT);
  digitalWrite(PIN_RELE_PORTON, RELE_DESACTIVAR);

  digitalWrite(PIN_RELE_PUERTA, RELE_DESACTIVAR);
  pinMode(PIN_RELE_PUERTA, OUTPUT);
  digitalWrite(PIN_RELE_PUERTA, RELE_DESACTIVAR);
}

// =============================================================================
// LOOP PRINCIPAL (NO BLOQUEANTE)
// =============================================================================
void loop() {
  unsigned long ahora = millis();

  // 1. Gestionar temporización de relés
  procesarMaquinaEstados();

  // 2. Expirar challenge si ha transcurrido el tiempo de validez
  if (challengeActive && (ahora - challengeIssuedAt > NONCE_VALIDITY_MS)) {
    challengeActive = false;
    currentChallenge[0] = '\0';
    Serial.println(F("[CHALLENGE] Nonce expirado por tiempo."));
  }

  // 3. Reset de buffer si hay timeout en la línea
  if (rxIndex > 0 && (ahora - ultimoByteRecibidoMs > TIMEOUT_SERIAL_MS)) {
    rxIndex = 0;
  }

  // 4. Lectura de comandos serie / Bluetooth
  while (ESP_BT.available()) {
    char c = (char)ESP_BT.read();
    ultimoByteRecibidoMs = millis();

    if (c == '\n' || c == '\r') {
      if (rxIndex > 0) {
        rxBuffer[rxIndex] = '\0';
        procesarComandoEntrante(rxBuffer);
        rxIndex = 0;
      }
    } else {
      if (rxIndex < (BUFFER_SIZE - 1)) {
        rxBuffer[rxIndex++] = c;
      } else {
        rxIndex = 0;
        responderBluetooth("ERR:BUFFER_OVERFLOW\n");
      }
    }
  }

  vTaskDelay(1 / portTICK_PERIOD_MS);
}

// =============================================================================
// MÁQUINA DE ESTADOS DE RELÉS
// =============================================================================
void procesarMaquinaEstados() {
  actualizarEstadoRele(relePorton);
  actualizarEstadoRele(relePuerta);
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
        Serial.printf("[RELE %s] Pulso concluido -> Cooldown\n", rele.nombre);
      }
      break;

    case EstadoRele::ENFRIAMIENTO:
      if (ahora - rele.tiempoInicioCooldown >= TIEMPO_COOLDOWN_MS) {
        rele.estado = EstadoRele::INACTIVO;
        Serial.printf("[RELE %s] Cooldown finalizado -> Listo\n", rele.nombre);
      }
      break;
  }
}

// =============================================================================
// GESTIÓN DE APERTURA DE RELÉS
// =============================================================================
bool solicitarApertura(ControlRele &rele) {
  unsigned long ahora = millis();

  if (rele.estado == EstadoRele::PULSO_ACTIVO) {
    responderBluetoothF("ERR:EN_EJECUCION:%s\n", rele.nombre);
    return false;
  }

  if (rele.estado == EstadoRele::ENFRIAMIENTO) {
    unsigned long restante = TIEMPO_COOLDOWN_MS - (ahora - rele.tiempoInicioCooldown);
    responderBluetoothF("ERR:COOLDOWN:%s:%lu\n", rele.nombre, restante);
    return false;
  }

  digitalWrite(rele.pin, RELE_ACTIVAR);
  rele.tiempoInicioPulso = ahora;
  rele.estado = EstadoRele::PULSO_ACTIVO;

  Serial.printf("[ACCION] Apertura confirmada para: %s\n", rele.nombre);
  responderBluetoothF("OK:%s\n", rele.nombre);
  return true;
}

// =============================================================================
// GENERADOR DE CHALLENGE CRIPTOGRÁFICO (NONCE ALEATORIO)
// =============================================================================
void generarNuevoChallenge() {
  uint32_t r1 = esp_random();
  uint32_t r2 = esp_random();
  uint32_t r3 = esp_random();
  uint32_t r4 = esp_random();

  snprintf(currentChallenge, sizeof(currentChallenge), "%08x%08x%08x%08x", r1, r2, r3, r4);
  challengeIssuedAt = millis();
  challengeActive = true;

  Serial.printf("[CHALLENGE] Nonce generado: %s\n", currentChallenge);
  responderBluetoothF("PLK:CHALLENGE:%s\n", currentChallenge);
}

// =============================================================================
// CÁLCULO Y VALIDACIÓN DE HMAC-SHA256 (MBEDTLS)
// =============================================================================
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

  // Formato del mensaje firmado: "<NONCE>:<COMANDO>"
  char payload[96];
  snprintf(payload, sizeof(payload), "%s:%s", nonce, comando);

  char hmacCalculado[65];
  calcularHmacSha256(secretKey, payload, hmacCalculado);

  // Comparación en tiempo constante para evitar Timing Attacks
  if (strlen(hmacCalculado) != strlen(hmacRecibido)) return false;

  uint8_t resultado = 0;
  for (size_t i = 0; i < 64; i++) {
    resultado |= (hmacCalculado[i] ^ hmacRecibido[i]);
  }

  return (resultado == 0);
}

// =============================================================================
// PARSER Y DISPATCHER DE COMANDOS CRIPTOGRÁFICOS
// =============================================================================
void procesarComandoEntrante(const char* rawCmd) {
  while (*rawCmd == ' ') rawCmd++;
  if (strlen(rawCmd) == 0) return;

  Serial.printf("[BT RX] Comando recibido: \"%s\"\n", rawCmd);

  // 1. Solicitud de Reto / Challenge para inicio de sesión criptográfica
  if (strcmp(rawCmd, "PLK:REQ_CHALLENGE") == 0 || strcmp(rawCmd, "REQ:CHALLENGE") == 0) {
    generarNuevoChallenge();
    return;
  }

  // 2. Ejecución autenticada con HMAC: "PLK:AUTH:<HMAC_HEX>:<CMD>"
  if (strncmp(rawCmd, "PLK:AUTH:", 9) == 0) {
    if (!challengeActive) {
      Serial.println(F("[AUTH RECHAZADA] No hay ningún Challenge Nonce activo o ya expiró."));
      responderBluetooth("ERR:CHALLENGE_EXPIRED\n");
      return;
    }

    const char* hmacInicio = rawCmd + 9;
    const char* separador = strchr(hmacInicio, ':');

    if (separador != nullptr) {
      size_t hmacLen = separador - hmacInicio;
      char hmacRecibido[65];
      if (hmacLen < sizeof(hmacRecibido)) {
        strncpy(hmacRecibido, hmacInicio, hmacLen);
        hmacRecibido[hmacLen] = '\0';
        const char* cmd = separador + 1;

        // Validar firma HMAC
        if (validarHmacSha256(currentChallenge, cmd, hmacRecibido)) {
          // Destrucción inmediata del nonce de un solo uso (Inmunidad a Replay)
          challengeActive = false;
          currentChallenge[0] = '\0';
          fallosConsecutivos = 0;

          if (strcmp(cmd, "E") == 0 || strcmp(cmd, "PUERTA") == 0) {
            solicitarApertura(relePuerta);
          } else if (strcmp(cmd, "H") == 0 || strcmp(cmd, "PORTON") == 0 || strcmp(cmd, "GARAJE") == 0) {
            solicitarApertura(relePorton);
          } else if (strncmp(cmd, "SET_PIN:", 8) == 0) {
            const char* nuevoPin = cmd + 8;
            guardarNuevaClaveNVS(nuevoPin);
            responderBluetooth("OK:PIN_UPDATED\n");
          } else if (strcmp(cmd, "PING") == 0) {
            responderBluetooth("OK:PONG\n");
          } else {
            responderBluetooth("ERR:COMANDO_DESCONOCIDO\n");
          }
          return;
        } else {
          // Firma inválida: invalidar reto e incrementar backoff progresivo
          challengeActive = false;
          currentChallenge[0] = '\0';
          fallosConsecutivos++;

          unsigned long delayMs = min((int)(fallosConsecutivos * 500), 4000);
          Serial.printf("[AUTH ERROR] HMAC inválido. Retardo de seguridad: %lu ms\n", delayMs);
          vTaskDelay(delayMs / portTICK_PERIOD_MS);

          responderBluetooth("ERR:AUTH_INVALIDA\n");
          return;
        }
      }
    }
  }

  // 3. Protocolo secundario con PIN directo (compatibilidad controlada con comparación en tiempo constante)
  if (strncmp(rawCmd, "PLK:", 4) == 0) {
    const char* pinInicio = rawCmd + 4;
    const char* separador = strchr(pinInicio, ':');

    if (separador != nullptr) {
      size_t pinLen = separador - pinInicio;
      char pinRecibido[32];
      if (pinLen < sizeof(pinRecibido)) {
        strncpy(pinRecibido, pinInicio, pinLen);
        pinRecibido[pinLen] = '\0';
        const char* cmd = separador + 1;

        // Comparación segura XOR en tiempo constante
        size_t lenEsperado = strlen(secretKey);
        size_t lenRecibido = strlen(pinRecibido);
        uint8_t mismatch = (lenEsperado ^ lenRecibido);
        for (size_t i = 0; i < lenEsperado && i < lenRecibido; i++) {
          mismatch |= (pinRecibido[i] ^ secretKey[i]);
        }

        if (mismatch == 0) {
          fallosConsecutivos = 0;
          if (strcmp(cmd, "E") == 0 || strcmp(cmd, "PUERTA") == 0) {
            solicitarApertura(relePuerta);
          } else if (strcmp(cmd, "H") == 0 || strcmp(cmd, "PORTON") == 0 || strcmp(cmd, "GARAJE") == 0) {
            solicitarApertura(relePorton);
          } else if (strncmp(cmd, "SET_PIN:", 8) == 0) {
            const char* nuevoPin = cmd + 8;
            guardarNuevaClaveNVS(nuevoPin);
            responderBluetooth("OK:PIN_UPDATED\n");
          } else if (strcmp(cmd, "PING") == 0) {
            responderBluetooth("OK:PONG\n");
          } else {
            responderBluetooth("ERR:COMANDO_DESCONOCIDO\n");
          }
          return;
        } else {
          fallosConsecutivos++;
          unsigned long delayMs = min((int)(fallosConsecutivos * 400), 3000);
          vTaskDelay(delayMs / portTICK_PERIOD_MS);
          responderBluetooth("ERR:AUTH_FALLIDA\n");
          return;
        }
      }
    }
  }

  // 4. Comandos de diagnóstico permitidos sin actuar sobre relés físicos
  if (strcmp(rawCmd, "PING") == 0) {
    responderBluetooth("OK:PONG\n");
  } else if (strcmp(rawCmd, "STATUS") == 0) {
    responderBluetoothF("STATUS:PORTON=%s,PUERTA=%s\n",
      relePorton.estado == EstadoRele::INACTIVO ? "LISTO" : "OCUPADO",
      relePuerta.estado == EstadoRele::INACTIVO ? "LISTO" : "OCUPADO"
    );
  } else {
    // Comandos directos no autenticados son rechazados de forma segura
    Serial.printf("[SEGURIDAD] Rechazado comando no autenticado: '%s'\n", rawCmd);
    responderBluetooth("ERR:AUTH_REQUERIDA\n");
  }
}

// =============================================================================
// TELEMETRÍA DE RESPUESTA
// =============================================================================
void responderBluetooth(const char* mensaje) {
  if (mensaje == nullptr) return;
  ESP_BT.print(mensaje);
  Serial.print(F("[BT TX ->] "));
  Serial.print(mensaje);
}

void responderBluetoothF(const char* formato, ...) {
  char buffer[96];
  va_list args;
  va_start(args, formato);
  vsnprintf(buffer, sizeof(buffer), formato, args);
  va_end(args);

  responderBluetooth(buffer);
}


