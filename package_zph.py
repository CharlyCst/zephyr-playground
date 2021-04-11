""" Package Zephyr sources

This script is a small helper that bundle the Zephyr core & standard library into a TypeScript file
"""
import sys
import os
import re
import json

OUTPUT_PATH = os.path.join("src", "zephyr.ts")
ZEPHYR_PATH = os.getenv("ZEPHYR_LIB")

if ZEPHYR_PATH is None:
    print("Could not locate Zephyr libraries: variable 'ZEPHYR_LIB' is not set")
    sys.exit(1)

zephyr_files = {}
file_id = 1
prefix_len = len(ZEPHYR_PATH) + 1


## ——————————————————————————————— Walk files ——————————————————————————————— ##


def new_folder():
    return {"folders": {}, "files": {}}


def add_file(module: str, filepath: str, is_asm: bool):
    global file_id
    path = module.split("/")
    file = path[-1]
    package = path[0]

    if not package in zephyr_files:
        zephyr_files[package] = new_folder()
    folder = zephyr_files[package]

    for dir in path[1:-1]:
        if not dir in folder["folders"]:
            folder["folders"][dir] = new_folder()
        folder = folder["folders"][dir]

    with open(filepath, "r") as f:
        code = f.read()
        code = code.replace("\n", "\\n")
        folder["files"][file] = {"fileName": file, "fileId": file_id, "isAsm": is_asm, "code": code}
        file_id += 1


for dir, subdirs, files in os.walk(ZEPHYR_PATH):
    for filename in files:
        filepath = os.path.join(dir, filename)
        module = filepath[prefix_len:].split(".")[0]

        if filepath.endswith(".zph"):
            add_file(module, filepath, False)
        elif filepath.endswith(".zasm"):
            add_file(module, filepath, True)


## —————————————————————————— Generate TypeScript ——————————————————————————— ##


ts_file = """
// This files has been generated using `package_zph.py`, do not edit.

interface IFolder {
  folders: { [folder: string]: IFolder };
  files: { [file: string]: IFile };
}

interface IFile {
  code: string;
  fileName: string;
  fileId: number;
  isAsm: boolean;
}

export const modules: { [module: string]: IFolder } = JSON.parse(`
"""

ts_file += json.dumps(zephyr_files)
ts_file += "`)\n"

with open(OUTPUT_PATH, "w") as f:
    f.write(ts_file)
