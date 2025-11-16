import { login } from "@mahiru/ui/utils/login";

export function exposeToWindow() {
  window.login = login;
}
