import { describe, expect, it } from "vitest";
import { reportPrintPageStyles } from "./printReport";

describe("report print layout", () => {
  it("repeats classification markings in the reserved page margins", () => {
    const styles = reportPrintPageStyles("CONFIDENTIAL");
    expect(styles).toContain("@top-right");
    expect(styles).toContain("@bottom-right");
    expect(styles.match(/content: \"CONFIDENTIAL\"/g)).toHaveLength(2);
  });

  it("keeps classification text inside the generated style element", () => {
    expect(reportPrintPageStyles('SENSITIVE </style> "review"'))
      .not.toContain("</style>");
  });
});
