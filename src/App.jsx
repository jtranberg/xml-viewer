import { useMemo, useState } from "react";
import "./App.css";

export default function XmlFeedViewerApp() {
  const [feedUrl, setFeedUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [useProxy, setUseProxy] = useState(false);

  const [xmlText, setXmlText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function loadFeed() {
    setLoading(true);
    setError("");
    setCopied(false);

    try {
      if (!feedUrl.trim()) {
        throw new Error("Please enter a feed URL.");
      }

      const headers = {};

      if (username || password) {
        headers.Authorization = "Basic " + btoa(`${username}:${password}`);
      }

      let res;

      if (useProxy) {
        const proxyBase = "https://your-proxy-url.onrender.com/proxy-feed";
        const proxyUrl =
          `${proxyBase}?url=${encodeURIComponent(feedUrl)}` +
          `&username=${encodeURIComponent(username)}` +
          `&password=${encodeURIComponent(password)}`;

        res = await fetch(proxyUrl);
      } else {
        res = await fetch(feedUrl, { headers });
      }

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
        address1: property?.querySelector("Address1")?.textContent || "",
        city: property?.querySelector("City")?.textContent || "",
        region: property?.querySelector("Region")?.textContent || "",
        postal: property?.querySelector("Postal")?.textContent || "",
        description: property?.querySelector("Description")?.textContent || "",
        website: property?.querySelector("Website")?.textContent || "",
        buildingType: property?.querySelector("BuildingType")?.textContent || "",
        phone: property?.querySelector("Phone")?.textContent || "",
        email: property?.querySelector("Email")?.textContent || "",

        unitNumber: unit?.querySelector("UnitNumber")?.textContent || "",
        unitType: unit?.querySelector("UnitType")?.textContent || "",
        floorplanName: unit?.querySelector("FloorplanName")?.textContent || "",
        beds: unit?.querySelector("Bedrooms")?.textContent || "",
        baths: unit?.querySelector("Bathrooms")?.textContent || "",
        sqft:
          unit?.querySelector("SquareFootage > Max")?.textContent ||
          unit?.querySelector("SquareFootage > Min")?.textContent ||
          "",
        rent: unit?.querySelector("Pricing > Rent")?.textContent || "",
        available:
          unit?.querySelector("Availability > IsAvailable")?.textContent || "",
        availableDate:
          unit?.querySelector("Availability > AvailableDate")?.textContent || "",
        occupancyStatus:
          unit?.querySelector("Availability > OccupancyStatus")?.textContent || "",
        photo: unit?.querySelector("Media > Photos > Photo")?.textContent || "",
        unitPageSlug: unit?.querySelector("UnitPageSlug")?.textContent || "",
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
            <p>Load and inspect any XML feed</p>
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
              placeholder="Paste XML feed URL"
            />
          </div>

          <div className="row">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username (optional)"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (optional)"
            />
          </div>

          <div className="row proxy-row">
            <label className="proxy-toggle">
              <input
                type="checkbox"
                checked={useProxy}
                onChange={(e) => setUseProxy(e.target.checked)}
              />
              <span>Use Proxy for CORS-protected feeds</span>
            </label>
          </div>

          <div className="row">
            <button onClick={loadFeed} disabled={loading || !feedUrl.trim()}>
              {loading ? "Loading..." : "Load Feed"}
            </button>

            <button onClick={copyXml} disabled={!xmlText}>
              {copied ? "Copied" : "Copy XML"}
            </button>
          </div>

          <div className="links">
            {feedUrl && (
              <a href={feedUrl} target="_blank" rel="noreferrer">
                Open raw feed
              </a>
            )}
          </div>

          {useProxy && (
            <p className="proxy-note">
              Proxy mode is on. Replace the placeholder proxy URL in the code with your deployed proxy endpoint.
            </p>
          )}

          {error && <div className="error">{error}</div>}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Listings Preview</h2>
            <span>{listings.length} listings</span>
          </div>

          {listings.length === 0 ? (
            <p>No data loaded</p>
          ) : (
            <div className="listing-grid">
              {listings.map((listing, index) => (
                <div
                  className="listing-card"
                  key={`${listing.propertyName}-${listing.unitNumber}-${index}`}
                >
                  <div className="listing-image-wrap">
                    {listing.photo ? (
                      <img
                        src={listing.photo}
                        alt={`${listing.propertyName} Unit ${listing.unitNumber}`}
                        className="listing-image"
                      />
                    ) : (
                      <div className="listing-image-placeholder">No Image</div>
                    )}
                  </div>

                  <div className="listing-content">
                    <h2>{listing.propertyName}</h2>

                    <p className="address">
                      {listing.address1}, {listing.city}, {listing.region} {listing.postal}
                    </p>

                    <div className="listing-meta">
                      <span>Unit {listing.unitNumber}</span>
                      <span>{listing.beds} Beds</span>
                      <span>{listing.baths} Baths</span>
                      <span>{listing.sqft} SF</span>
                      <span>{listing.buildingType}</span>
                    </div>

                    <div className="listing-rent">
                      {listing.rent ? `$${listing.rent}/month` : "No rent listed"}
                    </div>

                    <div className="listing-availability">
                      Available: {listing.availableDate || "N/A"}
                    </div>

                    {listing.floorplanName && (
                      <div className="listing-floorplan">{listing.floorplanName}</div>
                    )}

                    {listing.description && (
                      <p className="listing-description">{listing.description}</p>
                    )}

                    <div className="listing-contact">
                      {listing.phone && <span>{listing.phone}</span>}
                      {listing.email && <span>{listing.email}</span>}
                    </div>

                    {listing.website && (
                      <a
                        href={listing.website}
                        target="_blank"
                        rel="noreferrer"
                        className="listing-button"
                      >
                        View Property
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
                  <th>Sqft</th>
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
                    <td>{listing.sqft}</td>
                    <td>{listing.rent ? `$${listing.rent}` : ""}</td>
                    <td>{listing.available}</td>
                    <td>{listing.availableDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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