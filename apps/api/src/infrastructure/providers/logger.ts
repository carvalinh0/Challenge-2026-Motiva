// Logger central — sem isso a API roda muda: nada aparece no terminal além do
// que cada `console.log` avulso decidisse imprimir. Todo log passa por aqui
// para ter timestamp, nível e escopo (["http"], ["mqtt"], ...) consistentes,
// com nível ajustável por LOG_LEVEL sem mexer em código.

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const envLevel = process.env.LOG_LEVEL?.toLowerCase();
const configuredLevel: Level =
    envLevel && envLevel in LEVELS ? (envLevel as Level) : "info";

// process.stdout pode não existir fora de um terminal real; sem cor nesse caso
// em vez de quebrar.
const useColor = Boolean(process.stdout?.isTTY);

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[90m";
const COLORS: Record<Level, string> = {
    debug: "\x1b[90m",
    info: "\x1b[36m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
};

function paint(text: string, color: string) {
    return useColor ? `${color}${text}${RESET}` : text;
}

function timestamp() {
    return new Date().toISOString().replace("T", " ").replace("Z", "");
}

function emit(level: Level, scope: string, message: string, extra?: unknown) {
    if (LEVELS[level] < LEVELS[configuredLevel]) return;
    const prefix = `${paint(timestamp(), DIM)} ${paint(`[${level.toUpperCase()}]`, COLORS[level])} ${paint(`[${scope}]`, BOLD)}`;
    const write = level === "error" || level === "warn" ? console.error : console.log;
    if (extra !== undefined) write(`${prefix} ${message}`, extra);
    else write(`${prefix} ${message}`);
}

export const log = {
    debug: (scope: string, message: string, extra?: unknown) =>
        emit("debug", scope, message, extra),
    info: (scope: string, message: string, extra?: unknown) =>
        emit("info", scope, message, extra),
    warn: (scope: string, message: string, extra?: unknown) =>
        emit("warn", scope, message, extra),
    error: (scope: string, message: string, extra?: unknown) =>
        emit("error", scope, message, extra),

    // Log de acesso HTTP — uma linha por requisição, cor pelo status.
    request(
        method: string,
        path: string,
        status: number,
        durationMs: number,
        ip: string,
    ) {
        if (LEVELS.info < LEVELS[configuredLevel]) return;
        const statusColor =
            status >= 500 ? COLORS.error : status >= 400 ? COLORS.warn : COLORS.info;
        const line =
            `${paint(timestamp(), DIM)} ${paint(`${method} ${path}`, BOLD)} ` +
            `${paint(String(status), statusColor)} ${durationMs.toFixed(1)}ms ${paint(ip, DIM)}`;
        (status >= 500 ? console.error : console.log)(line);
    },
};
