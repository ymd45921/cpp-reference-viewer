import consola from "consola";

const defaultLevel = process.env.NODE_ENV === "development" ? 4 /* debug */ : 3 /* info */;
export const logger = consola.create({ level: defaultLevel });