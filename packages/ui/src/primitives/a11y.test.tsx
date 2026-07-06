// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { DirectionIndicator } from "./DirectionIndicator";
import { InsufficientData } from "./InsufficientData";
import { ProvenanceChip } from "./ProvenanceChip";
import { Skeleton } from "./Skeleton";

afterEach(cleanup);

/**
 * Run axe-core against a rendered container (TUIT-29: "every primitive passes
 * axe-core"). `color-contrast` is disabled because jsdom has no layout engine to
 * measure it — contrast is instead guaranteed at the token level (tokens.css is
 * authored and verified for WCAG AA in both themes).
 */
async function expectNoViolations(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  const findings = results.violations.map((v) => `${v.id}: ${v.help}`);
  expect(findings).toEqual([]);
}

describe("primitive accessibility (axe-core)", () => {
  it("Button has no violations", async () => {
    const { container } = render(<Button>Export CSV</Button>);
    await expectNoViolations(container);
  });

  it("Card has no violations", async () => {
    const { container } = render(
      <Card>
        <p>Cost breakdown</p>
      </Card>,
    );
    await expectNoViolations(container);
  });

  it("Badge has no violations", async () => {
    const { container } = render(<Badge tone="rising">+3.9%</Badge>);
    await expectNoViolations(container);
  });

  it("Skeleton has no violations", async () => {
    const { container } = render(<Skeleton className="h-6 w-24" label="Loading net price" />);
    await expectNoViolations(container);
  });

  it("DirectionIndicator has no violations", async () => {
    const { container } = render(<DirectionIndicator rate={0.032} />);
    await expectNoViolations(container);
  });

  it("InsufficientData has no violations", async () => {
    const { container } = render(<InsufficientData reason="no prior-year record" />);
    await expectNoViolations(container);
  });

  it("ProvenanceChip has no violations", async () => {
    const { container } = render(
      <ProvenanceChip
        provenance={{
          asOf: "Mar 2026",
          source: "IPEDS",
          sourceUrl: "https://nces.ed.gov/ipeds/",
          extractedAt: "2026-03-01T00:00:00.000Z",
          confidence: 0.98,
        }}
      />,
    );
    await expectNoViolations(container);
  });
});
