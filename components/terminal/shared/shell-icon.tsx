import { Terminal, Shield, Fish, Monitor, Atom } from 'lucide-react';
import type { ShellType } from '@/types/tauri';

export function getShellIcon(shellType: ShellType | string) {
  const lower = typeof shellType === 'string' ? shellType.toLowerCase() : shellType;
  if (lower.includes('powershell')) return <Shield className="h-4 w-4 text-blue-500" />;
  if (lower.includes('fish')) return <Fish className="h-4 w-4 text-orange-500" />;
  if (lower.includes('cmd')) return <Monitor className="h-4 w-4 text-gray-500" />;
  if (lower.includes('nushell')) return <Atom className="h-4 w-4 text-purple-500" />;
  if (lower.includes('zsh')) return <Terminal className="h-4 w-4 text-emerald-500" />;
  return <Terminal className="h-4 w-4" />;
}
