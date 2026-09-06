/*********************************************************************************/
/*                                                                               */
/*   POCKET LOCKER - FIRMWARE CRIPTOGRÁFICO Y GESTOR DE USUARIOS PARA ESP32      */
/*   Versión: 5.0 - Multi-User Database & Fine-Grained Access Control Edition   */
/*                                                                               */
/*   Arquitectura:                                                               */
/*   1. Protocolo Challenge-Response HMAC-SHA256 y trama directa autenticada.    */
/*   2. Comandos de activación unificados: 'P' (Peatonal) y 'G' (Garaje).        */
/*   3. Captura automática de MAC física del cliente vía Bluetooth SPP.          */
/*   4. Base de datos persistente en NVS (Preferences) con control de validez    */
/*      temporal (hasta 99 días) y bloqueo automático por expiración.           */
/*   5. Perfil de Administrador (PIN 2415) con comandos para listar, desbloquear */
/*      y modificar permisos y días de los usuarios.                             */
/*   6. Pulso de 5000ms y exclusión mutua de 5000ms anti-colisión.              */
/*                                                                               */
/*********************************************************************************/

#include <Arduino.h>
#include <BluetoothSerial.h>
#include <Preferences.h>
#include "esp_spp_api.h"
#include "mbedtls/md.h"

// =============================================================================
// CONFIGURACIÓN DE PINES Y HARDWARE
// =============================================================================
#define PIN_RELE_PORTON   26  // GPIO para el relé del portón de garaje
#define PIN_RELE_PUERTA   27  // GPIO para el relé de la puerta peatonal

#define RELE_ACTIVAR      LOW
#define RELE_DESACTIVAR   HIGH

// =============================================================================
// PARÁMETROS DE SEGURIDAD Y TIEMPOS (MILISEGUNDOS)
// =============================================================================
static const char* BT_DEVICE_NAME = "PLBT";
static const char* ADMIN_PIN = "2415";
static const char* NVS_NAMESPACE = "pocket_lk";
static const char* NVS_KEY_PIN = "sec_pin";
static const char* NVS_USERS_NS = "plk_users";

// Tiempos de operación reglamentarios
static const unsigned long DURACION_PULSO_MS = 5000;
static const unsigned long TIEMPO_COOLDOWN_MS = 5000;
static const unsigned long NONCE_VALIDITY_MS = 15000;
static const unsigned long TIMEOUT_SERIAL_MS = 1500;
static const size_t BUFFER_SIZE = 160;
#define MAX_USUARIOS 50

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

static ControlRele relePorton = { PIN_RELE_PORTON, EstadoRele::INACTIVO, 0, 0, "GARAJE" };
static ControlRele relePuerta = { PIN_RELE_PUERTA, EstadoRele::INACTIVO, 0, 0, "PEATONAL" };

struct UsuarioDB {
  char mac[18];
  char nombre[24];
  bool peatonal;
  bool garaje;
  int diasValidez;            // 0 = ilimitado / indefinido, >0 = días permitidos
  uint32_t timestampRegistro; // Timestamp Unix recibido al registrarse o sincronizar
  bool bloqueado;
  bool activo;
};

// =============================================================================
// VARIABLES GLOBALES
// =============================================================================
BluetoothSerial ESP_BT;
Preferences preferences;

// MAC del cliente móvil Bluetooth actualmente conectado
static char currentClientMac[18] = "00:00:00:00:00:00";
static bool clientConnected = false;

// Base de datos en RAM (sincronizada con NVS)
static UsuarioDB tablaUsuarios[MAX_USUARIOS];
static size_t totalUsuarios = 0;

// Reloj interno sincronizado por la app
static uint32_t epochBase = 0;
static unsigned long millisBase = 0;

// Clave de seguridad del locker (por defecto 2415)
static char secretKey[32] = "2415";

// Challenge Nonce activo
static char currentChallenge[33] = {0};
static unsigned long challengeIssuedAt = 0;
static bool challengeActive = false;

// Buffer de recepción serie
static char rxBuffer[BUFFER_SIZE];
static size_t rxIndex = 0;
static unsigned long ultimoByteRecibidoMs = 0;

// Anti-DoS
static uint8_t fallosConsecutivos = 0;

