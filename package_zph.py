""" Package Zephyr sources

This script is a small helper that bundle the Zephyr core & standard library into a TypeScript file
"""
import sys
import os
import re

OUTPUT_PATH = os.path.join("src", "zephyr.ts")
ZEPHYR_PATH = os.getenv("ZEPHYR_LIB")

if ZEPHYR_PATH is None:
    print("Could not locate Zephyr libraries: variable 'ZEPHYR_LIB' is not set")
    sys.exit(1)

zephyr_files = {}
prefix_len = len(ZEPHYR_PATH) + 1


## ——————————————————————————————— Walk files ——————————————————————————————— ##


def add_file(module: str, filepath: str):
    with open(filepath, "r") as f:
        code = f.read()
        zephyr_files[module] = code


for subdir, dirs, files in os.walk(ZEPHYR_PATH):
    for filename in files:
        filepath = os.path.join(subdir, filename)
        module = filepath[prefix_len:].split(".")[0]

        if filepath.endswith(".zph") or filepath.endswith(".zasm"):
            add_file(module, filepath)


## —————————————————————————— Generate TypeScript ——————————————————————————— ##


ts_file = """
// This files has been generated using `package_zph.py`, do not edit.

interface folder {
  folders: { [folder: string]: folder };
  files: { [file: string]: string };
}

export const modules: { [module: string]: string } = {
"""

for module in zephyr_files.keys():
    ts_file += f'"{module}": `\n{zephyr_files[module]}`,\n'

ts_file = ts_file[:-2]
ts_file += "\n}\n"

with open(OUTPUT_PATH, "w") as f:
    f.write(ts_file)
