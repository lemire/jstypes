// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('Module[\'ENVIRONMENT\'] value is not valid. must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    var ret;
    ret = tryParseAsDataURI(filename);
    if (!ret) {
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      ret = nodeFS['readFileSync'](filename);
    }
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  // Currently node will swallow unhandled rejections, but this behavior is
  // deprecated, and in the future it will exit with error status.
  process['on']('unhandledRejection', function(reason, p) {
    Module['printErr']('node.js exiting due to unhandled promise rejection');
    process['exit'](1);
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
} else
if (ENVIRONMENT_IS_SHELL) {
  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      var data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }

  Module['readBinary'] = function readBinary(f) {
    var data;
    data = tryParseAsDataURI(f);
    if (data) {
      return data;
    }
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status, toThrow) {
      quit(status);
    }
  }
} else
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function shell_read(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
    } catch (err) {
      var data = tryParseAsDataURI(url);
      if (data) {
        return intArrayToString(data);
      }
      throw err;
    }
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return data;
        }
        throw err;
      }
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      var data = tryParseAsDataURI(url);
      if (data) {
        onload(data.buffer);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  Module['setWindowTitle'] = function(title) { document.title = title };
} else
{
  throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');
}

// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
Module['print'] = typeof console !== 'undefined' ? console.log.bind(console) : (typeof print !== 'undefined' ? print : null);
Module['printErr'] = typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || Module['print']);

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = setTempRet0 = getTempRet0 = function() {
  abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
};

function staticAlloc(size) {
  assert(!staticSealed);
  var ret = STATICTOP;
  STATICTOP = (STATICTOP + size + 15) & -16;
  return ret;
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  if (end >= TOTAL_MEMORY) {
    var success = enlargeMemory();
    if (!success) {
      HEAP32[DYNAMICTOP_PTR>>2] = ret;
      return 0;
    }
  }
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  var ret = size = Math.ceil(size / factor) * factor;
  return ret;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    Module.printErr(text);
  }
}



var jsCallStartIndex = 1;
var functionPointers = new Array(0);

// 'sig' parameter is only used on LLVM wasm backend
function addFunction(func, sig) {
  if (typeof sig === 'undefined') {
    Module.printErr('warning: addFunction(): You should provide a wasm function signature string as a second argument. This is not necessary for asm.js and asm2wasm, but is required for the LLVM wasm backend, so it is recommended for full portability.');
  }
  var base = 0;
  for (var i = base; i < base + 0; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
}

function removeFunction(index) {
  functionPointers[index-jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length-1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].call(null, ptr);
  }
}


