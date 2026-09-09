#pragma once
#include <Arduino.h>
#include "config.h"

// Tudo aqui usa RTC_DATA_ATTR: sobrevive ao deep sleep, mas é resetado em
// power-on/reset normal (queda de energia, reset manual, novo flash). Isso é
// exatamente o comportamento que a calibração e o cache de dedup precisam.
//
// RTC_DATA_ATTR só deve ser aplicado UMA vez, num único .cpp — por isso as
// variáveis reais moram em rtc_state.cpp e este header só expõe funções de
// acesso, pra evitar problema de linkagem entre arquivos.

// --- Janela de calibração ---
bool rtcIsCalibrated();
long rtcGetWindowStart();
long rtcGetWindowEnd();
void rtcSetCalibratedWindow(long windowStart, long windowEnd);
void rtcInvalidateCalibration(); // força recalibrar no próximo boot "quente" que passar por aqui, se algum dia for necessário
bool rtcHasMotorPosition();
long rtcGetMotorPosition();
void rtcSetMotorPosition(long position);
void rtcClearMotorPosition();

// --- Cache de deduplicação da mesh (substitui TTL — ver mesh_protocol.h) ---
// Ring buffer simples: sem timestamp/expiração, porque millis() zera a cada
// deep sleep. Entradas antigas somem naturalmente quando o buffer dá a volta.
bool rtcMeshWasSeen(uint32_t messageId);
void rtcMeshMarkSeen(uint32_t messageId);

// --- Motivo do despertar (preenchido no início do setup(), antes de qualquer
//     lógica de negócio decidir o que fazer) ---
enum WakeReason {
  WAKE_POWER_ON,     // energizou do zero (ou resetou) -> precisa calibrar
  WAKE_TIMER,        // acordou pelo timer -> ciclo normal de medição
  WAKE_LORA_RX,       // acordou porque o rádio recebeu QUALQUER pacote -> ver se precisa repassar
  WAKE_OTHER
};
WakeReason rtcDetermineWakeReason();
