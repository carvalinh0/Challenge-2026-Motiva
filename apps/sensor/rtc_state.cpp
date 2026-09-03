#include "rtc_state.h"
#include <esp_sleep.h>

// -----------------------------------------------------------------------
// Variáveis reais em RTC memory — declaradas UMA única vez, aqui.
// -----------------------------------------------------------------------
RTC_DATA_ATTR static bool s_calibrated = false;
RTC_DATA_ATTR static long s_windowStart = 0;
RTC_DATA_ATTR static long s_windowEnd = 0;

RTC_DATA_ATTR static uint32_t s_dedupCache[MESH_DEDUP_CACHE_SIZE];
RTC_DATA_ATTR static int s_dedupIndex = 0;
RTC_DATA_ATTR static bool s_dedupInitialized = false;

// -----------------------------------------------------------------------
// Calibração
// -----------------------------------------------------------------------
bool rtcIsCalibrated() { return s_calibrated; }
long rtcGetWindowStart() { return s_windowStart; }
long rtcGetWindowEnd() { return s_windowEnd; }

void rtcSetCalibratedWindow(long windowStart, long windowEnd) {
  s_windowStart = windowStart;
  s_windowEnd = windowEnd;
  s_calibrated = true;
}

void rtcInvalidateCalibration() {
  s_calibrated = false;
}

// -----------------------------------------------------------------------
// Cache de deduplicação da mesh
// -----------------------------------------------------------------------
bool rtcMeshWasSeen(uint32_t messageId) {
  if (!s_dedupInitialized) return false; // buffer ainda não tem nada de útil
  for (int i = 0; i < MESH_DEDUP_CACHE_SIZE; i++) {
    if (s_dedupCache[i] == messageId) return true;
  }
  return false;
}

void rtcMeshMarkSeen(uint32_t messageId) {
  s_dedupCache[s_dedupIndex] = messageId;
  s_dedupIndex = (s_dedupIndex + 1) % MESH_DEDUP_CACHE_SIZE;
  s_dedupInitialized = true;
}

// -----------------------------------------------------------------------
// Motivo do despertar
// -----------------------------------------------------------------------
WakeReason rtcDetermineWakeReason() {
  esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();

  switch (cause) {
    case ESP_SLEEP_WAKEUP_TIMER:
      return WAKE_TIMER;
    case ESP_SLEEP_WAKEUP_EXT0:
      return WAKE_LORA_RX; // DIO1 configurado como fonte ext0 (ver lora_task.cpp)
    case ESP_SLEEP_WAKEUP_UNDEFINED:
    default:
      // Não veio de deep sleep -> é energização (power-on) ou reset.
      return WAKE_POWER_ON;
  }
}
