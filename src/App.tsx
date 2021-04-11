import React, { useEffect, useState } from "react";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "./prism/prism";
import { resolve_module_from_js } from "./lib";
import "./prism/prism.css";
import "./App.css";

const EXAMPLE = `runtime module playground

expose hello

fun hello(): i32 {
  return 42
}
`;

function App() {
  const [code, setCode] = useState(EXAMPLE);
  const [compiler, setCompiler] = useState<
    null | typeof import("./compiler")
  >();

  useEffect(() => {
    import("./compiler")
      .then((compiler) => {
        setCompiler(compiler);
        compiler.compile();
        // compiler.greet();
      })
      .catch((err) => console.log(err));
  }, []);

  return (
    <div className="App">
      <h1>Zephyr playground</h1>
      <Editor
        value={code}
        onValueChange={(code) => setCode(code)}
        highlight={(code) => highlight(code, (languages as any).zph)}
        padding={10}
        style={{
          fontFamily: '"Fira code", "Fira Mono", monospace',
          fontSize: 16,
        }}
        className="Editor"
      />
    </div>
  );
}

export default App;
