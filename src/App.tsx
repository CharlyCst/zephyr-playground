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

// Hooks used by the compiler
export let code_ref = EXAMPLE;
export let log_ref: WriteLine | undefined;

type WriteLine = (line: string, kind: LineKind) => void;

async function compile(compiler: typeof import("./compiler"), log: WriteLine) {
  try {
    const wasm = compiler.compile();
    if (wasm === undefined) {
      // Failed to compile...
      return;
    }
    runCode(wasm, log);
  } catch {}
}

async function runCode(wasmSource: Uint8Array, log: WriteLine) {
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
  if (funs.length === 1) {
    log(`> ${funs[0].name}()`, LineKind.input);
    log(`${funs[0].ref()}`, LineKind.output);
  }
}

function App() {
  const [code, setCode] = useState(EXAMPLE);
  const [consoleState, setConsoleState] = useState<IConsoleState>({
    lines: [],
    counter: 0,
  });
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

  const log = (line: string, kind: LineKind) => {
    consoleState.lines.push({
      id: consoleState.counter,
      content: line,
      kind: kind,
    });
    consoleState.counter += 1;
    setConsoleState({ ...consoleState });
  };

  log_ref = log;

  return (
    <div className="App">
      <h1>Zephyr playground</h1>
      <div className="row-container">
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
        <Console
          state={consoleState}
          onCompile={compiler ? () => compile(compiler, log) : undefined}
        />
      </div>
    </div>
  );
}

export enum LineKind {
  input = 1,
  output = 2,
  error = 3,
}

interface ILine {
  id: number;
  content: string;
  kind: LineKind;
}

interface IConsoleState {
  lines: ILine[];
  counter: number;
}

interface IConsoleProps {
  state: IConsoleState;
  onCompile?: () => void;
}

function Console(props: IConsoleProps) {
  const onCompile = props.onCompile ? props.onCompile : () => {};

  return (
    <div className="ConsoleContainer">
      <div className="Console">
        {props.state.lines.map((line) => (
          <div
            key={line.id}
            className={`ConsoleText ${getTextColor(line.kind)}`}
          >
            {line.content}
          </div>
        ))}
      </div>
      <button
        className="CompileButton"
        onClick={onCompile}
        disabled={!onCompile}
      >
        Compile
      </button>
    </div>
  );
}

export default App;

function getTextColor(kind: LineKind): string {
  switch (kind) {
    case LineKind.error:
      return "TextError";
    case LineKind.output:
      return "TextOutput";
    case LineKind.input:
      return "";
  }
}