function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // FIXME backwards compatibility layer for ports. Support some Runtime.*
  //       for now, fix it there, then remove it from here. That way we
  //       can minimize any period of breakage.
  dynCall: dynCall, // for SDL2 port
  // helpful errors
  getTempRet0: function() { abort('getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  staticAlloc: function() { abort('staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  stackAlloc: function() { abort('stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 1024;



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

var JSfuncs = {
  // Helpers for cwrap -- it can't refer to Runtime directly because it might
  // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
  // out what the minified function name is.
  'stackSave': function() {
    stackSave()
  },
  'stackRestore': function() {
    stackRestore()
  },
  // type conversion from js to c
  'arrayToC' : function(arr) {
    var ret = stackAlloc(arr.length);
    writeArrayToMemory(arr, ret);
    return ret;
  },
  'stringToC' : function(str) {
    var ret = 0;
    if (str !== null && str !== undefined && str !== 0) { // null string
      // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
      var len = (str.length << 2) + 1;
      ret = stackAlloc(len);
      stringToUTF8(str, ret, len);
    }
    return ret;
  }
};

// For fast lookup of conversion functions
var toC = {
  'string': JSfuncs['stringToC'], 'array': JSfuncs['arrayToC']
};

// C calling interface.
function ccall (ident, returnType, argTypes, args, opts) {
  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  if (returnType === 'string') ret = Pointer_stringify(ret);
  else if (returnType === 'boolean') ret = Boolean(ret);
  if (stack !== 0) {
    stackRestore(stack);
  }
  return ret;
}

function cwrap (ident, returnType, argTypes) {
  argTypes = argTypes || [];
  var cfunc = getCFunc(ident);
  // When the function takes numbers and returns a number, we can just return
  // the original function
  var numericArgs = argTypes.every(function(type){ return type === 'number'});
  var numericRet = returnType !== 'string';
  if (numericRet && numericArgs) {
    return cfunc;
  }
  return function() {
    return ccall(ident, returnType, argTypes, arguments);
  }
}

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : staticAlloc, stackAlloc, staticAlloc, dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return staticAlloc(size);
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return UTF8ToString(ptr);
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

function demangle(func) {
  warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
}

function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}

if (!Module['reallocBuffer']) Module['reallocBuffer'] = function(size) {
  var ret;
  try {
    if (ArrayBuffer.transfer) {
      ret = ArrayBuffer.transfer(buffer, size);
    } else {
      var oldHEAP8 = HEAP8;
      ret = new ArrayBuffer(size);
      var temp = new Int8Array(ret);
      temp.set(oldHEAP8);
    }
  } catch(e) {
    return false;
  }
  var success = _emscripten_replace_memory(ret);
  if (!success) return false;
  return ret;
};

function enlargeMemory() {
  // TOTAL_MEMORY is the current size of the actual array, and DYNAMICTOP is the new top.
  assert(HEAP32[DYNAMICTOP_PTR>>2] > TOTAL_MEMORY); // This function should only ever be called after the ceiling of the dynamic heap has already been bumped to exceed the current total size of the asm.js heap.


  var PAGE_MULTIPLE = Module["usingWasm"] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE; // In wasm, heap size must be a multiple of 64KB. In asm.js, they need to be multiples of 16MB.
  var LIMIT = 2147483648 - PAGE_MULTIPLE; // We can do one page short of 2GB as theoretical maximum.

  if (HEAP32[DYNAMICTOP_PTR>>2] > LIMIT) {
    Module.printErr('Cannot enlarge memory, asked to go up to ' + HEAP32[DYNAMICTOP_PTR>>2] + ' bytes, but the limit is ' + LIMIT + ' bytes!');
    return false;
  }

  var OLD_TOTAL_MEMORY = TOTAL_MEMORY;
  TOTAL_MEMORY = Math.max(TOTAL_MEMORY, MIN_TOTAL_MEMORY); // So the loop below will not be infinite, and minimum asm.js memory size is 16MB.

  while (TOTAL_MEMORY < HEAP32[DYNAMICTOP_PTR>>2]) { // Keep incrementing the heap size as long as it's less than what is requested.
    if (TOTAL_MEMORY <= 536870912) {
      TOTAL_MEMORY = alignUp(2 * TOTAL_MEMORY, PAGE_MULTIPLE); // Simple heuristic: double until 1GB...
    } else {
      // ..., but after that, add smaller increments towards 2GB, which we cannot reach
      TOTAL_MEMORY = Math.min(alignUp((3 * TOTAL_MEMORY + 2147483648) / 4, PAGE_MULTIPLE), LIMIT);
      if (TOTAL_MEMORY === OLD_TOTAL_MEMORY) {
        warnOnce('Cannot ask for more memory since we reached the practical limit in browsers (which is just below 2GB), so the request would have failed. Requesting only ' + TOTAL_MEMORY);
      }
    }
  }

  var start = Date.now();

  var replacement = Module['reallocBuffer'](TOTAL_MEMORY);
  if (!replacement || replacement.byteLength != TOTAL_MEMORY) {
    Module.printErr('Failed to grow the heap from ' + OLD_TOTAL_MEMORY + ' bytes to ' + TOTAL_MEMORY + ' bytes, not enough memory!');
    if (replacement) {
      Module.printErr('Expected to get back a buffer of size ' + TOTAL_MEMORY + ' bytes, but instead got back a buffer of size ' + replacement.byteLength);
    }
    // restore the state to before this call, we failed
    TOTAL_MEMORY = OLD_TOTAL_MEMORY;
    return false;
  }

  // everything worked

  updateGlobalBuffer(replacement);
  updateGlobalBufferViews();

  if (!Module["usingWasm"]) {
    Module.printErr('Warning: Enlarging memory arrays, this is not fast! ' + [OLD_TOTAL_MEMORY, TOTAL_MEMORY]);
  }


  return true;
}

var byteLength;
try {
  byteLength = Function.prototype.call.bind(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get);
  byteLength(new ArrayBuffer(4)); // can fail on older ie
} catch(e) { // can fail on older node/v8
  byteLength = function(buffer) { return buffer.byteLength; };
}

var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  if (typeof WebAssembly === 'object' && typeof WebAssembly.Memory === 'function') {
    assert(TOTAL_MEMORY % WASM_PAGE_SIZE === 0);
    Module['wasmMemory'] = new WebAssembly.Memory({ 'initial': TOTAL_MEMORY / WASM_PAGE_SIZE });
    buffer = Module['wasmMemory'].buffer;
  } else
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

assert(Math['imul'] && Math['fround'] && Math['clz32'] && Math['trunc'], 'this is a legacy browser, build with LEGACY_VM_SUPPORT');

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}




function integrateWasmJS() {
  // wasm.js has several methods for creating the compiled code module here:
  //  * 'native-wasm' : use native WebAssembly support in the browser
  //  * 'interpret-s-expr': load s-expression code from a .wast and interpret
  //  * 'interpret-binary': load binary wasm and interpret
  //  * 'interpret-asm2wasm': load asm.js code, translate to wasm, and interpret
  //  * 'asmjs': no wasm, just load the asm.js code and use that (good for testing)
  // The method is set at compile time (BINARYEN_METHOD)
  // The method can be a comma-separated list, in which case, we will try the
  // options one by one. Some of them can fail gracefully, and then we can try
  // the next.

  // inputs

  var method = 'native-wasm';

  var wasmTextFile = '';
  var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAABpQEZYAN/f38Bf2ABfwF/YAABf2ABfwBgAn9/AX9gAn9/AGAAAGAEf39/fgF+YAN/f38BfGAFf39/f38BfGAGf39/f39/AXxgAn9/AX5gAnx/AXxgAnx8AXxgAXwBfmAFf39/f38Bf2ADf39/AGADfn9/AX9gAn5/AX9gBX9/f39/AGAGf3x/f39/AX9gBH9/f38Bf2ADf39/AX5gAn9/AX1gAn9/AXwC3AMZA2VudgZtZW1vcnkCAIACA2VudgV0YWJsZQFwAQoKA2VudgptZW1vcnlCYXNlA38AA2Vudgl0YWJsZUJhc2UDfwADZW52DkRZTkFNSUNUT1BfUFRSA38AA2Vudg10ZW1wRG91YmxlUHRyA38AA2VudgVBQk9SVAN/AANlbnYIU1RBQ0tUT1ADfwADZW52CVNUQUNLX01BWAN/AAZnbG9iYWwDTmFOA3wABmdsb2JhbAhJbmZpbml0eQN8AANlbnYNZW5sYXJnZU1lbW9yeQACA2Vudg5nZXRUb3RhbE1lbW9yeQACA2VudhdhYm9ydE9uQ2Fubm90R3Jvd01lbW9yeQACA2VudhJhYm9ydFN0YWNrT3ZlcmZsb3cAAwNlbnYLbnVsbEZ1bmNfaWkAAwNlbnYNbnVsbEZ1bmNfaWlpaQADA2VudgdfX19sb2NrAAMDZW52C19fX3NldEVyck5vAAMDZW52DV9fX3N5c2NhbGwxNDAABANlbnYNX19fc3lzY2FsbDE0NgAEA2VudgxfX19zeXNjYWxsNTQABANlbnYLX19fc3lzY2FsbDYABANlbnYJX19fdW5sb2NrAAMDZW52Fl9lbXNjcmlwdGVuX21lbWNweV9iaWcAAAN1dAEBAgMFBQMCAQAAAAAAAAAAAAAEBAQBAQQBAQEBAAAAAQMBAAABAgEAAQIEAQMBAQAEAAQCBgEBBQEHCAkKCwwNDQwNDg0BAQAAAA8QARAREhIBEwQUDgwMAAICBAQVAAcWFgQAABYWFwgYBgEAAAEEFQEABm0TfwEjAgt/ASMDC38BIwQLfwEjBQt/ASMGC38BQQALfwFBAAt/AUEAC38BQQALfAEjBwt8ASMIC38BQQALfwFBAAt/AUEAC38BQQALfAFEAAAAAAAAAAALfwFBAAt9AUMAAAAAC30BQwAAAAALB7EFKhBfX2dyb3dXYXNtTWVtb3J5AA4RX19fZXJybm9fbG9jYXRpb24ANBBfZG91YmxlX3RvX2hleDY0ACoHX2ZmbHVzaABED19mbG9hdF90b19oZXg2NAApBV9mcmVlAC8KX2hleDY0X2FkZAAXCl9oZXg2NF9hbmQAGA1faGV4NjRfYW5kbm90ABsMX2hleDY0X2VxdWFsABwZX2hleDY0X2dyZWF0ZXJ0aGFuX3NpZ25lZAAeFl9oZXg2NF9sZXNzdGhhbl9zaWduZWQAHQ9faGV4NjRfbXVsdGlwbHkAIA1faGV4NjRfbmVnYXRlACIKX2hleDY0X25vdAAhCV9oZXg2NF9vcgAZEV9oZXg2NF9zaGlmdF9sZWZ0AC0ZX2hleDY0X3NoaWZ0X3JpZ2h0X3NpZ25lZAArG19oZXg2NF9zaGlmdF9yaWdodF91bnNpZ25lZAAsD19oZXg2NF9zdWJ0cmFjdAAfEF9oZXg2NF90b19kb3VibGUAJw9faGV4NjRfdG9fZmxvYXQAKBBfaGV4NjRfdG9fc2lnbmVkACYSX2hleDY0X3RvX3Vuc2lnbmVkACMKX2hleDY0X3hvcgAaD19sbHZtX2Jzd2FwX2kzMgB6B19tYWxsb2MALgdfbWVtY3B5AHsHX21lbXNldAB8BV9zYnJrAH0QX3NpZ25lZF90b19oZXg2NAAlEl91bnNpZ25lZF90b19oZXg2NAAkCmR5bkNhbGxfaWkAfgxkeW5DYWxsX2lpaWkAfxNlc3RhYmxpc2hTdGFja1NwYWNlABILZ2V0VGVtcFJldDAAFQtydW5Qb3N0U2V0cwB5C3NldFRlbXBSZXQwABQIc2V0VGhyZXcAEwpzdGFja0FsbG9jAA8Mc3RhY2tSZXN0b3JlABEJc3RhY2tTYXZlABAJFQEAIwELCoABMIEBgQExMjZtgQGBAQqbrQR0BgAgAEAACygBAX8jDCEBIwwgAGokDCMMQQ9qQXBxJAwjDCMNTgRAIAAQAwsgAQ8LBQAjDA8LBgAgACQMCwoAIAAkDCABJA0LEgAjDkEARgRAIAAkDiABJA8LCwYAIAAkGQsFACMZDwueAwEkfyMMISQjDEEgaiQMIwwjDU4EQEEgEAMLICRBEGohIiAkQQhqISEgJCEgICRBHGohBSAAIRAgECEaIBpBAEYhGyAbBEBBgAgoAgAhHCAcQZwPICAQVxpB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IJADIJEDcSGTAyCTAwRAII4DIUogjwMhTQUgjgMhQwwBCwwBCwsFIDchQwsgQ0ESaiGUAyAAQTAglANBEkEAEGEgayGVAyAzIZYDIJUDIJYDayGXAyAAIDMglwMQWgsgBEGAwABzIZgDIABBICACIMoCIJgDEGEgygIhXwsLIF8gAkghmQMgmQMEfyACBSBfCyFJIOkDJAwgSQ8LEgICfwF+IwwhAiAAvSEDIAMPCxUCAn8BfCMMIQMgACABEGYhBCAEDwv0EQMLfwR+BXwjDCEMIAC9IQ8gD0I0iCEQIBCnQf//A3EhCSAJQf8PcSEKAkACQAJAAkAgCkEQdEEQdUEAaw6AEAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIBAgsCQCAARAAAAAAAAAAAYiEEIAQEQCAARAAAAAAAAPBDoiEUIBQgARBmIRUgASgCACEFIAVBQGohBiAVIRIgBiEIBSAAIRJBACEICyABIAg2AgAgEiERDAMACwALAkAgACERDAIACwALAkAgEKchByAHQf8PcSECIAJBgnhqIQMgASADNgIAIA9C/////////4eAf4MhDSANQoCAgICAgIDwP4QhDiAOvyETIBMhEQsLIBEPC+QEATt/IwwhPSAAQQBGIRgCQCAYBEBBASEDBSABQYABSSEjICMEQCABQf8BcSEuIAAgLjoAAEEBIQMMAgsQaCE3IDdBvAFqITggOCgCACE5IDkoAgAhOiA6QQBGIQQgBARAIAFBgH9xIQUgBUGAvwNGIQYgBgRAIAFB/wFxIQggACAIOgAAQQEhAwwDBRA0IQcgB0HUADYCAEF/IQMMAwsACyABQYAQSSEJIAkEQCABQQZ2IQogCkHAAXIhCyALQf8BcSEMIABBAWohDSAAIAw6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AmoRAAAPCwkAQQAQBEEADwsJAEEBEAVBAA8LC8UdAQBBgAgLvR0EBAAABQAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAMAAAAIFQAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAA//////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIQEAAAFAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAwAAABAVAAAABAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAK/////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAhAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2BQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKAAAAZAAAAOgDAAAQJwAAoIYBAEBCDwCAlpgAAOH1BV9wiQD/CS8PAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP///////////////////////////////////////////////////////////////wABAgMEBQYHCAn/////////CgsMDQ4P//////////////////////////////////8KCwwNDg////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////9VbmV4cGVjdGVkIG51bGwgcG9pbnRlcgBDaGFyYWN0ZXIgJWMgaXMgbm90IGhleGFkZWNpbWFsIQBTdHJpbmcgJXMgaXMgbm90IGhleGFkZWNpbWFsIQAlMDE2bGxYACUwOFgAJTA0WAB1bmtub3duIGJpdHdpZHRoICVkCgAlbGx1ACV1ACVsbGkAJWkAJWYAJTAyWABpbmZpbml0eQD/////////////////////////////////////////////////////////////////AAECAwQFBgcICf////////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI////////woLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIj/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wABAgQHAwYFABEACgAREREAAAAABQAAAAAAAAkAAAAACwAAAAAAAAAAEQAPChEREQMKBwABEwkLCwAACQYLAAALAAYRAAAAERERAAAAAAAAAAAAAAAAAAAAAAsAAAAAAAAAABEACgoREREACgAAAgAJCwAAAAkACwAACwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAAAAwAAAAACQwAAAAAAAwAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAADQAAAAQNAAAAAAkOAAAAAAAOAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA8AAAAADwAAAAAJEAAAAAAAEAAAEAAAEgAAABISEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASAAAAEhISAAAAAAAACQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACwAAAAAAAAAAAAAACgAAAAAKAAAAAAkLAAAAAAALAAALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAwAAAAADAAAAAAJDAAAAAAADAAADAAALSsgICAwWDB4AChudWxsKQAtMFgrMFggMFgtMHgrMHggMHgAaW5mAElORgBuYW4ATkFOADAxMjM0NTY3ODlBQkNERUYuAFQhIhkNAQIDEUscDBAECx0SHidobm9wcWIgBQYPExQVGggWBygkFxgJCg4bHyUjg4J9JiorPD0+P0NHSk1YWVpbXF1eX2BhY2RlZmdpamtscnN0eXp7fABJbGxlZ2FsIGJ5dGUgc2VxdWVuY2UARG9tYWluIGVycm9yAFJlc3VsdCBub3QgcmVwcmVzZW50YWJsZQBOb3QgYSB0dHkAUGVybWlzc2lvbiBkZW5pZWQAT3BlcmF0aW9uIG5vdCBwZXJtaXR0ZWQATm8gc3VjaCBmaWxlIG9yIGRpcmVjdG9yeQBObyBzdWNoIHByb2Nlc3MARmlsZSBleGlzdHMAVmFsdWUgdG9vIGxhcmdlIGZvciBkYXRhIHR5cGUATm8gc3BhY2UgbGVmdCBvbiBkZXZpY2UAT3V0IG9mIG1lbW9yeQBSZXNvdXJjZSBidXN5AEludGVycnVwdGVkIHN5c3RlbSBjYWxsAFJlc291cmNlIHRlbXBvcmFyaWx5IHVuYXZhaWxhYmxlAEludmFsaWQgc2VlawBDcm9zcy1kZXZpY2UgbGluawBSZWFkLW9ubHkgZmlsZSBzeXN0ZW0ARGlyZWN0b3J5IG5vdCBlbXB0eQBDb25uZWN0aW9uIHJlc2V0IGJ5IHBlZXIAT3BlcmF0aW9uIHRpbWVkIG91dABDb25uZWN0aW9uIHJlZnVzZWQASG9zdCBpcyBkb3duAEhvc3QgaXMgdW5yZWFjaGFibGUAQWRkcmVzcyBpbiB1c2UAQnJva2VuIHBpcGUASS9PIGVycm9yAE5vIHN1Y2ggZGV2aWNlIG9yIGFkZHJlc3MAQmxvY2sgZGV2aWNlIHJlcXVpcmVkAE5vIHN1Y2ggZGV2aWNlAE5vdCBhIGRpcmVjdG9yeQBJcyBhIGRpcmVjdG9yeQBUZXh0IGZpbGUgYnVzeQBFeGVjIGZvcm1hdCBlcnJvcgBJbnZhbGlkIGFyZ3VtZW50AEFyZ3VtZW50IGxpc3QgdG9vIGxvbmcAU3ltYm9saWMgbGluayBsb29wAEZpbGVuYW1lIHRvbyBsb25nAFRvbyBtYW55IG9wZW4gZmlsZXMgaW4gc3lzdGVtAE5vIGZpbGUgZGVzY3JpcHRvcnMgYXZhaWxhYmxlAEJhZCBmaWxlIGRlc2NyaXB0b3IATm8gY2hpbGQgcHJvY2VzcwBCYWQgYWRkcmVzcwBGaWxlIHRvbyBsYXJnZQBUb28gbWFueSBsaW5rcwBObyBsb2NrcyBhdmFpbGFibGUAUmVzb3VyY2UgZGVhZGxvY2sgd291bGQgb2NjdXIAU3RhdGUgbm90IHJlY292ZXJhYmxlAFByZXZpb3VzIG93bmVyIGRpZWQAT3BlcmF0aW9uIGNhbmNlbGVkAEZ1bmN0aW9uIG5vdCBpbXBsZW1lbnRlZABObyBtZXNzYWdlIG9mIGRlc2lyZWQgdHlwZQBJZGVudGlmaWVyIHJlbW92ZWQARGV2aWNlIG5vdCBhIHN0cmVhbQBObyBkYXRhIGF2YWlsYWJsZQBEZXZpY2UgdGltZW91dABPdXQgb2Ygc3RyZWFtcyByZXNvdXJjZXMATGluayBoYXMgYmVlbiBzZXZlcmVkAFByb3RvY29sIGVycm9yAEJhZCBtZXNzYWdlAEZpbGUgZGVzY3JpcHRvciBpbiBiYWQgc3RhdGUATm90IGEgc29ja2V0AERlc3RpbmF0aW9uIGFkZHJlc3MgcmVxdWlyZWQATWVzc2FnZSB0b28gbGFyZ2UAUHJvdG9jb2wgd3JvbmcgdHlwZSBmb3Igc29ja2V0AFByb3RvY29sIG5vdCBhdmFpbGFibGUAUHJvdG9jb2wgbm90IHN1cHBvcnRlZABTb2NrZXQgdHlwZSBub3Qgc3VwcG9ydGVkAE5vdCBzdXBwb3J0ZWQAUHJvdG9jb2wgZmFtaWx5IG5vdCBzdXBwb3J0ZWQAQWRkcmVzcyBmYW1pbHkgbm90IHN1cHBvcnRlZCBieSBwcm90b2NvbABBZGRyZXNzIG5vdCBhdmFpbGFibGUATmV0d29yayBpcyBkb3duAE5ldHdvcmsgdW5yZWFjaGFibGUAQ29ubmVjdGlvbiByZXNldCBieSBuZXR3b3JrAENvbm5lY3Rpb24gYWJvcnRlZABObyBidWZmZXIgc3BhY2UgYXZhaWxhYmxlAFNvY2tldCBpcyBjb25uZWN0ZWQAU29ja2V0IG5vdCBjb25uZWN0ZWQAQ2Fubm90IHNlbmQgYWZ0ZXIgc29ja2V0IHNodXRkb3duAE9wZXJhdGlvbiBhbHJlYWR5IGluIHByb2dyZXNzAE9wZXJhdGlvbiBpbiBwcm9ncmVzcwBTdGFsZSBmaWxlIGhhbmRsZQBSZW1vdGUgSS9PIGVycm9yAFF1b3RhIGV4Y2VlZGVkAE5vIG1lZGl1bSBmb3VuZABXcm9uZyBtZWRpdW0gdHlwZQBObyBlcnJvciBpbmZvcm1hdGlvbg==';
  var asmjsCodeFile = '';

  if (typeof Module['locateFile'] === 'function') {
    if (!isDataURI(wasmTextFile)) {
      wasmTextFile = Module['locateFile'](wasmTextFile);
    }
    if (!isDataURI(wasmBinaryFile)) {
      wasmBinaryFile = Module['locateFile'](wasmBinaryFile);
    }
    if (!isDataURI(asmjsCodeFile)) {
      asmjsCodeFile = Module['locateFile'](asmjsCodeFile);
    }
  }

  // utilities

  var wasmPageSize = 64*1024;

  var info = {
    'global': null,
    'env': null,
    'asm2wasm': { // special asm2wasm imports
      "f64-rem": function(x, y) {
        return x % y;
      },
      "debugger": function() {
        debugger;
      }
    },
    'parent': Module // Module inside wasm-js.cpp refers to wasm-js.cpp; this allows access to the outside program.
  };

  var exports = null;


  function mergeMemory(newBuffer) {
    // The wasm instance creates its memory. But static init code might have written to
    // buffer already, including the mem init file, and we must copy it over in a proper merge.
    // TODO: avoid this copy, by avoiding such static init writes
    // TODO: in shorter term, just copy up to the last static init write
    var oldBuffer = Module['buffer'];
    if (newBuffer.byteLength < oldBuffer.byteLength) {
      Module['printErr']('the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here');
    }
    var oldView = new Int8Array(oldBuffer);
    var newView = new Int8Array(newBuffer);


    newView.set(oldView);
    updateGlobalBuffer(newBuffer);
    updateGlobalBufferViews();
  }

  function fixImports(imports) {
    return imports;
  }

  function getBinary() {
    try {
      if (Module['wasmBinary']) {
        return new Uint8Array(Module['wasmBinary']);
      }
      var binary = tryParseAsDataURI(wasmBinaryFile);
      if (binary) {
        return binary;
      }
      if (Module['readBinary']) {
        return Module['readBinary'](wasmBinaryFile);
      } else {
        throw "on the web, we need the wasm binary to be preloaded and set on Module['wasmBinary']. emcc.py will do that for you when generating HTML (but not JS)";
      }
    }
    catch (err) {
      abort(err);
    }
  }

  function getBinaryPromise() {
    // if we don't have the binary yet, and have the Fetch api, use that
    // in some environments, like Electron's render process, Fetch api may be present, but have a different context than expected, let's only use it on the Web
    if (!Module['wasmBinary'] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === 'function') {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
        }
        return response['arrayBuffer']();
      }).catch(function () {
        return getBinary();
      });
    }
    // Otherwise, getBinary should be able to get it synchronously
    return new Promise(function(resolve, reject) {
      resolve(getBinary());
    });
  }

  // do-method functions


  function doNativeWasm(global, env, providedBuffer) {
    if (typeof WebAssembly !== 'object') {
      // when the method is just native-wasm, our error message can be very specific
      abort('No WebAssembly support found. Build with -s WASM=0 to target JavaScript instead.');
      Module['printErr']('no native wasm support detected');
      return false;
    }
    // prepare memory import
    if (!(Module['wasmMemory'] instanceof WebAssembly.Memory)) {
      Module['printErr']('no native wasm Memory in use');
      return false;
    }
    env['memory'] = Module['wasmMemory'];
    // Load the wasm module and create an instance of using native support in the JS engine.
    info['global'] = {
      'NaN': NaN,
      'Infinity': Infinity
    };
    info['global.Math'] = Math;
    info['env'] = env;
    // handle a generated wasm instance, receiving its exports and
    // performing other necessary setup
    function receiveInstance(instance, module) {
      exports = instance.exports;
      if (exports.memory) mergeMemory(exports.memory);
      Module['asm'] = exports;
      Module["usingWasm"] = true;
      removeRunDependency('wasm-instantiate');
    }
    addRunDependency('wasm-instantiate');

    // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
    // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
    // to any other async startup actions they are performing.
    if (Module['instantiateWasm']) {
      try {
        return Module['instantiateWasm'](info, receiveInstance);
      } catch(e) {
        Module['printErr']('Module.instantiateWasm callback failed with error: ' + e);
        return false;
      }
    }

    // Async compilation can be confusing when an error on the page overwrites Module
    // (for example, if the order of elements is wrong, and the one defining Module is
    // later), so we save Module and check it later.
    var trueModule = Module;
    function receiveInstantiatedSource(output) {
      // 'output' is a WebAssemblyInstantiatedSource object which has both the module and instance.
      // receiveInstance() will swap in the exports (to Module.asm) so they can be called
      assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
      trueModule = null;
      receiveInstance(output['instance'], output['module']);
    }
    function instantiateArrayBuffer(receiver) {
      getBinaryPromise().then(function(binary) {
        return WebAssembly.instantiate(binary, info);
      }).then(receiver).catch(function(reason) {
        Module['printErr']('failed to asynchronously prepare wasm: ' + reason);
        abort(reason);
      });
    }
    // Prefer streaming instantiation if available.
    if (!Module['wasmBinary'] &&
        typeof WebAssembly.instantiateStreaming === 'function' &&
        !isDataURI(wasmBinaryFile) &&
        typeof fetch === 'function') {
      WebAssembly.instantiateStreaming(fetch(wasmBinaryFile, { credentials: 'same-origin' }), info)
        .then(receiveInstantiatedSource)
        .catch(function(reason) {
          // We expect the most common failure cause to be a bad MIME type for the binary,
          // in which case falling back to ArrayBuffer instantiation should work.
          Module['printErr']('wasm streaming compile failed: ' + reason);
          Module['printErr']('falling back to ArrayBuffer instantiation');
          instantiateArrayBuffer(receiveInstantiatedSource);
        });
    } else {
      instantiateArrayBuffer(receiveInstantiatedSource);
    }
    return {}; // no exports yet; we'll fill them in later
  }


  // We may have a preloaded value in Module.asm, save it
  Module['asmPreload'] = Module['asm'];

  // Memory growth integration code

  var asmjsReallocBuffer = Module['reallocBuffer'];

  var wasmReallocBuffer = function(size) {
    var PAGE_MULTIPLE = Module["usingWasm"] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE; // In wasm, heap size must be a multiple of 64KB. In asm.js, they need to be multiples of 16MB.
    size = alignUp(size, PAGE_MULTIPLE); // round up to wasm page size
    var old = Module['buffer'];
    var oldSize = old.byteLength;
    if (Module["usingWasm"]) {
      // native wasm support
      try {
        var result = Module['wasmMemory'].grow((size - oldSize) / wasmPageSize); // .grow() takes a delta compared to the previous size
        if (result !== (-1 | 0)) {
          // success in native wasm memory growth, get the buffer from the memory
          return Module['buffer'] = Module['wasmMemory'].buffer;
        } else {
          return null;
        }
      } catch(e) {
        console.error('Module.reallocBuffer: Attempted to grow from ' + oldSize  + ' bytes to ' + size + ' bytes, but got error: ' + e);
        return null;
      }
    }
  };

  Module['reallocBuffer'] = function(size) {
    if (finalMethod === 'asmjs') {
      return asmjsReallocBuffer(size);
    } else {
      return wasmReallocBuffer(size);
    }
  };

  // we may try more than one; this is the final one, that worked and we are using
  var finalMethod = '';

  // Provide an "asm.js function" for the application, called to "link" the asm.js module. We instantiate
  // the wasm module at that time, and it receives imports and provides exports and so forth, the app
  // doesn't need to care that it is wasm or olyfilled wasm or asm.js.

  Module['asm'] = function(global, env, providedBuffer) {
    env = fixImports(env);

    // import table
    if (!env['table']) {
      var TABLE_SIZE = Module['wasmTableSize'];
      if (TABLE_SIZE === undefined) TABLE_SIZE = 1024; // works in binaryen interpreter at least
      var MAX_TABLE_SIZE = Module['wasmMaxTableSize'];
      if (typeof WebAssembly === 'object' && typeof WebAssembly.Table === 'function') {
        if (MAX_TABLE_SIZE !== undefined) {
          env['table'] = new WebAssembly.Table({ 'initial': TABLE_SIZE, 'maximum': MAX_TABLE_SIZE, 'element': 'anyfunc' });
        } else {
          env['table'] = new WebAssembly.Table({ 'initial': TABLE_SIZE, element: 'anyfunc' });
        }
      } else {
        env['table'] = new Array(TABLE_SIZE); // works in binaryen interpreter at least
      }
      Module['wasmTable'] = env['table'];
    }

    if (!env['memoryBase']) {
      env['memoryBase'] = Module['STATIC_BASE']; // tell the memory segments where to place themselves
    }
    if (!env['tableBase']) {
      env['tableBase'] = 0; // table starts at 0 by default, in dynamic linking this will change
    }

    // try the methods. each should return the exports if it succeeded

    var exports;
    exports = doNativeWasm(global, env, providedBuffer);

    assert(exports, 'no binaryen method succeeded. consider enabling more options, like interpreting, if you want that: https://github.com/kripken/emscripten/wiki/WebAssembly#binaryen-methods');


    return exports;
  };

  var methodHandler = Module['asm']; // note our method handler, as we may modify Module['asm'] later
}

