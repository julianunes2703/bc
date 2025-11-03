import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

/**
 * Hook para DRE vertical (linhas = contas; colunas = meses 1..12, com colunas auxiliares de índice/% ao lado)
 *
 * Ajustes principais vs. sua versão:
 * 1) Detecção robusta das colunas de mês + salto automático da coluna auxiliar (índice/%),
 *    mesmo quando o header da coluna auxiliar está vazio e não há símbolo "%".
 * 2) Aliases ampliados (inclui variantes como "(=)" e sinais "+/-")
 * 3) Fallbacks: custos_fixos → custos_operacionais → (adm + comercial + logística) (esse fallback é usado no componente)
 * 4) Normalização de mês no valueAt (aceita "MAR", "mar", etc.)
 * 5) Auto-detecção do header de meses, com fallback para headerIdx=1 e titleCol=1
 */

const ID_DRE = "1jZDjV8eJUePLJq-q6QVxapvpbAaHZm0q7Sntx5M7QNo";
const DRE_CSV_URL = `https://script.google.com/a/macros/consultingblue.com.br/s/AKfycbzEGR5h2wSMesQoCAqFICR-pPnhylrDnkB0bKB6elaDBKAm-2JpnVdVeOzlGdxM7emb/exec?id=${ID_DRE}&sheet=DRE&range=A1:Z999&cachebust=${Date.now()}`;

const normalize = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const MONTH_ALIASES = [
  { re: /^(jan|janeiro)(?:[\/\-\s]?\d{2,4})?$/i, key: "jan" },
  { re: /^(fev|fevereiro)(?:[\/\-\s]?\d{2,4})?$/i, key: "fev" },
  { re: /^(mar|marco|março)(?:[\/\-\s]?\d{2,4})?$/i, key: "mar" },
  { re: /^(abr|abril)(?:[\/\-\s]?\d{2,4})?$/i, key: "abr" },
  { re: /^(mai|maio)(?:[\/\-\s]?\d{2,4})?$/i, key: "mai" },
  { re: /^(jun|junho)(?:[\/\-\s]?\d{2,4})?$/i, key: "jun" },
  { re: /^(jul|julho)(?:[\/\-\s]?\d{2,4})?$/i, key: "jul" },
  { re: /^(ago|agosto)(?:[\/\-\s]?\d{2,4})?$/i, key: "ago" },
  { re: /^(set|setembro)(?:[\/\-\s]?\d{2,4})?$/i, key: "set" },
  { re: /^(out|outubro)(?:[\/\-\s]?\d{2,4})?$/i, key: "out" },
  { re: /^(nov|novembro)(?:[\/\-\s]?\d{2,4})?$/i, key: "nov" },
  { re: /^(dez|dezembro)(?:[\/\-\s]?\d{2,4})?$/i, key: "dez" },
  { re: /^total$/i, key: "total" },
];

const monthKey = (cell) => {
  const s = normalize(cell);
  for (const { re, key } of MONTH_ALIASES) if (re.test(s)) return key;
  return null;
};

