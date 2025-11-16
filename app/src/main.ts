import { APP } from "./background";

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

const app = new APP();
app.run();