integrateWasmJS();

// === Body ===

var ASM_CONSTS = [];





STATIC_BASE = GLOBAL_BASE;

STATICTOP = STATIC_BASE + 6416;
/* global initializers */  __ATINIT__.push();







var STATIC_BUMP = 6416;
Module["STATIC_BASE"] = STATIC_BASE;
Module["STATIC_BUMP"] = STATIC_BUMP;

/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  function ___lock() {}

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var printChar = ___syscall146.printChar;
      if (!printChar) return;
      var buffers = ___syscall146.buffers;
      if (buffers[1].length) printChar(1, 10);
      if (buffers[2].length) printChar(2, 10);
    }function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffers) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___unlock() {}

   

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 

   

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else Module.printErr('failed to set errno from JS');
      return value;
    } 
DYNAMICTOP_PTR = staticAlloc(4);

STACK_BASE = STACKTOP = alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

var ASSERTIONS = true;

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {String} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
    var buf;
    try {
      buf = Buffer.from(s, 'base64');
    } catch (_) {
      buf = new Buffer(s, 'base64');
    }
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}



function nullFunc_ii(x) { Module["printErr"]("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

Module['wasmTableSize'] = 10;

Module['wasmMaxTableSize'] = 10;

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = {};

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_ii": nullFunc_ii, "nullFunc_iiii": nullFunc_iiii, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "___lock": ___lock, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall146": ___syscall146, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___unlock": ___unlock, "_emscripten_memcpy_big": _emscripten_memcpy_big, "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX };
// EMSCRIPTEN_START_ASM
var asm =Module["asm"]// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____errno_location.apply(null, arguments);
};

