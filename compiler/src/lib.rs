use js_sys;
use js_sys::Reflect;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use zephyr::error::{ErrorHandler, Level, Location};
use zephyr::resolver::{FileId, FileKind, ModuleKind, ModulePath, PreparedFile, Resolver};
use zephyr::Ctx;

mod utils;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen(raw_module = "../resolver")]
extern "C" {
    fn resolve_module_from_js(root: &str, path: &str) -> JsValue;
}

#[wasm_bindgen]
pub fn compile() -> Option<Vec<u8>> {
    let mut ctx = Ctx::new();
    let mut err = JsHandler::new_no_file();
    let resolver = JsResolver::new();
    let module = ModulePath {
        root: String::from("playground"),
        path: vec![String::from("main")],
    };
    if let Err(_) = ctx.add_module(module, &mut err, &resolver) {
        log("Failed adding module");
    }
    match ctx.get_wasm(&mut err, &resolver) {
        Err(_) => {
            log("Failed compiling to wasm");
            None
        }
        Ok(wasm) => {
            Some(wasm)
        }
    }
}

#[wasm_bindgen]
pub fn get_memory() -> js_sys::WebAssembly::Memory {
    wasm_bindgen::memory().into()
}

/// Handles to properties of JS source file objects
pub struct SourceFileProperty {
    code: JsValue,
    file_name: JsValue,
    file_id: JsValue,
    is_asm: JsValue,
    is_standalone: JsValue,
    files: JsValue,
}

impl SourceFileProperty {
    fn new() -> Self {
        Self {
            code: JsValue::from_str("code"),
            file_name: JsValue::from_str("fileName"),
            file_id: JsValue::from_str("fileId"),
            is_asm: JsValue::from_str("isAsm"),
            is_standalone: JsValue::from_str("isStandalone"),
            files: JsValue::from_str("files"),
        }
    }

    fn load_js_module(&self, object: &JsValue) -> Result<(Vec<PreparedFile>, ModuleKind), ()> {
        if object.is_undefined() || object.is_null() {
            return Err(());
        }

        let is_standalone = Reflect::get(object, &self.is_standalone).map_err(|_| ())?;
        let files = Reflect::get(object, &self.files).map_err(|_| ())?;

        // Reading files
        if !js_sys::Array::is_array(&files) {
            return Err(());
        }
        let files: js_sys::Array = files.into();
        let mut prepared_files = Vec::new();
        for js_object in files.iter() {
            prepared_files.push(self.load_js_file(&js_object)?);
        }

        // Module kind
        let kind = if is_standalone.is_truthy() {
            ModuleKind::Standalone
        } else {
            ModuleKind::Standard
        };
        Ok((prepared_files, kind))
    }

    fn load_js_file(&self, object: &JsValue) -> Result<PreparedFile, ()> {
        // Get back values
        let code = Reflect::get(object, &self.code).map_err(|_| ())?;
        let file_name = Reflect::get(object, &self.file_name).map_err(|_| ())?;
        let is_asm = Reflect::get(object, &self.is_asm).map_err(|_| ())?;
        let file_id = Reflect::get(object, &self.file_id).map_err(|_| ())?;

        // Validate types
        let code = code.as_string().ok_or(())?;
        let file_name = file_name.as_string().ok_or(())?;
        let is_asm = is_asm.as_bool().ok_or(())?;
        let file_id = file_id.as_f64().ok_or(())?;
        let file_id = file_id.round() as u16;
        let kind = if is_asm {
            FileKind::Asm
        } else {
            FileKind::Zephyr
        };
        Ok(PreparedFile {
            code,
            file_name,
            kind,
            f_id: FileId(file_id),
        })
    }
}

#[wasm_bindgen]
pub struct JsResolver {
    file_properties: SourceFileProperty,
}

impl JsResolver {
    fn new() -> Self {
        Self {
            file_properties: SourceFileProperty::new(),
        }
    }
}

impl Resolver for JsResolver {
    fn resolve_module(
        &self,
        module: &ModulePath,
        _err: &mut impl ErrorHandler,
    ) -> Result<(Vec<PreparedFile>, ModuleKind), ()> {
        let path = module.path.join("/");
        let files = resolve_module_from_js(&module.root, &path);
        self.file_properties.load_js_module(&files)
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
    fn log(&mut self, message: String, _level: Level, _loc: Option<Location>) {
        self.has_error = true;
        log(&message);
    }
}
