function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function mergeUserSettings(current: unknown, incoming: Record<string, unknown>) {
  const currentSettings = isRecord(current) ? current : {};
  const mergedSettings = { ...currentSettings, ...incoming };

  if (isRecord(incoming.themeByDevice)) {
    const currentThemeByDevice = isRecord(currentSettings.themeByDevice)
      ? currentSettings.themeByDevice
      : {};
    mergedSettings.themeByDevice = {
      ...currentThemeByDevice,
      ...incoming.themeByDevice,
    };
  }

  return mergedSettings;
}