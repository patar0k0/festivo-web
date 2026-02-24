/* eslint-disable @typescript-eslint/no-require-imports */
const childProcess = require("child_process");

const originalSpawn = childProcess.spawn;
const originalSpawnSync = childProcess.spawnSync;

console.error("[spawn-log] loaded", process.pid);

function formatArgs(args) {
  if (!Array.isArray(args)) return "";
  return args.map((arg) => String(arg)).join(" ");
}

function logSpawn(command, args, options) {
  const cwd = (options && options.cwd) || process.cwd();
  const argText = formatArgs(args);
  const cmdText = [command, argText].filter(Boolean).join(" ");
  process.stderr.write(`[spawn] ${cmdText} | cwd=${cwd}\n`);
}

childProcess.spawn = function patchedSpawn(command, args, options) {
  logSpawn(command, args, options);
  const child = originalSpawn.call(childProcess, command, args, options);
  if (child && typeof child.on === "function") {
    child.on("error", (err) => {
      process.stderr.write(
        `[spawn-error] ${command} ${err && err.errno} ${err && err.code} ${err && err.syscall} ${
          err && err.message
        }\n`
      );
    });
  }
  return child;
};

childProcess.spawnSync = function patchedSpawnSync(command, args, options) {
  logSpawn(command, args, options);
  const result = originalSpawnSync.call(childProcess, command, args, options);
  if (result && result.error) {
    const err = result.error;
    process.stderr.write(
      `[spawn-error] ${command} ${err && err.errno} ${err && err.code} ${err && err.syscall} ${
        err && err.message
      }\n`
    );
  }
  return result;
};
