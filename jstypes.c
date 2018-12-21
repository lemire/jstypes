#include <emscripten.h>
#include <inttypes.h>
#include <malloc.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <memory.h>
#include <string.h>

const char digittoval[256] = {
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0,  1,  2,  3,  4,  5,  6,  7,  8,
    9,  -1, -1, -1, -1, -1, -1, -1, 10, 11, 12, 13, 14, 15, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, 10, 11, 12, 13, 14, 15, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1};

bool validate_hex64(const char *a) {
  if( a == NULL ) {
    fprintf( stderr, "Unexpected null pointer");
    return false;
  }
  const char *ao = a;
  while (*a != '\0') {
    if (digittoval[(unsigned char)*a] == -1) {
      fprintf( stderr, "Character %c is not hexadecimal!",*a);
      fprintf( stderr, "String %s is not hexadecimal!",ao);
      return false;
    }
    a++;
  }
  return true;
}
// add two values using the specified bitwidth as a word size
EMSCRIPTEN_KEEPALIVE
char *hex64_add(const char *a, const char *b, int bitwidth) {
  char *answer = NULL;
  if (!validate_hex64(a) || !validate_hex64(b))
    return NULL;
  switch (bitwidth) {
  case 64: {
    uint64_t va = (uint64_t)strtoumax(a, NULL, 16);
    uint64_t vb = (uint64_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "", va + vb);
    break;
  }
  case 32: {
    uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
    uint32_t vb = (uint32_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", va + vb);
    break;
  }
  case 16: {
    uint16_t va = (uint16_t)strtoumax(a, NULL, 16);
    uint16_t vb = (uint16_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va + vb);
    break;
  }
  case 8: {
    uint8_t va = (uint8_t)strtoumax(a, NULL, 16);
    uint8_t vb = (uint8_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va + vb);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *hex64_and(const char *a, const char *b, int bitwidth) {
  char *answer = NULL;
  if (!validate_hex64(a) || !validate_hex64(b))
    return NULL;
  switch (bitwidth) {
  case 64: {
    uint64_t va = (uint64_t)strtoumax(a, NULL, 16);
    uint64_t vb = (uint64_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "", va + vb);
    break;
  }
  case 32: {
    uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
    uint32_t vb = (uint32_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", va & vb);
    break;
  }
  case 16: {
    uint16_t va = (uint16_t)strtoumax(a, NULL, 16);
    uint16_t vb = (uint16_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va & vb);
    break;
  }
  case 8: {
    uint8_t va = (uint8_t)strtoumax(a, NULL, 16);
    uint8_t vb = (uint8_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va & vb);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *hex64_or(const char *a, const char *b, int bitwidth) {
  char *answer = NULL;
  if (!validate_hex64(a) || !validate_hex64(b))
    return NULL;
  switch (bitwidth) {
  case 64: {
    uint64_t va = (uint64_t)strtoumax(a, NULL, 16);
    uint64_t vb = (uint64_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "", va | vb);
    break;
  }
  case 32: {
    uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
    uint32_t vb = (uint32_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", va | vb);
    break;
  }
  case 16: {
    uint16_t va = (uint16_t)strtoumax(a, NULL, 16);
    uint16_t vb = (uint16_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va | vb);
    break;
  }
  case 8: {
    uint8_t va = (uint8_t)strtoumax(a, NULL, 16);
    uint8_t vb = (uint8_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va | vb);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *hex64_xor(const char *a, const char *b, int bitwidth) {
  char *answer = NULL;
  if (!validate_hex64(a) || !validate_hex64(b))
    return NULL;
  switch (bitwidth) {
  case 64: {
    uint64_t va = (uint64_t)strtoumax(a, NULL, 16);
    uint64_t vb = (uint64_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "", va ^ vb);
    break;
  }
  case 32: {
    uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
    uint32_t vb = (uint32_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", va ^ vb);
    break;
  }
  case 16: {
    uint16_t va = (uint16_t)strtoumax(a, NULL, 16);
    uint16_t vb = (uint16_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va ^ vb);
    break;
  }
  case 8: {
    uint8_t va = (uint8_t)strtoumax(a, NULL, 16);
    uint8_t vb = (uint8_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va ^ vb);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *hex64_andnot(const char *a, const char *b, int bitwidth) {
  char *answer = NULL;
  if (!validate_hex64(a) || !validate_hex64(b))
    return NULL;
  switch (bitwidth) {
  case 64: {
    uint64_t va = (uint64_t)strtoumax(a, NULL, 16);
    uint64_t vb = (uint64_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "", va & ~vb);
    break;
  }
  case 32: {
    uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
    uint32_t vb = (uint32_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", va & ~vb);
    break;
  }
  case 16: {
    uint16_t va = (uint16_t)strtoumax(a, NULL, 16);
    uint16_t vb = (uint16_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va & ~vb);
    break;
  }
  case 8: {
    uint8_t va = (uint8_t)strtoumax(a, NULL, 16);
    uint8_t vb = (uint8_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va & ~vb);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *hex64_equal(const char *a, const char *b, int bitwidth) {
  char *answer = NULL;
  if (!validate_hex64(a) || !validate_hex64(b))
    return NULL;
  switch (bitwidth) {
  case 64: {
    uint64_t va = (uint64_t)strtoumax(a, NULL, 16);
    uint64_t vb = (uint64_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "",
             va == vb ? UINT64_C(0xFFFFFFFFFFFFFFFF) : 0);
    break;
  }
  case 32: {
    uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
    uint32_t vb = (uint32_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", va == vb ? UINT32_C(0xFFFFFFFF) : 0);
    break;
  }
  case 16: {
    uint16_t va = (uint16_t)strtoumax(a, NULL, 16);
    uint16_t vb = (uint16_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va == vb ? 0xFFFF : 0);
    break;
  }
  case 8: {
    uint8_t va = (uint8_t)strtoumax(a, NULL, 16);
    uint8_t vb = (uint8_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va == vb ? 0xFF : 0);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *hex64_lessthan_signed(const char *a, const char *b, int bitwidth) {
  char *answer = NULL;
  if (!validate_hex64(a) || !validate_hex64(b))
    return NULL;
  switch (bitwidth) {
  case 64: {
    int64_t va = (int64_t)strtoumax(a, NULL, 16);
    int64_t vb = (int64_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "",
             va < vb ? UINT64_C(0xFFFFFFFFFFFFFFFF) : 0);
    break;
  }
  case 32: {
    int32_t va = (int32_t)strtoumax(a, NULL, 16);
    int32_t vb = (int32_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", va < vb ? UINT32_C(0xFFFFFFFF) : 0);
    break;
  }
  case 16: {
    int16_t va = (int16_t)strtoumax(a, NULL, 16);
    int16_t vb = (int16_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va < vb ? 0xFFFF : 0);
    break;
  }
  case 8: {
    int8_t va = (int8_t)strtoumax(a, NULL, 16);
    int8_t vb = (int8_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va < vb ? 0xFF : 0);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *hex64_greaterthan_signed(const char *a, const char *b, int bitwidth) {
  char *answer = NULL;
  if (!validate_hex64(a) || !validate_hex64(b))
    return NULL;
  switch (bitwidth) {
  case 64: {
    int64_t va = (int64_t)strtoumax(a, NULL, 16);
    int64_t vb = (int64_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "",
             va > vb ? UINT64_C(0xFFFFFFFFFFFFFFFF) : 0);
    break;
  }
  case 32: {
    int32_t va = (int32_t)strtoumax(a, NULL, 16);
    int32_t vb = (int32_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", va > vb ? UINT32_C(0xFFFFFFFF) : 0);
    break;
  }
  case 16: {
    int16_t va = (int16_t)strtoumax(a, NULL, 16);
    int16_t vb = (int16_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va > vb ? 0xFFFF : 0);
    break;
  }
  case 8: {
    int8_t va = (int8_t)strtoumax(a, NULL, 16);
    int8_t vb = (int8_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va > vb ? 0xFF : 0);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}

// subtract two values using the specified bitwidth as a word size
EMSCRIPTEN_KEEPALIVE
char *hex64_subtract(const char *a, const char *b, int bitwidth) {
  char *answer = NULL;
  if (!validate_hex64(a) || !validate_hex64(b))
    return NULL;
  switch (bitwidth) {
  case 64: {
    uint64_t va = (uint64_t)strtoumax(a, NULL, 16);
    uint64_t vb = (uint64_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "", va - vb);
    break;
  }
  case 32: {
    uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
    uint32_t vb = (uint32_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", va - vb);
    break;
  }
  case 16: {
    uint16_t va = (uint16_t)strtoumax(a, NULL, 16);
    uint16_t vb = (uint16_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va - vb);
    break;
  }
  case 8: {
    uint8_t va = (uint8_t)strtoumax(a, NULL, 16);
    uint8_t vb = (uint8_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va - vb);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}

// multiply two values using the specified bitwidth as a word size
EMSCRIPTEN_KEEPALIVE
char *hex64_multiply(const char *a, const char *b, int bitwidth) {
  char *answer = NULL;
  if (!validate_hex64(a) || !validate_hex64(b))
    return NULL;
  switch (bitwidth) {
  case 64: {
    uint64_t va = (uint64_t)strtoumax(a, NULL, 16);
    uint64_t vb = (uint64_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "", va * vb);
    break;
  }
  case 32: {
    uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
    uint32_t vb = (uint32_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", va * vb);
    break;
  }
  case 16: {
    uint16_t va = (uint16_t)strtoumax(a, NULL, 16);
    uint16_t vb = (uint16_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va * vb);
    break;
  }
  case 8: {
    uint8_t va = (uint8_t)strtoumax(a, NULL, 16);
    uint8_t vb = (uint8_t)strtoumax(b, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va * vb);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}

// negate using two-complement's notation
EMSCRIPTEN_KEEPALIVE
char *hex64_not(const char *a, int bitwidth) {
  char *answer = NULL;
  if (!validate_hex64(a))
    return NULL;
  switch (bitwidth) {
  case 64: {
    uint64_t va = (uint64_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "", ~va);
    break;
  }
  case 32: {
    uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", ~va);
    break;
  }
  case 16: {
    uint16_t va = (uint16_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", ~va);
    break;
  }
  case 8: {
    uint8_t va = (uint8_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", ~va);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}
// negate using two-complement's notation
EMSCRIPTEN_KEEPALIVE
char *hex64_negate(const char *a, int bitwidth) {
  char *answer = NULL;
  if (!validate_hex64(a))
    return NULL;
  switch (bitwidth) {
  case 64: {
    uint64_t va = (uint64_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "", (~va) + 1);
    break;
  }
  case 32: {
    uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", (~va) + 1);
    break;
  }
  case 16: {
    uint16_t va = (uint16_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", (~va) + 1);
    break;
  }
  case 8: {
    uint8_t va = (uint8_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", (~va) + 1);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *hex64_to_unsigned(const char *a, int bitwidth) {
  char *answer = NULL;
  if (!validate_hex64(a))
    return NULL;

  switch (bitwidth) {
  case 64: {
    uint64_t va = (uint64_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%" PRIu64 "", va);
    break;
  }
  case 32: {
    uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%" PRIu32 "", va);
    break;
  }
  case 16: {
    uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%" PRIu16 "", va);
    break;
  }
  case 8: {
    uint8_t va = (uint8_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%" PRIu8 "", va);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}


EMSCRIPTEN_KEEPALIVE
char *unsigned_to_hex64(const char *a) {
  uint64_t va = (uint64_t)strtoumax(a, NULL, 10);
  char *answer = NULL;
  asprintf(&answer, "%016" PRIX64 "", va);
  return answer;
}


EMSCRIPTEN_KEEPALIVE
char *signed_to_hex64(const char *a) {
  int64_t va = (int64_t)strtoimax(a, NULL, 10);
  char *answer = NULL;
  asprintf(&answer, "%016" PRIX64 "", va);
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *hex64_to_signed(const char *a, int bitwidth) {
  char *answer = NULL;
  if (!validate_hex64(a))
    return NULL;

  switch (bitwidth) {
  case 64: {
    int64_t va = (int64_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%" PRIi64 "", va);
    break;
  }
  case 32: {
    int32_t va = (int32_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%" PRIi32 "", va);
    break;
  }
  case 16: {
    int16_t va = (int16_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%" PRIi16 "", va);
    break;
  }
  case 8: {
    int8_t va = (int8_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%" PRIi8 "", va);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *hex64_to_double(const char *a) {
  if (!validate_hex64(a))
    return NULL;

  uint64_t va = (uint64_t)strtoumax(a, NULL, 16);
  double x;
  memcpy(&x, &va, sizeof(x));
  char *answer;
  asprintf(&answer, "%f", x);
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *hex64_to_float(const char *a) {
  if (!validate_hex64(a))
    return NULL;
  uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
  float x;
  memcpy(&x, &va, sizeof(x));
  char *answer;
  asprintf(&answer, "%f", x);
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *float_to_hex64(const char *a) {
  double f = strtof(a, NULL);
  uint64_t v;
  memcpy(&v, &f, sizeof(v));
  char *answer;
  asprintf(&answer, "%016" PRIX64 "", v);
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *double_to_hex64(const char *a) {
  double f = strtod(a, NULL);
  uint64_t v;
  memcpy(&v, &f, sizeof(v));
  char *answer;
  asprintf(&answer, "%016" PRIX64 "", v);
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *hex64_shift_right_signed(const char *a, int i, int bitwidth) {
  if (!validate_hex64(a))
    return NULL;

  char *answer;

  switch (bitwidth) {
  case 64: {
    int64_t va = (int64_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "", va >> i);
    break;
  }
  case 32: {
    int32_t va = (int32_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", va >> i);
    break;
  }
  case 16: {
    int16_t va = (int16_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va >> i);
    break;
  }
  case 8: {
    int8_t va = (int8_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%02" PRIX8 "", va >> i);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *hex64_shift_right_unsigned(const char *a, int i, int bitwidth) {
  if (!validate_hex64(a))
    return NULL;

  char *answer;

  switch (bitwidth) {
  case 64: {
    uint64_t va = (uint64_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "", va >> i);
    break;
  }
  case 32: {
    uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", va >> i);
    break;
  }
  case 16: {
    uint16_t va = (uint16_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va >> i);
    break;
  }
  case 8: {
    uint8_t va = (uint8_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%02" PRIX8 "", va >> i);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}

EMSCRIPTEN_KEEPALIVE
char *hex64_shift_left(const char *a, int i, int bitwidth) {
  if (!validate_hex64(a))
    return NULL;

  char *answer;

  switch (bitwidth) {
  case 64: {
    uint64_t va = (uint64_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%016" PRIX64 "", va << i);
    break;
  }
  case 32: {
    uint32_t va = (uint32_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%08" PRIX32 "", va << i);
    break;
  }
  case 16: {
    uint16_t va = (uint16_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%04" PRIX16 "", va << i);
    break;
  }
  case 8: {
    uint8_t va = (uint8_t)strtoumax(a, NULL, 16);
    asprintf(&answer, "%02" PRIX8 "", va << i);
    break;
  }
  default:
    printf("unknown bitwidth %d\n", bitwidth);
  }
  return answer;
}
