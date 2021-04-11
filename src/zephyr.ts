// This files has been generated using `package_zph.py`, do not edit.

interface folder {
  folders: { [folder: string]: folder };
  files: { [file: string]: string };
}

export const modules: { [module: string]: string } = {
  "std/std": `
/// The Zephyr standard library
module std

`,
  "std/r/wasi": `
/// Wasi runtime
standalone runtime module wasi

use core.str
use core.mem

// Tested on Wasmtime 0.15.0
from wasi_unstable import {
    pub fun fd_write(fd: i32, iovs: i32, iovs_len: i32, nwritten: i32): i32
}

/// Print a string to stdout.
pub fun print(message: str.Str) {
    let iov = mem.malloc(12)
    mem.set_i32(iov, message.start)
    mem.set_i32(iov + 4, message.len)
    fd_write(1, iov, 1, iov + 8)
    mem.free(iov)
}
`,
  "std/r/r": `
/// Runtime modules
///
/// This module hosts a collection of runtime modules for well known platforms, such as Wasi.
module r

`,
  "core/utils": `
/// Exposes utility functions
standalone module utils

pub fun panic() {
    unreachable
}
`,
  "core/core": `
/// Core is module exposing the runtime functionnalities of Zephyr, it is
/// known from the compiler.
module core

use core.mem
use core.utils

`,
  "core/mem/utils": `
module mem

/// Increases the memory size by a given number of pages and return the old
/// memory size, or -1 if the operation failed.
///
/// A memory page is 65536 bytes, or 64Ki bytes
fun memory_grow(size: i32): i32 {
    local.get size
    memory.grow
}

/// Returns the size of memory in pages (65536 = 2^16 bytes).
fun memory_size(): i32 {
    memory.size
}

/// Reads an i32 from memory, expects an alignment of 32 at least.
pub fun read_i32(addr: i32): i32 {
    local.get addr
    i32.load 2 0
}

/// Reads an u8 from memory, returned as an i32.
pub fun read_u8(addr: i32): i32 {
    local.get addr
    i32.load8_u 0 0
}

/// Set an i32 at the given memory address, expects an alignment of 32 at least.
pub fun set_i32(addr: i32, val: i32) {
    local.get addr
    local.get val
    i32.store 2 0
}

pub fun set_u8(addr: i32, val: i32) {
    local.get addr
    local.get val
    i32.store8 0 0
}
`,
  "core/mem/malloc": `
/// The malloc module handles memory management, it exposes a malloc and free
/// implementation.
module mem

use core.utils

// The global memory allocator.
//
// Malloc is implemented using a doubly linked free list with a first fit
// strategy. Malloc always return a block with an aligment of 8 bytes.
// Coalescing is done after the free operation.
//
// Each block is composed of:
//   - a 4 bytes header
//   - a 4 bytes pointer to the next block
//   - a 4 bytes pointer to the previous block
//   - a 4 bytes footer
//
//   0      4      8      10        n-4     n
//
//   +------+------+------+----------+------+
//   |      |      |      |          |      |
//   |header| next | prev |   ....   |footer|
//   |      |      |      |          |      |
//   +------+------+------+----------+------+
//
//
// The header and the footer have the same values, they are outsize of the
// range seen by the user. The 31 lowest bits indicate the size, while the
// highest bit is a flag that is set when the block is allocated, and unset
// when it is freed.
// The size do not correspond to the size seen by the user, but to the number
// of bytes following the header (including the footer): the smallest valid
// valid takes 16 bytes in memory and thus has a size of 12 (16 - 4).
//
// Assumptions:
//   - The compiler ensures that at initialization read_i32(0) returns the
//     address of the first (and unique) free block.
//   - The compiler ensures that at initialization there is a fake
//     'allocated block' footer just before the first free block.

/// Returns a fresh block of memory, guaranted with an alignment of at least 8.
///
/// This malloc implementation uses a single (doubly linked) free list with a
/// first-fit strategy.
/// Coalescence is done when blocks are freed.
pub fun malloc(size: i32): i32 {
    let addr = read_i32(0)
    let target_size = get_real_block_size(size)
    while true {
        if addr == 0 {
            // TODO: out of memory
            utils.panic()
        }
        if read_i32(addr) >= target_size {
            let block_size = split_block(addr, target_size)
            remove_block(addr)
            let header = block_size | 0x80000000 // set the allocated bit
            set_i32(addr, header)                // header
            set_i32(addr + block_size, header)   // footer
            return addr + 4
        }
        addr = read_i32(addr + 4)                // go to next block
    }
    // needed for wasm stack type check...
    // TODO: find a (compiler) solution
    return 0
}

/// Marks the memory as free.
///
/// This operation is the inverse of malloc, blocks freed can be re-allocated later.
pub fun free(ptr: i32) {
    let addr = ptr - 4
    let old_root = read_i32(0)
    if old_root != 0 {
        set_i32(old_root + 8, addr)
    }
    set_i32(0, addr)
    set_i32(addr + 4, old_root)
    set_i32(addr + 8, 0)
    // Mark the block as free
    let header = read_i32(addr) ^ 0x80000000 // unset the allocated bit
    set_i32(addr, header)                    // header
    set_i32(addr + header, header)           // footer
    try_coalesce(addr)
}

/// Computes the final size of a block, so that the next block is aligned to 8 and
/// there is room for at least two 4 bytes pointers and a 4 bytes footer.
fun get_real_block_size(size: i32): i32 {
    if size <= 8 {
        return 12
    }
    let body_size = (size + 0b111) & -0b1000
    return body_size + 4
}

/// Tell if a block is free given its header.
///
/// A block header is composed of 31 bits for its size, while the highest bit
/// is a flag indicating if the block is free (0) or allocated (1).
/// Thus, interpreted as a signed 32 bits integer, if the header is positive
/// then the block is free.
fun is_free(header: i32): bool {
    return header >= 0
}

/// Split a free block, if possible, and return the new size.
///
/// The minimal block size is 16:
///   - 4 bytes header
///   - 4 bytes next pointer
///   - 4 bytes prev pointer
///   - 4 bytes footer
///
/// ! The block is assumed to be free.
fun split_block(addr: i32, size: i32): i32 {
    let available_size = read_i32(addr)
    if available_size - size >= 16 {
        let new_block_addr = addr + 4 + size
        // update pointers
        set_i32(new_block_addr + 8, addr)               // prev points to addr
        set_i32(new_block_addr + 4, read_i32(addr + 4)) // next points to block.next
        set_i32(addr + 4, new_block_addr)               // block.next points to new_block
        // update sizes
        set_i32(addr, size)
        set_i32(new_block_addr, available_size - size - 4)
        return size
    }
    return available_size
}

/// Removes a block from the free list.
fun remove_block(addr: i32) {
    let next = read_i32(addr + 4)
    let prev = read_i32(addr + 8)
    if next != 0 {
        set_i32(next + 8, prev)
    }
    if prev != 0 {
        set_i32(prev + 4, next)
    } else {
        set_i32(0, next)
    }
}

/// Try to coalesce a block with the next one (following to memory layout) and
/// the one just before.
///
/// ! The block passed as argument is assumed to be free.
fun try_coalesce(addr: i32) {
    let size = read_i32(addr)
    let next_addr = addr + 4 + size
    if next_addr < memory_size() * 0x10000 { // end of memory
        let next_header = read_i32(next_addr)
        if is_free(next_header) {
            // if the block is free, the header corresponds to its size
            size = size + 4 + next_header
            remove_block(next_addr)
            set_i32(addr, size)        // header
            set_i32(addr + size, size) // footer
        }
    }
    let prev_footer = read_i32(addr - 4)
    if is_free(prev_footer) {
        size = size + 4 + prev_footer
        let prev_addr = addr - prev_footer - 4
        remove_block(addr)
        set_i32(prev_addr, size)        // header
        set_i32(prev_addr + size, size) // footer
    }
}

`,
  "core/str/str": `
/// Implementation of strings for Zephyr.
module str

use core.mem

/// A String object, composed of a buffer holding the data and a len.
pub struct String {
    len: i32,
    capacity: i32,
    buffer: i32,
}

/// A String slice, a structure that doesn't own the data it points to.
pub struct Str {
    len: i32,
    start: i32,
}

/// Creates a new string.
pub fun new_string(): String {
    let capacity = 12 // Arbitrary default size
    let buffer = mem.malloc(capacity)
    return String {
        len: 0,
        capacity: capacity,
        buffer: buffer,
    }
}

/// Adds a character to the string.
pub fun push_char(s: String, char: i32) {
    if s.capacity <= s.len {
        // Reallocate the buffer
        let new_capacity = s.capacity * 2
        let new_buffer = mem.malloc(new_capacity)
        let old_buffer = s.buffer
        let idx = 0
        while idx < s.len {
            let tmp = mem.read_u8(old_buffer + idx)
            mem.set_u8(new_buffer + idx, tmp)
            idx = idx + 1
        }
        mem.free(s.buffer)
        s.buffer = new_buffer
        s.capacity = new_capacity
    }
    mem.set_u8(s.buffer + s.len, char)
    s.len = s.len + 1
}

/// Return slice from a String.
pub fun as_str(string: String): Str {
    return Str {
        len: string.len,
        start: string.buffer,
    }
}

`,
};
