import { run } from "./cli.js";
import { consoleIo } from "./output.js";

/**
 * `distribute ops | head` closes the pipe while we are still writing, which
 * Node reports as an unhandled EPIPE and a stack trace. Downstream stopped
 * reading on purpose, so there is nothing to report: stop writing and leave.
 */
for (const stream of [process.stdout, process.stderr]) {
  stream.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EPIPE") process.exit(0);
    throw error;
  });
}

const exitCode = await run({ argv: process.argv.slice(2), io: consoleIo });
process.exitCode = exitCode;
