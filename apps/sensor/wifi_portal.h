#pragma once

// Tenta conectar com as credenciais salvas (NVS/Preferences). Se não houver
// nenhuma salva, ou a conexão falhar dentro de WIFI_CONNECT_TIMEOUT_MS, sobe
// um Access Point + formulário HTTP simples e FICA BLOQUEADO ali até alguém
// configurar — ao salvar, reinicia o ESP32 (ESP.restart()) para reconectar
// já em modo estação. Só deve ser chamada quando IS_PROXY == true.
void wifiPortalSetupBlocking();
