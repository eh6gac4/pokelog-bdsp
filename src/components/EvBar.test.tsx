import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EvBar } from "./EvBar";
import { EvSpread, emptyEvSpread } from "@/types/pokemon";

function spread(partial: Partial<EvSpread> = {}): EvSpread {
  return { ...emptyEvSpread(), ...partial };
}

// The fill element is the only div with an inline width style. It's the
// child div of the relative track. Grab it by traversing the container.
function fillWidths(container: HTMLElement): string[] {
  const fills = Array.from(
    container.querySelectorAll<HTMLDivElement>("div[style*='width']"),
  );
  return fills.map((el) => el.style.width);
}

describe("EvBar", () => {
  it("renders 6 stat rows with EV_STAT_LABELS", () => {
    render(<EvBar evs={emptyEvSpread()} readonly />);
    for (const label of ["HP", "こうげき", "ぼうぎょ", "とくこう", "とくぼう", "すばやさ"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("computes fill width without clamping", () => {
    const { container } = render(
      <EvBar
        evs={spread({ hp: 126, atk: 0, def: 252, spa: 504 })}
        readonly
      />,
    );
    const widths = fillWidths(container);
    // order: hp, atk, def, spa, spd, spe
    expect(widths[0]).toBe("50%");
    expect(widths[1]).toBe("0%");
    expect(widths[2]).toBe("100%");
    expect(widths[3]).toBe("200%");
  });

  it("shows total against 510 and no 超過! at exactly 510", () => {
    // 252 + 252 + 6 = 510
    render(<EvBar evs={spread({ hp: 252, atk: 252, def: 6 })} readonly />);
    expect(screen.getByText(/合計 510 \/ 510/)).toBeInTheDocument();
    expect(screen.queryByText("超過!")).not.toBeInTheDocument();
  });

  it("shows 超過! only when total strictly exceeds 510", () => {
    render(<EvBar evs={spread({ hp: 252, atk: 252, def: 7 })} readonly />);
    expect(screen.getByText(/合計 511 \/ 510/)).toBeInTheDocument();
    expect(screen.getByText("超過!")).toBeInTheDocument();
  });

  it("no 超過! at total 0", () => {
    render(<EvBar evs={emptyEvSpread()} readonly />);
    expect(screen.getByText(/合計 0 \/ 510/)).toBeInTheDocument();
    expect(screen.queryByText("超過!")).not.toBeInTheDocument();
  });

  it("readonly shows values as text, no number inputs", () => {
    render(<EvBar evs={spread({ hp: 100 })} readonly />);
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("editable renders number inputs with min 0 max 252", () => {
    render(<EvBar evs={emptyEvSpread()} onChange={() => {}} />);
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs).toHaveLength(6);
    for (const input of inputs) {
      expect(input).toHaveAttribute("min", "0");
      expect(input).toHaveAttribute("max", "252");
    }
  });

  it("editing an input fires onChange(stat, numericValue)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EvBar evs={emptyEvSpread()} onChange={onChange} />);
    const inputs = screen.getAllByRole("spinbutton");
    // first input = hp
    await user.clear(inputs[0]);
    await user.type(inputs[0], "4");
    expect(onChange).toHaveBeenCalledWith("hp", 4);
    const lastCall = onChange.mock.calls.at(-1)!;
    expect(typeof lastCall[1]).toBe("number");
  });

  it("does not throw when onChange undefined and not readonly", async () => {
    const user = userEvent.setup();
    render(<EvBar evs={emptyEvSpread()} />);
    const inputs = screen.getAllByRole("spinbutton");
    await expect(user.type(inputs[0], "5")).resolves.toBeUndefined();
  });
});