const parsePtNumber = (raw) => {
  if (raw == null) return 0;
  let s = String(raw).trim();
  if (!s || /^[-–—]$/.test(s)) return 0;
  s = s.replace(/r\$\s*/gi, "").replace(/\s+/g, "");
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/-$/.test(s)) { neg = true; s = s.replace(/-$/, ""); }
  s = s.replace(/[^\d.,\-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const val = parseFloat(s);
  if (isNaN(val)) return 0;
  return neg ? -val : val;
};

export function useDREData() {
  const [rows, setRows] = useState([]);
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const text = await fetch(DRE_CSV_URL).then((r) => r.text());
        const { data } = Papa.parse(text, {
          header: false,
          skipEmptyLines: false,
          transform: (v) => (v == null ? "" : v),
        });

        // ===== Auto-detecção de cabeçalho (linha com meses) =====
        let headerIdx = 1; // fallback padrão (linha 2)
        let titleCol = 1;  // fallback padrão (coluna B)

        for (let i = 0; i < Math.min(5, data.length); i++) {
          const row = data[i] || [];
          const monthHits = row.map(monthKey).filter(Boolean);
          if (monthHits.length >= 3) { // achou uma linha com vários meses
            headerIdx = i;
            // heurística: primeira célula textual à esquerda dos meses costuma ser a coluna de títulos
            // se B estiver vazia, tenta A
            titleCol = row[1] !== undefined ? 1 : 0;
            break;
          }
        }

        const header = data[headerIdx] || [];

        // ===== Mapear colunas de mês (pula a auxiliar) =====
        const monthCols = [];
        // começar da primeira coluna que contenha um mês
        let startC = header.findIndex((c) => monthKey(c));
        if (startC < 0) startC = 2; // fallback em C

        for (let idx = startC; idx < header.length; idx++) {
          const key = monthKey(header[idx]);
          if (!key || key === "total") continue;

          // Heurística para detectar coluna auxiliar (índice/% ao lado do mês)
          const nextHeader = String(header[idx + 1] ?? "");
          const nextCell = String((data[headerIdx + 1] ?? [])[idx + 1] ?? "").trim();
          const nextNum = parsePtNumber(nextCell);
          const nextIsAux = (!nextHeader || nextHeader === "") && !isNaN(nextNum) && Math.abs(nextNum) <= 5;

          monthCols.push({ mes: key, col: idx, raw: header[idx] });
          if (nextIsAux) idx += 1; // pula a auxiliar
        }

        const monthsFound = monthCols.map((m) => m.mes);

        // ===== Montar linhas de contas =====
        const resultRows = [];
        const startRow = headerIdx + 1;
        for (let r = startRow; r < data.length; r++) {
          const row = data[r] || [];
          const titleRaw = String(row[titleCol] ?? "").trim();
          if (!titleRaw) continue;

          // ignora possíveis linhas de seção sem números no restante
          const hasAnyVal = monthCols.some(({ col }) => String(row[col] ?? "").trim() !== "");
          if (!hasAnyVal) continue;

          const values = {};
          monthCols.forEach(({ mes, col }) => {
            const val = parsePtNumber(row[col]);
            values[mes] = isNaN(val) ? 0 : val;
          });

          const keyNorm = normalize(titleRaw).replace(/\s+/g, "_").replace(/[()=+\-]/g, "").slice(0, 100);

          resultRows.push({
            name: titleRaw,
            key: keyNorm,
            values,
          });
        }

        setRows(resultRows);
        setMonths(monthsFound);
        setLoading(false);
      } catch (e) {
        console.error("Erro lendo DRE CSV:", e);
        setRows([]); setMonths([]); setLoading(false);
      }
    })();
  }, []);

  // ===== Índice para busca rápida =====
  const map = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.key, r));
    return m;
  }, [rows]);

  // ===== Aliases =====
  const aliases = useMemo(() => ({
    faturamento_bruto: ["faturamento bruto"],
    receitas_servicos: ["receita da prestacao de servicos","receita prestacao de servicos","receita de servicos"],
    receitas_revenda: ["receita da revenda de mercadorias"],
    receitas_fabricacao: ["receita de fabricacao propria","receita de fabricacao propria"],
    deducoes: ["deducoes","deducoes estornos","devolucoes/estornos","deducoes (-)"],
    receita_liquida: ["receita liquida","receita liquida =","receita liquida (=)"],
    custos_totais: ["custos totais","custos totais =","custos totais (=)"],
    custos_operacionais: ["custos operacionais","custos operacionais (-)"],
    despesas_adm: ["despesas adm","despesas administrativas"],
    despesas_comercial: ["despesas comercial","despesas comerciais"],
    despesas_logistica: ["despesas com logistica","despesas com logistica","logistica"],
    ebitda: ["ebitda"],
    lucro_operacional: ["lucro operacional (ebit)","lucro operacional ebit","ebit"],
    resultado_financeiro: ["resultado financeiro"],
    impostos_sobre_lucro: ["impostos sobre o lucro"],
    lucro_liquido: ["lucro liquido","lucro liquido =","lucro liquido (=)","lucro liquido (+/-)"],
    geracao_caixa: ["geracao de caixa","geracao de caixa"],
    inadimplencia_mes: ["inadimplencia do mes","inadimplencia mes","inadimplencia do mês"],
    inadimplencia_acumulada: ["inadimplencia acumulada"],
    prazo_medio_receber: ["pmr","prazo medio receber","prazo medio de recebimento"],
    prazo_medio_pagar: ["pmp","prazo medio pagar","prazo medio de pagamento"],
  }), []);

  const findRow = (aliasKey) => {
    const opts = aliases[aliasKey] || [];
    for (const opt of opts) {
      const k = normalize(opt).replace(/\s+/g, "_").replace(/[()=+\-]/g, "");
      if (map.has(k)) return map.get(k);
      for (const [key, obj] of map.entries()) {
        if (key.includes(k)) return obj;
      }
    }
    return null;
  };

  const valueAt = (aliasKey, mes) => {
    const row = findRow(aliasKey);
    if (!row) return 0;
    const m = (mes || "").toString().toLowerCase();
    return Number(row.values?.[m] ?? 0);
  };

  // util: ver rapidamente se achou as linhas-chave
  const debugKeys = (...keys) => {
    return keys.map(k => ({ k, found: !!findRow(k)?.name }));
  };

  return { rows, months, loading, findRow, valueAt, debugKeys };
}
