import { modules } from "./zephyr";

export const resolve_module_from_js = (root: string, path: string) => {
  console.log(`Resolve ${root}/${path}`);
  const items = path.split("/");
  const last = items.pop();
  if (last === undefined) {
    console.log("Error: error in module resolution - JS side");
    return undefined;
  }

  let folder = modules[root];
  if (!folder) {
    console.log("Error: module does not exist - JS side");
    return undefined;
  }

  for (const item of items) {
    folder = folder.folders[item];
  }

  const files = [];
  if (folder.files[last] !== undefined) {
    files.push(folder.files[last]);
  } else {
    folder = folder.folders[last];
    if (folder === undefined) {
      console.log("Error: last module does not exist - JS size");
    }
    for (const fileName of Object.keys(folder.files)) {
      files.push(folder.files[fileName]);
    }
  }

  console.log(files);
  return files;
};
