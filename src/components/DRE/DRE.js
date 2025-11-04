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
 * Correção: separar Margem Operacional (Lucro Operacional) e EBITDA usando o campo lógico "lucro_operacional".
 */

const PIE_COLORS = ["#F4C430", "#BFA22A", "#8C7C1F"];

const money = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });
const percent = (v, d = 1) => `${(Number(v) || 0).toFixed(d)}%`;

export default function DREDashboard({ dreLink }) {
  const { months = [], loading, valueAt } = useDREData();
  const [mes, setMes] = useState(() => months?.[months.length - 1] || null);
  const [tab, setTab] = useState("destaques"); // destaques | projecoes | graficos | config

  // Config persistida
  const [config, setConfig] = useState(() => {
    const raw = localStorage.getItem("dre_config_bc");
    return raw
      ? JSON.parse(raw)
      : {
          taxaProjReceitaPct: 2.0, // % ao mês
          usarTaxaManual: false,
          capitalInvestido: 0,
          campoCapitalInvestido: "capital_investido",
          campoCPV: "custos_totais",
          campoCustoFixo: "custos_fixos",
          mesesParaCAGR: 6,
        };
  });

  useEffect(() => {
    localStorage.setItem("dre_config_bc", JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    if (months?.length) setMes(months[months.length - 1]);
  }, [months]);

  // ---------- Leitura base (mês selecionado) ----------
  const receitaLiquida = useMemo(
    () => valueAt("receita_liquida", mes),
    [mes, valueAt]
  );
  const cpvCampo = config.campoCPV || "custos_totais";
  const cpv = useMemo(() => valueAt(cpvCampo, mes), [mes, valueAt, cpvCampo]);

  const despesasAdm = useMemo(() => valueAt("despesas_adm", mes), [mes, valueAt]);
  const despesasCom = useMemo(() => valueAt("despesas_comercial", mes), [mes, valueAt]);
  const despesasLog = useMemo(() => valueAt("despesas_logistica", mes), [mes, valueAt]);

  const ebitda = useMemo(() => valueAt("ebitda", mes), [mes, valueAt]);
  const lucroOperacional = useMemo(
    () => valueAt("lucro_operacional", mes), // hook cobre aliases: "lucro operacional (ebit)", "lucro operacional ebit", "ebit"
    [mes, valueAt]
  );
  const lucroLiquido = useMemo(() => valueAt("lucro_liquido", mes), [mes, valueAt]);

  // Indicadores adicionais
  const inadMes = useMemo(() => valueAt("inadimplencia_mes", mes) || 0, [mes, valueAt]);
  const inadAcum = useMemo(() => valueAt("inadimplencia_acumulada", mes) || 0, [mes, valueAt]);
  const prazoPgto = useMemo(
    () => valueAt("prazo_medio_pagar", mes) || valueAt("pmp", mes) || 0,
    [mes, valueAt]
  );
  const prazoReceb = useMemo(
    () => valueAt("prazo_medio_receber", mes) || valueAt("pmr", mes) || 0,
    [mes, valueAt]
  );
  const cicloCaixa = useMemo(
    () => (Number(prazoReceb) || 0) - (Number(prazoPgto) || 0),
    [prazoReceb, prazoPgto]
  );

  // Lucro Bruto e Margem Bruta (usa DRE se existir; senão RL - CPV)
  const lucroBruto = useMemo(() => {
    const lbDre = valueAt("lucro_bruto", mes);
    const lb =
      lbDre || lbDre === 0
        ? Number(lbDre)
        : (Number(receitaLiquida) || 0) - (Number(cpv) || 0);
    return Number.isFinite(lb) ? lb : 0;
  }, [mes, valueAt, receitaLiquida, cpv]);

  const margemBruta = useMemo(() => {
    const rl = Number(receitaLiquida) || 0;
    if (!rl) return 0;
    const mb = (Number(lucroBruto) || 0) / rl * 100;
    return Number.isFinite(mb) ? mb : 0;
  }, [lucroBruto, receitaLiquida]);

  // Margens principais (fórmulas exatas)
  const margemEbitda = useMemo(
    () => (receitaLiquida ? ((Number(ebitda) || 0) / receitaLiquida) * 100 : 0),
    [ebitda, receitaLiquida]
  );
  const margemOper = useMemo(
    () => (receitaLiquida ? ((Number(lucroOperacional) || 0) / receitaLiquida) * 100 : 0),
    [lucroOperacional, receitaLiquida]
  );
  const margemLL = useMemo(
    () => (receitaLiquida ? ((Number(lucroLiquido) || 0) / receitaLiquida) * 100 : 0),
    [lucroLiquido, receitaLiquida]
  );

  // Custos fixos (valor e % da receita)
  const custosFixosVal = useMemo(() => {
    const cf = valueAt(config.campoCustoFixo, mes);
    if (cf || cf === 0) return cf;
    // fallback: despesas operacionais (adm+com+log)
    return (
      (Number(despesasAdm) || 0) +
      (Number(despesasCom) || 0) +
      (Number(despesasLog) || 0)
    );
  }, [mes, valueAt, config.campoCustoFixo, despesasAdm, despesasCom, despesasLog]);

  const custoFixoReceitaPct = useMemo(
    () => (receitaLiquida ? (custosFixosVal / receitaLiquida) * 100 : 0),
    [custosFixosVal, receitaLiquida]
  );

  // ROI
  const capitalDRE = useMemo(
    () => valueAt(config.campoCapitalInvestido, mes) || 0,
    [mes, valueAt, config.campoCapitalInvestido]
  );
  const capitalUsado =
    Number(capitalDRE) > 0 ? Number(capitalDRE) : Number(config.capitalInvestido) || 0;
  const roiPct = useMemo(
    () => (capitalUsado ? (Number(lucroLiquido) / capitalUsado) * 100 : 0),
    [lucroLiquido, capitalUsado]
  );

  // ---------- Séries para gráficos ----------
  // Estrutura DRE (Faturamento, EBITDA, EBIT e Geração de Caixa)

 const receitaCustos = useMemo(
  () =>
    months.map((m) => {
      const faturamento =
        (valueAt("faturamento_bruto", m) || 0) ||
        (valueAt("receita_liquida", m) || 0);

      return {
        mes: String(m).toUpperCase(),
        Faturamento: Number(faturamento) || 0,
        "Custos Totais": Math.abs(Number(valueAt(cpvCampo, m) || 0)),
        "Despesas Adm.": Math.abs(Number(valueAt("despesas_adm", m) || 0)),
        "Despesas Comerciais": Math.abs(Number(valueAt("despesas_comercial", m) || 0)),
        "Despesas Logística": Math.abs(Number(valueAt("despesas_logistica", m) || 0)),
      };
    }),
  [months, valueAt, cpvCampo]
);


  const despesasBreak = useMemo(
    () => [
      { nome: "Administrativas", valor: Math.abs(despesasAdm || 0) },
      { nome: "Comerciais", valor: Math.abs(despesasCom || 0) },
      { nome: "Logística", valor: Math.abs(despesasLog || 0) },
    ],
    [despesasAdm, despesasCom, despesasLog]
  );

  const compReceita = useMemo(() => {
  // tenta cobrir variações de nome de campo
  const mao =
    valueAt("receita_mao_de_obra", mes) ??
    valueAt("receitas_mao_de_obra", mes) ??
    0;

  const loc =
    valueAt("receita_locacao", mes) ??
    valueAt("receitas_locacao", mes) ??
    0;

  const items = [
    { name: "Mão de obra", value: Math.max(0, Number(mao) || 0) },
    { name: "Locação",    value: Math.max(0, Number(loc) || 0) },
  ];

  // se ambas são 0 e existir receita líquida, opcionalmente mostrar um total único
  const totalMOeLoc = items[0].value + items[1].value;
  if (totalMOeLoc === 0 && (Number(receitaLiquida) || 0) > 0) {
    // comente esta seção se quiser *sempre* ver as duas categorias mesmo somando 0
    return items; // <- deixe assim para manter "Mão de obra" e "Locação" com 0
    // return [{ name: "Receita Líquida", value: Math.max(0, Number(receitaLiquida) || 0) }];
  }

  return items;
}, [mes, valueAt, receitaLiquida]);


  // ---------- Projeções ----------
  const serieReceita = useMemo(
    () => months.map((m) => ({ m, v: Number(valueAt("receita_liquida", m) || 0) })),
    [months, valueAt]
  );
  const serieCustos = useMemo(
    () => months.map((m) => ({ m, v: Number(valueAt(cpvCampo, m) || 0) })),
    [months, valueAt, cpvCampo]
  );
  const serieDespesas = useMemo(
    () =>
      months.map((m) => {
        const v =
          (valueAt("despesas_adm", m) || 0) +
          (valueAt("despesas_comercial", m) || 0) +
          (valueAt("despesas_logistica", m) || 0);
        return { m, v: Number(v) };
      }),
    [months, valueAt]
  );

  // Tabela Estrutura DRE (linhas = meses; colunas = métricas com Meta/Real)
      const estruturaTable = useMemo(
        () =>
          months.map((m) => {
            const faturamento =
              (valueAt("faturamento_bruto", m) || 0) ||
              (valueAt("receita_liquida", m) || 0);
            const ebt = valueAt("ebitda", m) || 0;
            const ebit = valueAt("lucro_operacional", m) || 0;
            const ll  = valueAt("lucro_liquido", m) || 0;

            return {
              mes: String(m).toUpperCase(),
              EBITDA_meta: 0,
              EBITDA_real: Number(ebt) || 0,
              EBIT_meta: 0,
              EBIT_real: Number(ebit) || 0,
              Faturamento_meta: 0,
              Faturamento_real: Number(faturamento) || 0,
              LL_meta: 0,
              LL_real: Number(ll) || 0,
            };
          }),
        [months, valueAt]
      );


  const projectSerie = (serie, cfg) => {
    const horizon = 12;
    const out = [];
    if (!serie.length) return { metodo: "insuficiente", taxaMensal: 0, pontos: out };

    if (cfg.usarTaxaManual) {
      const g = (Number(cfg.taxaProjReceitaPct) || 0) / 100;
      const lastV = serie[serie.length - 1]?.v || 0;
      for (let i = 1; i <= horizon; i++) out.push(lastV * Math.pow(1 + g, i));
      return { metodo: "taxa-manual", taxaMensal: g * 100, pontos: out };
    }

    const N = Math.min(Number(cfg.mesesParaCAGR) || 6, serie.length);
    if (N >= 2) {
      const tail = serie.slice(-N);
      const first = tail[0].v || 0;
      const last = tail[tail.length - 1].v || 0;
      const g = first > 0 ? Math.pow((last || 0) / first, 1 / (N - 1)) - 1 : 0;
      for (let i = 1; i <= 12; i++) out.push((last || 0) * Math.pow(1 + g, i));
      return { metodo: "cagr", taxaMensal: g * 100, pontos: out };
    }
    return { metodo: "insuficiente", taxaMensal: 0, pontos: out };
  };

  const proj = useMemo(
    () => ({
      receita: projectSerie(serieReceita, config),
      custos: projectSerie(serieCustos, config),
      despesas: projectSerie(serieDespesas, config),
    }),
    [serieReceita, serieCustos, serieDespesas, config]
  );

  const chartProjData = useMemo(() => {
    const actual = months.map((m, idx) => ({
      label: String(m).toUpperCase(),
      Receita: serieReceita[idx]?.v || 0,
      Custos: serieCustos[idx]?.v || 0,
      Despesas: serieDespesas[idx]?.v || 0,
    }));

    const baseLabel = months[months.length - 1]
      ? String(months[months.length - 1]).toUpperCase()
      : "";

    const future = Array.from({
      length: Math.max(
        proj.receita.pontos.length,
        proj.custos.pontos.length,
        proj.despesas.pontos.length
      ),
    }).map((_, i) => ({
      label: `${baseLabel} +${i + 1}m`,
      ReceitaProj: proj.receita.pontos[i] ?? null,
      CustosProj: proj.custos.pontos[i] ?? null,
      DespesasProj: proj.despesas.pontos[i] ?? null,
    }));

    return [...actual, ...future];
  }, [months, serieReceita, serieCustos, serieDespesas, proj]);

  // ---------- UI ----------
  if (loading) return <div className="dre-loading">Carregando DRE...</div>;
  if (!months?.length) return <div className="dre-loading">Não encontrei meses válidos no CSV do DRE.</div>;

  return (
    <div className="dre-page bg-gray-50">
      {/* Top bar */}
      <div className="dre-toolbar">
        <div className="dre-tabs">
          <button className={tab === "destaques" ? "active" : ""} onClick={() => setTab("destaques")}>Indicadores</button>
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
          {/* Cards com KPI */}
          <section className="dre-cards dre-cards-grid">
              {/* Margem Comercial (zerada) */}
              <div className="dre-card">
                <h4>Margem Comercial</h4>
                <div className="dre-card-row">
                  <div>
                    <small>Valor</small>
                    <div className="dre-card-value">{money(0)}</div>
                  </div>
                  <div className="dre-card-pct">{percent(0)}</div>
                </div>
                <p className="dre-note"></p>
              </div>


            {/* Margem Operacional */}
                    <div className="dre-card">
                      <h4>Margem Operacional</h4>
                      <div className="dre-card-row">
                        <div>
                        { /* <small>Lucro Operacional</small>
                          <div className="dre-card-value">{money(lucroOperacional)}</div>*/}
                        </div> 
                        {/* Exibe em % */}
                        <div className="dre-card-pct  margem-operacional">{percent(margemOper)}</div>
                      </div>
                      <p className="dre-note">(Lucro Operacional ÷ Receita Líquida) × 100</p>
                    </div>


            <div className="dre-card">
              <h4>EBITDA</h4>
              <div className="dre-card-row">
                <div>
                  <small>Valor</small>
                  <div className="dre-card-value">{money(ebitda)}</div>
                </div>
                <div className="dre-card-pct">{percent(margemEbitda)}</div>
              </div>
              <p className="dre-note">EBITDA</p>
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
                <div className={cicloCaixa >= 0 ? "dre-card-pct" : "dre-card-pct negative"}>
                  {(Number(cicloCaixa) || 0)}d
                </div>
              </div>
            </div>
          </section>

                          
        {/* Destaques rápidos */}
      <section className="dre-grid single">
        <div className="dre-panel">
          <h3>Estrutura DRE</h3>

    {/* tabela responsiva */}
    <div className="dre-table-wrap">
      <table className="dre-table dre-table-yellow">
        {/* controla largura e divisórias por par Meta/Real */}
        <colgroup>
          <col style={{ width: "10rem" }} /> {/* Mês */}
          <col /><col />                     {/* EBITDA meta/real */}
          <col /><col />                     {/* EBIT meta/real */}
          <col /><col />                     {/* Faturamento meta/real */}
          <col /><col />                     {/* LL meta/real */}
        </colgroup>

        <thead>
          <tr>
            <th rowSpan={2} className="th-mes">Mês</th>
            <th colSpan={2}>EBITDA</th>
            <th colSpan={2}>EBIT</th>
            <th colSpan={2}>Faturamento</th>
            <th colSpan={2}>Lucro Líquido</th>
          </tr>
          <tr>
            <th>Meta</th><th>Real</th>
            <th>Meta</th><th>Real</th>
            <th>Meta</th><th>Real</th>
            <th>Meta</th><th>Real</th>
          </tr>
        </thead>

        <tbody>
          {estruturaTable.map((row) => (
            <tr key={row.mes}>
              <td className="cell-mes"><strong>{row.mes}</strong></td>

              <td className="num">{money(row.EBITDA_meta)}</td>
              <td className="num">{money(row.EBITDA_real)}</td>

              <td className="num">{money(row.EBIT_meta)}</td>
              <td className="num">{money(row.EBIT_real)}</td>

              <td className="num">{money(row.Faturamento_meta)}</td>
              <td className="num">{money(row.Faturamento_real)}</td>

              <td className="num">{money(row.LL_meta)}</td>
              <td className="num">{money(row.LL_real)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
                        <Legend /> {/* <- novo: mostra "Mão de obra" e "Locação" mesmo quando 0 */}
                        <Pie
                          data={compReceita}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={70}
                          outerRadius={120}
                          paddingAngle={2}
                        >
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


      {tab === "graficos" && (
        <section className="dre-grid single">
            <div className="dre-panel">
            <h3>Faturamento x Custos/Despesas</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={receitaCustos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={(v) => money(v)} />
                <Legend />

                <Line type="monotone" dataKey="Faturamento" stroke="#22c55e" dot />
                <Line type="monotone" dataKey="Custos Totais" stroke="#ef4444" dot />
                <Line type="monotone" dataKey="Despesas Adm." stroke="#f59e0b" dot />
                <Line type="monotone" dataKey="Despesas Comerciais" stroke="#0ea5e9" dot />
                <Line type="monotone" dataKey="Despesas Logística" stroke="#6366f1" dot />
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
                  <input
                    type="checkbox"
                    checked={config.usarTaxaManual}
                    onChange={(e) =>
                      setConfig({ ...config, usarTaxaManual: e.target.checked })
                    }
                  />
                  <span>Usar taxa manual em vez de CAGR</span>
                </label>
                <label>
                  Taxa manual (% ao mês)
                  <input
                    type="number"
                    step="0.1"
                    value={config.taxaProjReceitaPct}
                    onChange={(e) =>
                      setConfig({ ...config, taxaProjReceitaPct: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Meses para CAGR
                  <input
                    type="number"
                    min={2}
                    max={24}
                    value={config.mesesParaCAGR}
                    onChange={(e) =>
                      setConfig({ ...config, mesesParaCAGR: Number(e.target.value) })
                    }
                  />
                </label>
              </fieldset>

              <fieldset>
                <legend>Campos do DRE</legend>
                <label>
                  Campo CPV / Custos
                  <input
                    type="text"
                    value={config.campoCPV}
                    onChange={(e) => setConfig({ ...config, campoCPV: e.target.value })}
                  />
                </label>
                <label>
                  Campo Custos Fixos
                  <input
                    type="text"
                    value={config.campoCustoFixo}
                    onChange={(e) =>
                      setConfig({ ...config, campoCustoFixo: e.target.value })
                    }
                  />
                </label>
                <label>
                  Campo Capital Investido
                  <input
                    type="text"
                    value={config.campoCapitalInvestido}
                    onChange={(e) =>
                      setConfig({ ...config, campoCapitalInvestido: e.target.value })
                    }
                  />
                </label>
              </fieldset>

              <fieldset>
                <legend>Capital / ROI (fallback)</legend>
                <label>
                  Capital Investido (R$)
                  <input
                    type="number"
                    step="1000"
                    value={config.capitalInvestido}
                    onChange={(e) =>
                      setConfig({ ...config, capitalInvestido: Number(e.target.value) })
                    }
                  />
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