var real__double_to_hex64 = asm["_double_to_hex64"]; asm["_double_to_hex64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__double_to_hex64.apply(null, arguments);
};

var real__fflush = asm["_fflush"]; asm["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fflush.apply(null, arguments);
};

var real__float_to_hex64 = asm["_float_to_hex64"]; asm["_float_to_hex64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__float_to_hex64.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real__hex64_add = asm["_hex64_add"]; asm["_hex64_add"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_add.apply(null, arguments);
};

var real__hex64_and = asm["_hex64_and"]; asm["_hex64_and"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_and.apply(null, arguments);
};

var real__hex64_andnot = asm["_hex64_andnot"]; asm["_hex64_andnot"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_andnot.apply(null, arguments);
};

var real__hex64_equal = asm["_hex64_equal"]; asm["_hex64_equal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_equal.apply(null, arguments);
};

var real__hex64_greaterthan_signed = asm["_hex64_greaterthan_signed"]; asm["_hex64_greaterthan_signed"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_greaterthan_signed.apply(null, arguments);
};

var real__hex64_lessthan_signed = asm["_hex64_lessthan_signed"]; asm["_hex64_lessthan_signed"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_lessthan_signed.apply(null, arguments);
};

var real__hex64_multiply = asm["_hex64_multiply"]; asm["_hex64_multiply"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_multiply.apply(null, arguments);
};

