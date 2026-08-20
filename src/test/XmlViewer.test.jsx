import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { vi } from "vitest";
import App from "../App";

const MITS_XML = `
  <Feed>
    <PhysicalProperty>
      <Property IDValue="property-trails" IDType="PrimaryID">
        <PropertyID>
          <MarketingName>Wall Trails</MarketingName>
          <Address AddressType="property">
            <AddressLine1>520 E 1st St</AddressLine1>
            <City>North Vancouver</City>
            <State>BC</State>
            <PostalCode>V7L 1B9</PostalCode>
          </Address>
        </PropertyID>
        <Information>
          <LongDescription>Wall Trails test property</LongDescription>
        </Information>
        <ILS_Unit IDValue="unit-trails" IDType="ILS_UnitID">
          <Units>
            <Unit>
              <Identification IDValue="unit-trails" IDType="ILS_UnitID" />
              <Identification IDValue="fp-trails" IDType="FloorPlanID" />
              <MarketingName>212</MarketingName>
              <Featured>false</Featured>
              <UnitType>1 Bed / 1 Bath • 739 SF</UnitType>
              <UnitBedrooms>1.00</UnitBedrooms>
              <UnitBathrooms>1.00</UnitBathrooms>
              <MinSquareFeet>739</MinSquareFeet>
              <MaxSquareFeet>739</MaxSquareFeet>
              <UnitRent>2850</UnitRent>
              <MarketRent>2850</MarketRent>
              <UnitLeasedStatus>available</UnitLeasedStatus>
              <UnitOccupancyStatus>vacant</UnitOccupancyStatus>
              <FloorplanName>1 Bed / 1 Bath • 739 SF</FloorplanName>
              <BuildingName>Wall Trails</BuildingName>
            </Unit>
          </Units>
          <EffectiveRent Min="2850" Max="2850" />
          <Availability>
            <VacateDate Day="1" Month="9" Year="2026" />
            <MadeReadyDate Day="1" Month="9" Year="2026" />
            <VacancyClass>Unoccupied</VacancyClass>
            <UnitAvailabilityURL>https://example.com/trails-unit-212</UnitAvailabilityURL>
          </Availability>
        </ILS_Unit>
      </Property>

      <Property IDValue="property-seafair" IDType="PrimaryID">
        <PropertyID>
          <MarketingName>Wall Seafair</MarketingName>
          <Address AddressType="property">
            <AddressLine1>3851 Francis Rd</AddressLine1>
            <City>Richmond</City>
            <State>BC</State>
            <PostalCode>V7C 2B2</PostalCode>
          </Address>
        </PropertyID>
        <Information>
          <LongDescription>Wall Seafair test property</LongDescription>
        </Information>
        <Promotional>One month free</Promotional>
        <ILS_Unit IDValue="unit-seafair" IDType="ILS_UnitID">
          <File FileID="seafair-floorplan" Active="true">
            <FileType>Floorplan</FileType>
            <Name>Unit Diagram</Name>
            <Src>https://example.com/seafair-floorplan.jpg</Src>
            <Rank>1</Rank>
          </File>
          <File FileID="seafair-photo" Active="true">
            <FileType>Photo</FileType>
            <Name>Unit Photo</Name>
            <Src>https://example.com/seafair-photo.jpg</Src>
            <Rank>2</Rank>
          </File>
          <Units>
            <Unit>
              <Identification IDValue="unit-seafair" IDType="ILS_UnitID" />
              <Identification IDValue="fp-seafair" IDType="FloorPlanID" />
              <MarketingName>205</MarketingName>
              <Featured>true</Featured>
              <UnitType>2 Bed / 1.5 Bath • 970 SF</UnitType>
              <UnitBedrooms>2.00</UnitBedrooms>
              <UnitBathrooms>1.50</UnitBathrooms>
              <MinSquareFeet>970</MinSquareFeet>
              <MaxSquareFeet>970</MaxSquareFeet>
              <UnitRent>2500</UnitRent>
              <MarketRent>2500</MarketRent>
              <UnitLeasedStatus>available</UnitLeasedStatus>
              <UnitOccupancyStatus>vacant</UnitOccupancyStatus>
              <FloorplanName>2 Bed / 1.5 Bath • 970 SF</FloorplanName>
              <BuildingName>Wall Seafair</BuildingName>
            </Unit>
          </Units>
          <EffectiveRent Min="2500" Max="2500" />
          <Availability>
            <VacateDate Day="1" Month="10" Year="2026" />
            <MadeReadyDate Day="15" Month="10" Year="2026" />
            <VacancyClass>Unoccupied</VacancyClass>
            <UnitAvailabilityURL>https://example.com/seafair-unit-205</UnitAvailabilityURL>
          </Availability>
        </ILS_Unit>
      </Property>
    </PhysicalProperty>
  </Feed>
`;

