import { formatUptime } from '@/lib/utils';
import { APP_VERSION } from '@/lib/app-version';
import type { SystemInfo } from '@/types/about';
import type { SelfUpdateInfo } from '@/lib/tauri';
import type { SystemInfoDisplay } from '@/hooks/use-system-info-display';

export interface BuildSystemInfoTextParams {
  systemInfo: SystemInfo | null;
  updateInfo: SelfUpdateInfo | null;
  display: Pick<SystemInfoDisplay, 'osDisplayName' | 'cpuCoresDisplay' | 'memoryDisplay' | 'swapDisplay' | 'gpuDisplay'>;
  unknownText: string;
  t: (key: string) => string;
}

export function buildSystemInfoText({
  systemInfo,
  updateInfo,
  display,
  unknownText,
  t,
}: BuildSystemInfoTextParams): string {
  const { osDisplayName, cpuCoresDisplay, memoryDisplay, swapDisplay, gpuDisplay } = display;

  const lines = [
    `${t("about.systemInfoTitle")}`,
    "================================",
    `${t("about.version")}: v${updateInfo?.current_version || systemInfo?.appVersion || APP_VERSION}`,
    `${t("about.operatingSystem")}: ${osDisplayName || unknownText}`,
    `${t("about.architecture")}: ${systemInfo?.cpuArch || systemInfo?.arch || unknownText}`,
    `${t("about.kernelVersion")}: ${systemInfo?.kernelVersion || unknownText}`,
    `${t("about.hostname")}: ${systemInfo?.hostname || unknownText}`,
    `${t("about.cpu")}: ${systemInfo?.cpuModel || unknownText} (${cpuCoresDisplay || 0} ${t("about.cores")})`,
    `${t("about.cpuFrequency")}: ${systemInfo?.cpuFrequency ? `${systemInfo.cpuFrequency} MHz` : unknownText}`,
    `${t("about.memory")}: ${memoryDisplay || unknownText}`,
    `${t("about.swap")}: ${swapDisplay || unknownText}`,
    `${t("about.gpu")}: ${gpuDisplay || unknownText}`,
    `${t("about.uptime")}: ${systemInfo?.uptime ? formatUptime(systemInfo.uptime) : unknownText}`,
    `${t("about.homeDirectory")}: ${systemInfo?.homeDir || "~/.cognia"}`,
    `${t("about.locale")}: ${systemInfo?.locale || "en-US"}`,
  ];

  return lines.join("\n");
}
