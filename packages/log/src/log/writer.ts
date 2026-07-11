export interface LoggerWriter {
  log(input: string): any;
  warn(input: string): any;
  debug(input: string): any;
  error(input: string): any;
  trace(input: string): any;
}
