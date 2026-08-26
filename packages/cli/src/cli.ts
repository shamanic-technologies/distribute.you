import { boolFlag, parseArgs } from "./args.js";
import { VERSION } from "./client.js";
import { buildContext } from "./context.js";
import { CliError, EXIT, type ExitCode } from "./errors.js";
import { helpText } from "./help.js";
import { type Io, printError, printJson } from "./output.js";
import { findRoute, groupNames } from "./routes.js";
import { login, logout, status } from "./commands/auth.js";
import { call } from "./commands/call.js";
import { describe, ops } from "./commands/ops.js";
import { groupUsage, runRoute, unknownAction } from "./commands/resource.js";

export interface RunOptions {
  argv: string[];
  io: Io;
  env?: NodeJS.ProcessEnv;
  interactive?: boolean;
}

/**
 * One entry point that returns an exit code instead of calling process.exit, so
 * the whole surface is testable and every failure travels the same path: a
 * CliError with a code the caller can branch on.
 */
export async function run(options: RunOptions): Promise<ExitCode> {
  const env = options.env ?? process.env;
  const io = options.io;
  let compact = false;

  try {
    const args = parseArgs(options.argv);
    compact = boolFlag(args, "compact");

    if (boolFlag(args, "version")) {
      printJson(io, { version: VERSION }, compact);
      return EXIT.ok;
    }

    const [command, subcommand] = args.positionals;
    const wantsHelp = boolFlag(args, "help") || command === "help";

    if (!command || wantsHelp) {
      const group = command && command !== "help" ? command : subcommand;
      if (group && groupNames().includes(group)) {
        io.stdout(groupUsage(group));
        return EXIT.ok;
      }
      io.stdout(helpText());
      return command ? EXIT.ok : EXIT.usage;
    }

    const context = buildContext(args, io, env, options.interactive ?? process.stdin.isTTY === true);

    switch (command) {
      case "version":
        printJson(io, { version: VERSION }, compact);
        return EXIT.ok;
      case "auth":
        switch (subcommand) {
          case "login":
            return await login(context, args);
          case "logout":
            return logout(context);
          case "status":
            return await status(context);
          default:
            throw new CliError({
              code: "usage_error",
              message: "Usage: distribute auth <login|logout|status>",
              exitCode: EXIT.usage,
            });
        }
      case "ops":
        return await ops(context, args);
      case "describe":
        return await describe(context, args);
      case "call":
        return await call(context, args);
      default: {
        if (!groupNames().includes(command)) {
          throw new CliError({
            code: "unknown_command",
            message: `Unknown command: ${command}. Run \`distribute help\` to see every command.`,
            exitCode: EXIT.usage,
          });
        }
        const route = findRoute(command, subcommand ?? "");
        if (!route) unknownAction(command, subcommand);
        return await runRoute(context, route, args);
      }
    }
  } catch (error) {
    const cliError =
      error instanceof CliError
        ? error
        : new CliError({
            code: "unexpected_error",
            message: error instanceof Error ? error.message : String(error),
            exitCode: EXIT.unexpected,
            details: error instanceof Error && error.stack ? error.stack.split("\n").slice(0, 4) : undefined,
          });
    printError(io, cliError, compact);
    return cliError.exitCode;
  }
}
