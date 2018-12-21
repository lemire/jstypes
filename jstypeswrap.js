
var jstypesmodule = require("./jstypes")

const isString = str => ((typeof str === 'string') || (str instanceof String));

function validateWebAssembly() {
  if (typeof WebAssembly === "undefined") {
    throw new Error("WebAssembly is not available");
  }
};

var generatemyfncs =  function() {
  /// this functionify thingy can probably be simplified greatly, but
  /// we need to do garbage collection
  var functionify = function(fnc) {
    // we create a new function
    return function() {
      var garbage = []
      var newargs = []
      for (var i = 0; i < arguments.length; i++) {
        if(isString(arguments[i])) {
          // need to convert a javascript into a C string
          var allocstr = jstypesmodule.allocate(jstypesmodule.intArrayFromString(arguments[i]), 'i8', jstypesmodule.ALLOC_NORMAL)
          garbage.push(allocstr) // garbage will need to be clearned
          newargs.push(allocstr)
        } else {
          newargs.push(arguments[i])
        }
      }
      var strptr = fnc.apply(null,newargs)
      var answer = jstypesmodule.Pointer_stringify(strptr)
      jstypesmodule._free(strptr)
      for (var i = 0; i < garbage.length; i++) {
        jstypesmodule._free(garbage[i]);
      }
      return answer;
    }
  };

  exports.hex64_add = functionify(jstypesmodule._hex64_add)
  exports.hex64_subtract = functionify(jstypesmodule._hex64_subtract)
  exports.hex64_multiply = functionify(jstypesmodule._hex64_multiply)
  exports.hex64_to_double = functionify(jstypesmodule._hex64_to_double)
  exports.hex64_to_float = functionify(jstypesmodule._hex64_to_float)
  exports.double_to_hex64 = functionify(jstypesmodule._double_to_hex64)
  exports.hex64_to_signed = functionify(jstypesmodule._hex64_to_signed)
  exports.unsigned_to_hex64 = functionify(jstypesmodule._unsigned_to_hex64)
  exports.signed_to_hex64 = functionify(jstypesmodule._signed_to_hex64)
  exports.float_to_hex64 = functionify(jstypesmodule._float_to_hex64)
  exports.hex64_or = functionify(jstypesmodule._hex64_or)
  exports.hex64_and = functionify(jstypesmodule._hex64_and)
  exports.hex64_andnot = functionify(jstypesmodule._hex64_andnot)
  exports.hex64_xor = functionify(jstypesmodule._hex64_xor)
  exports.hex64_equal = functionify(jstypesmodule._hex64_equal)
  exports.hex64_lessthan_signed = functionify(jstypesmodule._hex64_lessthan_signed)
  exports.hex64_greaterthan_signed = functionify(jstypesmodule._hex64_greaterthan_signed)
  exports.hex64_or = functionify(jstypesmodule._hex64_or)
  exports.hex64_negate = functionify(jstypesmodule._hex64_negate)
  exports.hex64_not = functionify(jstypesmodule._hex64_not)
  exports.hex64_shift_left = functionify(jstypesmodule._hex64_shift_left)
  exports.hex64_shift_right_signed = functionify(jstypesmodule._hex64_shift_right_signed)
  exports.hex64_shift_right_signed = functionify(jstypesmodule._hex64_shift_right_signed)
  exports.hex64_shift_right_signed = functionify(jstypesmodule._hex64_shift_right_signed)
};

var init = function() {
  return new Promise((resolve, reject) => {
    validateWebAssembly();
    jstypesmodule.onRuntimeInitialized=(() => {
      generatemyfncs();
      resolve(true);
    });
  })
}

exports.init = init
