/**
 * Mirror preset configurations for package registries
 * Shared between settings and onboarding
 */

import type { MirrorPreset } from "@/types/settings";

export const MIRROR_PRESETS: Record<string, MirrorPreset> = {
  default: {
    labelKey: "settings.mirrorPresetDefault",
    npm: "https://registry.npmjs.org",
    pypi: "https://pypi.org/simple",
    crates: "https://crates.io",
    go: "https://proxy.golang.org",
  },
  china: {
    labelKey: "settings.mirrorPresetChina",
    npm: "https://registry.npmmirror.com",
    pypi: "https://pypi.tuna.tsinghua.edu.cn/simple",
    crates: "https://rsproxy.cn",
    go: "https://goproxy.cn",
  },
  aliyun: {
    labelKey: "settings.mirrorPresetAliyun",
    npm: "https://registry.npmmirror.com",
    pypi: "https://mirrors.aliyun.com/pypi/simple",
    crates: "https://rsproxy.cn",
    go: "https://mirrors.aliyun.com/goproxy/",
  },
  ustc: {
    labelKey: "settings.mirrorPresetUstc",
    npm: "https://registry.npmmirror.com",
    pypi: "https://pypi.mirrors.ustc.edu.cn/simple",
    crates: "https://rsproxy.cn",
    go: "https://goproxy.cn",
  },
} as const;

export type MirrorPresetKey = keyof typeof MIRROR_PRESETS;
