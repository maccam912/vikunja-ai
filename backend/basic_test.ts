Deno.test("basic math sanity check", () => {
  // Minimal assertion helper to avoid external downloads in restricted environments
  const assertEquals = (actual: unknown, expected: unknown) => {
    if (actual !== expected) {
      throw new Error(
        `Assertion failed: expected ${expected}, received ${actual}`,
      );
    }
  };

  assertEquals(1 + 1, 2);
});
