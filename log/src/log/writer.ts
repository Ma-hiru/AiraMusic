export interface LoggerWriter {
  debug(input: string): any;
  trace(input: string): any;
  log(input: string): any;
  error(input: string): any;
  warn(input: string): any;
}