describe("XML Feed Inspector", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function openInspector() {
    fireEvent.click(
      screen.getByRole("button", { name: /open inspector/i }),
    );
  }

  async function loadXml(xml) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => xml,
      }),
    );

    render(<App />);
    openInspector();

    fireEvent.change(screen.getByPlaceholderText(/paste xml feed url/i), {
      target: { value: "https://example.com/feed.xml" },
    });
    fireEvent.click(screen.getByRole("button", { name: /load feed/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  }

  it("renders the welcome screen and heading", () => {
    render(<App />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: /xml feed inspector/i }).length,
    ).toBeGreaterThan(0);
  });

  it("shows the empty state initially", () => {
    render(<App />);
    openInspector();

    expect(screen.getAllByText(/no data loaded/i).length).toBeGreaterThan(0);
  });

  it("dismisses the welcome screen", () => {
    render(<App />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    openInspector();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
      }),
    );

    render(<App />);
    openInspector();

    fireEvent.change(screen.getByPlaceholderText(/paste xml feed url/i), {
      target: { value: "https://example.com/feed.xml" },
    });

    fireEvent.click(screen.getByRole("button", { name: /load feed/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /shannon mews/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("203")).toBeInTheDocument();
    expect(screen.getByText("2000")).toBeInTheDocument();
  });

  it("renders units from every property inside one MITS container", async () => {
    await loadXml(MITS_XML);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Wall Trails" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Wall Seafair" }),
      ).toBeInTheDocument();
    });
  });

  it("renders complete MITS unit inspection fields", async () => {
    await loadXml(MITS_XML);

    const heading = await screen.findByRole("heading", { name: "Wall Seafair" });
    const card = heading.closest(".listing-card");

    expect(card).not.toBeNull();
    expect(card).toHaveTextContent(/property ID:\s*property-seafair/i);
    expect(card).toHaveTextContent(/unit ID:\s*unit-seafair/i);
    expect(card).toHaveTextContent(/floorplan ID:\s*fp-seafair/i);
    expect(card).toHaveTextContent(/beds:\s*2\.00/i);
    expect(card).toHaveTextContent(/baths:\s*1\.50/i);
    expect(card).toHaveTextContent(/market rent:\s*2500/i);
    expect(card).toHaveTextContent(/lease status:\s*available/i);
    expect(card).toHaveTextContent(/occupancy:\s*vacant/i);
    expect(card).toHaveTextContent(/vacate date:\s*2026-10-01/i);
    expect(card).toHaveTextContent(/made-ready date:\s*2026-10-15/i);
    expect(card).toHaveTextContent(/vacancy class:\s*Unoccupied/i);
  });

  it("shows both absent and active promotion states", async () => {
    await loadXml(MITS_XML);

    const trailsHeading = await screen.findByRole("heading", {
      name: "Wall Trails",
    });
    const seafairHeading = screen.getByRole("heading", {
      name: "Wall Seafair",
    });
    const trailsCard = trailsHeading.closest(".listing-card");
    const seafairCard = seafairHeading.closest(".listing-card");

    expect(trailsCard).toHaveTextContent(/promotion:\s*None/i);
    expect(seafairCard).toHaveTextContent(/promotion:\s*One month free/i);
  });

  it("renders and switches through the complete unit image gallery", async () => {
    await loadXml(MITS_XML);

    const heading = await screen.findByRole("heading", { name: "Wall Seafair" });
    const card = heading.closest(".listing-card");
    const cardQueries = within(card);
    const mainImage = cardQueries.getByRole("img", { name: "Wall Seafair" });

    expect(
      cardQueries.getAllByRole("button", { name: /show (floorplan|photo)/i }),
    ).toHaveLength(2);
    expect(mainImage).toHaveAttribute(
      "src",
      "https://example.com/seafair-photo.jpg",
    );

    fireEvent.click(
      cardQueries.getByRole("button", { name: /show floorplan 1/i }),
    );
    expect(mainImage).toHaveAttribute(
      "src",
      "https://example.com/seafair-floorplan.jpg",
    );
  });

  it("renders raw XML larger than 200,000 characters", async () => {
    const largeXml = `<Root><Payload>${"x".repeat(210000)}</Payload></Root>`;
    await loadXml(largeXml);

    fireEvent.click(screen.getByRole("button", { name: /^raw xml/i }));

    const rawViewer = await screen.findByRole("textbox", {
      name: /raw xml feed/i,
    });
    expect(rawViewer.value).toBe(largeXml);
    expect(rawViewer.value.length).toBeGreaterThan(200000);
  });

  it("shows an error when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    render(<App />);
    openInspector();

    fireEvent.change(screen.getByPlaceholderText(/paste xml feed url/i), {
      target: { value: "https://example.com/feed.xml" },
    });

    fireEvent.click(screen.getByRole("button", { name: /load feed/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
