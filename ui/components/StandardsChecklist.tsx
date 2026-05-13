import { useState, useEffect } from "react";
import { useI18n } from "../i18n/I18nContext";
import styles from "./StandardsChecklist.module.css";

export interface StandardItem {
  id: string;
  category: "uiux" | "ba";
  label: string;
  required: boolean;
  checked: boolean;
}

interface StandardsChecklistProps {
  onStandardsChange: (items: StandardItem[]) => void;
}

const STORAGE_KEY = "designready-standards";

const DEFAULT_STANDARDS: StandardItem[] = [
  // UI/UX Standards
  { id: "uiux-1", category: "uiux", label: "Color tokens use semantic naming (primary, secondary, error, success)", required: true, checked: false },
  { id: "uiux-2", category: "uiux", label: "Typography scale defined (h1-h6, body, caption, overline)", required: true, checked: false },
  { id: "uiux-3", category: "uiux", label: "Spacing follows 4/8px grid system", required: true, checked: false },
  { id: "uiux-4", category: "uiux", label: "All interactive components have hover, active, disabled states", required: true, checked: false },
  { id: "uiux-5", category: "uiux", label: "Focus states visible for keyboard navigation", required: true, checked: false },
  { id: "uiux-6", category: "uiux", label: "Touch targets minimum 44x44px on mobile", required: false, checked: false },
  { id: "uiux-7", category: "uiux", label: "Color contrast ratio >= 4.5:1 for text (WCAG AA)", required: true, checked: false },
  { id: "uiux-8", category: "uiux", label: "Empty, loading, and error states defined for all data views", required: true, checked: false },
  { id: "uiux-9", category: "uiux", label: "Icon style consistent (outline/filled/duotone — same family)", required: false, checked: false },
  { id: "uiux-10", category: "uiux", label: "Responsive breakpoints defined (mobile, tablet, desktop)", required: false, checked: false },
  { id: "uiux-11", category: "uiux", label: "Dark mode / light mode variants available", required: false, checked: false },
  { id: "uiux-12", category: "uiux", label: "Motion/animation tokens defined (duration, easing)", required: false, checked: false },
  { id: "uiux-13", category: "uiux", label: "Border radius tokens consistent across components", required: false, checked: false },
  { id: "uiux-14", category: "uiux", label: "Shadow/elevation scale defined (sm, md, lg)", required: false, checked: false },

  // BA Standards
  { id: "ba-1", category: "ba", label: "User stories follow As a / I want / So that format", required: true, checked: false },
  { id: "ba-2", category: "ba", label: "Each screen has defined purpose and entry points", required: true, checked: false },
  { id: "ba-3", category: "ba", label: "Acceptance criteria measurable and testable", required: true, checked: false },
  { id: "ba-4", category: "ba", label: "Data requirements specify field types and validation", required: true, checked: false },
  { id: "ba-5", category: "ba", label: "Business rules documented and numbered", required: false, checked: false },
  { id: "ba-6", category: "ba", label: "User flow / navigation map defined", required: false, checked: false },
  { id: "ba-7", category: "ba", label: "Error scenarios and edge cases documented", required: true, checked: false },
  { id: "ba-8", category: "ba", label: "Permissions and role-based access defined", required: false, checked: false },
  { id: "ba-9", category: "ba", label: "Performance requirements specified (load time, response time)", required: false, checked: false },
  { id: "ba-10", category: "ba", label: "API endpoints or data sources identified", required: false, checked: false },
];

function loadStandards(): StandardItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_STANDARDS;
  } catch {
    return DEFAULT_STANDARDS;
  }
}

function saveStandards(items: StandardItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* */ }
}

export function StandardsChecklist({ onStandardsChange }: StandardsChecklistProps) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<StandardItem[]>(loadStandards);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState<"uiux" | "ba">("uiux");
  const { t } = useI18n();

  useEffect(() => { onStandardsChange(items); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleItem = (id: string) => {
    const next = items.map(i => i.id === id ? { ...i, checked: !i.checked } : i);
    setItems(next);
    saveStandards(next);
    onStandardsChange(next);
  };

  const addItem = () => {
    if (!newLabel.trim()) return;
    const next: StandardItem[] = [...items, {
      id: `custom-${Date.now()}`,
      category: newCategory,
      label: newLabel.trim(),
      required: false,
      checked: false,
    }];
    setItems(next);
    saveStandards(next);
    onStandardsChange(next);
    setNewLabel("");
    setAdding(false);
  };

  const removeItem = (id: string) => {
    const next = items.filter(i => i.id !== id);
    setItems(next);
    saveStandards(next);
    onStandardsChange(next);
  };

  const resetDefaults = () => {
    setItems(DEFAULT_STANDARDS);
    saveStandards(DEFAULT_STANDARDS);
    onStandardsChange(DEFAULT_STANDARDS);
  };

  const uiuxItems = items.filter(i => i.category === "uiux");
  const baItems = items.filter(i => i.category === "ba");
  const checkedCount = items.filter(i => i.checked).length;
  const requiredChecked = items.filter(i => i.required && i.checked).length;
  const requiredTotal = items.filter(i => i.required).length;

  return (
    <div className={styles.root}>
      <button className={styles.header} onClick={() => setExpanded(!expanded)}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>{t.standardsChecklist}</span>
          <span className={styles.badge}>{checkedCount}/{items.length}</span>
          {requiredChecked < requiredTotal && (
            <span className={styles.badgeWarn}>{requiredTotal - requiredChecked} {t.required}</span>
          )}
        </div>
        <span className={styles.chevron}>{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className={styles.body}>
          <div className={styles.section}>
            <span className={styles.sectionLabel}>{t.uiUxStandards}</span>
            {uiuxItems.map(item => (
              <label key={item.id} className={styles.item}>
                <input type="checkbox" checked={item.checked} onChange={() => toggleItem(item.id)} />
                <span className={styles.itemLabel}>
                  {item.label}
                  {item.required && <span className={styles.requiredTag}>{t.required}</span>}
                </span>
                {item.id.startsWith("custom-") && (
                  <button className={styles.removeBtn} onClick={(e) => { e.preventDefault(); removeItem(item.id); }}>×</button>
                )}
              </label>
            ))}
          </div>

          <div className={styles.section}>
            <span className={styles.sectionLabel}>{t.baStandards}</span>
            {baItems.map(item => (
              <label key={item.id} className={styles.item}>
                <input type="checkbox" checked={item.checked} onChange={() => toggleItem(item.id)} />
                <span className={styles.itemLabel}>
                  {item.label}
                  {item.required && <span className={styles.requiredTag}>{t.required}</span>}
                </span>
                {item.id.startsWith("custom-") && (
                  <button className={styles.removeBtn} onClick={(e) => { e.preventDefault(); removeItem(item.id); }}>×</button>
                )}
              </label>
            ))}
          </div>

          {adding ? (
            <div className={styles.addForm}>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value as "uiux" | "ba")} className={styles.addSelect}>
                <option value="uiux">UI/UX</option>
                <option value="ba">BA</option>
              </select>
              <input className={styles.addInput} value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder={t.newStandard} onKeyDown={e => e.key === "Enter" && addItem()} />
              <button className="btn-primary btn-sm" onClick={addItem}>{t.add}</button>
              <button className="btn-link" onClick={() => setAdding(false)}>{t.cancel}</button>
            </div>
          ) : (
            <div className={styles.actions}>
              <button className="btn-link" onClick={() => setAdding(true)}>{t.addCustomStandard}</button>
              <button className="btn-link" onClick={resetDefaults} style={{ opacity: 0.5 }}>{t.resetDefaults}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
