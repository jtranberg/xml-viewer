import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import App from "../App";

describe("XML Feed Viewer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the heading", () => {
    render(<App />);
    expect(screen.getByText(/xml feed viewer/i)).toBeInTheDocument();
  });

  it("shows empty state initially", () => {
    render(<App />);
    expect(screen.getAllByText(/no data loaded/i).length).toBeGreaterThan(0);
  });

  it("loads and renders listing data after clicking Load Feed", async () => {
    const mockXml = `
      <Root>
        <Listing>
          <Property>
            <Name>Shannon Mews</Name>
            <Address1>123 Main St</Address1>
            <City>Vancouver</City>
            <Region>BC</Region>
            <Postal>V1V1V1</Postal>
          </Property>
          <Unit>
            <UnitNumber>203</UnitNumber>
            <Bedrooms>1</Bedrooms>
            <Bathrooms>1</Bathrooms>
            <Rent>2000</Rent>
            <AvailableDate>2026-04-01</AvailableDate>
          </Unit>
        </Listing>
      </Root>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockXml,
      })
    );

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText(/paste xml feed url/i), {
      target: { value: "https://example.com/feed.xml" },
    });

    fireEvent.click(screen.getByRole("button", { name: /load feed/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /shannon mews/i })
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/unit 203/i)).toBeInTheDocument();
    expect(screen.getByText(/\$2000\/month/i)).toBeInTheDocument();
  });

  it("shows an error when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText(/paste xml feed url/i), {
      target: { value: "https://example.com/feed.xml" },
    });

    fireEvent.click(screen.getByRole("button", { name: /load feed/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});