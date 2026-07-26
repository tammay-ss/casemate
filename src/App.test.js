import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

test("renders CaseMate shell", () => {
  render(<App />);
  expect(screen.getAllByText(/CaseMate/i)[0]).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /Today/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /Calendar/i })).toBeInTheDocument();
  expect(screen.getByRole("grid")).toBeInTheDocument();
});

test("drawer navigation focuses Today without the calendar", async () => {
  render(<App />);

  userEvent.click(screen.getByRole("button", { name: /open menu/i }));
  userEvent.click(screen.getByRole("button", { name: "Today" }));

  expect(screen.getByRole("heading", { name: /Today/i })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /Calendar/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /Clients/i })).not.toBeInTheDocument();
});

test("drawer navigation focuses Clients without the calendar", async () => {
  render(<App />);

  userEvent.click(screen.getByRole("button", { name: /open menu/i }));
  userEvent.click(screen.getByRole("button", { name: "Clients" }));

  expect(screen.getByRole("heading", { name: /Clients/i })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /Today/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /Calendar/i })).not.toBeInTheDocument();
});
