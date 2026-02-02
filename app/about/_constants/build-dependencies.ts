export interface BuildDependency {
  name: string;
  version: string;
  color: string;
  textColor: string;
  darkColor: string;
  darkTextColor: string;
  letter: string;
  url: string;
}

export const BUILD_DEPENDENCIES: BuildDependency[] = [
  {
    name: 'Tauri',
    version: process.env.NEXT_PUBLIC_TAURI_VERSION || 'v2.9.0',
    color: '#FFC131',
    textColor: '#000000',
    darkColor: '#FFC131',
    darkTextColor: '#000000',
    letter: 'T',
    url: 'https://tauri.app',
  },
  {
    name: 'Rust',
    version: process.env.NEXT_PUBLIC_RUST_VERSION || 'v1.77.2',
    color: '#DEA584',
    textColor: '#000000',
    darkColor: '#DEA584',
    darkTextColor: '#000000',
    letter: 'R',
    url: 'https://www.rust-lang.org',
  },
  {
    name: 'Next.js',
    version: process.env.NEXT_PUBLIC_NEXTJS_VERSION || 'v16.0.0',
    color: '#000000',
    textColor: '#FFFFFF',
    darkColor: '#FFFFFF',
    darkTextColor: '#000000',
    letter: 'N',
    url: 'https://nextjs.org',
  },
  {
    name: 'React',
    version: process.env.NEXT_PUBLIC_REACT_VERSION || 'v19.0.0',
    color: '#61DAFB',
    textColor: '#000000',
    darkColor: '#61DAFB',
    darkTextColor: '#000000',
    letter: '⚛',
    url: 'https://react.dev',
  },
];
