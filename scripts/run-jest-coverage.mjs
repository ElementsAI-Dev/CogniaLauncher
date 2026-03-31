import { spawnSync } from "node:child_process";

function runCommand(command, args) {
  const isWindowsPnpm = process.platform === "win32" && command === "pnpm";
  const resolvedCommand = isWindowsPnpm
    ? (process.env.comspec ?? "cmd.exe")
    : command;
  const resolvedArgs = isWindowsPnpm
    ? ["/d", "/s", "/c", command, ...args]
    : args;

  return spawnSync(resolvedCommand, resolvedArgs, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: "inherit",
  });
}

function exitOnFailure(result) {
  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const forwardedArgs = process.argv.slice(2).filter((arg, index) => {
  return !(index === 0 && arg === "--");
});

const jestArgs = [
  "exec",
  "jest",
  "--coverage",
  ...(process.platform === "win32" ? ["--runInBand"] : ["--maxWorkers=50%"]),
  ...forwardedArgs,
];

exitOnFailure(runCommand("pnpm", jestArgs));
exitOnFailure(runCommand("pnpm", ["test:settings:coverage"]));
exitOnFailure(runCommand("pnpm", ["test:git:coverage"]));
