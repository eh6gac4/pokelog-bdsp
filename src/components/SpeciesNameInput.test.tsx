import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpeciesNameInput } from "./SpeciesNameInput";

function Harness(props: {
  spy: (name: string, id: number | undefined) => void;
  required?: boolean;
  listId?: string;
  placeholder?: string;
}) {
  const [v, setV] = useState("");
  return (
    <div>
      <button type="button">outside</button>
      <SpeciesNameInput
        value={v}
        required={props.required}
        listId={props.listId}
        placeholder={props.placeholder}
        onChange={(n, id) => {
          setV(n);
          props.spy(n, id);
        }}
      />
    </div>
  );
}

const input = () => screen.getByPlaceholderText("ポッチャマ");

describe("SpeciesNameInput", () => {
  it("does not show the listbox before the input is focused", () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);

    expect(screen.getByPlaceholderText("ポッチャマ")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens a listbox with 493 Sinnoh-first options on focus", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);

    await user.click(input());

    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    const opts = within(listbox).getAllByRole("option");
    expect(opts).toHaveLength(493);

    expect(opts[0]).toHaveTextContent("ナエトル");
    expect(opts[0]).not.toHaveTextContent("フシギダネ");

    const fushigidane = within(listbox).getByText("フシギダネ");
    expect(fushigidane).toBeInTheDocument();
    expect(opts[0]).not.toBe(fushigidane.closest("[role=option]"));
  });

  it("filters the listbox by substring and reports undefined for partial text", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);

    await user.type(input(), "ヒコ");

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("ヒコザル")).toBeInTheDocument();
    expect(within(listbox).queryByText("ナエトル")).toBeNull();

    const last = spy.mock.calls[spy.mock.calls.length - 1];
    expect(last).toEqual(["ヒコ", undefined]);
  });

  it("reports the matching national id when the full name is typed", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);

    await user.type(input(), "ヒコザル");

    const last = spy.mock.calls[spy.mock.calls.length - 1];
    expect(last).toEqual(["ヒコザル", 390]);
  });

  it("selects an option on click and closes the listbox", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);

    await user.click(input());
    const listbox = screen.getByRole("listbox");
    await user.click(within(listbox).getByText("フシギダネ"));

    const last = spy.mock.calls[spy.mock.calls.length - 1];
    expect(last).toEqual(["フシギダネ", 1]);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("reports undefined for unknown text", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);

    await user.type(input(), "ぜんぜんちがう");

    const last = spy.mock.calls[spy.mock.calls.length - 1];
    expect(last).toEqual(["ぜんぜんちがう", undefined]);
  });

  it("closes the listbox on Escape and on outside click", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);

    await user.click(input());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();

    await user.click(input());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("forwards the required attribute only when the prop is true", () => {
    const spy = vi.fn();
    const { unmount } = render(<Harness spy={spy} required />);
    expect(input()).toBeRequired();
    unmount();

    render(<Harness spy={spy} />);
    expect(input()).not.toBeRequired();
  });

  it("uses the provided listId for input + listbox, defaults otherwise", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    const { unmount } = render(
      <Harness spy={spy} listId="party-species-list" />,
    );
    expect(input().getAttribute("aria-controls")).toBe("party-species-list");
    await user.click(input());
    expect(screen.getByRole("listbox").id).toBe("party-species-list");
    unmount();

    render(<Harness spy={spy} />);
    expect(input().getAttribute("aria-controls")).toBe("species-name-list");
    await user.click(input());
    expect(screen.getByRole("listbox").id).toBe("species-name-list");
  });

  it("respects a custom placeholder while defaulting to ポッチャマ", () => {
    const spy = vi.fn();
    const { unmount } = render(<Harness spy={spy} />);
    expect(screen.getByPlaceholderText("ポッチャマ")).toBeInTheDocument();
    unmount();

    render(<Harness spy={spy} placeholder="ヒコザル" />);
    expect(screen.getByPlaceholderText("ヒコザル")).toBeInTheDocument();
  });
});
