import { spawn } from "node:child_process";

const commands = [
  ["api", "node", ["server.mjs"]],
  ["web", "pnpm", ["dev", "--host", "0.0.0.0"]],
];

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, { stdio: ["inherit", "pipe", "pipe"], env: process.env });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("exit", (code) => {
    if (code) {
      process.exitCode = code;
      children.forEach((item) => item.kill("SIGTERM"));
    }
  });

  return child;
});

process.on("SIGINT", () => {
  children.forEach((child) => child.kill("SIGINT"));
});

process.on("SIGTERM", () => {
  children.forEach((child) => child.kill("SIGTERM"));
});