// =============================================================================
// PROTOTIPOS DE FUNCIONES
// =============================================================================
void inicializarPinesSeguros();
void cargarCredencialesNVS();
void cargarUsuariosNVS();
void guardarUsuariosNVS();
uint32_t obtenerEpoch();
void verificarExpiraciones();
int buscarUsuarioPorMac(const char* mac);
bool parsearPin(const char* pin, bool &p, bool &g, int &dias);
void procesarMaquinaEstados();
void actualizarEstadoRele(ControlRele &rele);
bool solicitarApertura(ControlRele &rele, const char* callerPin);
void generarNuevoChallenge();
bool validarHmacSha256(const char* nonce, const char* comando, const char* hmacRecibido);
void calcularHmacSha256(const char* key, const char* data, char* outputHex);
void procesarComandoEntrante(const char* rawCmd);
void responderBluetooth(const char* mensaje);
void responderBluetoothF(const char* formato, ...);

// =============================================================================
// CALLBACK NATIVO BLUETOOTH SPP: CAPTURA DE MAC DEL CLIENTE
// =============================================================================
void btCallback(esp_spp_cb_event_t event, esp_spp_cb_param_t *param) {
  if (event == ESP_SPP_SRV_OPEN_EVT) {
    clientConnected = true;
    snprintf(currentClientMac, sizeof(currentClientMac), "%02X:%02X:%02X:%02X:%02X:%02X",
      param->srv_open.rem_bda[0], param->srv_open.rem_bda[1], param->srv_open.rem_bda[2],
      param->srv_open.rem_bda[3], param->srv_open.rem_bda[4], param->srv_open.rem_bda[5]);
    Serial.printf("[BT] Cliente conectado con MAC física: %s\n", currentClientMac);
  } else if (event == ESP_SPP_CLOSE_EVT) {
    clientConnected = false;
    Serial.printf("[BT] Cliente desconectado (era MAC: %s)\n", currentClientMac);
    strncpy(currentClientMac, "00:00:00:00:00:00", sizeof(currentClientMac) - 1);
    currentClientMac[sizeof(currentClientMac) - 1] = '\0';
  }
}

// =============================================================================
// SETUP: INICIALIZACIÓN
// =============================================================================
void setup() {
  inicializarPinesSeguros();

  Serial.begin(115200);
  Serial.println();
  Serial.println(F("================================================="));
  Serial.println(F("[POCKET LOCKER] Firmware v5.0 - Control P / G"));
  Serial.println(F("================================================="));

  cargarCredencialesNVS();
  cargarUsuariosNVS();

  // Iniciar Bluetooth SPP con callback de captura de MAC
  ESP_BT.register_callback(btCallback);
  ESP_BT.setPin(secretKey);

  if (ESP_BT.begin(BT_DEVICE_NAME)) {
    Serial.printf("[BT] Servidor Bluetooth activo: '%s'\n", BT_DEVICE_NAME);
  } else {
    Serial.println(F("[BT ERROR] Error iniciando Bluetooth!"));
  }

  Serial.println(F("[SISTEMA] Listo. Esperando conexiones de Pocket Locker..."));
}

// =============================================================================
// GESTIÓN DE BASE DE DATOS Y PERSISTENCIA NVS
// =============================================================================
void cargarCredencialesNVS() {
  preferences.begin(NVS_NAMESPACE, false);
  String storedPin = preferences.getString(NVS_KEY_PIN, ADMIN_PIN);
  strncpy(secretKey, storedPin.c_str(), sizeof(secretKey) - 1);
  secretKey[sizeof(secretKey) - 1] = '\0';
  preferences.end();
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
  Serial.printf("[NVS] Guardados %u usuarios.\n", (unsigned int)totalUsuarios);
}

uint32_t obtenerEpoch() {
  if (epochBase == 0) return 0;
  return epochBase + ((millis() - millisBase) / 1000);
}

void verificarExpiraciones() {
  uint32_t ahora = obtenerEpoch();
  if (ahora == 0) return;

  bool cambios = false;
  for (size_t i = 0; i < totalUsuarios; i++) {
    if (tablaUsuarios[i].activo && !tablaUsuarios[i].bloqueado && tablaUsuarios[i].diasValidez > 0) {
      uint32_t transcurrido = ahora - tablaUsuarios[i].timestampRegistro;
      uint32_t limite = tablaUsuarios[i].diasValidez * 86400;
      if (transcurrido >= limite) {
        tablaUsuarios[i].bloqueado = true;
        cambios = true;
        Serial.printf("[EXPIRADO] Usuario %s (%s) bloqueado por tiempo.\n",
          tablaUsuarios[i].nombre, tablaUsuarios[i].mac);
      }
    }
  }
  if (cambios) {
    guardarUsuariosNVS();
  }
}

