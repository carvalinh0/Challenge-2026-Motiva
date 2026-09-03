#include "wifi_portal.h"
#include "config.h"
#include <WiFi.h>
#include <WebServer.h> // já vem com o core ESP32 do Arduino, não precisa instalar
#include <Preferences.h>

namespace {

Preferences s_prefs;
WebServer s_server(80);
bool s_credentialsSubmitted = false;
String s_pendingSsid;
String s_pendingPassword;

const char* FORM_HTML =
  "<html><body style='font-family:sans-serif;max-width:320px;margin:40px auto'>"
  "<h2>Configurar WiFi</h2>"
  "<form method='POST' action='/save'>"
  "<label>SSID</label><br><input name='ssid' style='width:100%'><br><br>"
  "<label>Senha</label><br><input name='password' type='password' style='width:100%'><br><br>"
  "<input type='submit' value='Salvar' style='width:100%;padding:8px'>"
  "</form></body></html>";

void handleRoot() {
  s_server.send(200, "text/html", FORM_HTML);
}

void handleSave() {
  s_pendingSsid = s_server.arg("ssid");
  s_pendingPassword = s_server.arg("password");
  s_credentialsSubmitted = true;
  s_server.send(200, "text/html", "<html><body>Salvo! Reiniciando...</body></html>");
}

bool tryConnectWithSavedCredentials() {
  s_prefs.begin("wifi", true); // somente leitura
  String ssid = s_prefs.getString("ssid", "");
  String password = s_prefs.getString("password", "");
  s_prefs.end();

  if (ssid.length() == 0) {
    Serial.println("[WIFI] Nenhuma credencial salva.");
    return false;
  }

  Serial.print("[WIFI] Tentando conectar em: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < WIFI_CONNECT_TIMEOUT_MS) {
    delay(250);
  }

  return WiFi.status() == WL_CONNECTED;
}

// Bloqueia até alguém submeter o formulário. Depois disso reinicia o ESP32
// (mais simples e confiável do que tentar trocar de AP pra STA em runtime).
void runConfigPortal() {
  Serial.println("[WIFI] Subindo portal de configuracao...");
  WiFi.mode(WIFI_AP);
  WiFi.softAP(WIFI_PORTAL_SSID, WIFI_PORTAL_PASSWORD);

  Serial.print("[WIFI] Portal em: ");
  Serial.println(WiFi.softAPIP());
  Serial.print("[WIFI] Conecte no WiFi '");
  Serial.print(WIFI_PORTAL_SSID);
  Serial.println("' e acesse esse IP no navegador.");

  s_server.on("/", handleRoot);
  s_server.on("/save", HTTP_POST, handleSave);
  s_server.begin();

  s_credentialsSubmitted = false;
  while (!s_credentialsSubmitted) {
    s_server.handleClient();
    delay(10);
  }
  s_server.stop();

  s_prefs.begin("wifi", false); // leitura/escrita
  s_prefs.putString("ssid", s_pendingSsid);
  s_prefs.putString("password", s_pendingPassword);
  s_prefs.end();

  Serial.println("[WIFI] Credenciais salvas. Reiniciando...");
  delay(500);
  ESP.restart();
}

} // namespace

void wifiPortalSetupBlocking() {
  if (tryConnectWithSavedCredentials()) {
    Serial.print("[WIFI] Conectado! IP: ");
    Serial.println(WiFi.localIP());
    return;
  }

  Serial.println("[WIFI] Falha ao conectar com as credenciais salvas (ou nao ha nenhuma).");
  runConfigPortal(); // só retorna via ESP.restart() lá dentro
}
