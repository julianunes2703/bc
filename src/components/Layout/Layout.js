// src/components/DashboardLayout.jsx
import React, { useState } from "react";
import DREDashboard from "../DRE/DRE";


import "./Layout.css";
import DREAnual from "../DREAnual/DREAnual";


export default function DashboardLayout() {
  const [selectedMenu, setSelectedMenu] = useState("obras");

  const renderContent = () => {
    switch (selectedMenu) {
      // Financeiro
      case "dre":
        return <DREDashboard />;
      case "dreAnual":
        return <DREAnual/>

      default:
        return <DREAnual/>;
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>B&C Transportes</h2>
          <h3 className="blue">By Consulting Blue</h3>
        </div>

        <nav>
          <ul>
            {/* Seção Financeiro */}
            <li className="submenu-title"> Financeiro</li>
            <li
              className={selectedMenu === "dreAnual" ? "active" : ""}
              onClick={() => setSelectedMenu("dreAnual")}
            >
              • DRE Anual
            </li>

            <li
              className={selectedMenu === "dre" ? "active" : ""}
              onClick={() => setSelectedMenu("dre")}
            >
              • DRE por mês
            </li>
          


          </ul>
        </nav>
      </aside>

      {/* Conteúdo principal */}
      <main className="dashboard-content">{renderContent()}</main>
    </div>
  );
}
