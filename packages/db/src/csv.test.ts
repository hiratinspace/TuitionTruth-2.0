import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRecords } from "./csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    expect(parseCsv('id,name\n1,"University of California, Berkeley"')).toEqual([
      ["id", "name"],
      ["1", "University of California, Berkeley"],
    ]);
  });

  it("handles escaped double quotes", () => {
    expect(parseCsv('q\n"She said ""hi"""')).toEqual([["q"], ['She said "hi"']]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles quoted fields with embedded newlines", () => {
    expect(parseCsv('note\n"line1\nline2"')).toEqual([["note"], ["line1\nline2"]]);
  });
});

describe("parseCsvRecords", () => {
  it("keys cells by header and tolerates trailing blank lines", () => {
    const records = parseCsvRecords("UNITID,INSTNM\n110635,University of California\n");
    expect(records).toEqual([{ UNITID: "110635", INSTNM: "University of California" }]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsvRecords("")).toEqual([]);
  });

  it("fills missing trailing cells with empty strings", () => {
    expect(parseCsvRecords("a,b,c\n1,2")).toEqual([{ a: "1", b: "2", c: "" }]);
  });
});
