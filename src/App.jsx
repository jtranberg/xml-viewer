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

  const [selectedImages, setSelectedImages] = useState({});

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

    const allNodes = [...doc.getElementsByTagName("*")];

    const getChildrenByLocalName = (node, name) =>
      [...node.children].filter((child) => child.localName === name);

    const getFirstChildByLocalName = (node, name) =>
      [...node.children].find((child) => child.localName === name) || null;

    const getTextFromDescendants = (node, name) => {
      const found = [...node.getElementsByTagName("*")].find(
        (el) => el.localName === name,
      );
      return found?.textContent?.trim() || "";
    };

    const livListings = allNodes.filter((el) => el.localName === "Listing");

    if (livListings.length > 0) {
      return livListings.map((item) => {
        const property = getFirstChildByLocalName(item, "Property");
        const unit = getFirstChildByLocalName(item, "Unit");

        const photos = unit
          ? [...unit.getElementsByTagName("*")]
              .filter((el) => el.localName === "Photo")
              .map((el) => el.textContent?.trim() || "")
              .filter(Boolean)
          : [];

        const photo = photos[0] || "";

        return {
          propertyName: property ? getTextFromDescendants(property, "Name") : "",
          address1: property ? getTextFromDescendants(property, "Address1") : "",
          city: property ? getTextFromDescendants(property, "City") : "",
          region: property ? getTextFromDescendants(property, "Region") : "",
          postal: property ? getTextFromDescendants(property, "Postal") : "",
          description: property ? getTextFromDescendants(property, "Description") : "",
          website: property ? getTextFromDescendants(property, "Website") : "",
          buildingType: property ? getTextFromDescendants(property, "BuildingType") : "",
          phone: property ? getTextFromDescendants(property, "Phone") : "",
          email: property ? getTextFromDescendants(property, "Email") : "",

          unitNumber: unit ? getTextFromDescendants(unit, "UnitNumber") : "",
          unitType: unit ? getTextFromDescendants(unit, "UnitType") : "",
          floorplanName: unit ? getTextFromDescendants(unit, "FloorplanName") : "",
          beds: unit ? getTextFromDescendants(unit, "Bedrooms") : "",
          baths: unit ? getTextFromDescendants(unit, "Bathrooms") : "",
          sqft:
            (unit && getTextFromDescendants(unit, "Max")) ||
            (unit && getTextFromDescendants(unit, "Min")) ||
            "",
          rent: unit ? getTextFromDescendants(unit, "Rent") : "",
          available: unit ? getTextFromDescendants(unit, "IsAvailable") : "",
          availableDate: unit ? getTextFromDescendants(unit, "AvailableDate") : "",
          occupancyStatus: unit ? getTextFromDescendants(unit, "OccupancyStatus") : "",
          photos,
          photo,
          unitPageSlug: unit ? getTextFromDescendants(unit, "UnitPageSlug") : "",
        };
      });
    }

    const physicalProperties = allNodes.filter(
      (el) => el.localName === "PhysicalProperty",
    );

    if (physicalProperties.length > 0) {
      const mitsListings = [];

      physicalProperties.forEach((physicalProperty) => {
        const property = getFirstChildByLocalName(physicalProperty, "Property");
        if (!property) return;

        const propertyIdNode = getFirstChildByLocalName(property, "PropertyID");
        const infoNode = getFirstChildByLocalName(property, "Information");
        const unitNodes = getChildrenByLocalName(property, "ILS_Unit");

        const propertyName = propertyIdNode
          ? getTextFromDescendants(propertyIdNode, "MarketingName")
          : "";
        const address1 = propertyIdNode
          ? getTextFromDescendants(propertyIdNode, "AddressLine1")
          : "";
        const city = propertyIdNode
          ? getTextFromDescendants(propertyIdNode, "City")
          : "";
        const region = propertyIdNode
          ? getTextFromDescendants(propertyIdNode, "State")
          : "";
        const postal = propertyIdNode
          ? getTextFromDescendants(propertyIdNode, "PostalCode")
          : "";
        const website = propertyIdNode
          ? getTextFromDescendants(propertyIdNode, "WebSite")
          : "";
        const email = propertyIdNode
          ? getTextFromDescendants(propertyIdNode, "Email")
          : "";
        const description = infoNode
          ? getTextFromDescendants(infoNode, "LongDescription")
          : "";

        unitNodes.forEach((unitNode) => {
          const availabilityNode = getFirstChildByLocalName(unitNode, "Availability");
          const vacateDateNode = availabilityNode
            ? getFirstChildByLocalName(availabilityNode, "VacateDate")
            : null;

          let availableDate = "";
          if (vacateDateNode) {
            const year = vacateDateNode.getAttribute("Year") || "";
            const month = (vacateDateNode.getAttribute("Month") || "").padStart(2, "0");
            const day = (vacateDateNode.getAttribute("Day") || "").padStart(2, "0");

            if (year && month && day) {
              availableDate = `${year}-${month}-${day}`;
            }
          }

          const unitUrl = availabilityNode
            ? getTextFromDescendants(availabilityNode, "UnitAvailabilityURL")
            : "";

          let unitNumber = "";
          if (unitUrl) {
            const match = unitUrl.match(/unit-([^/?#]+)/i);
            if (match) {
              unitNumber = match[1];
            }
          }

          const photos = [...unitNode.getElementsByTagName("*")]
            .filter((el) => el.localName === "Photo")
            .map((el) => el.textContent?.trim() || "")
            .filter(Boolean);

          const photo = photos[0] || "";

          mitsListings.push({
            propertyName,
            address1,
            city,
            region,
            postal,
            description,
            website,
            buildingType: "",
            phone: "",
            email,

            unitNumber,
            unitType: "",
            floorplanName: getTextFromDescendants(unitNode, "FloorplanName") || "",
            beds: getTextFromDescendants(unitNode, "Bedrooms") || "",
            baths: getTextFromDescendants(unitNode, "Bathrooms") || "",
            sqft: getTextFromDescendants(unitNode, "SquareFeet") || "",
            rent: getTextFromDescendants(unitNode, "MarketRent") || "",
            available: "true",
            availableDate,
            occupancyStatus: "",
            photo,
            photos,
            unitPageSlug: unitUrl,
          });
        });
      });

      return mitsListings;
    }

    return [];
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

    const allNodes = [...doc.getElementsByTagName("*")];

    const livProperties = allNodes.filter((el) => el.localName === "Property").length;
    const livUnits = allNodes.filter((el) => el.localName === "Unit").length;
    const livFloorplans = allNodes.filter((el) => el.localName === "Floorplan").length;

    const mitsPhysicalProperties = allNodes.filter(
      (el) => el.localName === "PhysicalProperty",
    ).length;

    const mitsUnits = allNodes.filter((el) => el.localName === "ILS_Unit").length;

    return {
      properties: mitsPhysicalProperties || livProperties,
      floorplans: livFloorplans,
      units: mitsUnits || livUnits,
    };
  }, [xmlText]);

  return (
    <div className="app">
      <div className="container">
        <div className="card header">
          <div>
            <h1>App Intelligence.ca <br></br><br></br>XML Feed Viewer</h1>
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
              Proxy mode is on. Replace the placeholder proxy URL in the code
              with your deployed proxy endpoint.
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
              {listings.map((listing, index) => {
                const imageKey = `${listing.propertyName}-${listing.unitNumber}-${index}`;
                const currentImage = selectedImages[imageKey] || listing.photo;

                return (
                  <div
                    className={`listing-card ${listing.photo ? "has-image" : "no-image"}`}
                    key={imageKey}
                  >
                    {listing.photo && (
                      <div className="listing-media">
                        <div className="listing-image-wrap">
                          <img
                            src={currentImage}
                            alt={`${listing.propertyName} Unit ${listing.unitNumber}`}
                            className="listing-image"
                          />
                        </div>

                        {listing.photos?.length > 1 && (
                          <div className="listing-thumbs">
                            {listing.photos.map((img, imgIndex) => (
                              <img
                                key={imgIndex}
                                src={img}
                                alt={`${listing.propertyName} thumbnail ${imgIndex + 1}`}
                                className={`listing-thumb ${currentImage === img ? "active" : ""}`}
                                onClick={() =>
                                  setSelectedImages((prev) => ({
                                    ...prev,
                                    [imageKey]: img,
                                  }))
                                }
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="listing-content">
                      <h2>{listing.propertyName || "Unnamed Property"}</h2>

                      <p className="address">
                        {[listing.address1, listing.city, listing.region, listing.postal]
                          .filter(Boolean)
                          .join(", ")}
                      </p>

                      <div className="listing-meta">
                        {listing.unitNumber && <span>Unit {listing.unitNumber}</span>}
                        {listing.beds && <span>{listing.beds} Beds</span>}
                        {listing.baths && <span>{listing.baths} Baths</span>}
                        {listing.sqft && <span>{listing.sqft} SF</span>}
                        {listing.buildingType && <span>{listing.buildingType}</span>}
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

                      {(listing.unitPageSlug || listing.website) && (
                        <a
                          href={
                            listing.unitPageSlug
                              ? listing.unitPageSlug.startsWith("http")
                                ? listing.unitPageSlug
                                : `https://www.wallfinancialcorporation.com/units/${listing.unitPageSlug}`
                              : listing.website
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="listing-button"
                        >
                          View Property
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
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