var real__hex64_negate = asm["_hex64_negate"]; asm["_hex64_negate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_negate.apply(null, arguments);
};

var real__hex64_not = asm["_hex64_not"]; asm["_hex64_not"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_not.apply(null, arguments);
};

var real__hex64_or = asm["_hex64_or"]; asm["_hex64_or"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_or.apply(null, arguments);
};

var real__hex64_shift_left = asm["_hex64_shift_left"]; asm["_hex64_shift_left"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_shift_left.apply(null, arguments);
};

var real__hex64_shift_right_signed = asm["_hex64_shift_right_signed"]; asm["_hex64_shift_right_signed"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_shift_right_signed.apply(null, arguments);
};

var real__hex64_shift_right_unsigned = asm["_hex64_shift_right_unsigned"]; asm["_hex64_shift_right_unsigned"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_shift_right_unsigned.apply(null, arguments);
};

var real__hex64_subtract = asm["_hex64_subtract"]; asm["_hex64_subtract"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_subtract.apply(null, arguments);
};

var real__hex64_to_double = asm["_hex64_to_double"]; asm["_hex64_to_double"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_to_double.apply(null, arguments);
};

var real__hex64_to_float = asm["_hex64_to_float"]; asm["_hex64_to_float"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_to_float.apply(null, arguments);
};

