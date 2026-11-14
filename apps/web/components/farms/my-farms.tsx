"use client";

import { useRef, useState } from "react";
import { MapPin, ArrowUpRight, Trash2 } from "lucide-react";
import type { Farm, FarmField } from "@/types";
import FarmMap from "./farm-map";
import { Button } from "../ui/button";

interface MyFarmsProps {
  fields: FarmField[];
  farms: Farm[];
  onOpen: (field: FarmField) => void;
  onInsights: (field: FarmField) => void;
  onDelete: (field: FarmField) => void;
}

export default function MyFarms({
  fields,
  farms,
  onOpen,
  onInsights,
  onDelete,
}: MyFarmsProps) {
  const [selectedId, setSelectedId] = useState<string>();
  const panel = useRef<HTMLDivElement>(null);
  function selectField(id: string | undefined) {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 760px)").matches) {
      panel.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  }
  const selected = fields.find((field) => field.id === selectedId);
  return (
    <>
      <div className="summary-strip farm-summary">
        <div>
          <strong>
            {
              farms.filter((farm) =>
                fields.some((field) => field.farmId === farm.id),
              ).length
            }
          </strong>
          <span>Farms</span>
        </div>
        <div>
          <strong>{fields.length}</strong>
          <span>Mapped fields</span>
        </div>
        <div>
          <strong>
            {fields
              .reduce((sum, field) => sum + field.areaHectares, 0)
              .toFixed(2)}{" "}
            <small>ha</small>
          </strong>
          <span>Total mapped area</span>
        </div>
      </div>
      <div className="farm-workspace">
        <div className="farm-list" role="region" aria-label="Saved field list">
          <div className="farm-list-heading">
            <h2>Your fields</h2>
            <p>Select a field to see its boundary.</p>
          </div>
          {farms
            .filter((farm) => fields.some((field) => field.farmId === farm.id))
            .map((farm) => (
              <section key={farm.id}>
                <h3>{farm.name}</h3>
                {fields
                  .filter((field) => field.farmId === farm.id)
                  .map((field) => (
                    <button
                      type="button"
                      key={field.id}
                      className={`farm-list-item ${selected?.id === field.id ? "selected" : ""}`}
                      aria-pressed={selected?.id === field.id}
                      onClick={() => selectField(field.id)}
                    >
                      <span className="farm-list-name">
                        {field.name}
                        <span>{field.areaHectares.toFixed(2)} ha</span>
                      </span>
                      <span className="farm-list-location">
                        <MapPin size={13} aria-hidden="true" />
                        {field.locationName}
                      </span>
                      <span className="farm-list-crop">
                        {field.currentCrop} · Updated{" "}
                        {new Date(field.updatedAt).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
              </section>
            ))}
        </div>
        <div className="farm-map-panel" ref={panel}>
          <FarmMap
            fields={fields}
            selectedId={selected?.id}
            onSelect={selectField}
          />
          <section
            className="farm-detail"
            aria-label="Selected field details"
            aria-live="polite"
          >
            {selected ? (
              <>
                <div className="farm-detail-title">
                  <div>
                    <span className="eyebrow">SELECTED FIELD</span>
                    <h2>{selected.name}</h2>
                    <p>{selected.locationName}</p>
                  </div>
                  <strong>
                    {selected.areaHectares.toFixed(2)} <small>ha</small>
                  </strong>
                </div>
                <dl className="farm-detail-facts">
                  <div>
                    <dt>Current crop</dt>
                    <dd>{selected.currentCrop}</dd>
                  </div>
                  <div>
                    <dt>Irrigation</dt>
                    <dd>{selected.irrigationType}</dd>
                  </div>
                  <div>
                    <dt>Analysis</dt>
                    <dd>Demo available</dd>
                  </div>
                </dl>
                <div className="actions">
                  <Button onClick={() => onOpen(selected)}>
                    Open field <ArrowUpRight size={15} />
                  </Button>
                  <button type="button" onClick={() => onInsights(selected)}>
                    Insights
                  </button>
                  <button
                    type="button"
                    className="farm-delete"
                    aria-label={`Delete ${selected.name}`}
                    onClick={() => onDelete(selected)}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
                <small className="farm-edit-hint">
                  Open field to edit its boundary on the satellite map.
                </small>
              </>
            ) : (
              <div className="farm-detail-empty">
                <MapPin size={24} />
                <div>
                  <h2>Choose a field</h2>
                  <p>
                    Select a boundary on the map or a field from the list. Your
                    saved GeoJSON provides the boundaries.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
