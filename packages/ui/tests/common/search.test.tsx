import { act, render, cleanup, fireEvent } from "@testing-library/react";
import Search from "@mahiru/ui/common/components/data-input/search";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

it("keeps uncontrolled input working and searches after the debounce while forwarding typing state", async () => {
  const onSearch = vi.fn();
  const setIsTyping = vi.fn();
  const view = render(<Search setIsTyping={setIsTyping} onSearch={onSearch} />);
  const input = view.getByRole("textbox");

  fireEvent.focus(input);
  expect(setIsTyping).toHaveBeenLastCalledWith(true);
  await act(async () => {
    fireEvent.change(input, { target: { value: "First" } });
  });
  expect(input).toHaveValue("First");
  await advance(299);
  expect(onSearch).not.toHaveBeenCalled();
  await advance(1);
  expect(onSearch).toHaveBeenCalledExactlyOnceWith("First");

  fireEvent.blur(input);
  expect(setIsTyping).toHaveBeenLastCalledWith(false);
});

it("keeps one controlled input across a tab change and cancels the old keyword and callback", async () => {
  const oldSearch = vi.fn();
  const newSearch = vi.fn();
  const onValueChange = vi.fn();
  const setIsTyping = vi.fn();
  const view = render(
    <Search value="" setIsTyping={setIsTyping} onSearch={oldSearch} onValueChange={onValueChange} />
  );
  const input = view.getByRole("textbox");

  fireEvent.change(input, { target: { value: "Old keyword" } });
  expect(onValueChange).toHaveBeenCalledExactlyOnceWith("Old keyword");
  expect(input).toHaveValue("");
  view.rerender(
    <Search
      value="Old keyword"
      setIsTyping={setIsTyping}
      onSearch={oldSearch}
      onValueChange={onValueChange}
    />
  );
  await advance(100);
  view.rerender(
    <Search value="" setIsTyping={setIsTyping} onSearch={newSearch} onValueChange={onValueChange} />
  );

  expect(view.getByRole("textbox")).toBe(input);
  expect(input).toHaveValue("");
  await advance(299);
  expect(oldSearch).not.toHaveBeenCalled();
  expect(newSearch).not.toHaveBeenCalled();
  await advance(1);
  expect(oldSearch).not.toHaveBeenCalled();
  expect(newSearch).toHaveBeenCalledExactlyOnceWith("");
});

it("cancels a pending search when the input unmounts", async () => {
  const onSearch = vi.fn();
  const view = render(<Search setIsTyping={vi.fn()} onSearch={onSearch} />);

  await act(async () => {
    fireEvent.change(view.getByRole("textbox"), { target: { value: "Pending keyword" } });
  });
  await advance(200);
  view.unmount();
  await advance(1000);
  expect(onSearch).not.toHaveBeenCalled();
});
