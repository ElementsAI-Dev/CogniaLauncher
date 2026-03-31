import { useState, useEffect } from "react";
import { isTauri } from "@/lib/tauri";

interface CliArgs {
  verbose: boolean;
  quiet: boolean;
  json: boolean;
  minimized: boolean;
  subcommand: string | null;
}

export function useCliArgs() {
  const [args, setArgs] = useState<CliArgs | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    import("@tauri-apps/plugin-cli").then(({ getMatches }) => {
      getMatches()
        .then((matches) => {
          setArgs({
            verbose: matches.args.verbose?.value === true,
            quiet: matches.args.quiet?.value === true,
            json: matches.args.json?.value === true,
            minimized: matches.args.minimized?.value === true,
            subcommand: matches.subcommand?.name ?? null,
          });
        })
        .catch(() => {});
    });
  }, []);

  return args;
}