int buscarUsuarioPorMac(const char* mac) {
  if (mac == nullptr) return -1;
  for (size_t i = 0; i < totalUsuarios; i++) {
    if (tablaUsuarios[i].activo && strcasecmp(tablaUsuarios[i].mac, mac) == 0) {
      return (int)i;
    }
  }
  return -1;
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
    dias = 0; // Acceso indefinido
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

// =============================================================================
// INICIALIZACIÓN DE PINES
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
// LOOP PRINCIPAL
// =============================================================================
void loop() {
  unsigned long ahora = millis();

  // 1. Temporización de relés
  procesarMaquinaEstados();

  // 2. Expirar challenge si ha transcurrido el tiempo de validez
  if (challengeActive && (ahora - challengeIssuedAt > NONCE_VALIDITY_MS)) {
    challengeActive = false;
    currentChallenge[0] = '\0';
  }

  // 3. Reset de buffer si hay timeout
  if (rxIndex > 0 && (ahora - ultimoByteRecibidoMs > TIMEOUT_SERIAL_MS)) {
    rxIndex = 0;
  }

  // 4. Lectura de comandos
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
// GESTIÓN DE APERTURA CON EXCLUSIÓN MUTUA Y COMPROBACIÓN DE PERMISOS
// =============================================================================
bool solicitarApertura(ControlRele &rele, const char* callerPin) {
  unsigned long ahora = millis();

  // Exclusión mutua de 5000ms: no permitir accionar ambos relés a la vez
  if (relePorton.estado == EstadoRele::PULSO_ACTIVO || relePuerta.estado == EstadoRele::PULSO_ACTIVO) {
    responderBluetoothF("ERR:EN_EJECUCION\n");
    return false;
  }

  if (rele.estado == EstadoRele::ENFRIAMIENTO) {
    unsigned long restante = TIEMPO_COOLDOWN_MS - (ahora - rele.tiempoInicioCooldown);
    responderBluetoothF("ERR:COOLDOWN:%s:%lu\n", rele.nombre, restante / 1000 + 1);
    return false;
  }

  // Verificar estado del usuario conectado
  verificarExpiraciones();

  bool esAdmin = (callerPin != nullptr && strcmp(callerPin, ADMIN_PIN) == 0);

  if (!esAdmin) {
    int idx = buscarUsuarioPorMac(currentClientMac);
    if (idx >= 0) {
      if (tablaUsuarios[idx].bloqueado) {
        responderBluetooth("ERR:BLOQUEADO\n");
        return false;
      }
      if (rele.pin == PIN_RELE_PUERTA && !tablaUsuarios[idx].peatonal) {
        responderBluetooth("ERR:SIN_PERMISO_PEATONAL\n");
        return false;
      }
      if (rele.pin == PIN_RELE_PORTON && !tablaUsuarios[idx].garaje) {
        responderBluetooth("ERR:SIN_PERMISO_GARAJE\n");
        return false;
      }
    } else if (callerPin != nullptr) {
      bool p = false, g = false;
      int dias = 0;
      if (parsearPin(callerPin, p, g, dias)) {
        if (rele.pin == PIN_RELE_PUERTA && !p) {
          responderBluetooth("ERR:SIN_PERMISO_PEATONAL\n");
          return false;
        }
        if (rele.pin == PIN_RELE_PORTON && !g) {
          responderBluetooth("ERR:SIN_PERMISO_GARAJE\n");
          return false;
        }
      } else {
        responderBluetooth("ERR:PIN_INVALIDO\n");
        return false;
      }
    }
  }

  digitalWrite(rele.pin, RELE_ACTIVAR);
  rele.tiempoInicioPulso = ahora;
  rele.estado = EstadoRele::PULSO_ACTIVO;

  Serial.printf("[ACCION] Apertura autorizada y ejecutada para: %s\n", rele.nombre);
  responderBluetoothF("OK:%s\n", rele.nombre);
  return true;
}

// =============================================================================
// GENERADOR DE CHALLENGE CRIPTOGRÁFICO
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

  if (strlen(hmacCalculado) != strlen(hmacRecibido)) return false;

  uint8_t resultado = 0;
  for (size_t i = 0; i < 64; i++) {
    resultado |= (hmacCalculado[i] ^ hmacRecibido[i]);
  }
  return (resultado == 0);
}

// =============================================================================
// PARSER Y DISPATCHER DE COMANDOS
// =============================================================================
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

  Serial.printf("[BT RX] Comando recibido: \"%s\"\n", cmdLimpio);

  // 1. Solicitud de Challenge
  if (strcmp(cmdLimpio, "PLK:REQ_CHALLENGE") == 0 || strcmp(cmdLimpio, "REQ:CHALLENGE") == 0) {
    generarNuevoChallenge();
    return;
  }

  // 2. Sincronización de tiempo y obtención de estado de usuario
  // Formato: "PLK:SYNC:<TIMESTAMP_UNIX>"
  if (strncmp(cmdLimpio, "PLK:SYNC:", 9) == 0) {
    const char* tsStr = cmdLimpio + 9;
    uint32_t ts = strtoul(tsStr, NULL, 10);
    if (ts > 1000000000) {
      epochBase = ts;
      millisBase = millis();
    }
    verificarExpiraciones();

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
      responderBluetoothF("INFO:%s:%d:%d:%d\n",
        tablaUsuarios[idx].bloqueado ? "BLOQUEADO" : "ACTIVO",
        diasRestantes,
        tablaUsuarios[idx].peatonal ? 1 : 0,
        tablaUsuarios[idx].garaje ? 1 : 0
      );
    } else {
      responderBluetooth("INFO:DESCONOCIDO:-1:1:1\n");
    }
    return;
  }

  // 3. Registro de usuario en base de datos al vincular
  // Formato: "PLK:REG:<NOMBRE>:<PIN>"
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
        responderBluetooth("OK:REGISTRADO:ADMIN\n");
        return;
      }

      bool p = false, g = false;
      int dias = 0;
      if (parsearPin(pin, p, g, dias)) {
        int idx = buscarUsuarioPorMac(currentClientMac);
        if (idx < 0) {
          if (totalUsuarios < MAX_USUARIOS) {
            idx = totalUsuarios++;
          } else {
            responderBluetooth("ERR:DB_LLENA\n");
            return;
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
        responderBluetoothF("OK:REGISTRADO:USER:%d:%d:%d\n", p ? 1 : 0, g ? 1 : 0, dias);
      } else {
        responderBluetooth("ERR:PIN_INVALIDO\n");
      }
    }
    return;
  }

  // 4. Comandos de Administrador (gestión de base de datos)
  if (strncmp(cmdLimpio, "PLK:ADMIN:", 10) == 0) {
    const char* adminCmd = cmdLimpio + 10;

    // Listar todos los usuarios
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
          responderBluetoothF("USER:%s:%s:%d:%d:%d:%s\n",
            tablaUsuarios[i].mac,
            tablaUsuarios[i].nombre,
            tablaUsuarios[i].peatonal ? 1 : 0,
            tablaUsuarios[i].garaje ? 1 : 0,
            diasRestantes,
            tablaUsuarios[i].bloqueado ? "BLOQUEADO" : "ACTIVO"
          );
        }
      }
      responderBluetooth("END:USERS\n");
      return;
    }

    // Desbloquear usuario
    // Formato: "PLK:ADMIN:UNBLOCK:<MAC>"
    if (strncmp(adminCmd, "UNBLOCK:", 8) == 0) {
      const char* mac = adminCmd + 8;
      int idx = buscarUsuarioPorMac(mac);
      if (idx >= 0) {
        tablaUsuarios[idx].bloqueado = false;
        if (tablaUsuarios[idx].diasValidez > 0) {
          tablaUsuarios[idx].timestampRegistro = obtenerEpoch();
        }
        guardarUsuariosNVS();
        responderBluetooth("OK:UNBLOCKED\n");
      } else {
        responderBluetooth("ERR:USUARIO_NO_ENCONTRADO\n");
      }
      return;
    }

    // Modificar datos/días/permisos de un usuario
    // Formato: "PLK:ADMIN:SET:<MAC>:<DIAS>:<P>:<G>"
    if (strncmp(adminCmd, "SET:", 4) == 0) {
      char params[64];
      strncpy(params, adminCmd + 4, sizeof(params) - 1);
      params[sizeof(params) - 1] = '\0';

      // Parseo reverso para preservar las direcciones MAC con dos puntos (XX:XX:XX:XX:XX:XX)
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

            int idx = buscarUsuarioPorMac(mac);
            if (idx >= 0) {
              int d = atoi(diasStr);
              tablaUsuarios[idx].diasValidez = (d >= 0 && d <= 99) ? d : 0;
              tablaUsuarios[idx].peatonal = (atoi(pStr) == 1);
              tablaUsuarios[idx].garaje = (atoi(gStr) == 1);
              tablaUsuarios[idx].bloqueado = false;
              tablaUsuarios[idx].timestampRegistro = obtenerEpoch();
              guardarUsuariosNVS();
              responderBluetooth("OK:USER_UPDATED\n");
            } else {
              responderBluetooth("ERR:USUARIO_NO_ENCONTRADO\n");
            }
            return;
          }
        }
      }
      responderBluetooth("ERR:PARAMETROS_INVALIDOS\n");
      return;
    }

    // Eliminar usuario
    // Formato: "PLK:ADMIN:DEL:<MAC>"
    if (strncmp(adminCmd, "DEL:", 4) == 0) {
      const char* mac = adminCmd + 4;
      int idx = buscarUsuarioPorMac(mac);
      if (idx >= 0) {
        for (size_t i = idx; i < totalUsuarios - 1; i++) {
          tablaUsuarios[i] = tablaUsuarios[i + 1];
        }
        totalUsuarios--;
        guardarUsuariosNVS();
        responderBluetooth("OK:USER_DELETED\n");
      } else {
        responderBluetooth("ERR:USUARIO_NO_ENCONTRADO\n");
      }
      return;
    }
  }

  // 5. Ejecución autenticada con HMAC: "PLK:AUTH:<HMAC_HEX>:<CMD>"
  if (strncmp(cmdLimpio, "PLK:AUTH:", 9) == 0) {
    if (!challengeActive) {
      responderBluetooth("ERR:CHALLENGE_EXPIRED\n");
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
          fallosConsecutivos = 0;

          // Despacho unificado de puertas:
          // Peatonal: 'P' (estándar actual), 'E' (Entrada histórico), 'PUERTA'
          // Garaje: 'G' (estándar actual), 'H' (Hangar histórico), 'PORTON', 'GARAJE'
          if (strcmp(cmd, "P") == 0 || strcmp(cmd, "E") == 0 || strcmp(cmd, "PUERTA") == 0) {
            solicitarApertura(relePuerta, secretKey);
          } else if (strcmp(cmd, "G") == 0 || strcmp(cmd, "H") == 0 || strcmp(cmd, "PORTON") == 0 || strcmp(cmd, "GARAJE") == 0) {
            solicitarApertura(relePorton, secretKey);
          } else if (strcmp(cmd, "PING") == 0) {
            responderBluetooth("OK:PONG\n");
          } else {
            responderBluetooth("ERR:COMANDO_DESCONOCIDO\n");
          }
          return;
        } else {
          challengeActive = false;
          currentChallenge[0] = '\0';
          fallosConsecutivos++;

          unsigned long delayMs = min((int)(fallosConsecutivos * 500), 4000);
          vTaskDelay(delayMs / portTICK_PERIOD_MS);
          responderBluetooth("ERR:AUTH_INVALIDA\n");
          return;
        }
      }
    }
  }

  // 6. Protocolo directo autenticado con PIN: "PLK:<PIN>:<CMD>"
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
          fallosConsecutivos = 0;
          if (strcmp(cmd, "P") == 0 || strcmp(cmd, "E") == 0 || strcmp(cmd, "PUERTA") == 0) {
            solicitarApertura(relePuerta, pinRecibido);
          } else if (strcmp(cmd, "G") == 0 || strcmp(cmd, "H") == 0 || strcmp(cmd, "PORTON") == 0 || strcmp(cmd, "GARAJE") == 0) {
            solicitarApertura(relePorton, pinRecibido);
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

  // 7. Diagnósticos permitidos sin accionar relés
  if (strcmp(cmdLimpio, "PING") == 0) {
    responderBluetooth("OK:PONG\n");
  } else if (strcmp(cmdLimpio, "STATUS") == 0) {
    responderBluetoothF("STATUS:GARAJE=%s,PEATONAL=%s\n",
      relePorton.estado == EstadoRele::INACTIVO ? "LISTO" : "OCUPADO",
      relePuerta.estado == EstadoRele::INACTIVO ? "LISTO" : "OCUPADO"
    );
  } else {
    Serial.printf("[SEGURIDAD] Comando rechazado: '%s'\n", cmdLimpio);
    responderBluetooth("ERR:AUTH_REQUERIDA\n");
  }
}

// =============================================================================
// TELEMETRÍA DE RESPUESTA BLUETOOTH
// =============================================================================
void responderBluetooth(const char* mensaje) {
  if (mensaje == nullptr) return;
  ESP_BT.print(mensaje);
  Serial.print(F("[BT TX ->] "));
  Serial.print(mensaje);
}

void responderBluetoothF(const char* formato, ...) {
  char buffer[128];
  va_list args;
  va_start(args, formato);
  vsnprintf(buffer, sizeof(buffer), formato, args);
  va_end(args);

  responderBluetooth(buffer);
}
