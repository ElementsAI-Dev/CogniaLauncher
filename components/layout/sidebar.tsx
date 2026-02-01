'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Package, Settings, HardDrive, Layers, Server, Info } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/environments', label: 'Environments', icon: Layers },
  { href: '/packages', label: 'Packages', icon: Package },
  { href: '/providers', label: 'Providers', icon: Server },
  { href: '/cache', label: 'Cache', icon: HardDrive },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/about', label: 'About', icon: Info },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r bg-card h-screen flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold">CogniaLauncher</h1>
        <p className="text-xs text-muted-foreground">Environment Manager</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t text-xs text-muted-foreground">
        <p>v0.1.0</p>
      </div>
    </aside>
  );
}
