import { useMemo, useState } from "react";
import "./App.css";

const TITLE_KEYS = ["title", "name", "marketingname", "label", "id", "guid", "loc"];
const SUBTITLE_KEYS = ["type", "category", "status", "city", "region", "state"];
const DESCRIPTION_KEYS = ["description", "summary", "longdescription", "content"];
const LINK_KEYS = ["link", "url", "website", "loc", "unitavailabilityurl"];
const IMAGE_KEYS = ["image", "photo", "thumbnail", "src", "logo"];

export default function XmlFeedViewerApp() {
  const [feedUrl, setFeedUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [useProxy, setUseProxy] = useState(false);

  const [xmlText, setXmlText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingNotice, setLoadingNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState("cards");
  const [showWelcome, setShowWelcome] = useState(true);

  async function loadFeed() {
    setLoading(true);
    setLoadingNotice("Connecting to the feed...");
    setError("");
    setCopied(false);

    const wakeTimer = window.setTimeout(() => {
      setLoadingNotice(
        "The feed service may be waking up. The first request can take a few seconds.",
      );
    }, 2000);

    try {
      if (!feedUrl.trim()) {
        throw new Error("Please enter a feed URL.");
      }

      const proxyBase =
        import.meta.env.VITE_PROXY_URL || "http://localhost:10000/proxy-feed";

      const headers = {};
      if (username || password) {
        headers.Authorization = "Basic " + btoa(`${username}:${password}`);
      }

      let text = "";

      if (useProxy) {
        const proxyUrl =
          `${proxyBase}?url=${encodeURIComponent(feedUrl)}` +
          `&username=${encodeURIComponent(username)}` +
          `&password=${encodeURIComponent(password)}`;

        const proxyRes = await fetch(proxyUrl);

        if (!proxyRes.ok) {
          throw new Error(`Proxy failed: ${proxyRes.status} ${proxyRes.statusText}`);
        }

        text = await proxyRes.text();
      } else {
        try {
          const directRes = await fetch(feedUrl, { headers });

          if (!directRes.ok) {
            throw new Error(`Direct fetch failed: ${directRes.status} ${directRes.statusText}`);
          }

          text = await directRes.text();
        // eslint-disable-next-line no-unused-vars
        } catch (err) {
          const proxyUrl =
            `${proxyBase}?url=${encodeURIComponent(feedUrl)}` +
            `&username=${encodeURIComponent(username)}` +
            `&password=${encodeURIComponent(password)}`;

          const proxyRes = await fetch(proxyUrl);

          if (!proxyRes.ok) {
            throw new Error(`Proxy failed: ${proxyRes.status} ${proxyRes.statusText}`);
          }

          text = await proxyRes.text();
        }
      }

      setXmlText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
      setXmlText("");
    } finally {
      window.clearTimeout(wakeTimer);
      setLoadingNotice("");
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

  const xmlDoc = useMemo(() => {
    if (!xmlText) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");
    const parserError = doc.querySelector("parsererror");

    if (parserError) return null;
    return doc;
  }, [xmlText]);

  const analysis = useMemo(() => {
    if (!xmlDoc) {
      return {
        profile: null,
        records: [],
        summary: [],
      };
    }

    const allNodes = [...xmlDoc.getElementsByTagName("*")];

    const livListings = allNodes.filter((el) => el.localName === "Listing");
    if (livListings.length > 0) {
      const records = buildLivRecords(xmlDoc);

      return {
        profile: {
          rootName: xmlDoc.documentElement.localName,
          detectedSchema: "liv",
          repeatedCandidates: [
            {
              key: "liv-listing",
              tagName: "Listing",
              path: `/${xmlDoc.documentElement.localName}/Listing`,
              count: livListings.length,
            },
          ],
          totalNodes: allNodes.length,
        },
        records,
        summary: [
          { label: "Schema", value: "LIV Real Estate" },
          { label: "Root", value: xmlDoc.documentElement.localName },
          { label: "Listings", value: records.length },
          { label: "Nodes", value: allNodes.length },
        ],
      };
    }

    const physicalProperties = allNodes.filter(
      (el) => el.localName === "PhysicalProperty",
    );

    if (physicalProperties.length > 0) {
      const records = buildMitsRecords(xmlDoc);

      return {
        profile: {
          rootName: xmlDoc.documentElement.localName,
          detectedSchema: "mits",
          repeatedCandidates: [
            {
              key: "mits-unit",
              tagName: "ILS_Unit",
              path: `/${xmlDoc.documentElement.localName}/PhysicalProperty/Property/ILS_Unit`,
              count: records.length,
            },
          ],
          totalNodes: allNodes.length,
        },
        records,
        summary: [
          { label: "Schema", value: "MITS Real Estate" },
          { label: "Root", value: xmlDoc.documentElement.localName },
          { label: "Units", value: records.length },
          { label: "Nodes", value: allNodes.length },
        ],
      };
    }

    const profile = buildGenericProfile(xmlDoc);
    const records = buildGenericRecords(xmlDoc, profile);

    return {
      profile,
      records,
      summary: [
        { label: "Schema", value: "Generic XML" },
        { label: "Root", value: profile.rootName },
        { label: "Records", value: records.length },
        { label: "Nodes", value: profile.totalNodes },
      ],
    };
  }, [xmlDoc]);

  const tableColumns = useMemo(() => {
    const keySet = new Set();

    analysis.records.slice(0, 25).forEach((record) => {
      record.fields.forEach((field) => keySet.add(field.key));
    });

    const maxFields = analysis.profile?.detectedSchema === "mits" ? 30 : 8;

    return ["title", "subtitle", ...Array.from(keySet).slice(0, maxFields)];
  }, [analysis.profile?.detectedSchema, analysis.records]);

  return (
    <div className="app">
      <style>{`
        @keyframes inspector-spin {
          to { transform: rotate(360deg); }
        }

        .inspector-spinner {
          width: 0.9rem;
          height: 0.9rem;
          display: inline-block;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          margin-right: 0.45rem;
          vertical-align: -0.12rem;
          animation: inspector-spin 0.75s linear infinite;
        }
      `}</style>

      {showWelcome && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "1rem",
            background: "rgba(2, 6, 23, 0.88)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="card"
            style={{
              width: "min(560px, 100%)",
              textAlign: "center",
              padding: "2rem",
            }}
          >
            <img
              src="/icon.png"
              alt=""
              width="88"
              height="88"
              style={{ borderRadius: "1rem", marginBottom: "1rem" }}
            />
            <p style={{ margin: 0 }}>App Intelligence.ca</p>
            <h1 id="welcome-title">XML Feed Inspector</h1>
            <p>
              Inspect XML feeds before they reach listing platforms. Review
              properties, units, images, availability, promotions, and raw feed
              data in one place.
            </p>
            <p>
              This viewer does not persist your feed data. It only retrieves and
              displays the feed for inspection. Use at your own risk.
            </p>
            <button type="button" onClick={() => setShowWelcome(false)}>
              Open Inspector
            </button>
          </div>
        </div>
      )}

      <div className="container">
        <header className="card header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <img
              src="/icon.png"
              alt="XML Feed Inspector"
              width="64"
              height="64"
              style={{ borderRadius: "0.8rem", flex: "0 0 auto" }}
            />

            <div>
              <a
                href="https://appintelligence.ca"
                target="_blank"
                rel="noreferrer"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                <strong>App Intelligence.ca</strong>
              </a>
              <h1 style={{ margin: "0.15rem 0" }}>XML Feed Inspector</h1>
              <p style={{ margin: 0 }}>
                A feed preflight tool for inspecting smart cards, tables, XML
                structure, and raw source data before syndication.
              </p>
            </div>
          </div>

          <div className="stats">
            {analysis.summary.length === 0 ? (
              <>
                <StatCard label="Schema" value="-" />
                <StatCard label="Records" value={0} />
                <StatCard label="Nodes" value={0} />
                <StatCard label="Root" value="-" />
              </>
            ) : (
              analysis.summary.map((item) => (
                <StatCard key={item.label} label={item.label} value={item.value} />
              ))
            )}
          </div>
        </header>

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
              {loading ? (
                <>
                  <span className="inspector-spinner" aria-hidden="true" />
                  Loading Feed...
                </>
              ) : (
                "Load Feed"
              )}
            </button>

            <button onClick={copyXml} disabled={!xmlText}>
              {copied ? "Copied" : "Copy XML"}
            </button>
          </div>

          {loading && (
            <p
              role="status"
              aria-live="polite"
              style={{ marginBottom: 0 }}
            >
              {loadingNotice}
            </p>
          )}

          <div className="links">
            {feedUrl && (
              <a href={feedUrl} target="_blank" rel="noreferrer">
                Open raw feed
              </a>
            )}
          </div>

          {useProxy && (
            <p className="proxy-note">
              Proxy mode is enabled. The feed will be requested through your proxy endpoint.
            </p>
          )}

          {error && <div className="error">{error}</div>}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Choose View</h2>
            <span>{analysis.records.length} records</span>
          </div>

          <div className="view-card-grid">
            <ViewCard
              title="Smart Cards"
              description="Best for repeated records like listings, products, articles, and feed entries."
              active={viewMode === "cards"}
              onClick={() => setViewMode("cards")}
            />
            <ViewCard
              title="Table View"
              description="Useful when the XML repeats similar fields across many records."
              active={viewMode === "table"}
              onClick={() => setViewMode("table")}
            />
            <ViewCard
              title="Tree Explorer"
              description="See the XML structure and repeated node candidates at a glance."
              active={viewMode === "tree"}
              onClick={() => setViewMode("tree")}
            />
            <ViewCard
              title="Raw XML"
              description="Inspect the original feed exactly as loaded."
              active={viewMode === "raw"}
              onClick={() => setViewMode("raw")}
            />
          </div>
        </div>

        {viewMode === "cards" && (
          <div className="card">
            <div className="card-header">
              <h2>Preview</h2>
              <span>{analysis.profile?.detectedSchema || "none"}</span>
            </div>

            {analysis.records.length === 0 ? (
              <p>No data loaded</p>
            ) : (
              <div className="listing-grid">
                {analysis.records.map((record) => (
                  <div
                    className={`listing-card ${record.image ? "has-image" : "no-image"}`}
                    key={record.id}
                  >
                    {record.image && (
                      <ListingMedia
                        key={`${record.id}-${record.image}`}
                        title={record.title}
                        image={record.image}
                        images={record.images}
                      />
                    )}

                    <div className="listing-content">
                      <h2>{record.title || "Untitled Record"}</h2>

                      {record.subtitle && (
                        <p className="address">{record.subtitle}</p>
                      )}

                      {record.description && (
                        <p className="listing-description">{record.description}</p>
                      )}

                      <div className="generic-fields">
                        {record.fields
                          .slice(
                            0,
                            record.tagName === "ILS_Unit"
                              ? record.fields.length
                              : 8,
                          )
                          .map((field) => (
                          <div
                            className="generic-field"
                            key={`${record.id}-${field.key}`}
                          >
                            <strong>{field.key}:</strong> {field.value}
                          </div>
                          ))}
                      </div>

                      {record.link && (
                        <a
                          href={record.link}
                          target="_blank"
                          rel="noreferrer"
                          className="listing-button"
                        >
                          {record.tagName === "ILS_Unit" ? "View Unit" : "Read Article"}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === "table" && (
          <div className="card">
            <h2>Table View</h2>

            {analysis.records.length === 0 ? (
              <p>No data loaded</p>
            ) : (
              <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {tableColumns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {analysis.records.map((record) => {
                    const fieldMap = Object.fromEntries(
                      record.fields.map((field) => [field.key, field.value]),
                    );

                    return (
                      <tr key={record.id}>
                        {tableColumns.map((column) => (
                          <td key={`${record.id}-${column}`}>
                            {column === "title"
                              ? record.title
                              : column === "subtitle"
                                ? record.subtitle || ""
                                : fieldMap[column] || ""}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </div>
        )}

        {viewMode === "tree" && (
          <div className="card">
            <div className="card-header">
              <h2>Tree Explorer</h2>
              <span>{analysis.profile?.rootName || "No root"}</span>
            </div>

            {!analysis.profile ? (
              <p>No data loaded</p>
            ) : (
              <>
                <div className="generic-fields">
                  <div className="generic-field">
                    <strong>Detected schema:</strong> {analysis.profile.detectedSchema}
                  </div>
                  <div className="generic-field">
                    <strong>Total nodes:</strong> {analysis.profile.totalNodes}
                  </div>
                </div>

                <h3>Repeated Node Candidates</h3>

                <div className="listing-grid compact-grid">
                  {analysis.profile.repeatedCandidates.map((candidate) => (
                    <div className="listing-card no-image" key={candidate.key}>
                      <div className="listing-content">
                        <h2>{candidate.tagName}</h2>
                        <p className="address">{candidate.path}</p>
                        <div className="listing-meta">
                          <span>{candidate.count} records</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {viewMode === "raw" && (
          <div className="card">
            <div className="card-header">
              <h2>Raw XML</h2>
              <span>{xmlText ? `${xmlText.length} chars` : "No feed loaded"}</span>
            </div>

            <div className="xml-box">
              {!xmlText ? (
                <p>Load a feed to view XML</p>
              ) : (
                <textarea
                  value={xmlText}
                  readOnly
                  spellCheck="false"
                  aria-label="Raw XML feed"
                  style={{
                    width: "100%",
                    minHeight: "70vh",
                    resize: "vertical",
                    padding: "1rem",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "inherit",
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                    fontSize: "0.8rem",
                    lineHeight: 1.5,
                    whiteSpace: "pre",
                  }}
                />
              )}
            </div>
          </div>
        )}

        <footer
          className="card"
          style={{ textAlign: "center", marginTop: "1rem" }}
        >
          <p>
            <strong>Use at your own risk.</strong>
          </p>
          <p>
            This viewer does not persist your feed data. It only retrieves and
            displays the feed for inspection.
          </p>
          <p>
            Provided by{" "}
            <a
              href="https://appintelligence.ca"
              target="_blank"
              rel="noreferrer"
            >
              App Intelligence.ca
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

function buildLivRecords(doc) {
  const allNodes = [...doc.getElementsByTagName("*")];
  const livListings = allNodes.filter((el) => el.localName === "Listing");

  return livListings.map((item, index) => {
    const property = getFirstChildByLocalName(item, "Property");
    const unit = getFirstChildByLocalName(item, "Unit");

    const photos = unit
      ? [...unit.getElementsByTagName("*")]
          .filter((el) => el.localName === "Photo")
          .map((el) => el.textContent?.trim() || "")
          .filter(Boolean)
      : [];

    const propertyName = property ? getTextFromDescendants(property, "Name") : "";
    const address1 = property ? getTextFromDescendants(property, "Address1") : "";
    const city = property ? getTextFromDescendants(property, "City") : "";
    const region = property ? getTextFromDescendants(property, "Region") : "";
    const postal = property ? getTextFromDescendants(property, "Postal") : "";
    const description = property
      ? getTextFromDescendants(property, "Description")
      : "";
    const unitNumber = unit ? getTextFromDescendants(unit, "UnitNumber") : "";
    const beds = unit ? getTextFromDescendants(unit, "Bedrooms") : "";
    const baths = unit ? getTextFromDescendants(unit, "Bathrooms") : "";
    const sqft = unit
      ? getTextFromDescendants(unit, "Max") || getTextFromDescendants(unit, "Min")
      : "";
    const rent = unit ? getTextFromDescendants(unit, "Rent") : "";
    const link = unit ? getTextFromDescendants(unit, "UnitPageSlug") : "";

    return {
      id: `liv-${index}`,
      tagName: "Listing",
      path: `/${doc.documentElement.localName}/Listing`,
      title: propertyName || `Listing ${index + 1}`,
      subtitle: [address1, city, region, postal].filter(Boolean).join(", "),
      description,
      image: photos[0] || undefined,
      link: link
        ? link.startsWith("http")
          ? link
          : `https://www.wallfinancialcorporation.com/units/${link}`
        : undefined,
      fields: [
        { key: "unit", value: unitNumber },
        { key: "beds", value: beds },
        { key: "baths", value: baths },
        { key: "sqft", value: sqft },
        { key: "rent", value: rent },
      ].filter((field) => field.value),
      raw: {
        propertyName,
        address1,
        city,
        region,
        postal,
        unitNumber,
        beds,
        baths,
        sqft,
        rent,
        photos,
      },
    };
  });
}

function buildMitsRecords(doc) {
  const allNodes = [...doc.getElementsByTagName("*")];
  const physicalProperties = allNodes.filter(
    (el) => el.localName === "PhysicalProperty",
  );
  const records = [];

  const propertyNodes = physicalProperties.flatMap((physicalProperty) =>
    getChildrenByLocalName(physicalProperty, "Property"),
  );

  propertyNodes.forEach((property, propertyIndex) => {

    const propertyIdNode = getFirstChildByLocalName(property, "PropertyID");
    const infoNode = getFirstChildByLocalName(property, "Information");
    const unitNodes = getChildrenByLocalName(property, "ILS_Unit");

    const propertyName = propertyIdNode
      ? getTextFromDescendants(propertyIdNode, "MarketingName")
      : "";
    const address1 = propertyIdNode
      ? getTextFromDescendants(propertyIdNode, "AddressLine1")
      : "";
    const city = propertyIdNode ? getTextFromDescendants(propertyIdNode, "City") : "";
    const region = propertyIdNode
      ? getTextFromDescendants(propertyIdNode, "State")
      : "";
    const postal = propertyIdNode
      ? getTextFromDescendants(propertyIdNode, "PostalCode")
      : "";
    const description = infoNode
      ? getTextFromDescendants(infoNode, "LongDescription")
      : "";
    const propertyId = property.getAttribute("IDValue") || "";
    const propertyPromotion = getTextFromDescendants(property, "Promotional");

    unitNodes.forEach((unitNode, unitIndex) => {
      const availabilityNode = getFirstChildByLocalName(unitNode, "Availability");
      const unitUrl = availabilityNode
        ? getTextFromDescendants(availabilityNode, "UnitAvailabilityURL")
        : "";

      const unitEl = getFirstChildByLocalName(
        getFirstChildByLocalName(unitNode, "Units") || unitNode,
        "Unit",
      );

      const identificationNodes = unitEl
        ? [...unitEl.getElementsByTagName("*")].filter(
            (el) => el.localName === "Identification",
          )
        : [];

      const unitId =
        unitNode.getAttribute("IDValue") ||
        identificationNodes
          .find((el) => el.getAttribute("IDType") === "ILS_UnitID")
          ?.getAttribute("IDValue") ||
        "";
      const floorplanId =
        identificationNodes
          .find((el) => el.getAttribute("IDType") === "FloorPlanID")
          ?.getAttribute("IDValue") || "";

      const unitNumber = unitEl
        ? getTextFromDescendants(unitEl, "MarketingName")
        : "";
      const beds = unitEl ? getTextFromDescendants(unitEl, "UnitBedrooms") : "";
      const baths = unitEl ? getTextFromDescendants(unitEl, "UnitBathrooms") : "";
      const minSqft = unitEl
        ? getTextFromDescendants(unitEl, "MinSquareFeet")
        : "";
      const maxSqft = unitEl
        ? getTextFromDescendants(unitEl, "MaxSquareFeet")
        : "";
      const sqft = maxSqft || minSqft;
      const rent = unitEl ? getTextFromDescendants(unitEl, "MarketRent") : "";
      const unitRent = unitEl ? getTextFromDescendants(unitEl, "UnitRent") : "";
      const featured = unitEl ? getTextFromDescendants(unitEl, "Featured") : "";
      const unitType = unitEl ? getTextFromDescendants(unitEl, "UnitType") : "";
      const leasedStatus = unitEl
        ? getTextFromDescendants(unitEl, "UnitLeasedStatus")
        : "";
      const occupancyStatus = unitEl
        ? getTextFromDescendants(unitEl, "UnitOccupancyStatus")
        : "";
      const floorplanName = unitEl
        ? getTextFromDescendants(unitEl, "FloorplanName")
        : "";
      const buildingName = unitEl
        ? getTextFromDescendants(unitEl, "BuildingName")
        : "";

      const effectiveRentNode = getFirstChildByLocalName(unitNode, "EffectiveRent");
      const effectiveRentMin = effectiveRentNode?.getAttribute("Min") || "";
      const effectiveRentMax = effectiveRentNode?.getAttribute("Max") || "";
      const effectiveRent = effectiveRentMin || effectiveRentMax;

      const vacateDate = availabilityNode
        ? formatMitsDate(getFirstChildByLocalName(availabilityNode, "VacateDate"))
        : "";
      const madeReadyDate = availabilityNode
        ? formatMitsDate(getFirstChildByLocalName(availabilityNode, "MadeReadyDate"))
        : "";
      const vacancyClass = availabilityNode
        ? getTextFromDescendants(availabilityNode, "VacancyClass")
        : "";

      const files = [...unitNode.getElementsByTagName("*")]
        .filter((el) => el.localName === "File")
        .map((fileNode) => ({
          fileType: getTextFromDescendants(fileNode, "FileType"),
          src: getTextFromDescendants(fileNode, "Src"),
          rank: Number(getTextFromDescendants(fileNode, "Rank") || "999"),
        }))
        .filter((f) => f.src);

      const sortedFiles = files.sort((a, b) => a.rank - b.rank);
      const photos = sortedFiles
        .filter((f) => f.fileType === "Photo")
        .map((f) => f.src);
      const images = sortedFiles.map((file) => ({
        src: file.src,
        label: file.fileType || "Image",
        rank: file.rank,
      }));

      records.push({
        id: `mits-${propertyIndex}-${unitIndex}`,
        tagName: "ILS_Unit",
        path: `/${doc.documentElement.localName}/PhysicalProperty/Property/ILS_Unit`,
        title: propertyName || `Property ${propertyIndex + 1}`,
        subtitle: [address1, city, region, postal].filter(Boolean).join(", "),
        description,
        image: photos[0] || images[0]?.src || undefined,
        images,
        link: unitUrl || undefined,
        fields: [
          { key: "unit", value: unitNumber },
          { key: "property ID", value: propertyId },
          { key: "unit ID", value: unitId },
          { key: "floorplan ID", value: floorplanId },
          { key: "unit type", value: unitType },
          { key: "beds", value: beds },
          { key: "baths", value: baths },
          { key: "min sqft", value: minSqft },
          { key: "max sqft", value: maxSqft },
          { key: "unit rent", value: unitRent },
          { key: "market rent", value: rent },
          { key: "effective rent min", value: effectiveRentMin },
          { key: "effective rent max", value: effectiveRentMax },
          { key: "featured", value: featured },
          { key: "lease status", value: leasedStatus },
          { key: "occupancy", value: occupancyStatus },
          { key: "vacate date", value: vacateDate },
          { key: "made-ready date", value: madeReadyDate },
          { key: "vacancy class", value: vacancyClass },
          { key: "floorplan", value: floorplanName },
          { key: "building", value: buildingName },
          { key: "promotion", value: propertyPromotion || "None" },
          { key: "images", value: images.length ? String(images.length) : "" },
        ].filter((field) => field.value),
        raw: {
          propertyName,
          address1,
          city,
          region,
          postal,
          propertyId,
          propertyPromotion,
          unitNumber,
          beds,
          baths,
          sqft,
          minSqft,
          maxSqft,
          rent,
          unitRent,
          effectiveRent,
          effectiveRentMin,
          effectiveRentMax,
          featured,
          unitType,
          leasedStatus,
          occupancyStatus,
          floorplanName,
          buildingName,
          unitId,
          floorplanId,
          vacateDate,
          madeReadyDate,
          vacancyClass,
          photos,
          images,
        },
      });
    });
  });

  return records;
}

function formatMitsDate(node) {
  if (!node) return "";

  const year = node.getAttribute("Year");
  const month = node.getAttribute("Month");
  const day = node.getAttribute("Day");

  if (!year || !month || !day) return "";

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildGenericProfile(doc) {
  const root = doc.documentElement;
  const allNodes = [...doc.getElementsByTagName("*")];
  const counts = new Map();

  allNodes.forEach((node) => {
    const path = getNodePath(node);
    const key = `${path}::${node.localName}`;
    const entry = counts.get(key);

    if (entry) {
      entry.count += 1;
    } else {
      counts.set(key, {
        tagName: node.localName,
        path,
        count: 1,
        sampleNode: node,
      });
    }
  });

  const repeatedCandidates = [...counts.values()]
    .filter((entry) => entry.count > 1 && !isBadGenericCandidate(entry))
    .map((entry, index) => ({
      key: `${entry.tagName}-${index}`,
      tagName: entry.tagName,
      path: entry.path,
      count: entry.count,
      score: scoreGenericCandidate(entry),
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 8);

  return {
    rootName: root.localName,
    detectedSchema: "generic",
    repeatedCandidates,
    totalNodes: allNodes.length,
  };
}

function buildGenericRecords(doc, profile) {
  const bestCandidate = profile.repeatedCandidates[0];
  if (!bestCandidate) return [];

  const nodes = [...doc.getElementsByTagName("*")].filter(
    (node) =>
      node.localName === bestCandidate.tagName &&
      getNodePath(node) === bestCandidate.path,
  );

  return nodes.slice(0, 200).map((node, index) => {
    const flat = flattenInterestingFields(node);
    const title =
      pickFirstValue(flat, TITLE_KEYS) || `${node.localName} ${index + 1}`;

    const rawSubtitle = pickFirstValue(flat, SUBTITLE_KEYS);
    const subtitle =
      rawSubtitle &&
      rawSubtitle.trim().toLowerCase() !== title.trim().toLowerCase()
        ? rawSubtitle
        : undefined;

    let description = pickFirstValue(flat, DESCRIPTION_KEYS);

    const encoded = flat["content_encoded"] || flat["encoded"] || flat["content"];
    if (encoded) {
      const temp = document.createElement("div");
      temp.innerHTML = Array.isArray(encoded) ? encoded[0] : encoded;

      const cleanText = temp.textContent || temp.innerText || "";
      if (cleanText.length > 100) {
        description = cleanText.slice(0, 300) + "...";
      }
    }

    const link = findBestLink(flat);
    const image = findBestImage(flat);

    return {
      id: `generic-${bestCandidate.tagName}-${index}`,
      tagName: node.localName,
      path: bestCandidate.path,
      title,
      subtitle,
      description,
      image,
      link,
      fields: Object.entries(flat)
        .filter(([key, value]) => {
          const normalized = key.toLowerCase();

          if (!value) return false;

          if (
            TITLE_KEYS.includes(normalized) ||
            SUBTITLE_KEYS.includes(normalized) ||
            DESCRIPTION_KEYS.includes(normalized) ||
            LINK_KEYS.includes(normalized) ||
            IMAGE_KEYS.includes(normalized)
          ) {
            return false;
          }

          if (
            normalized.endsWith("_domain") ||
            normalized.endsWith("_rel") ||
            normalized.endsWith("_ispermalink") ||
            normalized.endsWith("_height") ||
            normalized.endsWith("_width") ||
            normalized.endsWith("_medium") ||
            normalized.endsWith("_type") ||
            normalized.endsWith("_length")
          ) {
            return false;
          }

          if (
            normalized.includes("content_url") ||
            normalized.includes("link_href") ||
            normalized.includes("image_url") ||
            normalized.includes("photo_url") ||
            normalized.includes("thumbnail_url") ||
            normalized.includes("enclosure") ||
            normalized.includes("media")
          ) {
            return false;
          }

          return true;
        })
        .slice(0, 8)
        .map(([key, value]) => ({
          key: formatFieldLabel(key),
          value: Array.isArray(value) ? value.join(", ") : value,
        })),
      raw: flat,
    };
  });
}

function flattenInterestingFields(node) {
  const result = {};

  [...node.children].forEach((child) => {
    const key = child.localName;

    if (child.attributes && child.attributes.length > 0) {
      [...child.attributes].forEach((attr) => {
        const attrKey = `${key}_${attr.name}`;
        const attrValue = (attr.value || "").trim();
        if (!attrValue) return;

        if (result[attrKey]) {
          const current = result[attrKey];
          result[attrKey] = Array.isArray(current)
            ? [...current, attrValue]
            : [current, attrValue];
        } else {
          result[attrKey] = attrValue;
        }
      });
    }

    if (child.children.length === 0) {
      const value = child.textContent?.trim() || "";

      if (value) {
        if (result[key]) {
          const current = result[key];
          result[key] = Array.isArray(current)
            ? [...current, value]
            : [current, value];
        } else {
          result[key] = value;
        }
      }

      return;
    }

    const nestedText = [...child.children]
      .filter((grandchild) => grandchild.children.length === 0)
      .map((grandchild) => grandchild.textContent?.trim() || "")
      .filter(Boolean)
      .join(" • ");

    if (nestedText) {
      result[key] = nestedText;
    }
  });

  return result;
}

function pickFirstValue(flat, keys) {
  for (const desired of keys) {
    for (const [key, value] of Object.entries(flat)) {
      if (key.toLowerCase() === desired) {
        return Array.isArray(value) ? value[0] : value;
      }
    }
  }
  return undefined;
}

function findBestLink(flat) {
  const priorityKeys = ["link", "guid", "url", "website", "loc", "link_href"];

  for (const desired of priorityKeys) {
    for (const [key, value] of Object.entries(flat)) {
      if (key.toLowerCase() === desired) {
        const values = Array.isArray(value) ? value : [value];
        const valid = values.find(
          (entry) => typeof entry === "string" && /^https?:\/\//i.test(entry),
        );
        if (valid) return valid;
      }
    }
  }

  for (const value of Object.values(flat)) {
    const values = Array.isArray(value) ? value : [value];
    const valid = values.find(
      (entry) => typeof entry === "string" && /^https?:\/\//i.test(entry),
    );
    if (valid) return valid;
  }

  return undefined;
}

function findBestImage(flat) {
  for (const [key, value] of Object.entries(flat)) {
    const values = Array.isArray(value) ? value : [value];
    const normalizedKey = key.toLowerCase();

    const imageLike = values.find(
      (entry) =>
        typeof entry === "string" &&
        /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(entry),
    );

    const isImageKey =
      IMAGE_KEYS.includes(normalizedKey) ||
      normalizedKey.includes("image") ||
      normalizedKey.includes("photo") ||
      normalizedKey.includes("thumbnail") ||
      normalizedKey.includes("media") ||
      normalizedKey.includes("enclosure") ||
      normalizedKey.endsWith("_url") ||
      normalizedKey.includes("content_url");

    if (isImageKey && imageLike) return imageLike;
    if (imageLike) return imageLike;
  }

  return undefined;
}

function formatFieldLabel(key) {
  const map = {
    creator: "Author",
    pubDate: "Published",
    source: "Source",
    source_url: "Source URL",
    credit: "Credit",
  };

  if (map[key]) return map[key];

  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getChildrenByLocalName(node, name) {
  return [...node.children].filter((child) => child.localName === name);
}

function getFirstChildByLocalName(node, name) {
  return [...node.children].find((child) => child.localName === name) || null;
}

function getTextFromDescendants(node, name) {
  const found = [...node.getElementsByTagName("*")].find(
    (el) => el.localName === name,
  );
  return found?.textContent?.trim() || "";
}

function getNodePath(node) {
  const parts = [];
  let current = node;

  while (current && current.nodeType === 1) {
    parts.unshift(current.localName);
    current = current.parentElement;
  }

  return `/${parts.join("/")}`;
}

function isTriviallySmallNode(tagName) {
  const small = new Set([
    "filetype",
    "rank",
    "src",
    "city",
    "state",
    "postalcode",
    "postal",
    "name",
    "title",
    "link",
    "category",
    "guid",
    "pubdate",
    "creator",
    "description",
    "url",
    "loc",
  ]);

  return small.has(tagName.toLowerCase());
}

function isBadGenericCandidate(entry) {
  const node = entry.sampleNode;
  if (!node) return true;

  const childElements = [...node.children];
  const hasElementChildren = childElements.length > 0;
  const hasAttributes = node.attributes && node.attributes.length > 0;
  const leafText = (node.textContent || "").trim();

  if (isTriviallySmallNode(entry.tagName)) return true;
  if (!hasElementChildren && !hasAttributes) return true;
  if (!hasElementChildren && leafText.length < 80) return true;

  return false;
}

function scoreGenericCandidate(entry) {
  const node = entry.sampleNode;
  if (!node) return 0;

  const childElements = [...node.children];
  const childNames = new Set(
    childElements.map((child) => child.localName.toLowerCase()),
  );

  const hasTitleLike = [...childNames].some((name) => TITLE_KEYS.includes(name));
  const hasDescriptionLike = [...childNames].some((name) =>
    DESCRIPTION_KEYS.includes(name),
  );
  const hasLinkLike = [...childNames].some((name) => LINK_KEYS.includes(name));
  const hasMediaLike = [...childNames].some(
    (name) =>
      IMAGE_KEYS.includes(name) ||
      name.includes("media") ||
      name.includes("image") ||
      name.includes("enclosure"),
  );

  let score = 0;
  score += entry.count;
  score += childElements.length * 4;
  if (hasTitleLike) score += 30;
  if (hasDescriptionLike) score += 20;
  if (hasLinkLike) score += 20;
  if (hasMediaLike) score += 12;
  if (node.attributes && node.attributes.length > 0) score += 4;

  return score;
}

function StatCard({ label, value }) {
  return (
    <div className="stat">
      <div>{value}</div>
      <small>{label}</small>
    </div>
  );
}

function ViewCard({ title, description, active, onClick }) {
  return (
    <button className={`view-card ${active ? "active" : ""}`} onClick={onClick}>
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  );
}

function ListingMedia({ title, image, images = [] }) {
  const [selectedImage, setSelectedImage] = useState(image);
  const gallery = images.length > 0 ? images : [{ src: image, label: "Image" }];

  return (
    <div className="listing-media">
      <div className="listing-image-wrap">
        <img src={selectedImage} alt={title} className="listing-image" />
      </div>

      {gallery.length > 1 && (
        <div
          className="listing-thumbnails"
          aria-label={`${title} image gallery`}
          style={{
            display: "flex",
            gap: "0.5rem",
            overflowX: "auto",
            padding: "0.5rem",
          }}
        >
          {gallery.map((item, index) => (
            <button
              key={`${item.src}-${index}`}
              type="button"
              onClick={() => setSelectedImage(item.src)}
              title={`${item.label} ${index + 1}`}
              aria-label={`Show ${item.label.toLowerCase()} ${index + 1}`}
              style={{
                border:
                  selectedImage === item.src
                    ? "2px solid #22c55e"
                    : "1px solid #475569",
                borderRadius: "0.4rem",
                padding: 0,
                background: "transparent",
                cursor: "pointer",
                flex: "0 0 auto",
              }}
            >
              <img
                src={item.src}
                alt=""
                style={{
                  width: 72,
                  height: 54,
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
