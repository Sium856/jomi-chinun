import { db } from './db.js';

export const BD_DIGITS = "০১২৩৪৫৬৭৮৯";

export function toEnDigits(s: string | number | null | undefined): string {
  return String(s || "")
    .replace(/[০-৯]/g, (c) => String(BD_DIGITS.indexOf(c)))
    .trim();
}

export function norm(s: string | null | undefined): string {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function authKey(a: string | null | undefined): string {
  return String(a || "")
    .split("|")[0]
    .trim()
    .toLowerCase();
}

export interface LandRecord {
  id: number;
  k: string;
  d: string;
  m: string;
  me: string;
  o: string;
  oe: string;
  n: number;
  x: number;
  c: number;
  a: number;
  data_status: string;
}

export interface PlotRecord {
  id: number;
  dv: string;
  ds: string;
  up: string;
  mz: string;
  sv: string;
  k: string;
  d: string;
  area: number;
  unit: string;
  map: string | null;
  road_type: string | null;
  road_width: number | null;
  road_auth: string | null;
  road_st: string | null;
  data_status: string;
}

export interface SetbackRuleRecord {
  id: number;
  auth: string;
  min_width: number;
  max_width: number;
  front_ft: number;
  side_ft: number;
  rear_ft: number;
  data_status: string;
}

export function findLand(k: string, d: string): LandRecord | null {
  const row = db.prepare('SELECT * FROM lands WHERE k = ? AND d = ?').get(toEnDigits(k), toEnDigits(d)) as
    | LandRecord
    | undefined;
  return row || null;
}

export function findPlot(k: string, d: string): PlotRecord | null {
  const row = db.prepare('SELECT * FROM plots WHERE k = ? AND d = ?').get(toEnDigits(k), toEnDigits(d)) as
    | PlotRecord
    | undefined;
  return row || null;
}

export function findSetbackRule(auth: string, width: number): SetbackRuleRecord | null {
  const rules = db.prepare('SELECT * FROM setback_rules').all() as unknown as any[];
  const targetAuth = authKey(auth);
  const matched = rules.find((r) => {
    const rAuth = r.auth || (r.authority_en ? `${r.authority_en}|${r.authority_bn}` : '');
    const minW = r.min_width != null ? r.min_width : r.min_width_ft;
    const maxW = r.max_width != null ? r.max_width : r.max_width_ft;
    return authKey(rAuth) === targetAuth && width >= minW && width < maxW;
  });
  if (!matched) return null;
  return {
    id: matched.id,
    auth: matched.auth || (matched.authority_en ? `${matched.authority_en}|${matched.authority_bn}` : ''),
    min_width: matched.min_width != null ? matched.min_width : matched.min_width_ft,
    max_width: matched.max_width != null ? matched.max_width : matched.max_width_ft,
    front_ft: matched.front_ft,
    side_ft: matched.side_ft,
    rear_ft: matched.rear_ft,
    data_status: matched.data_status || 'demo'
  };
}

export function evaluateSetbackGuidance(plot: PlotRecord | null) {
  if (!plot) {
    return {
      ok: false,
      whyEn: ["Plot not found in records."],
      whyBn: ["রেকর্ডে এই প্লট খুঁজে পাওয়া যায়নি।"],
      rule: null
    };
  }

  const hasRoad = !!plot.road_type;
  const whyEn: string[] = [];
  const whyBn: string[] = [];

  if (!hasRoad) {
    whyEn.push("No road information is recorded for this plot.");
    whyBn.push("এই প্লটের রাস্তার কোনো তথ্য রেকর্ডে নেই।");
  } else {
    if (plot.road_width == null) {
      whyEn.push("Road width is not recorded.");
      whyBn.push("রাস্তার প্রস্থ রেকর্ডে নেই।");
    }
    if (!plot.road_auth) {
      whyEn.push("Road owner / responsible authority is not recorded.");
      whyBn.push("রাস্তার মালিক বা দায়িত্বপ্রাপ্ত কর্তৃপক্ষ রেকর্ডে নেই।");
    }
    if (plot.road_width != null && plot.road_auth) {
      const rule = findSetbackRule(plot.road_auth, plot.road_width);
      if (!rule) {
        whyEn.push("No demo rule is available for this road authority and width.");
        whyBn.push("এই কর্তৃপক্ষ ও রাস্তার প্রস্থের জন্য কোনো ডেমো নিয়ম নেই।");
      } else {
        return {
          ok: true,
          whyEn: [],
          whyBn: [],
          rule
        };
      }
    }
  }

  return {
    ok: false,
    whyEn,
    whyBn,
    rule: null
  };
}

export function getPlotSnapshot(k: string, d: string) {
  const p = findPlot(k, d);
  if (!p) return null;
  const g = evaluateSetbackGuidance(p);
  return {
    mz: p.mz,
    sv: p.sv,
    area: p.area,
    unit: p.unit,
    map: p.map,
    rd: p.road_type ? { type: p.road_type, width: p.road_width, auth: p.road_auth } : null,
    g: g.ok && g.rule ? { f: g.rule.front_ft, s: g.rule.side_ft, b: g.rule.rear_ft } : null
  };
}

export function evaluateLandCheck(land: LandRecord | null, k: string, d: string, seller: string) {
  if (!land) {
    return {
      f: null,
      items: [] as [number, number][],
      score: null as number | null,
      status: "Not Verified",
      px: getPlotSnapshot(k, d)
    };
  }

  const normSeller = norm(seller);
  const nameMatch = [land.o, land.oe].some((name) => norm(name) === normSeller);

  // Weights: owner: 35, namjari: 15, khas: 40, case: 30, acquisition: 30
  // Result codes: 0 = Pass/OK, 1 = Warning, 2 = Risk
  const items: [number, number][] = [
    [nameMatch ? 0 : 2, 35],
    [land.n ? 0 : 1, 15],
    [land.x ? 2 : 0, 40],
    [land.c ? 2 : 0, 30],
    [land.a ? 2 : 0, 30]
  ];

  const totalDeduction = items.reduce((sum, item) => sum + (item[0] ? item[1] : 0), 0);
  const score = Math.max(0, 100 - totalDeduction);

  const maxRiskCode = Math.max(...items.map((item) => item[0]));
  const status = maxRiskCode === 2 ? "Risk Found" : maxRiskCode === 1 ? "Warning" : "Pass";

  return {
    f: {
      o: land.o,
      oe: land.oe,
      m: land.m,
      me: land.me
    },
    items,
    score,
    status,
    px: getPlotSnapshot(k, d)
  };
}
