"use client";
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Home' },
  { href: '/dex-dash', label: 'Dex Dash' },
  { href: '/dashboard', label: 'Slotting' },
  { href: '/clarity', label: 'Clarity' },
  { href: '/vision', label: 'Vision' },
  { href: '/projects', label: 'Projects' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <aside className={`flex-shrink-0 bg-dex-surface border-r border-dex-border ${open ? 'w-60' : 'w-16'} transition-all duration-200 relative`}> 
      <button
        aria-label="Toggle navigation"
        onClick={() => setOpen(o => !o)}
        className="absolute -right-3 top-4 w-6 h-6 rounded-full bg-dex-accent text-white text-xs flex items-center justify-center shadow"
      >{open ? '‹' : '›'}</button>
      <div className="h-full flex flex-col">
        <div className="p-4 text-sm font-semibold tracking-wide">
          <span className="block text-dex-accent">SmartPick</span>
          {open && <span className="text-xs text-slate-400">Human–Machine Bond</span>}
        </div>
        <nav className="flex-1 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {links.map(l => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className={`group flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-dex-accent text-white' : 'text-slate-300 hover:bg-dex-surfaceAlt hover:text-white'}`}
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-dex-accent opacity-70 group-hover:opacity-100" />
                    {open && <span>{l.label}</span>}
                    {!open && <span className="sr-only">{l.label}</span>}
                  </a>
                </li>
              );
            })}
            <li>
              <a
                href="/reality"
                className={`group flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors`}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-dex-accent opacity-70 group-hover:opacity-100" />
                {open && <span>Reality RPG</span>}
                {!open && <span className="sr-only">Reality RPG</span>}
              </a>
            </li>
          </ul>
        </nav>
        <div className="p-3 text-[10px] text-slate-500">v0.1.0</div>
      </div>
    </aside>
  );
}
