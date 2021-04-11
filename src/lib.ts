import { modules } from "./zephyr";

export const resolve_module_from_js = (root: string, path: string) => {
  console.log(`Resolve ${root}/${path}`);
  const code = modules[`${root}/${path}`];
  console.log(code);
  return code;
};
