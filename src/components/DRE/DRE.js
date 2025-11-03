import React, { useMemo, useState, useEffect } from "react";
import { useDREData } from "../../hooks/useDREData";
import {
  ResponsiveContainer,
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  BarChart, Bar,
  PieChart, Pie, Cell,
  AreaChart, Area
} from "recharts";
import "./DRE.css";

/**
 * DRE Dashboard B&C — Indicadores em Destaque + Projeção + Gráficos + Config
 *
 * Requisitos implementados:
 * - Margem Bruta (valor e %) — Lucro Bruto = Receita Líquida – CPV (custos_totais)
 * - Margem Operacional (via EBITDA) — EBITDA/Receita Líquida (% e valor)
 * - Lucro Líquido (valor e %) — Lucro Líquido/Receita Líquida
 * - EBITDA (valor e %) — direto do DRE
 * - Custo fixo / Receita
 * - ROI — Lucro Líquido / Capital Investido (do DRE se existir, senão via aba Config)
 * - Inadimplência do mês e acumulada — (campos opcionais do DRE). Fallback = 0
 * - Prazos médios (pagar/receber) e ciclo de caixa — (campos opcionais do DRE)
 * - Aba Projeções com série projetada (12 meses) a partir de CAGR dos últimos N meses ou taxa definida na aba Config
 * - Aba Config ("Tab de Conf.") para ajustes de supostos/nomes de campos
 * - Link para DRE bruto (se fornecido via prop/variável de ambiente)
 */

const CUSTO_COLORS = ["#FFE7A3", "#F4C430", "#C8CBD3"]; // deduções (claro), CPV (dourado), despesas op (cinza)
const PIE_COLORS   = ["#F4C430", "#BFA22A", "#8C7C1F"];  // tons de dourado

const money = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
const percent = (v, d=1) => `${(Number(v) || 0).toFixed(d)}%`;

