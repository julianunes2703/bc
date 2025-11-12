import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  ComposedChart
} from "recharts";
import { useDREData } from "../../hooks/useDREData";
import "../DRE/DRE.css";

/**
 * DRE Anual — versão simplificada
 * Soma todos os meses disponíveis no CSV (assumindo que já pertencem ao mesmo ano)
 * e exibe totais + margens + gráfico mensal.
 */

const money = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });
const percent = (v, d = 1) => `${(Number(v) || 0).toFixed(d)}%`;

export default function DREAnual() {
  const { months = [], loading, valueAt } = useDREData();

  const cpvCampo = "custos_totais";
  const custoFixoCampo = "custos_fixos";

  // --- linhas mensais (mantém rótulos originais)
  const linhasMensais = useMemo(() => {
    return months.map((m) => {
      const rl =
        Number(valueAt("receita_liquida", m) || valueAt("faturamento_bruto", m) || 0);
      const cpv = Number(valueAt(cpvCampo, m) || 0);
      const ebt = Number(valueAt("ebitda", m) || 0);
      const ebit = Number(valueAt("lucro_operacional", m) || 0);
      const ll = Number(valueAt("lucro_liquido", m) || 0);
      const cf =
        valueAt(custoFixoCampo, m) ??
        (Number(valueAt("despesas_adm", m) || 0) +
          Number(valueAt("despesas_comercial", m) || 0) +
          Number(valueAt("despesas_logistica", m) || 0));

      return {
        mes: String(m).toUpperCase(),
        receita: rl,
        cpv,
        ebitda: ebt,
        ebit,
        ll,
        custosFixos: Number(cf) || 0,
      };
    });
  }, [months, valueAt]);

  // --- totais e margens ---
  const totais = useMemo(() => {
    const sum = (k) => linhasMensais.reduce((acc, r) => acc + (Number(r[k]) || 0), 0);
    const receita = sum("receita");
    const cpv = sum("cpv");
    const ebitda = sum("ebitda");
    const ebit = sum("ebit");
    const ll = sum("ll");
    const custosFixos = sum("custosFixos");
    const margem = (num) => (receita ? (num / receita) * 100 : 0);

    return {
      receita,
      cpv,
      ebitda,
      ebit,
      ll,
      custosFixos,
      margemEbitda: margem(ebitda),
      margemOper: margem(ebit),
      margemLL: margem(ll),
      margemBruta: margem(Math.max(0, receita - cpv)),
    };
  }, [linhasMensais]);

  const chartData = useMemo(
    () =>
      linhasMensais.map((r) => ({
        Mes: r.mes,
        Faturamento: r.receita,
        EBITDA: r.ebitda,
        EBIT: r.ebit,
        "Lucro Líquido": r.ll,
      })),
    [linhasMensais]
  );

  if (loading)
    return <div className="dre-loading">Carregando DRE...</div>;
  if (!months?.length)
    return (
      <div className="dre-loading">
        Não encontrei meses válidos no CSV do DRE.
      </div>
    );

  return (
    <div className="dre-page bg-gray-50">
      <div className="dre-toolbar">
        <h3 style={{ margin: 0 }}>DRE Anual (Consolidado)</h3>
      </div>

      {/* KPIs do Ano */}
      <section className="dre-cards dre-cards-grid">
        <div className="dre-card">
          <h4>Receita Líquida (Ano)</h4>
          <div className="dre-card-row">
            <div className="dre-card-value">{money(totais.receita)}</div>
          </div>
        </div>

        <div className="dre-card">
          <h4>EBITDA (Ano)</h4>
          <div className="dre-card-row">
            <div>
              <small>Valor</small>
              <div className="dre-card-value">{money(totais.ebitda)}</div>
            </div>
            <div className="dre-card-pct">{percent(totais.margemEbitda)}</div>
          </div>
        </div>

        <div className="dre-card">
          <h4>Margem Operacional</h4>
          <div className="dre-card-row">
            <div>
              <small>EBIT</small>
              <div className="dre-card-value">{money(totais.ebit)}</div>
            </div>
            <div className="dre-card-pct">{percent(totais.margemOper)}</div>
          </div>
        </div>

        <div className="dre-card">
          <h4>Lucro Líquido</h4>
          <div className="dre-card-row">
            <div>
              <small>Valor</small>
              <div className="dre-card-value">{money(totais.ll)}</div>
            </div>
            <div className="dre-card-pct">{percent(totais.margemLL)}</div>
          </div>
        </div>

        <div className="dre-card">
          <h4>Margem Bruta</h4>
          <div className="dre-card-row">
            <div>
              <small>Lucro Bruto</small>
              <div className="dre-card-value">
                {money(Math.max(0, totais.receita - totais.cpv))}
              </div>
            </div>
            <div className="dre-card-pct">{percent(totais.margemBruta)}</div>
          </div>
        </div>
      </section>

              <section className="dre-grid single">
                <div className="dre-panel">
                  <h3>Faturamento × EBITDA</h3>
                  <ResponsiveContainer width="100%" height={340}>
                    <ComposedChart
                      data={months.map((m) => ({
                        mes: String(m).toUpperCase(),
                        Faturamento:
                          Number(valueAt("faturamento_bruto", m) || valueAt("receita_liquida", m) || 0),
                        EBITDA: Number(valueAt("ebitda", m) || 0),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" />
                      <YAxis />
                      <Tooltip formatter={(v) => money(v)} />
                      <Legend />
      
                      {/* Barra de Faturamento */}
                      <Bar dataKey="Faturamento" fill="#000000ff" name="Faturamento" />
      
                      {/* Linha de EBITDA */}
                      <Line
                        type="monotone"
                        dataKey="EBITDA"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        name="EBITDA"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </section>

      {/* Tabela Mensal + Total */}
      <section className="dre-grid single">
        <div className="dre-panel">
          <h3>Resumo Mensal</h3>
          <div className="dre-table-wrap">
            <table className="dre-table dre-table-yellow">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Faturamento</th>
                  <th>EBITDA</th>
                  <th>EBIT</th>
                  <th>Lucro Líquido</th>
                </tr>
              </thead>
              <tbody>
                {linhasMensais.map((r) => (
                  <tr key={r.mes}>
                    <td className="cell-mes">
                      <strong>{r.mes}</strong>
                    </td>
                    <td className="num">{money(r.receita)}</td>
                    <td className="num">{money(r.ebitda)}</td>
                    <td className="num">{money(r.ebit)}</td>
                    <td className="num">{money(r.ll)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="dre-total-row">
                  <td><strong>Total</strong></td>
                  <td className="num"><strong>{money(totais.receita)}</strong></td>
                  <td className="num"><strong>{money(totais.ebitda)}</strong></td>
                  <td className="num"><strong>{money(totais.ebit)}</strong></td>
                  <td className="num"><strong>{money(totais.ll)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      
    </div>
  );
}