var real__hex64_to_signed = asm["_hex64_to_signed"]; asm["_hex64_to_signed"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_to_signed.apply(null, arguments);
};

var real__hex64_to_unsigned = asm["_hex64_to_unsigned"]; asm["_hex64_to_unsigned"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_to_unsigned.apply(null, arguments);
};

var real__hex64_xor = asm["_hex64_xor"]; asm["_hex64_xor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hex64_xor.apply(null, arguments);
};

var real__llvm_bswap_i32 = asm["_llvm_bswap_i32"]; asm["_llvm_bswap_i32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__llvm_bswap_i32.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sbrk.apply(null, arguments);
};

var real__signed_to_hex64 = asm["_signed_to_hex64"]; asm["_signed_to_hex64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__signed_to_hex64.apply(null, arguments);
};

var real__unsigned_to_hex64 = asm["_unsigned_to_hex64"]; asm["_unsigned_to_hex64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unsigned_to_hex64.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_establishStackSpace.apply(null, arguments);
};

var real_getTempRet0 = asm["getTempRet0"]; asm["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_getTempRet0.apply(null, arguments);
};

var real_setTempRet0 = asm["setTempRet0"]; asm["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setTempRet0.apply(null, arguments);
};

var real_setThrew = asm["setThrew"]; asm["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setThrew.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};
Module["asm"] = asm;
var ___errno_location = Module["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___errno_location"].apply(null, arguments) };
var _double_to_hex64 = Module["_double_to_hex64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_double_to_hex64"].apply(null, arguments) };
var _emscripten_replace_memory = Module["_emscripten_replace_memory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_emscripten_replace_memory"].apply(null, arguments) };
var _fflush = Module["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_fflush"].apply(null, arguments) };
var _float_to_hex64 = Module["_float_to_hex64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_float_to_hex64"].apply(null, arguments) };
var _free = Module["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_free"].apply(null, arguments) };
var _hex64_add = Module["_hex64_add"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_add"].apply(null, arguments) };
var _hex64_and = Module["_hex64_and"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_and"].apply(null, arguments) };
var _hex64_andnot = Module["_hex64_andnot"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_andnot"].apply(null, arguments) };
var _hex64_equal = Module["_hex64_equal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_equal"].apply(null, arguments) };
var _hex64_greaterthan_signed = Module["_hex64_greaterthan_signed"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_greaterthan_signed"].apply(null, arguments) };
var _hex64_lessthan_signed = Module["_hex64_lessthan_signed"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_lessthan_signed"].apply(null, arguments) };
var _hex64_multiply = Module["_hex64_multiply"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_multiply"].apply(null, arguments) };
var _hex64_negate = Module["_hex64_negate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_negate"].apply(null, arguments) };
var _hex64_not = Module["_hex64_not"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_not"].apply(null, arguments) };
var _hex64_or = Module["_hex64_or"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_or"].apply(null, arguments) };
var _hex64_shift_left = Module["_hex64_shift_left"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_shift_left"].apply(null, arguments) };
var _hex64_shift_right_signed = Module["_hex64_shift_right_signed"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_shift_right_signed"].apply(null, arguments) };
var _hex64_shift_right_unsigned = Module["_hex64_shift_right_unsigned"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_shift_right_unsigned"].apply(null, arguments) };
var _hex64_subtract = Module["_hex64_subtract"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_subtract"].apply(null, arguments) };
var _hex64_to_double = Module["_hex64_to_double"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_to_double"].apply(null, arguments) };
var _hex64_to_float = Module["_hex64_to_float"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_to_float"].apply(null, arguments) };
var _hex64_to_signed = Module["_hex64_to_signed"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_to_signed"].apply(null, arguments) };
var _hex64_to_unsigned = Module["_hex64_to_unsigned"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_to_unsigned"].apply(null, arguments) };
var _hex64_xor = Module["_hex64_xor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hex64_xor"].apply(null, arguments) };
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_llvm_bswap_i32"].apply(null, arguments) };
var _malloc = Module["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_malloc"].apply(null, arguments) };
var _memcpy = Module["_memcpy"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memcpy"].apply(null, arguments) };
var _memset = Module["_memset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memset"].apply(null, arguments) };
var _sbrk = Module["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sbrk"].apply(null, arguments) };
var _signed_to_hex64 = Module["_signed_to_hex64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_signed_to_hex64"].apply(null, arguments) };
var _unsigned_to_hex64 = Module["_unsigned_to_hex64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unsigned_to_hex64"].apply(null, arguments) };
var establishStackSpace = Module["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["establishStackSpace"].apply(null, arguments) };
var getTempRet0 = Module["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["getTempRet0"].apply(null, arguments) };
var runPostSets = Module["runPostSets"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["runPostSets"].apply(null, arguments) };
var setTempRet0 = Module["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["setTempRet0"].apply(null, arguments) };
var setThrew = Module["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["setThrew"].apply(null, arguments) };
var stackAlloc = Module["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackAlloc"].apply(null, arguments) };
var stackRestore = Module["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackRestore"].apply(null, arguments) };
var stackSave = Module["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackSave"].apply(null, arguments) };
var dynCall_ii = Module["dynCall_ii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_ii"].apply(null, arguments) };
var dynCall_iiii = Module["dynCall_iiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiii"].apply(null, arguments) };
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

Module["intArrayFromString"] = intArrayFromString;
if (!Module["intArrayToString"]) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;
if (!Module["setValue"]) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getValue"]) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["allocate"] = allocate;
if (!Module["getMemory"]) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
Module["Pointer_stringify"] = Pointer_stringify;
if (!Module["AsciiToString"]) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToAscii"]) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ToString"]) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8"]) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackTrace"]) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnInit"]) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnExit"]) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeAsciiToMemory"]) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addRunDependency"]) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["removeRunDependency"]) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS"]) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS_createFolder"]) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPath"]) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDataFile"]) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPreloadedFile"]) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLazyFile"]) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLink"]) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDevice"]) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_unlink"]) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["GL"]) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["staticAlloc"]) Module["staticAlloc"] = function() { abort("'staticAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function() { abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["warnOnce"]) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getLEB"]) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["registerFunctions"]) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addFunction"]) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["removeFunction"]) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["prettyPrint"]) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["makeBigInt"]) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynCall"]) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackSave"]) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackRestore"]) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackAlloc"]) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayFromBase64"]) Module["intArrayFromBase64"] = function() { abort("'intArrayFromBase64' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["tryParseAsDataURI"]) Module["tryParseAsDataURI"] = function() { abort("'tryParseAsDataURI' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", { get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STATIC"]) Object.defineProperty(Module, "ALLOC_STATIC", { get: function() { abort("'ALLOC_STATIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", { get: function() { abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", { get: function() { abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });




/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}





/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in NO_FILESYSTEM
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = Module['print'];
  var printErr = Module['printErr'];
  var has = false;
  Module['print'] = Module['printErr'] = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush(0);
  } catch(e) {}
  Module['print'] = print;
  Module['printErr'] = printErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set NO_EXIT_RUNTIME to 0 (see the FAQ), or make sure to emit a newline when you printf etc.');
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      Module.printErr('exit(' + status + ') called, but NO_EXIT_RUNTIME is set, so halting execution but not exiting the runtime or preventing further async execution (build with NO_EXIT_RUNTIME=0, if you want a true shutdown)');
    }
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  }
  Module['quit'](status, new ExitStatus(status));
}
Module['exit'] = exit;

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';
  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}


Module["noExitRuntime"] = true;

run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}



