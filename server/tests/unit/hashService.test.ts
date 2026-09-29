import { hammingDistance } from "../../src/services/hashService";

describe("hammingDistance", () => {
  it("returns 0 for identical hashes", () => {
    const hash = "1010101010101010101010101010101010101010101010101010101010101 0".replace(/\s/g, "").slice(0, 64);
    expect(hammingDistance(hash, hash)).toBe(0);
  });

  it("counts the number of differing bits", () => {
    const a = "0000000000000000000000000000000000000000000000000000000000000000".slice(0, 64);
    const b = "1111000000000000000000000000000000000000000000000000000000000000".slice(0, 64);
    expect(hammingDistance(a, b)).toBe(4);
  });

  it("is symmetric", () => {
    const a = "1100110011001100110011001100110011001100110011001100110011001100".slice(0, 64);
    const b = "0011001100110011001100110011001100110011001100110011001100110011".slice(0, 64);
    expect(hammingDistance(a, b)).toBe(hammingDistance(b, a));
  });

  it("throws on mismatched hash lengths instead of silently comparing a prefix", () => {
    expect(() => hammingDistance("1010", "101")).toThrow(/different lengths/i);
  });
});