export default function DREDashboard({ dreLink }) {
  const { months = [], loading, valueAt } = useDREData();
  const [mes, setMes] = useState(() => months?.[months.length - 1] || null);

  // Estado da UI
  const [tab, setTab] = useState("destaques"); // destaques | projecoes | graficos | config

  // Config persistida (LocalStorage)
  const [config, setConfig] = useState(() => {
    const raw = localStorage.getItem("dre_config_bc");
    return raw ? JSON.parse(raw) : {
      taxaProjReceitaPct: 2.0,         // % ao mês (override da projeção automática)
      usarTaxaManual: false,
      capitalInvestido: 0,            // usado para ROI se não houver no DRE
      campoCapitalInvestido: "capital_investido",
      campoCPV: "custos_totais",      // alias para CPV no CSV
      campoCustoFixo: "custos_fixos", // se existir, senão estima
      mesesParaCAGR: 6,               // janelamento para CAGR de projeção
    };
  });

  useEffect(() => {
    localStorage.setItem("dre_config_bc", JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    if (months?.length) setMes(months[months.length - 1]);
  }, [months]);

  // ---------- Leitura base (mês selecionado) ----------
  const receitaLiquida = useMemo(() => valueAt("receita_liquida", mes), [mes, valueAt]);
  const receitaBruta   = useMemo(() => valueAt("faturamento_bruto", mes), [mes, valueAt]);
  const cpvCampo       = config.campoCPV || "custos_totais";
  const cpv            = useMemo(() => valueAt(cpvCampo, mes), [mes, valueAt, cpvCampo]);
  const despesasAdm    = useMemo(() => valueAt("despesas_adm", mes), [mes, valueAt]);
  const despesasCom    = useMemo(() => valueAt("despesas_comercial", mes), [mes, valueAt]);
  const despesasLog    = useMemo(() => valueAt("despesas_logistica", mes), [mes, valueAt]);
  const ebitda         = useMemo(() => valueAt("ebitda", mes), [mes, valueAt]);
  const lucroLiquido   = useMemo(() => valueAt("lucro_liquido", mes), [mes, valueAt]);
  const deducoes       = useMemo(() => valueAt("deducoes", mes), [mes, valueAt]);

  const custosFixosVal = useMemo(() => {
    const cf = valueAt(config.campoCustoFixo, mes);
    if (cf || cf === 0) return cf;
    // fallback: estima custo fixo como despesas operacionais (adm+com+log)
    return (Number(despesasAdm) || 0) + (Number(despesasCom) || 0) + (Number(despesasLog) || 0);
  }, [mes, valueAt, config.campoCustoFixo, despesasAdm, despesasCom, despesasLog]);

  // Indicadores financeiros adicionais (opcionais no DRE)
  const inadMes       = useMemo(() => valueAt("inadimplencia_mes", mes) || 0, [mes, valueAt]);
  const inadAcum      = useMemo(() => valueAt("inadimplencia_acumulada", mes) || 0, [mes, valueAt]);
  const prazoPgto     = useMemo(() => valueAt("prazo_medio_pagar", mes) || valueAt("pmp", mes) || 0, [mes, valueAt]);
  const prazoReceb    = useMemo(() => valueAt("prazo_medio_receber", mes) || valueAt("pmr", mes) || 0, [mes, valueAt]);
  const cicloCaixa    = useMemo(() => (Number(prazoReceb) || 0) - (Number(prazoPgto) || 0), [prazoReceb, prazoPgto]);

  // Lucro Bruto e margens
  const lucroBruto    = useMemo(() => (Number(receitaLiquida) || 0) - (Number(cpv) || 0), [receitaLiquida, cpv]);
  const margemBruta   = useMemo(() => receitaLiquida ? (lucroBruto / receitaLiquida) * 100 : 0, [lucroBruto, receitaLiquida]);
  const margemEbitda  = useMemo(() => receitaLiquida ? (ebitda / receitaLiquida) * 100 : 0, [ebitda, receitaLiquida]);
  const margemLL      = useMemo(() => receitaLiquida ? (lucroLiquido / receitaLiquida) * 100 : 0, [lucroLiquido, receitaLiquida]);
  const ebitdaPct     = margemEbitda; // alias
  const custoFixoReceitaPct = useMemo(() => receitaLiquida ? (custosFixosVal / receitaLiquida) * 100 : 0, [custosFixosVal, receitaLiquida]);

  // ROI
  const capitalDRE    = useMemo(() => valueAt(config.campoCapitalInvestido, mes) || 0, [mes, valueAt, config.campoCapitalInvestido]);
  const capitalUsado  = Number(capitalDRE) > 0 ? Number(capitalDRE) : Number(config.capitalInvestido) || 0;
  const roiPct        = useMemo(() => capitalUsado ? (Number(lucroLiquido) / capitalUsado) * 100 : 0, [lucroLiquido, capitalUsado]);

  // ---------- Séries para gráficos ----------
  const estruturaData = useMemo(() => months.map((m) => {
    const ded = valueAt("deducoes", m) || 0;
    const cus = valueAt(cpvCampo, m) || 0;
    const despOp = (valueAt("despesas_adm", m) || 0) + (valueAt("despesas_comercial", m) || 0) + (valueAt("despesas_logistica", m) || 0);
    return {
      mes: String(m).toUpperCase(),
      Deducoes: Math.abs(ded),
      Custos: Math.abs(cus),
      "Despesas op": Math.abs(despOp),
    };
  }), [months, valueAt, cpvCampo]);

  const receitaCustos = useMemo(() => months.map((m) => ({
    mes: String(m).toUpperCase(),
    Receita: valueAt("receita_liquida", m) || 0,
    "Custos Totais": -(Math.abs(valueAt(cpvCampo, m) || 0)),
  })), [months, valueAt, cpvCampo]);

  const despesasBreak = useMemo(() => ([
    { nome: "Administrativas", valor: Math.abs(despesasAdm || 0) },
    { nome: "Comerciais",      valor: Math.abs(despesasCom || 0) },
    { nome: "Logística",       valor: Math.abs(despesasLog || 0) },
  ]), [despesasAdm, despesasCom, despesasLog]);

  const compReceita = useMemo(() => {
    const serv = valueAt("receitas_servicos", mes);
    const rev  = valueAt("receitas_revenda", mes);
    const fab  = valueAt("receitas_fabricacao", mes);
    const items = [
      { name: "Serviços", value: Math.max(0, serv || 0) },
      { name: "Revenda",  value: Math.max(0, rev || 0)  },
      { name: "Fabricação", value: Math.max(0, fab || 0) },
    ].filter(i => i.value > 0);
    return items.length ? items : [{ name: "Receita Líquida", value: Math.max(0, receitaLiquida || 0) }];
  }, [mes, valueAt, receitaLiquida]);

  // ---------- Projeções ----------
  const serieReceita = useMemo(() => months.map(m => ({ m, v: Number(valueAt("receita_liquida", m) || 0) })), [months, valueAt]);

  // CAGR dos últimos N meses (se houver volume suficiente)
  const proj = useMemo(() => {
    const N = Math.min(Number(config.mesesParaCAGR) || 6, serieReceita.length);
    const horizon = 12; // projeta 12 meses à frente
    const out = [];

    if (config.usarTaxaManual) {
      const g = (Number(config.taxaProjReceitaPct) || 0) / 100; // taxa mensal
      const lastV = serieReceita[serieReceita.length - 1]?.v || 0;
      for (let i = 1; i <= horizon; i++) {
        out.push({ idx: i, valor: lastV * Math.pow(1 + g, i) });
      }
      return { metodo: "taxa-manual", taxaMensal: g * 100, pontos: out };
    }

    if (N >= 2) {
      const tail = serieReceita.slice(-N);
      const first = tail[0].v || 0;
      const last  = tail[tail.length - 1].v || 0;
      const g = first > 0 ? Math.pow(last / first, 1 / (N - 1)) - 1 : 0; // taxa média mensal
      for (let i = 1; i <= horizon; i++) {
        out.push({ idx: i, valor: (last || 0) * Math.pow(1 + g, i) });
      }
      return { metodo: "cagr", taxaMensal: g * 100, pontos: out };
    }
    return { metodo: "insuficiente", taxaMensal: 0, pontos: [] };
  }, [serieReceita, config.usarTaxaManual, config.taxaProjReceitaPct, config.mesesParaCAGR]);

  const chartProjData = useMemo(() => {
    const actual = months.map((m) => ({ label: String(m).toUpperCase(), Receita: valueAt("receita_liquida", m) || 0 }));
    const baseLabel = months[months.length - 1] ? String(months[months.length - 1]).toUpperCase() : "";
    const future = proj.pontos.map((p, i) => ({ label: `${baseLabel} +${i+1}m`, Projecao: p.valor }));
    return [...actual, ...future];
  }, [months, valueAt, proj]);

  // ---------- UI ----------
  if (loading) return <div className="dre-loading">Carregando DRE...</div>;
  if (!months?.length) return <div className="dre-loading">Não encontrei meses válidos no CSV do DRE.</div>;

  return (
    <div className="dre-page bg-gray-50">
      {/* Top bar */}
      <div className="dre-toolbar">
        <div className="dre-tabs">
          <button className={tab === "destaques" ? "active" : ""} onClick={() => setTab("destaques")}>Indicadores</button>
          <button className={tab === "projecoes" ? "active" : ""} onClick={() => setTab("projecoes")}>Projeção</button>
          <button className={tab === "graficos" ? "active" : ""} onClick={() => setTab("graficos")}>Gráficos</button>
          <button className={tab === "config" ? "active" : ""} onClick={() => setTab("config")}>Config</button>
        </div>
        <div className="dre-select">
          <label>Mês</label>
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>{String(m).toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Link para DRE bruto, se existir */}
      {dreLink && (
        <div className="dre-link">
          <a href={dreLink} target="_blank" rel="noreferrer">Abrir DRE (origem)</a>
        </div>
      )}

      {tab === "destaques" && (
        <>
          {/* Cards com KPI — valor e % lado a lado */}
          <section className="dre-cards dre-cards-grid">
            <div className="dre-card">
              <h4>Margem Bruta (Comercial)</h4>
              <div className="dre-card-row">
                <div>
                  <small>Lucro Bruto</small>
                  <div className="dre-card-value">{money(lucroBruto)}</div>
                </div>
                <div className="dre-card-pct">{percent(margemBruta)}</div>
              </div>
              <p className="dre-note">Lucro Bruto = Receita Líquida – CPV</p>
            </div>
            <div className="dre-card">
              <h4>Margem Operacional (EBITDA)</h4>
              <div className="dre-card-row">
                <div>
                  <small>EBITDA</small>
                  <div className="dre-card-value">{money(ebitda)}</div>
                </div>
                <div className="dre-card-pct">{percent(margemEbitda)}</div>
              </div>
            </div>
            <div className="dre-card">
              <h4>Lucro Líquido</h4>
              <div className="dre-card-row">
                <div>
                  <small>Valor</small>
                  <div className="dre-card-value">{money(lucroLiquido)}</div>
                </div>
                <div className="dre-card-pct">{percent(margemLL)}</div>
              </div>
            </div>
            <div className="dre-card">
              <h4>Custo Fixo / Receita</h4>
              <div className="dre-card-row">
                <div>
                  <small>Custos Fixos</small>
                  <div className="dre-card-value">{money(custosFixosVal)}</div>
                </div>
                <div className="dre-card-pct">{percent(custoFixoReceitaPct)}</div>
              </div>
            </div>
            <div className="dre-card">
              <h4>ROI</h4>
              <div className="dre-card-row">
                <div>
                  <small>Capital</small>
                  <div className="dre-card-value">{money(capitalUsado)}</div>
                </div>
                <div className={roiPct >= 0 ? "dre-card-pct" : "dre-card-pct negative"}>{percent(roiPct)}</div>
              </div>
              <p className="dre-note">LL ÷ Capital Investido</p>
            </div>
            <div className="dre-card">
              <h4>Inadimplência</h4>
              <div className="dre-card-row">
                <div>
                  <small>Mês</small>
                  <div className="dre-card-value">{percent(inadMes, 1)}</div>
                </div>
                <div>
                  <small>Acumulada</small>
                  <div className="dre-card-value">{percent(inadAcum, 1)}</div>
                </div>
              </div>
            </div>
            <div className="dre-card">
              <h4>Ciclo de Caixa</h4>
              <div className="dre-card-row">
                <div>
                  <small>PMR (dias)</small>
                  <div className="dre-card-value">{Number(prazoReceb) || 0}</div>
                </div>
                <div>
                  <small>PMP (dias)</small>
                  <div className="dre-card-value">{Number(prazoPgto) || 0}</div>
                </div>
                <div className={cicloCaixa >= 0 ? "dre-card-pct" : "dre-card-pct negative"}>{(Number(cicloCaixa) || 0)}d</div>
              </div>
            </div>
          </section>

          {/* Destaques rápidos */}
          <section className="dre-grid">
            <div className="dre-panel">
              <h3>Estrutura DRE</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={estruturaData} stackOffset="sign">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip formatter={(v) => money(v)} />
                  <Legend />
                  <Bar dataKey="Deducoes" stackId="a" fill={CUSTO_COLORS[0]} />
                  <Bar dataKey="Custos" stackId="a" fill={CUSTO_COLORS[1]} />
                  <Bar dataKey="Despesas op" stackId="a" fill={CUSTO_COLORS[2]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="dre-panel">
              <h3>Receita x Custos</h3>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={receitaCustos}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip formatter={(v) => money(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="Receita" stroke="#22c55e" dot />
                  <Line type="monotone" dataKey="Custos Totais" stroke="#ef4444" dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="dre-grid">
            <div className="dre-panel">
              <h3>Quebra de Despesas</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={despesasBreak} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="nome" />
                  <Tooltip formatter={(v) => money(v)} />
                  <Bar dataKey="valor" fill="#F4C430" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="dre-panel">
              <h3>Composição da Receita</h3>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Tooltip formatter={(v) => money(v)} />
                  <Pie data={compReceita} dataKey="value" nameKey="name" innerRadius={70} outerRadius={120} paddingAngle={2}>
                    {compReceita.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}

      {tab === "projecoes" && (
        <section className="dre-grid single">
          <div className="dre-panel">
            <div className="dre-panel-head">
              <h3>Projeção de Receita (12 meses)</h3>
              <div className="dre-badge">
                {proj.metodo === "taxa-manual" ? `Taxa manual: ${percent(proj.taxaMensal, 1)}` :
                 proj.metodo === "cagr" ? `CAGR(${config.mesesParaCAGR}m): ${percent(proj.taxaMensal, 1)}` :
                 "Sem dados para projetar"}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartProjData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(v) => money(v)} />
                <Legend />
                <Area type="monotone" dataKey="Receita" stroke="#16a34a" fillOpacity={1} fill="url(#colA)" />
                <Area type="monotone" dataKey="Projecao" stroke="#3b82f6" strokeDasharray="5 5" fillOpacity={1} fill="url(#colB)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {tab === "graficos" && (
        <section className="dre-grid single">
          <div className="dre-panel">
            <h3>Margens (%) ao longo do tempo</h3>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={months.map((m) => {
                const rl = valueAt("receita_liquida", m) || 0;
                const ebt = valueAt("ebitda", m) || 0;
                const cpvM = valueAt(cpvCampo, m) || 0;
                const lb  = rl - cpvM;
                const ll  = valueAt("lucro_liquido", m) || 0;
                return {
                  mes: String(m).toUpperCase(),
                  "Bruta": rl ? (lb/rl)*100 : 0,
                  "EBITDA": rl ? (ebt/rl)*100 : 0,
                  "Líquida": rl ? (ll/rl)*100 : 0,
                };
              })}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis unit="%" />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Legend />
                <Line type="monotone" dataKey="Bruta" stroke="#10b981" dot={false} />
                <Line type="monotone" dataKey="EBITDA" stroke="#6366f1" dot={false} />
                <Line type="monotone" dataKey="Líquida" stroke="#f97316" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {tab === "config" && (
        <section className="dre-grid single">
          <div className="dre-panel">
            <h3>Configuração (Tab de Conf.)</h3>
            <div className="dre-form-grid">
              <fieldset>
                <legend>Projeção</legend>
                <label className="row">
                  <input type="checkbox" checked={config.usarTaxaManual} onChange={e => setConfig({ ...config, usarTaxaManual: e.target.checked })} />
                  <span>Usar taxa manual em vez de CAGR</span>
                </label>
                <label>
                  Taxa manual (% ao mês)
                  <input type="number" step="0.1" value={config.taxaProjReceitaPct}
                    onChange={e => setConfig({ ...config, taxaProjReceitaPct: Number(e.target.value) })} />
                </label>
                <label>
                  Meses para CAGR
                  <input type="number" min={2} max={24} value={config.mesesParaCAGR}
                    onChange={e => setConfig({ ...config, mesesParaCAGR: Number(e.target.value) })} />
                </label>
              </fieldset>

              <fieldset>
                <legend>Campos do DRE</legend>
                <label>
                  Campo CPV / Custos
                  <input type="text" value={config.campoCPV}
                    onChange={e => setConfig({ ...config, campoCPV: e.target.value })} />
                </label>
                <label>
                  Campo Custos Fixos
                  <input type="text" value={config.campoCustoFixo}
                    onChange={e => setConfig({ ...config, campoCustoFixo: e.target.value })} />
                </label>
                <label>
                  Campo Capital Investido
                  <input type="text" value={config.campoCapitalInvestido}
                    onChange={e => setConfig({ ...config, campoCapitalInvestido: e.target.value })} />
                </label>
              </fieldset>

              <fieldset>
                <legend>Capital / ROI (fallback)</legend>
                <label>
                  Capital Investido (R$)
                  <input type="number" step="1000" value={config.capitalInvestido}
                    onChange={e => setConfig({ ...config, capitalInvestido: Number(e.target.value) })} />
                </label>
              </fieldset>
            </div>

            <div className="dre-hints">
              <p>Se algum campo não existir no CSV do DRE, preencha os aliases acima ou valores de fallback.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
