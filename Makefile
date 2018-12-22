src/jstypes.js : jstypes.c
	emcc jstypes.c -s SINGLE_FILE=true -s WASM=1 -o jstypes.js -s ALLOW_MEMORY_GROWTH=1 \
	 -s EXPORTED_FUNCTIONS='[ "_hex64_add", "_hex64_subtract", "_hex64_multiply", "_hex64_to_double",\
	 "_hex64_to_float", "_double_to_hex64", "_hex64_to_signed","_unsigned_to_hex64",\
	 "_signed_to_hex64","_float_to_hex64","_hex64_or", "_hex64_and", "_hex64_andnot",\
	 "_hex64_xor", "_hex64_equal", "_hex64_lessthan_signed", "_hex64_greaterthan_signed",\
	 "_hex64_or", "_hex64_negate", "_hex64_not","_hex64_shift_left",\
	 "_hex64_shift_right_signed","_hex64_shift_right_unsigned"]' \
	 -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "allocate",\
	 "intArrayFromString","ALLOC_NORMAL","Pointer_stringify"]'


test: demo.js jstypes.js
	node demo.js

clean:
	rm -f jstypes.wasm jstypes.js
