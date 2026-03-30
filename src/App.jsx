import { useMemo, useState } from "react";
import "./App.css";

export default function XmlFeedViewerApp() {
  const [feedUrl, setFeedUrl] = useState(
    "http://localhost:3000/feeds/liv-rent.xml?available=true"
  );
  const [xmlText, setXmlText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function loadFeed() {
    setLoading(true);
    setError("");
    setCopied(false);

    try {
      const username = "WallFinancialCorporation";
      const password = "#5LNwnlq";

      const res = await fetch(feedUrl, {
        headers: {
          Authorization: "Basic " + btoa(`${username}:${password}`),
        },
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${res.statusText}`);
      }

      const text = await res.text();
      setXmlText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
      setXmlText("");
    } finally {
      setLoading(false);
    }
  }

  async function copyXml() {
    if (!xmlText) return;

    try {
      await navigator.clipboard.writeText(xmlText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy XML to clipboard.");
    }
  }

  const escapedXml = useMemo(() => {
    return xmlText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }, [xmlText]);

  const listings = useMemo(() => {
    if (!xmlText) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");
    const parserError = doc.querySelector("parsererror");

    if (parserError) return [];

    const items = [...doc.querySelectorAll("Listing")];

    return items.map((item) => {
      const property = item.querySelector("Property");
      const unit = item.querySelector("Unit");

      return {
        propertyName: property?.querySelector("Name")?.textContent || "",
        city: property?.querySelector("City")?.textContent || "",
        unitNumber: unit?.querySelector("UnitNumber")?.textContent || "",
        rent: unit?.querySelector("Pricing > Rent")?.textContent || "",
        beds: unit?.querySelector("Bedrooms")?.textContent || "",
        baths: unit?.querySelector("Bathrooms")?.textContent || "",
        available: unit?.querySelector("Availability > IsAvailable")?.textContent || "",
        availableDate:
          unit?.querySelector("Availability > AvailableDate")?.textContent || "",
      };
    });
  }, [xmlText]);

  const summary = useMemo(() => {
    if (!xmlText) {
      return {
        properties: 0,
        floorplans: 0,
        units: 0,
      };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");
    const parserError = doc.querySelector("parsererror");

    if (parserError) {
      return {
        properties: 0,
        floorplans: 0,
        units: 0,
      };
    }

    return {
      properties: doc.querySelectorAll("Property").length,
      floorplans: doc.querySelectorAll("Floorplan").length,
      units: doc.querySelectorAll("Unit").length,
    };
  }, [xmlText]);

  return (
    <div className="app">
      <div className="container">
        <div className="card header">
          <div>
            <h1>XML Feed Viewer</h1>
            <p>Load and inspect your syndicator XML feed</p>
          </div>

          <div className="stats">
            <StatCard label="Properties" value={summary.properties} />
            <StatCard label="Floorplans" value={summary.floorplans} />
            <StatCard label="Units" value={summary.units} />
          </div>
        </div>

        <div className="card">
          <label htmlFor="feed-url">Feed URL</label>

          <div className="row">
            <input
              id="feed-url"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="Enter XML feed URL"
            />

            <button onClick={loadFeed} disabled={loading}>
              {loading ? "Loading..." : "Load Feed"}
            </button>

            <button onClick={copyXml} disabled={!xmlText}>
              {copied ? "Copied" : "Copy XML"}
            </button>
          </div>

          <div className="links">
            <a href={feedUrl} target="_blank" rel="noreferrer">
              Open raw feed
            </a>
          </div>

          {error && <div className="error">{error}</div>}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Raw XML</h2>
            <span>{xmlText ? `${xmlText.length} chars` : "No feed loaded"}</span>
          </div>

          <div className="xml-box">
            {xmlText ? (
              <pre dangerouslySetInnerHTML={{ __html: escapedXml }} />
            ) : (
              <p>Load a feed to view XML</p>
            )}
          </div>
        </div>

        <div className="card">
          <h2>Units</h2>

          {listings.length === 0 ? (
            <p>No data loaded</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>City</th>
                  <th>Unit</th>
                  <th>Beds</th>
                  <th>Baths</th>
                  <th>Rent</th>
                  <th>Available</th>
                  <th>Date</th>
                </tr>
              </thead>

              <tbody>
                {listings.map((listing, index) => (
                  <tr key={`${listing.propertyName}-${listing.unitNumber}-${index}`}>
                    <td>{listing.propertyName}</td>
                    <td>{listing.city}</td>
                    <td>{listing.unitNumber}</td>
                    <td>{listing.beds}</td>
                    <td>{listing.baths}</td>
                    <td>{listing.rent ? `$${listing.rent}` : ""}</td>
                    <td>{listing.available}</td>
                    <td>{listing.availableDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat">
      <div>{value}</div>
      <small>{label}</small>
    </div>
  );
}