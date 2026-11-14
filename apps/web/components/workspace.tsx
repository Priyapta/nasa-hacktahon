"use client";
import { useEffect, useState } from "react";
import {
  Globe2,
  Tractor,
  ChartNoAxesCombined,
  Sprout,
  Menu,
  ArrowUpRight,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { Polygon } from "geojson";
import type { FarmField } from "@/types";
import { measure } from "@/lib/geo";
import { useFields } from "@/store/fields";
import Earth from "./earth";
import { Button } from "./ui/button";
import MyFarms from "./farms/my-farms";
const tabs = [
  "Explore Earth",
  "My Farms",
  "Field Insights",
  "Rotation Planner",
];
const icons = [Globe2, Tractor, ChartNoAxesCombined, Sprout];
export default function Workspace() {
  const { fields, farms, hydrate, save, remove, error } = useFields();
  const [page, setPage] = useState(0),
    [collapsed, setCollapsed] = useState(false),
    [selected, setSelected] = useState<FarmField>(),
    [geometry, setGeometry] = useState<Polygon>(),
    [mapReset, setMapReset] = useState(0),
    [formMinimized, setFormMinimized] = useState(false),
    [location, setLocation] = useState(""),
    [notice, setNotice] = useState(""),
    [years, setYears] = useState(3),
    [candidates, setCandidates] = useState("Maize, Soybean, Sorghum"),
    [priorities, setPriorities] = useState<string[]>(["Improve soil health"]),
    [irrigation, setIrrigation] = useState("Rainfed");
  useEffect(hydrate, [hydrate]);
  function open(f: FarmField) {
    setFormMinimized(false);
    setSelected(f);
    setGeometry(undefined);
    setLocation(f.locationName);
    setPage(0);
  }
  let measurement: ReturnType<typeof measure> | undefined;
  try {
    if (geometry) measurement = measure(geometry);
  } catch {}
  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <aside>
        <a className="brand" href="/" aria-label="Field Atlas home">
          <Sprout />
          <span>
            field<span className="brand-light">atlas</span>
            <small>LAND INTELLIGENCE</small>
          </span>
        </a>
        <button
          className="collapse"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle navigation"
        >
          <Menu size={18} />
        </button>
        <nav>
          {tabs.map((t, i) => {
            const Icon = icons[i];
            return (
              <button
                className={page === i ? "active" : ""}
                onClick={() => setPage(i)}
                key={t}
                title={t}
              >
                <Icon size={20} />
                <span>{t}</span>
              </button>
            );
          })}
        </nav>
        <div className="aside-bottom">
          <span className="status-dot" />
          <span>
            Local workspace<small>Your fields stay in this browser</small>
          </span>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <span className="eyebrow">
              WORKSPACE / {page === 0 ? "EXPLORATION" : "YOUR LAND"}
            </span>
            <h2>{tabs[page]}</h2>
          </div>
          <div className="header-right">
            <span>{fields.length} saved fields</span>
            <div className="avatar">FA</div>
          </div>
        </header>
        <div className={page === 0 ? "map-stage" : "hidden"}>
          <Earth
            fields={fields}
            active={page === 0}
            selected={page === 0 ? selected : undefined}
            resetKey={mapReset}
            onSelect={open}
            onGeometry={setGeometry}
            onLocation={setLocation}
            onNew={() => {
              setSelected(undefined);
              setGeometry(undefined);
              setFormMinimized(false);
            }}
          />
          {geometry && (
            <form
              className={`field-form ${formMinimized ? "field-form-minimized" : ""}`}
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  if (!measurement)
                    throw Error("Please complete a valid field boundary.");
                  const d = new FormData(e.currentTarget);
                  const now = new Date().toISOString();
                  const f: FarmField = {
                    id: selected?.id ?? crypto.randomUUID(),
                    farmId: selected?.farmId ?? "",
                    geometry,
                    ...measurement,
                    name: String(d.get("name")),
                    locationName: String(d.get("locationName")),
                    currentCrop: String(d.get("currentCrop")),
                    previousCrop: String(d.get("previousCrop")),
                    soilType: String(d.get("soilType")),
                    irrigationType: String(d.get("irrigationType")),
                    notes: String(d.get("notes")),
                    createdAt: selected?.createdAt ?? now,
                    updatedAt: now,
                  };
                  save(f, String(d.get("farmName")));
                  setGeometry(undefined);
                  setSelected(undefined);
                  setMapReset((value) => value + 1);
                  setNotice("Field saved successfully.");
                } catch (e) {
                  setNotice(
                    e instanceof Error
                      ? e.message
                      : "Unable to save field. Storage may be full.",
                  );
                }
              }}
            >
              <div className="section-heading">
                <h3>Save Your Field</h3>
                <button
                  type="button"
                  aria-label={
                    formMinimized ? "Expand field form" : "Minimize field form"
                  }
                  aria-expanded={!formMinimized}
                  onClick={() => setFormMinimized((value) => !value)}
                >
                  {formMinimized ? (
                    <ChevronDown size={18} />
                  ) : (
                    <ChevronUp size={18} />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Close field form"
                  onClick={() => {
                    setGeometry(undefined);
                    setSelected(undefined);
                    setMapReset((value) => value + 1);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="measurement">
                <strong>
                  {measurement?.areaHectares.toFixed(3) ?? "—"}{" "}
                  <small>ha</small>
                </strong>
                <span>
                  {measurement
                    ? Math.round(
                        measurement.areaHectares * 10000,
                      ).toLocaleString()
                    : "—"}{" "}
                  m²
                </span>
              </div>
              {measurement && (
                <small>
                  {measurement.centroid[1].toFixed(5)},{" "}
                  {measurement.centroid[0].toFixed(5)}
                </small>
              )}
              {[
                [
                  "farmName",
                  "Farm name",
                  farms.find((f) => f.id === selected?.farmId)?.name ?? "",
                ],
                ["name", "Field name", selected?.name ?? ""],
                ["locationName", "Location", location],
                ["currentCrop", "Current crop", selected?.currentCrop ?? ""],
                ["previousCrop", "Previous crop", selected?.previousCrop ?? ""],
                ["soilType", "Soil type (optional)", selected?.soilType ?? ""],
                [
                  "irrigationType",
                  "Irrigation type",
                  selected?.irrigationType ?? "Rainfed",
                ],
                ["notes", "Notes (optional)", selected?.notes ?? ""],
              ].map(([name, label, value]) => (
                <label key={name}>
                  {label}
                  <input
                    name={name}
                    defaultValue={value}
                    required={!["soilType", "notes"].includes(name)}
                    maxLength={500}
                  />
                </label>
              ))}
              <Button type="submit" disabled={!measurement}>
                Save Field
              </Button>
            </form>
          )}
        </div>
        {page !== 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="content"
          >
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  FROM BOUNDARIES TO BETTER DECISIONS
                </span>
                <h1>
                  {page === 1
                    ? "Your growing ground."
                    : page === 2
                      ? "Know what shapes your field."
                      : "Plan the seasons ahead."}
                </h1>
                <p>
                  {page === 1
                    ? "Every field, one place. Build a clearer picture of your farm."
                    : page === 2
                      ? "Climate context and soil records, with clear limits on what we know."
                      : "Explore explainable rotations. Adapt every plan with local agronomic advice."}
                </p>
              </div>
              <Button
                onClick={() => {
                  setSelected(undefined);
                  setGeometry(undefined);
                  setMapReset((value) => value + 1);
                  setPage(0);
                }}
              >
                Add New Field <ArrowUpRight size={16} />
              </Button>
            </div>
            {error && <p role="alert">{error}</p>}
            {!fields.length ? (
              <div className="empty">
                <Tractor size={40} />
                <h2>Your first field starts here</h2>
                <p>
                  Find your land on the satellite map, trace its boundary, and
                  save its profile.
                </p>
                <Button onClick={() => setPage(0)}>Map a field</Button>
              </div>
            ) : page === 1 ? (
              <MyFarms
                fields={fields}
                farms={farms}
                onOpen={open}
                onInsights={(field) => {
                  setSelected(field);
                  setPage(2);
                }}
                onDelete={(field) => {
                  if (!confirm(`Delete ${field.name}?`)) return;
                  try {
                    remove(field.id);
                    if (selected?.id === field.id) {
                      setSelected(undefined);
                      setGeometry(undefined);
                      setMapReset((value) => value + 1);
                    }
                  } catch {
                    setNotice("Deletion failed; storage is unavailable.");
                  }
                }}
              />
            ) : (
              <>
                <label className="field-selector">
                  Selected field
                  <select
                    value={selected?.id ?? fields[0].id}
                    onChange={(e) =>
                      setSelected(fields.find((f) => f.id === e.target.value))
                    }
                  >
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                {page === 2 ? (
                  <Insights field={selected ?? fields[0]} />
                ) : (
                  <>
                    <div className="planner-settings">
                      <label>
                        Candidate crops
                        <input
                          value={candidates}
                          onChange={(e) => setCandidates(e.target.value)}
                        />
                      </label>
                      <label>
                        Planning horizon
                        <select
                          value={years}
                          onChange={(e) => setYears(Number(e.target.value))}
                        >
                          {[2, 3, 4].map((y) => (
                            <option key={y} value={y}>
                              {y} years
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Irrigation
                        <select
                          value={irrigation}
                          onChange={(e) => setIrrigation(e.target.value)}
                        >
                          <option>Rainfed</option>
                          <option>Available</option>
                        </select>
                      </label>
                      <p>
                        Current crop: {(selected ?? fields[0]).currentCrop} ·
                        Previous: {(selected ?? fields[0]).previousCrop}. Edit
                        these in the field profile.
                      </p>
                    </div>
                    <div className="priorities">
                      {[
                        "Improve soil health",
                        "Reduce water consumption",
                        "Improve crop productivity",
                        "Increase climate resilience",
                        "Reduce soil degradation",
                      ].map((p) => (
                        <label key={p}>
                          <input
                            type="checkbox"
                            checked={priorities.includes(p)}
                            onChange={() =>
                              setPriorities(
                                priorities.includes(p)
                                  ? priorities.filter((x) => x !== p)
                                  : [...priorities, p],
                              )
                            }
                          />
                          {p}
                        </label>
                      ))}
                    </div>
                    <p className="data-note">
                      Illustrative rules, not yield predictions. One crop per
                      year is assumed; water needs depend on local varieties,
                      season, and management.
                    </p>
                    <div className="scenario-grid">
                      {[
                        "Soil Health Focus",
                        "Water Efficiency Focus",
                        "Balanced Resilience",
                      ].map((title, i) => {
                        const crops = candidates
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const preferred =
                          i === 0
                            ? ["soybean", "pea", "bean", "lentil"]
                            : i === 1
                              ? ["sorghum", "millet"]
                              : [];
                        const ordered = [...crops].sort(
                          (a, b) =>
                            Number(
                              preferred.some((p) =>
                                b.toLowerCase().includes(p),
                              ),
                            ) -
                            Number(
                              preferred.some((p) =>
                                a.toLowerCase().includes(p),
                              ),
                            ),
                        );
                        return (
                          <article className="scenario" key={title}>
                            <span className="eyebrow">SCENARIO 0{i + 1}</span>
                            <h2>{title}</h2>
                            <ol>
                              {Array.from({ length: years }, (_, y) => (
                                <li key={y}>
                                  <small>YEAR {y + 1}</small>
                                  <strong>
                                    {ordered.length
                                      ? ordered[
                                          (y + (i === 2 ? 1 : 0)) %
                                            ordered.length
                                        ]
                                      : "Add candidate crops"}
                                  </strong>
                                </li>
                              ))}
                            </ol>
                            <h4>Rule & potential benefit</h4>
                            <p>
                              {i === 0
                                ? "Prioritizes candidate legumes to support nitrogen cycling; benefits depend on nodulation and residue management."
                                : i === 1
                                  ? "Prioritizes sorghum or millet when included, for their relative drought tolerance."
                                  : "Cycles candidate crops to encourage diversity across seasons."}
                            </p>
                            <h4>Trade-offs & assumptions</h4>
                            <p>
                              Verify crop suitability, pest families, markets,
                              and planting windows.{" "}
                              {irrigation === "Rainfed"
                                ? "Rainfed establishment depends on seasonal rainfall."
                                : "Irrigation availability does not guarantee sufficient water."}{" "}
                              {crops.length < 2
                                ? "Add at least two crops for an actual rotation."
                                : ""}
                            </p>
                            <small>
                              Your priorities:{" "}
                              {priorities.join(", ") || "None selected"}. These
                              inform your comparison, not a scientific score.
                            </small>
                          </article>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
        {notice && (
          <button className="toast" role="status" onClick={() => setNotice("")}>
            {notice} ×
          </button>
        )}
      </main>
    </div>
  );
}
function Insights({ field }: { field: FarmField }) {
  const data = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ].map((month, i) => ({
    month,
    rainfall: [110, 95, 120, 85, 65, 40, 30, 35, 60, 90, 110, 125][i],
  }));
  return (
    <>
      <div className="data-note">
        <strong>Demo climate dataset</strong> · Illustrative annual pattern, not
        NASA observations and not specific to this field. Observation period and
        spatial resolution: not applicable.
      </div>
      <div className="summary-strip">
        <div>
          <strong>24.8 °C</strong>
          <span>Demo mean temperature</span>
        </div>
        <div>
          <strong>965 mm</strong>
          <span>Demo annual rainfall</span>
        </div>
        <div>
          <strong>4.6 kWh/m²/day</strong>
          <span>Demo solar radiation</span>
        </div>
      </div>
      <div className="insights-grid">
        <article>
          <h2>Seasonal rainfall</h2>
          <p>Demo monthly totals · mm</p>
          <div style={{ height: 260, width: "100%" }}>
            <ResponsiveContainer>
              <BarChart data={data}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="rainfall" fill="#287A55" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article>
          <h2>Your soil record</h2>
          <dl>
            <dt>Soil type</dt>
            <dd>{field.soilType || "Not provided"}</dd>
            {["pH", "Moisture", "Organic matter", "Drainage"].map((k) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>Unavailable — field sample required</dd>
              </div>
            ))}
          </dl>
          <p>{field.notes || "No soil observations recorded."}</p>
        </article>
        <article>
          <h2>Water & climate risks</h2>
          <p>
            Irrigation: {field.irrigationType}. Drought exposure, historical
            variability, and seasonal water stress have not been assessed.
          </p>
          <p>
            Use local weather records and soil measurements before making
            irrigation decisions.
          </p>
        </article>
      </div>
    </>
  );
}
