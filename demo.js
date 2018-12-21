
var jstypes = require("./jstypeswrap")


jstypes.init().then(ready => {
  console.log("FF000000000000 + 00111111111111 (32 bits) = "
   +jstypes.hex64_add("FF000000000000","00111111111111",32));

  console.log("FF000000000000 + 00111111111111 (64 bits) = "
  +jstypes.hex64_multiply("FF000000000000","00111111111111",64));

  console.log("FF000000000000 shifted by 35 bits in signed mode is = "
  +jstypes.hex64_shift_right_signed("FF00000000000000",35, 64));

  console.log(jstypes)
}).
catch(error => {
  console.log(error.message);
});
