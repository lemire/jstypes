# jstypes

The jstypes library uses WebAssembly to support C-like arithmetic and logical operations in JavaScript. The essential strategy is to represent all numbers as string representing 64-bit hexadecimal numbers (we call them "hex64"). Conceptually these strings represent the content of a 64-bit register. These strings can be added, multiplied and so forth, resulting in other similar (hex64) strings. We can also convert these hex64 strings to other representations like 32-bit signed integers of 8-bit unsigned integers, as a processor would. Thus we use strings between  "0000000000000000" and "FFFFFFFFFFFFFFFF" as inputs. Some instructions also expect a bit width parameter (out of 8, 16, 32, and 64). When specifying a bit width of 32, only the least significant 32 bits are processed.  Thus we use strings between  "0000000000000000" and "FFFFFFFFFFFFFFFF" as inputs. Some instructions also expect a bit width parameter (out of 8, 16, 32, and 64). When specifying a bit width of 32, only the least significant 32 bits are processed.



## Example

The following JavaScript code

```
  console.log("FF000000000000 + 00111111111111 (32 bits) = "
   +jstypes.hex64_add("FF000000000000","00111111111111",32));

  console.log("FF000000000000 + 00111111111111 (64 bits) = "
  +jstypes.hex64_multiply("FF000000000000","00111111111111",64));

  console.log("FF000000000000 shifted by 35 bits in signed mode is = "
  +jstypes.hex64_shift_right_signed("FF00000000000000",35, 64));
```
should output...

```
FF000000000000 + 00111111111111 (32 bits) = 11111111
FF000000000000 + 00111111111111 (64 bits) = FFEF000000000000
FF000000000000 shifted by 35 bits in signed mode is = FFFFFFFFFFE00000
```

We support the following functions:

  - hex64_add
  - hex64_subtract
  - hex64_multiply
  - hex64_to_double
  - hex64_to_float
  - double_to_hex64
  - hex64_to_signed
  - unsigned_to_hex64
  - signed_to_hex64
  - float_to_hex64
  - hex64_or
  - hex64_and
  - hex64_andnot
  - hex64_xor
  - hex64_equal
  - hex64_lessthan_signed
  - hex64_greaterthan_signed
  - hex64_negate
  - hex64_not
  - hex64_shift_left
  - hex64_shift_right_signed

## Working node instructions

Go to a new directory and load the library:

```
npm init
npm i @lemire/jstypes
// copy jstypes.wasm in the current directory, e.g., as
cp node_modules/\@lemire/jstypes/jstypes.wasm .
```



Create and run the following script (e.g., as test.js):

```
var jstypes = require("@lemire/jstypes")


jstypes.init().then(ready => {
  console.log("FF000000000000 + 00111111111111 (32 bits) = "
   +jstypes.hex64_add("FF000000000000","00111111111111",32));

  console.log("FF000000000000 + 00111111111111 (64 bits) = "
  +jstypes.hex64_multiply("FF000000000000","00111111111111",64));

  console.log("FF000000000000 shifted by 35 bits in signed mode is = "
  +jstypes.hex64_shift_right_signed("FF00000000000000",35, 64));

}).
catch(error => {
  console.log(error.message);
});
```

## Todo and limitations

- This code is largely untested.
- It is unclear whether it works in a browser (only tested in node).
- We do not support floating-point operations (but it is easily added).
- It is unclear whether you can go from hex64 to float and back without error (you almost certainly can't).
