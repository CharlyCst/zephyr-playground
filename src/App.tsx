import React, { useEffect, useState } from "react";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "./prism/prism";
import "./prism/prism.css";
import "./App.css";

const EXAMPLE = `runtime module playground

expose hello

fun hello(): i32 {
  return 42
}
`;

export let code_ref = EXAMPLE;

async function compile(compiler: typeof import("./compiler")) {
  try {
    const wasm = compiler.compile();
    if (wasm === undefined) {
      // Failed to compile...
      return;
    }
    runCode(wasm);
  } catch {}
}

async function runCode(wasmSource: Uint8Array) {
  const wasm = await WebAssembly.instantiate(wasmSource);
  const exports = wasm.instance.exports;
  let funs = Object.keys(exports)
    .filter((f) => typeof exports[f] == "function")
    .map((f) => {
      const ref = exports[f];
      return {
        name: f,
        len: (ref as any).length || 0,
        ref: ref as (...args: number[]) => any,
      };
    });

  // If only one function is defined, let's call it!
  if (funs.length == 1) {
    console.log(funs[0].ref());
  }
}

function App() {
  const [code, setCode] = useState(EXAMPLE);
  const [compiler, setCompiler] = useState<
    null | typeof import("./compiler")
  >();

  useEffect(() => {
    import("./compiler")
      .then((compiler) => {
        setCompiler(compiler);
        //compile(compiler);
      })
      .catch((err) => console.log(err));
  }, []);

  return (
    <div className="App">
      <h1>Zephyr playground</h1>
      <Editor
        value={code}
        onValueChange={(code) => {
          setCode(code);
          code_ref = code;
        }}
        highlight={(code) => highlight(code, (languages as any).zph)}
        padding={10}
        style={{
          fontFamily: '"Fira code", "Fira Mono", monospace',
          fontSize: 16,
        }}
        className="Editor"
      />
      {compiler ? (
        <button onClick={() => compile(compiler)}>Compile</button>
      ) : null}
    </div>
  );
}

export default App;
