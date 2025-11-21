import { APP } from "./app";
import { printDevInfo } from "./utils/dev";

printDevInfo();
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
const app = new APP();
app.run();
