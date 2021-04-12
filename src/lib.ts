import { modules } from "./zephyr";
import { code_ref } from "./App";

interface IJsModule {
  files: IJsFile[];
  isStandalone: boolean;
}

interface IJsFile {
  code: string;
  fileName: string;
  fileId: number;
  isAsm: boolean;
}

export function resolve_module_from_js(
  root: string,
  path: string
): IJsModule | undefined {
  console.log(`Resolve ${root}/${path}`);

  // Base case
  if (root === "playground" && path === "main") {
    return {
      files: [{ code: code_ref, fileName: "main", fileId: 1, isAsm: false }],
      isStandalone: false,
    };
  }

  // Standard & Core library
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
  let isStandalone = false;
  if (folder.files[last] !== undefined) {
    files.push(folder.files[last]);
    isStandalone = true;
  } else {
    folder = folder.folders[last];
    if (folder === undefined) {
      console.log("Error: last module does not exist - JS size");
    }
    for (const fileName of Object.keys(folder.files)) {
      files.push(folder.files[fileName]);
    }
  }

  return { files: files, isStandalone: isStandalone };
}
