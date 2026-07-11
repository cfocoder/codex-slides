"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, Check, MagnifyingGlass, Palette } from "@phosphor-icons/react";
import {
  CATEGORIES,
  TEMPLATES,
  getTemplate,
  templatesByCategory,
  type DeckCategory,
  type DeckTemplate,
} from "@/lib/templates";
import { useI18n } from "@/i18n/I18nProvider";

function matchesSearch(template: DeckTemplate, category: DeckCategory, query: string) {
  if (!query) return true;
  return [template.name, template.description, template.font, category.labelZh, category.labelEn]
    .join(" ")
    .toLocaleLowerCase()
    .includes(query);
}

/** A searchable, in-product visual style picker (avoids the browser's native long select menu). */
export default function TemplatePicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (id: string | undefined) => void;
}) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = getTemplate(value);
  const selectedCategory = CATEGORIES.find((category) => category.id === selected?.categoryId);
  const query = search.trim().toLocaleLowerCase();
  const categoryLabel = (category?: DeckCategory) => category
    ? (locale === "zh-CN" ? category.labelZh : category.labelEn)
    : t("template.presetShort");
  const densityLabel = (density: DeckTemplate["density"]) => t(
    density === "low" ? "template.densityLow" : density === "high" ? "template.densityHigh" : "template.densityMedium",
  );

  const groups = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        category,
        templates: templatesByCategory(category.id).filter((template) => matchesSearch(template, category, query)),
      })).filter((group) => group.templates.length > 0),
    [query],
  );

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus());
    else setSearch("");
  }, [open]);

  function choose(id?: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className="style-field" ref={rootRef}>
      <div className="restyle-field-head">
        <label id="visual-style-label">{t("template.title")}</label>
        <span>{t("template.stylesCount", { count: TEMPLATES.length })}</span>
      </div>
      <button
        type="button"
        className={`style-picker-trigger${open ? " open" : ""}`}
        aria-labelledby="visual-style-label"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="style-picker-icon" aria-hidden="true">
          <Palette size={18} weight="regular" />
        </span>
        <span className="style-picker-copy">
          <strong>{selected?.name ?? t("template.useCurrent")}</strong>
          <small>
            {selected
              ? t("template.density", { category: categoryLabel(selectedCategory), density: densityLabel(selected.density) })
              : t("template.noPreset")}
          </small>
        </span>
        {selected && (
          <span className="style-palette" aria-label={t("template.palette", { colors: selected.palette.join(", ") })}>
            {selected.palette.map((color) => (
              <span key={color} style={{ background: color }} />
            ))}
          </span>
        )}
        <CaretDown className="style-picker-caret" size={16} weight="bold" aria-hidden="true" />
      </button>

      {open && (
        <div className="style-menu" role="listbox" aria-label={t("template.styles")}>
          <div className="style-search">
            <MagnifyingGlass size={16} aria-hidden="true" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("template.search")}
              aria-label={t("template.searchLabel")}
            />
          </div>
          <div className="style-menu-list">
            {!query && (
              <button
                type="button"
                className={`style-option${!selected ? " selected" : ""}`}
                role="option"
                aria-selected={!selected}
                onClick={() => choose(undefined)}
              >
                <span className="style-option-copy">
                  <strong>{t("template.current")}</strong>
                  <small>{t("template.currentHelp")}</small>
                </span>
                {!selected && <Check size={17} weight="bold" aria-hidden="true" />}
              </button>
            )}
            {groups.map(({ category, templates }) => (
              <section className="style-group" key={category.id} aria-label={categoryLabel(category)}>
                <div className="style-group-label">
                  <span>{categoryLabel(category)}</span>
                  <span>{locale === "zh-CN" ? category.labelEn : category.labelZh}</span>
                </div>
                {templates.map((template) => {
                  const active = template.id === value;
                  return (
                    <button
                      type="button"
                      className={`style-option${active ? " selected" : ""}`}
                      key={template.id}
                      role="option"
                      aria-selected={active}
                      onClick={() => choose(template.id)}
                    >
                      <span className="style-option-palette" aria-hidden="true">
                        {template.palette.slice(0, 4).map((color) => (
                          <span key={color} style={{ background: color }} />
                        ))}
                      </span>
                      <span className="style-option-copy">
                        <strong>{template.name}</strong>
                        <small>{template.description}</small>
                      </span>
                      {active && <Check size={17} weight="bold" aria-hidden="true" />}
                    </button>
                  );
                })}
              </section>
            ))}
            {!groups.length && <div className="style-menu-empty">{t("template.noMatch", { query: search.trim() })}</div>}
          </div>
        </div>
      )}
      {selected && (
        <p className="style-detail">
          <span>{selected.font}</span>
          <span aria-hidden="true">·</span>
          <span>{selected.imageStyle}</span>
        </p>
      )}
    </div>
  );
}
