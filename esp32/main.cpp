/*********************************************************************************/
/*                                                                               */
/*PROGRAMA CEMAR-ARDUINO PARA APERTURA Y CIERRE DE PUERTAS DE GARAJE.            */
/*                                                  VERSIÓN 20.05                */
/*                                                                               */
/*********************************************************************************/

#include <Arduino.h>
#include <BluetoothSerial.h>

BluetoothSerial ESP_BT;             // Crear Objeto Bluetooth
#define RELE_porton 26              // Ojo: los relés se activan con nivel bajo
#define RELE_puerta 27

// Variable para el servicio bluetooth
char entrada = ' ';

// Prototipos de funciones
void porton();
void puerta();

void setup() {
  pinMode(RELE_porton, OUTPUT);       // Configuramos relés
  pinMode(RELE_puerta, OUTPUT);
  digitalWrite(RELE_porton, HIGH);    // RELE CIERRE cerrado por si acaso
  digitalWrite(RELE_puerta, HIGH);    // RELE LUZ apagada por si acaso

  Serial.begin(115200);               // Iniciar serial
  ESP_BT.begin("sblas20");            // Iniciar señal bluetooth
}

void porton() {
  delay(50);
  digitalWrite(RELE_porton, LOW);     // apertura activado
  delay(1000);
  digitalWrite(RELE_porton, HIGH);    // activado
}

void puerta() {
  delay(50);
  digitalWrite(RELE_puerta, LOW);     // cier
  delay(1000);
  digitalWrite(RELE_puerta, HIGH);
}

void loop() {
  if (ESP_BT.available()) {
    Serial.println();
    Serial.print("Conexión Bluetooth establecida");
    entrada = ESP_BT.read();
    if (entrada == 'E') {
      puerta();
      Serial.println();
      Serial.print("Recibido: ");
      Serial.println(entrada);
      Serial.flush();
    }
    else if (entrada == 'H') {
      porton();
      Serial.println();
      Serial.print("Recibido: ");
      Serial.println(entrada);
      Serial.flush();
    }
    entrada = 'X';
  }
}
