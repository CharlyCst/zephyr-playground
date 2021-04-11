use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use zephyr::error::{ErrorHandler, Level, Location};
use zephyr::resolver::{FileId, ModuleKind, ModulePath, PreparedFile, Resolver};
use zephyr::Ctx;

mod utils;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

#[wasm_bindgen(raw_module = "../lib")]
extern "C" {
    fn resolve_module_from_js(root: &str, path: &str) -> Option<String>;
}

#[wasm_bindgen]
pub fn greet() {
    alert("Hello, compiler!");
}

#[wasm_bindgen]
pub fn compile() {
    let mut ctx = Ctx::new();
    let mut err = JsHandler::new_no_file();
    let resolver = JsResolver {};
    let module = ModulePath {
        root: String::from("playground"),
        path: vec![String::from("main")],
    };
    ctx.add_module(module, &mut err, &resolver);
}

#[wasm_bindgen]
pub struct JsResolver {}

impl Resolver for JsResolver {
    fn resolve_module(
        &self,
        module: &ModulePath,
        err: &mut impl ErrorHandler,
    ) -> Result<(Vec<PreparedFile>, ModuleKind), ()> {
        let path = module.path.join("/");
        resolve_module_from_js(&module.root, &path);
        Err(())
    }
}

pub struct JsHandler {
    has_error: bool,
    files: HashMap<FileId, String>,
}

impl ErrorHandler for JsHandler {
    fn new(code: String, f_id: FileId) -> Self {
        let mut files = HashMap::new();
        files.insert(f_id, code);
        Self {
            has_error: false,
            files,
        }
    }

    fn new_no_file() -> Self {
        Self {
            has_error: false,
            files: HashMap::new(),
        }
    }

    fn get_file(&self, f_id: FileId) -> Option<&str> {
        self.files.get(&f_id).map(|s| s.as_str())
    }

    fn has_error(&self) -> bool {
        self.has_error
    }

    fn silent_report(&mut self) {
        self.has_error = true;
    }

    fn merge(&mut self, other: Self) {
        self.has_error = self.has_error || other.has_error;
        self.files.extend(other.files);
    }

    fn flush(&mut self) {
        // TODO
    }

    /// Log an error encountered during the compilation.
    fn log(&mut self, message: String, level: Level, loc: Option<Location>) {
        self.has_error = true;
        // TODO: log something ^^'
    }
}
