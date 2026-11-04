const DATA = window.AVALIE_DATA;
const DATA1 = window.AVALIE1_DATA;
const DATA_SP = window.SPAECE_DATA;
const DATA_DIAG = window.DIAG_DATA;
const DATA_SAEP1 = window.SAEP1_TURMAS_DATA;
const DATA_DIAG_TURMAS = window.DIAG_TURMAS_DATA;
const DATA_IDEB = window.IDEB_DATA;
const DATA_PROTO = window.PROTOCOLO_DATA;
const ANOS_SAEP = ["1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º"];
// Escala 4º/5º/8º/9º: vermelho / amarelo / verde claro / verde escuro.
// 2º LP: Desejável=verde escuro, Suficiente=verde médio, Intermediário=verde claro,
//        Alf. incompleto=areia, Crítico=amarelo.
// 2º MAT: Avançado=verde escuro, Proficiente=verde claro, Básico=amarelo, Abaixo=vermelho.
const SIT_COLORS = {
  "Muito crítico": "#e53935",
  "Crítico": "#ffd60a",
  "Intermediário": "#8fd694",
  "Adequado": "#1b5e20",
  "Desejável": "#1b5e20",
  "Suficiente": "#2e8b57",
  "Alf. incompleto": "#c4a574",
  "Avançado": "#1b5e20",
  "Proficiente": "#8fd694",
  "Básico": "#ffd60a",
  "Abaixo do básico": "#e53935",
  "Defasagem": "#e53935",
  "Falta": "#8d99ae",
  "Não lançado": "#5b6770",
  "Não informado": "#5b6770",
};
const SIT_CLASS = {
  "Muito crítico": "sit-muito",
  "Crítico": "sit-critico",
  "Intermediário": "sit-inter",
  "Adequado": "sit-adeq",
  "Desejável": "sit-adeq",
  "Suficiente": "sit-suf",
  "Alf. incompleto": "sit-alf",
  "Avançado": "sit-adeq",
  "Proficiente": "sit-inter",
  "Básico": "sit-critico",
  "Abaixo do básico": "sit-muito",
  "Defasagem": "sit-muito",
  "Falta": "sit-falta",
  "Não lançado": "sit-ni",
  "Não informado": "sit-ni",
};
const SIT_2ANO_LP = ["Desejável", "Suficiente", "Intermediário", "Alf. incompleto", "Crítico"];
const SIT_2ANO_MAT = ["Avançado", "Proficiente", "Básico", "Abaixo do básico"];
const SIT_OUTROS = ["Muito crítico", "Crítico", "Intermediário", "Adequado"];
const SIT_AUSENCIA = ["Falta", "Não lançado"];
const SIT_ORDER = [...SIT_2ANO_LP, ...SIT_2ANO_MAT, ...SIT_OUTROS, ...SIT_AUSENCIA];

const ANOS_OK = ["2º", "4º", "5º", "8º", "9º"];
const ANOS_COMP = ["2º", "5º", "9º"];
const ANOS_CARTAS = ["1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º"];
const ORDEM_ANOS = ["1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º"];
const SIT_1AVALIE = ["Defasagem", "Intermediário", "Adequado"];
const PAGINAS_AVALIE = ["geral", "escolas", "descritores", "turmas", "alunos"];
const PADRAO_1000_UI = ["Abaixo do básico", "Básico", "Proficiente", "Avançado"];
const charts = {};

const NOME_EMTI_JOSE_MATEUS = "EMTI José Mateus Barroso";

function stripAccNome(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Espelha ESCOLA_ALIASES / canon_escola: Deputado Jonas (e variantes) → EMTI José Mateus Barroso. */
function canonEscolaNome(nome) {
  if (!nome) return nome;
  let blob = stripAccNome(nome).toUpperCase();
  blob = blob.replace(/E\.?\s*M\.?\s*T\.?\s*I\.?/g, " ");
  blob = blob.replace(/E\.?\s*E\.?\s*F\.?/g, " ");
  const aliases = [
    ["DEPUTADO JONAS", NOME_EMTI_JOSE_MATEUS],
    ["JONAS", NOME_EMTI_JOSE_MATEUS],
  ];
  let best = null;
  for (const [alias, official] of aliases) {
    const key = stripAccNome(alias).toUpperCase();
    if (key && blob.includes(key) && (!best || key.length > best[0])) {
      best = [key.length, official];
    }
  }
  return best ? best[1] : nome;
}

function remapEscolasNosPacotes() {
  const packs = [DATA, DATA1, DATA_SP, DATA_DIAG, DATA_SAEP1, DATA_DIAG_TURMAS, DATA_IDEB, DATA_PROTO];
  for (const pack of packs) {
    if (!pack || typeof pack !== "object") continue;
    for (const val of Object.values(pack)) {
      if (!Array.isArray(val)) continue;
      for (const row of val) {
        if (row && typeof row === "object" && typeof row.escola === "string") {
          row.escola = canonEscolaNome(row.escola);
        }
      }
    }
  }
}
remapEscolasNosPacotes();

function lerEdicaoAvalie() {
  try {
    const v = localStorage.getItem("avalie-edicao");
    if (v === "1" || v === "2") return v;
  } catch (e) { /* ignore */ }
  return "2";
}

const state = { page: "geral", edicao: lerEdicaoAvalie() };

const $ = (id) => document.getElementById(id);

function unique(arr) {
  return [...new Set(arr)].sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}

function avg(nums) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function fillSelect(el, values, extra = []) {
  const current = el.value;
  el.innerHTML = "";
  [...extra, ...values].forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    el.appendChild(opt);
  });
  if ([...el.options].some((o) => o.value === current)) el.value = current;
}

function discAvalie(d) {
  return d === "Português" || d === "Matemática";
}

function ordenarAnos(anos) {
  return unique(anos).sort((a, b) => {
    const ia = ORDEM_ANOS.indexOf(a);
    const ib = ORDEM_ANOS.indexOf(b);
    if (ia < 0 && ib < 0) return String(a).localeCompare(String(b), "pt-BR");
    if (ia < 0) return 1;
    if (ib < 0) return -1;
    return ia - ib;
  });
}

function fonteAvalie() {
  const edicao = state.edicao === "1" ? "1" : "2";
  if (edicao === "1") {
    const pack = DATA1 || {};
    const alunos = Array.isArray(pack.alunos) ? pack.alunos : [];
    const turmas = Array.isArray(pack.turmas) ? pack.turmas : [];
    const descritores = Array.isArray(pack.descritores) ? pack.descritores : [];
    const base = alunos.length ? alunos : turmas;
    const anos = ordenarAnos(
      (base || []).filter((r) => discAvalie(r.disciplina)).map((r) => r.ano).filter(Boolean)
    );
    return {
      edicao: "1",
      label: "1º Avalie.CE",
      pack,
      alunos,
      turmas,
      descritores,
      temAlunos: alunos.length > 0,
      temDesc: descritores.length > 0,
      usaTurmas: !alunos.length && turmas.length > 0,
      metrica: alunos.length ? "bh58" : "proficiencia",
      anos: anos.length ? anos : ANOS_COMP.slice(),
      fonte: pack.fonte || "1º Avalie.CE",
      notaFonte: pack.notaFonte || "",
      geradoEm: pack.geradoEm || "—",
      totais: pack.totais || {},
    };
  }
  const pack = DATA || {};
  const alunos = Array.isArray(pack.alunos) ? pack.alunos : [];
  const turmas = Array.isArray(pack.turmas) ? pack.turmas : [];
  const descritores = Array.isArray(pack.descritores) ? pack.descritores : [];
  const metrica = pack.metrica === "proficiencia" && turmas.length ? "proficiencia" : "bh58";
  const usaTurmas = metrica === "proficiencia" || (!alunos.length && turmas.length > 0);
  const anos = ordenarAnos(
    (usaTurmas ? turmas : alunos).filter((r) => discAvalie(r.disciplina)).map((r) => r.ano).filter(Boolean)
  );
  return {
    edicao: "2",
    label: "2º Avalie.CE",
    pack,
    alunos,
    turmas,
    descritores,
    temAlunos: alunos.length > 0,
    temDesc: descritores.length > 0,
    usaTurmas,
    metrica,
    anos: anos.length ? anos : ANOS_OK.slice(),
    fonte: pack.fonte || "2º Avalie.CE",
    notaFonte: pack.notaFonte || "",
    geradoEm: pack.geradoEm || "—",
    totais: pack.totais || {},
  };
}

function passaFiltrosAvalie(row, anosOk) {
  const ano = $("filtroAno")?.value || "Todos";
  const disc = $("filtroDisc")?.value || "Todas";
  const esc = $("filtroEscola")?.value || "Todas";
  if (anosOk && anosOk.length && !anosOk.includes(row.ano)) return false;
  if (!discAvalie(row.disciplina)) return false;
  if (ano !== "Todos" && row.ano !== ano) return false;
  if (disc !== "Todas" && row.disciplina !== disc) return false;
  if (esc !== "Todas" && row.escola !== esc) return false;
  return true;
}

function setupFilters() {
  const f = fonteAvalie();
  const rows = f.usaTurmas ? f.turmas : f.alunos;
  const recorte = (rows || []).filter((r) => discAvalie(r.disciplina) && f.anos.includes(r.ano));
  fillSelect($("filtroAno"), f.anos, ["Todos"]);
  fillSelect($("filtroDisc"), unique(recorte.map((r) => r.disciplina)), ["Todas"]);
  fillSelect($("filtroEscola"), unique(recorte.map((r) => r.escola)), ["Todas"]);
}

function filteredAlunos() {
  const f = fonteAvalie();
  return (f.alunos || []).filter((a) => passaFiltrosAvalie(a, f.anos));
}

function filteredTurmasAvalie() {
  const f = fonteAvalie();
  return (f.turmas || []).filter((t) => passaFiltrosAvalie(t, f.anos));
}

function filteredDesc() {
  const f = fonteAvalie();
  return (f.descritores || []).filter((a) => passaFiltrosAvalie(a, f.anos));
}

function expandTurmasToAlunos(turmas) {
  const rows = [];
  (turmas || []).forEach((t) => {
    const media = t.media != null && !Number.isNaN(Number(t.media)) ? Number(t.media) : null;
    const pad = t.padroes || {};
    let n = 0;
    const add = (sit, q) => {
      const qn = Number(q) || 0;
      for (let i = 0; i < qn; i++) {
        n += 1;
        rows.push({
          escola: t.escola,
          ano: t.ano,
          turma: t.turma,
          disciplina: t.disciplina,
          aluno: `${t.turma} · ${n}`,
          falta: false,
          nee: false,
          acertos: media == null ? null : media,
          nquestoes: media == null ? null : 100,
          percentual: media,
          situacao: sit,
          _viaTurma: true,
        });
      }
    };
    SIT_1AVALIE.forEach((sit) => add(sit, pad[sit]));
    Object.keys(pad).forEach((sit) => {
      if (!SIT_1AVALIE.includes(sit)) add(sit, pad[sit]);
    });
    if (!n) {
      const q = Math.max(Number(t.avaliados) || 0, media == null ? 0 : 1);
      add("Não informado", q);
    }
  });
  return rows;
}

function rowsAnalise() {
  const f = fonteAvalie();
  if (f.usaTurmas) return expandTurmasToAlunos(filteredTurmasAvalie());
  return filteredAlunos();
}

function usaEscala1Avalie(list) {
  const f = fonteAvalie();
  if (f.metrica === "proficiencia" || (f.edicao === "1" && !f.temAlunos)) return true;
  if (f.edicao !== "1") return false;
  return (list || []).some((a) => sitKey(a.situacao) === "Defasagem");
}

function usaProficiencia2() {
  return !!(DATA && DATA.metrica === "proficiencia" && (DATA.turmas || []).length);
}

function atualizarMetaFonte() {
  const el = $("metaFonte");
  if (!el) return;
  const f = fonteAvalie();
  const tot = f.totais || {};
  if (f.edicao === "1") {
    const av = Number(tot.avaliados || 0).toLocaleString("pt-BR");
    el.textContent = `${f.fonte}\nGerado em ${f.geradoEm}\n${av} avaliados · ${tot.turmas || 0} turmas · ${tot.escolas || 0} escolas`;
    return;
  }
  const unicos = tot.alunosUnicos || tot.avaliados || 0;
  const avs = tot.avaliados || 0;
  const pub = f.pack && f.pack.publico ? "\nPágina pública: médias e turmas, sem nomes de alunos." : "";
  el.textContent = `${f.fonte}\nGerado em ${f.geradoEm}\n${Number(unicos).toLocaleString("pt-BR")} alunos · ${Number(avs).toLocaleString("pt-BR")} avaliações · ${tot.escolas || 0} escolas${pub}`;
}

function atualizarNavEdicao() {
  const f = fonteAvalie();
  const sel = $("selEdicaoAvalie");
  if (sel && sel.value !== f.edicao) sel.value = f.edicao;
  const box = $("navEdicaoAvalie");
  if (box) box.classList.toggle("is-active", PAGINAS_AVALIE.includes(state.page));
  const btnAlunos = document.querySelector('.nav-btn[data-page="alunos"]');
  if (btnAlunos) btnAlunos.classList.toggle("hidden", !f.temAlunos);
  const sm = document.querySelector(".brand small");
  if (sm) sm.textContent = f.edicao === "1" ? "SAEP · 1º Avalie.CE" : "SAEP · 2º Avalie.CE";
  document.querySelectorAll("[data-capa-edicao]").forEach((b) => {
    b.classList.toggle("is-on", b.dataset.capaEdicao === f.edicao);
  });
  const cardAlunos = document.querySelector('[data-capa-page="alunos"]');
  if (cardAlunos) cardAlunos.classList.toggle("hidden", !f.temAlunos);
}

function setEdicaoAvalie(ed) {
  state.edicao = ed === "1" ? "1" : "2";
  try { localStorage.setItem("avalie-edicao", state.edicao); } catch (e) { /* ignore */ }
  atualizarNavEdicao();
  atualizarMetaFonte();
  setupFilters();
  const f = fonteAvalie();
  if (state.page === "alunos" && !f.temAlunos) {
    goto("turmas");
    return;
  }
  goto(state.page);
}

function naLista(list) {
  // COUNTA(C8:C57): todo aluno com nome, inclusive 0%, falta e "não faz".
  return list.filter((a) => a.aluno);
}

function avaliados(list) {
  return naLista(list).filter((a) => a.percentual != null);
}

function comPadrao(list) {
  return avaliados(list).filter((a) => {
    const k = sitKey(a.situacao);
    return k !== "Falta" && k !== "Não lançado";
  });
}

function mediaBH58(list) {
  // BH58 = SUM(acertos) / (COUNTA(nomes) * nº questões). Sem nota = 0.
  const av = naLista(list);
  const ac = av.reduce((s, a) => s + (Number(a.acertos) || 0), 0);
  const nq = av.reduce((s, a) => s + (Number(a.nquestoes) || 0), 0);
  return nq ? (100 * ac) / nq : 0;
}

function gruposTurma(list) {
  const map = {};
  naLista(list).forEach((a) => {
    const k = `${a.escola}|${a.ano}|${a.turma}|${a.disciplina}`;
    map[k] = map[k] || [];
    map[k].push(a);
  });
  return Object.values(map);
}

function mediaDasTurmas(list) {
  // Média da escola = média simples das BH58 das turmas (peso igual) — 77,5% na Augusto 9º LP.
  const gs = gruposTurma(list);
  return gs.length ? avg(gs.map(mediaBH58)) : 0;
}

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    charts[id] = null;
  }
}

function makeChart(id, cfg) {
  destroyChart(id);
  const ctx = $(id);
  if (!ctx) return;
  cfg.options = cfg.options || {};
  const wrap = ctx.parentElement;
  const labels = (cfg.data && cfg.data.labels) || [];
  const dedicated = wrap && wrap.classList.contains("chart-tall");
  const compact = wrap && (wrap.classList.contains("chart-cols") || wrap.classList.contains("chart-linha"));

  if (dedicated) {
    cfg.options.maintainAspectRatio = false;
    cfg.options.responsive = true;
    const h = Math.min(980, Math.max(520, labels.length * 34 + 80));
    wrap.style.height = `${h}px`;
    if (cfg.options.indexAxis === "y") {
      cfg.options.scales = cfg.options.scales || {};
      cfg.options.scales.y = cfg.options.scales.y || {};
      const prev = cfg.options.scales.y.ticks || {};
      cfg.options.scales.y.ticks = {
        ...prev,
        autoSkip: false,
        font: { ...(prev.font || {}), size: 12 },
      };
    }
  }
  if (compact) {
    cfg.options.maintainAspectRatio = false;
    cfg.options.responsive = true;
  }
  pintarGrafico(cfg);
  charts[id] = new Chart(ctx, cfg);
}

function corCss(nome, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return v || fallback;
}

function pintarGrafico(cfg) {
  const tick = corCss("--muted", "#9bb6c2");
  const text = corCss("--text", "#e8f2f6");
  const grid = corCss("--chart-grid", "rgba(255,255,255,.06)");
  cfg.options = cfg.options || {};
  cfg.options.plugins = cfg.options.plugins || {};
  cfg.options.plugins.legend = cfg.options.plugins.legend || {};
  cfg.options.plugins.legend.labels = { ...(cfg.options.plugins.legend.labels || {}), color: text };
  const scales = cfg.options.scales;
  if (!scales) return;
  Object.keys(scales).forEach((k) => {
    const sc = scales[k] || {};
    sc.ticks = { ...(sc.ticks || {}), color: tick };
    if (sc.grid && sc.grid.display === false) {
      scales[k] = sc;
      return;
    }
    sc.grid = { ...(sc.grid || {}), color: grid };
    scales[k] = sc;
  });
}

function aplicarTema(tema, rerender) {
  const t = tema === "dia" ? "dia" : "noite";
  document.documentElement.dataset.tema = t;
  try { localStorage.setItem("avalie-tema", t); } catch (e) { /* ignore */ }
  const n = document.getElementById("btnTemaNoite");
  const d = document.getElementById("btnTemaDia");
  if (n) n.classList.toggle("active", t === "noite");
  if (d) d.classList.toggle("active", t === "dia");
  if (window.Chart) Chart.defaults.color = corCss("--text", "#e8f2f6");
  if (rerender && typeof render === "function") render();
}

function setupTema() {
  const atual = document.documentElement.dataset.tema === "dia" ? "dia" : "noite";
  aplicarTema(atual, false);
  const n = document.getElementById("btnTemaNoite");
  const d = document.getElementById("btnTemaDia");
  if (n) n.addEventListener("click", () => aplicarTema("noite", true));
  if (d) d.addEventListener("click", () => aplicarTema("dia", true));
}

function sitLabelsIn(list, ordem) {
  const present = new Set(list.map((a) => a.situacao));
  return ordem.filter((s) => present.has(s));
}

function uniqueStudents(list) {
  return unique(list.map((a) => `${a.escola}|${a.ano}|${a.turma}|${a.aluno}`)).length;
}

function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n)}%`;
}

function fmtMedia(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(1).replace(".", ",")}%`;
}

function fmtProf(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("pt-BR");
}

function fmtNota10(n, casas = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(casas).replace(".", ",");
}

function fmtMedia10(n) {
  // Médias da rede em 0–10 com 2 casas (5,88), para não arredondar 5,88 para 5,9.
  return fmtNota10(n, 2);
}

function sitKey(sit) {
  if (sit === "Não informado") return "Não lançado";
  return sit;
}

function sitNome(sit, plural) {
  const k = sitKey(sit);
  if (k === "Falta") return plural ? "Faltas" : "Falta";
  if (k === "Não lançado") return plural ? "Não informados" : "Não informado";
  return sit;
}

function sitBarText(label) {
  if (["Adequado", "Desejável", "Avançado", "Não lançado", "Muito crítico", "Abaixo do básico", "Defasagem"].includes(label)) {
    return "#f4fff6";
  }
  return "#07151c";
}

function badge(sit) {
  const k = sitKey(sit);
  return `<span class="badge ${SIT_CLASS[k] || "sit-falta"}">${sitNome(sit, false)}</span>`;
}

function renderKpis(rows) {
  const f = fonteAvalie();
  if (f.usaTurmas) {
    const turmas = filteredTurmasAvalie();
    const escolas = unique(turmas.map((t) => t.escola)).length;
    const avs = turmas.reduce((s, t) => s + (Number(t.avaliados) || 0), 0);
    const prev = turmas.reduce((s, t) => s + (Number(t.previstos) || 0), 0);
    const media = mediaLista1(turmas);
    $("kpis").innerHTML = `
      <div class="kpi"><span>Avaliados</span><strong>${avs.toLocaleString("pt-BR")}</strong><em>${prev.toLocaleString("pt-BR")} previstos nas turmas</em></div>
      <div class="kpi"><span>${(f.pack && f.pack.nivelCaed === "escola") ? "Registros no recorte" : "Turmas no recorte"}</span><strong>${turmas.length}</strong><em>${(f.pack && f.pack.nivelCaed === "escola") ? "uma linha por escola · ano · disciplina (CAEd escola)" : f.label + " — sem lista nominal"}</em></div>
      <div class="kpi"><span>Escolas no recorte</span><strong>${escolas}</strong><em>${(f.pack && f.pack.nivelCaed === "escola") ? "média = Proficiência média oficial da escola" : "média da escola = média simples das turmas"}</em></div>
      <div class="kpi"><span>Proficiência média</span><strong>${fmtMedia(media)}</strong><em>média simples das turmas (CAEd 0–100)</em></div>
    `;
    return;
  }
  const av = avaliados(rows);
  const pad = comPadrao(rows);
  const escolas = unique(rows.map((a) => a.escola)).length;
  const media = mediaDasTurmas(rows);
  const unicos = uniqueStudents(av);
  $("kpis").innerHTML = `
    <div class="kpi"><span>Alunos únicos</span><strong>${unicos.toLocaleString("pt-BR")}</strong><em>${rows.filter(a=>sitKey(a.situacao)==="Falta").length} faltas · ${rows.filter(a=>sitKey(a.situacao)==="Não lançado").length} não informados</em></div>
    <div class="kpi"><span>Avaliações lançadas</span><strong>${pad.length.toLocaleString("pt-BR")}</strong><em>cada disciplina conta 1 vez</em></div>
    <div class="kpi"><span>Escolas no recorte</span><strong>${escolas}</strong><em>${gruposTurma(rows).length} turmas</em></div>
    <div class="kpi"><span>${rotuloMetricaAvalie(f)}</span><strong>${fmtMedia(media)}</strong><em>${f.edicao === "2" && f.metrica !== "proficiencia" ? "BH58 das planilhas — sem Proficiência média CAEd 2026.2 nos arquivos" : "média das turmas (BH58 da planilha, peso igual)"}</em></div>
  `;
}

function renderInsights(rows) {
  const av = avaliados(rows);
  const pad = comPadrao(rows);
  const anos = unique(av.map((a) => a.ano)).map((ano) => [ano, mediaDasTurmas(av.filter((a) => a.ano === ano))]).sort((a, b) => b[1] - a[1]);
  const ranking = rankingEscolasAvalie(rows);
  const lp = mediaDasTurmas(av.filter((a) => a.disciplina === "Português"));
  const mt = mediaDasTurmas(av.filter((a) => a.disciplina === "Matemática"));
  const items = [];
  if (anos[0]) items.push(`O ano com melhor média no recorte é o <b>${anos[0][0]}</b> (${fmtMedia(anos[0][1])}).`);
  if (ranking[0]) items.push(`A <b>1ª colocada</b> neste recorte é <b>${ranking[0].escola}</b> (${fmtMedia(ranking[0].media)}).`);
  if (ranking.length > 1) items.push(`A última colocada (${rotuloColocacao(ranking[ranking.length - 1].colocacao)}) é <b>${ranking[ranking.length - 1].escola}</b> (${fmtMedia(ranking[ranking.length - 1].media)}).`);
  if (lp && mt) items.push(`A média de <b>Português</b> é ${fmtMedia(lp)} e a de <b>Matemática</b> é ${fmtMedia(mt)}.`);
  const anoFiltro = $("filtroAno").value;
  const discFiltro = $("filtroDisc").value;
  if (usaEscala1Avalie(rows)) {
    const labels = sitLabelsIn(pad, SIT_1AVALIE);
    if (labels.length) {
      const dist = labels.map((s) => `${s}: ${pad.filter((a) => a.situacao === s).length}`).join(" · ");
      items.push(`Padrões deste recorte (Defasagem → Adequado): <b>${dist}</b>.`);
    }
  } else if (anoFiltro === "2º" && discFiltro === "Matemática") {
    const labels = sitLabelsIn(pad, SIT_2ANO_MAT);
    if (labels.length) {
      const dist = labels.map((s) => `${s}: ${pad.filter((a) => a.situacao === s).length}`).join(" · ");
      items.push(`Padrões de Matemática do 2º ano (Avançado → Abaixo do básico): <b>${dist}</b>.`);
    }
  } else if (anoFiltro === "2º") {
    const lp = pad.filter((a) => a.disciplina === "Português");
    const mt = pad.filter((a) => a.disciplina === "Matemática");
    const labelsLp = sitLabelsIn(lp, SIT_2ANO_LP);
    if (labelsLp.length) {
      const dist = labelsLp.map((s) => `${s}: ${lp.filter((a) => a.situacao === s).length}`).join(" · ");
      items.push(`Português do 2º ano (Desejável → Crítico): <b>${dist}</b>.`);
    }
    if (discFiltro === "Todas" && mt.length) {
      const labelsMt = sitLabelsIn(mt, SIT_2ANO_MAT);
      const dist = labelsMt.map((s) => `${s}: ${mt.filter((a) => a.situacao === s).length}`).join(" · ");
      items.push(`Matemática do 2º ano (Avançado → Abaixo do básico): <b>${dist}</b>.`);
    }
  } else if (anoFiltro !== "Todos") {
    const labels = sitLabelsIn(pad, SIT_OUTROS);
    if (labels.length) {
      const dist = labels.map((s) => `${s}: ${pad.filter((a) => a.situacao === s).length}`).join(" · ");
      items.push(`Padrões deste recorte (Muito crítico → Adequado): <b>${dist}</b>.`);
    }
  } else {
    items.push("O <b>2º ano</b> tem duas escalas: Português (Desejável → Crítico) e Matemática (Avançado, Proficiente, Básico, Abaixo do básico). Os anos <b>4º, 5º, 8º e 9º</b> usam Muito crítico / Crítico / Intermediário / Adequado.");
  }
  const pend = rows.filter((a) => a.situacao === "Não lançado").length;
  if (pend > 30) items.push(`Há <b>${pend.toLocaleString("pt-BR")}</b> registros sem gabarito lançado neste recorte.`);
  $("insights").innerHTML = items.map((t) => `<li>${t}</li>`).join("") || "<li>Sem dados para o filtro atual.</li>";
}

function doughnutCfg(labels, list) {
  return {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: labels.map((s) => list.filter((a) => a.situacao === s).length),
        backgroundColor: labels.map((s) => SIT_COLORS[s] || "#9bb6c2"),
        borderWidth: 0,
      }],
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 10, padding: 8, font: { size: 11 } },
        },
      },
    },
  };
}

function renderGeral(rows) {
  renderKpis(rows);
  renderInsights(rows);
  const av = avaliados(rows);
  const pad = comPadrao(rows);
  const anoFiltro = $("filtroAno").value;
  const discFiltro = $("filtroDisc").value;
  const wrap2 = $("wrapSit2ano");
  const wrapMat = $("wrapSit2mat");
  const tit = $("titSit");
  const hint = $("hintSit");
  const lp2 = pad.filter((a) => a.ano === "2º" && a.disciplina === "Português");
  const mt2 = pad.filter((a) => a.ano === "2º" && a.disciplina === "Matemática");

  if (usaEscala1Avalie(rows)) {
    tit.textContent = "Padrão de desempenho";
    hint.textContent = `Escala do ${fonteAvalie().label}: Defasagem, Intermediário e Adequado.`;
    wrap2.classList.add("hidden");
    wrapMat.classList.add("hidden");
    makeChart("chartSit", doughnutCfg(sitLabelsIn(pad, SIT_1AVALIE), pad));
  } else if (anoFiltro === "2º" && discFiltro === "Matemática") {
    tit.textContent = "Padrão de desempenho — 2º ano Matemática";
    hint.textContent = "Avançado, Proficiente, Básico e Abaixo do básico.";
    wrap2.classList.add("hidden");
    wrapMat.classList.add("hidden");
    makeChart("chartSit", doughnutCfg(sitLabelsIn(pad, SIT_2ANO_MAT), pad));
  } else if (anoFiltro === "2º" && discFiltro === "Português") {
    tit.textContent = "Padrão de desempenho — 2º ano Português";
    hint.textContent = "Desejável, Suficiente, Intermediário, Alf. incompleto e Crítico.";
    wrap2.classList.add("hidden");
    wrapMat.classList.add("hidden");
    makeChart("chartSit", doughnutCfg(sitLabelsIn(pad, SIT_2ANO_LP), pad));
  } else if (anoFiltro === "2º") {
    tit.textContent = "Padrão de desempenho — 2º ano Português";
    hint.textContent = "Escala de alfabetização: Desejável → Crítico.";
    wrap2.classList.add("hidden");
    wrapMat.classList.remove("hidden");
    makeChart("chartSit", doughnutCfg(sitLabelsIn(lp2, SIT_2ANO_LP), lp2));
    makeChart("chartSit2mat", doughnutCfg(sitLabelsIn(mt2, SIT_2ANO_MAT), mt2));
  } else if (anoFiltro === "Todos") {
    tit.textContent = "Padrão de desempenho — 4º, 5º, 8º e 9º";
    hint.textContent = "Escala Muito crítico, Crítico, Intermediário e Adequado.";
    wrap2.classList.remove("hidden");
    wrapMat.classList.remove("hidden");
    const demais = pad.filter((a) => a.ano !== "2º");
    makeChart("chartSit", doughnutCfg(sitLabelsIn(demais, SIT_OUTROS), demais));
    makeChart("chartSit2lp", doughnutCfg(sitLabelsIn(lp2, SIT_2ANO_LP), lp2));
    makeChart("chartSit2mat", doughnutCfg(sitLabelsIn(mt2, SIT_2ANO_MAT), mt2));
  } else {
    tit.textContent = "Padrão de desempenho";
    hint.textContent = "Escala Muito crítico, Crítico, Intermediário e Adequado.";
    wrap2.classList.add("hidden");
    wrapMat.classList.add("hidden");
    makeChart("chartSit", doughnutCfg(sitLabelsIn(pad, SIT_OUTROS), pad));
  }

  const anos = unique(av.map((a) => a.ano));
  makeChart("chartAno", {
    type: "bar",
    data: {
      labels: anos,
      datasets: [{
        label: "Média %",
        data: anos.map((ano) => mediaDasTurmas(av.filter((a) => a.ano === ano))),
        backgroundColor: "#2ec4b6",
        borderRadius: 8,
      }],
    },
    options: {
      scales: {
        x: { ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: { min: 0, max: 100, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
      },
      plugins: { legend: { display: false } },
    },
  });

  const discs = unique(av.map((a) => a.disciplina));
  makeChart("chartDisc", {
    type: "bar",
    data: {
      labels: discs,
      datasets: [{
        label: "Média %",
        data: discs.map((d) => mediaDasTurmas(av.filter((a) => a.disciplina === d))),
        backgroundColor: ["#2ec4b6", "#ffbf69"],
        borderRadius: 8,
      }],
    },
    options: {
      indexAxis: "y",
      scales: {
        x: { min: 0, max: 100, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: { ticks: { color: "#9bb6c2" }, grid: { display: false } },
      },
      plugins: { legend: { display: false } },
    },
  });
  renderRankingGeral(rows);
}

function escalasAtivas() {
  if (usaEscala1Avalie(rowsAnalise())) {
    return [{
      id: "avalie1",
      titulo: fonteAvalie().label,
      labels: [...SIT_1AVALIE, ...SIT_AUSENCIA],
      match: () => true,
    }];
  }
  const ano = $("filtroAno").value;
  const disc = $("filtroDisc").value;
  const grupos = [];
  const inclui2 = ano === "Todos" || ano === "2º";
  const incluiOutros = ano !== "2º";
  if (inclui2 && (disc === "Todas" || disc === "Português")) {
    grupos.push({
      id: "lp2",
      titulo: "2º Português",
      labels: [...SIT_2ANO_LP, ...SIT_AUSENCIA],
      match: (a) => a.ano === "2º" && a.disciplina === "Português",
    });
  }
  if (inclui2 && (disc === "Todas" || disc === "Matemática")) {
    grupos.push({
      id: "mat2",
      titulo: "2º Matemática",
      labels: [...SIT_2ANO_MAT, ...SIT_AUSENCIA],
      match: (a) => a.ano === "2º" && a.disciplina === "Matemática",
    });
  }
  if (incluiOutros) {
    grupos.push({
      id: "outros",
      titulo: ano === "Todos" ? "4º–9º" : `${ano} ano`,
      labels: [...SIT_OUTROS, ...SIT_AUSENCIA],
      match: (a) => a.ano !== "2º",
    });
  }
  return grupos;
}

function countsPadrao(list, labels) {
  const sit = {};
  labels.forEach((l) => { sit[l] = 0; });
  list.forEach((a) => {
    const k = sitKey(a.situacao);
    if (sit[k] != null) sit[k] += 1;
  });
  return sit;
}

function stackHtml(counts, labels) {
  const total = labels.reduce((s, l) => s + (counts[l] || 0), 0);
  if (!total) {
    return `<div class="stack-block"><div class="stack stack-empty"></div><div class="stack-counts">—</div></div>`;
  }
  const segs = labels.map((l) => {
    const n = counts[l] || 0;
    const pct = (100 * n) / total;
    const nome = sitNome(l, true);
    const txt = pct >= 16 ? `${Math.round(pct)}%` : "";
    return `<i class="stack-seg" style="width:${pct}%;background:${SIT_COLORS[l] || "#9bb6c2"};color:${sitBarText(l)}" title="${nome}: ${n} (${pct.toFixed(1)}%)">${txt}</i>`;
  }).join("");
  const nums = labels.map((l) => {
    const n = counts[l] || 0;
    return `<span title="${sitNome(l, true)}"><i style="background:${SIT_COLORS[l] || "#9bb6c2"}"></i>${n}</span>`;
  }).join("");
  return `<div class="stack-block"><div class="stack">${segs}</div><div class="stack-counts">${nums}</div></div>`;
}

function legendHtml(grupos) {
  return grupos.map((g) => `
    <div class="legend-group">
      <strong>${g.titulo}</strong>
      ${g.labels.map((l) => `<span><i style="background:${SIT_COLORS[l]}"></i>${sitNome(l, true)}</span>`).join("")}
    </div>
  `).join("");
}

function recorteFiltroTxt() {
  const ano = $("filtroAno")?.value || "Todos";
  const disc = $("filtroDisc")?.value || "Todas";
  const a = !ano || ano === "Todos" ? "todos os anos" : `${ano} ano`;
  const d = !disc || disc === "Todas" ? "Português e Matemática" : disc;
  return `${a} · ${d}`;
}

function rotuloColocacao(n) {
  return `${n}º`;
}

function classeColocacao(n) {
  if (n === 1) return "rank-1";
  if (n === 2) return "rank-2";
  if (n === 3) return "rank-3";
  return "";
}

function rotuloMetricaAvalie(f) {
  const src = f || fonteAvalie();
  if (src.metrica === "proficiencia") return "Proficiência média";
  return "% de acerto (BH58)";
}

function metricaRankingTxt() {
  const f = fonteAvalie();
  if (f.metrica === "proficiencia") {
    if (f.pack && f.pack.nivelCaed === "escola") {
      return "Proficiência média oficial CAEd por escola (0–100)";
    }
    return "média simples das turmas (proficiência média CAEd 0–100)";
  }
  if (f.edicao === "2") {
    return "média simples das BH58 das turmas — pasta 2026.2 ainda sem HABILIDADE_DESEMPENHO (Proficiência média)";
  }
  return "média simples das turmas (BH58)";
}

function rankingEscolasAvalie(rows) {
  const f = fonteAvalie();
  let ranking;
  if (f.usaTurmas) {
    const map = {};
    filteredTurmasAvalie().forEach((t) => {
      (map[t.escola] = map[t.escola] || []).push(t);
    });
    ranking = Object.entries(map).map(([escola, list]) => ({
      escola,
      nTurmas: list.length,
      avaliados: list.reduce((s, t) => s + (Number(t.avaliados) || 0), 0),
      n: list.reduce((s, t) => s + (Number(t.avaliados) || 0), 0),
      unicos: list.reduce((s, t) => s + (Number(t.avaliados) || 0), 0),
      media: mediaLista1(list),
      viaTurma: true,
      list,
    }));
  } else {
    const map = {};
    (rows || []).forEach((a) => {
      (map[a.escola] = map[a.escola] || []).push(a);
    });
    ranking = Object.entries(map).map(([escola, list]) => ({
      escola,
      nTurmas: gruposTurma(list).length,
      avaliados: avaliados(list).length,
      n: list.length,
      unicos: uniqueStudents(list),
      media: mediaDasTurmas(list),
      viaTurma: false,
      list,
    }));
  }
  ranking.sort((a, b) => (b.media ?? -1) - (a.media ?? -1) || a.escola.localeCompare(b.escola, "pt-BR"));
  return ranking.map((r, i) => ({ ...r, colocacao: i + 1 }));
}

function renderRankingGeral(rows) {
  const tbody = $("tbodyRankGeral");
  const hint = $("hintRankGeral");
  if (!tbody) return;
  const f = fonteAvalie();
  const ranking = rankingEscolasAvalie(rows);
  if (hint) {
    hint.textContent = `${f.label} · ${recorteFiltroTxt()} · ${ranking.length} escolas · ${metricaRankingTxt()}. Todas as escolas do recorte, da 1ª à última colocação.`;
  }
  tbody.innerHTML = ranking.map((r) => `
    <tr>
      <td class="col-rank ${classeColocacao(r.colocacao)}">${rotuloColocacao(r.colocacao)}</td>
      <td class="col-escola">${r.escola}</td>
      <td><b>${fmtMedia(r.media)}</b></td>
      <td>${r.nTurmas}</td>
      <td>${Number(r.unicos || 0).toLocaleString("pt-BR")}</td>
    </tr>
  `).join("") || `<tr><td colspan="5">Sem escolas neste recorte.</td></tr>`;
}

function renderEscolas(rows) {
  const f = fonteAvalie();
  const grupos = escalasAtivas();
  const ranking = rankingEscolasAvalie(rows);
  const tit = $("titEscolas");
  if (tit) tit.textContent = `Colocação das escolas — ${f.label}`;

  makeChart("chartEscolas", {
    type: "bar",
    data: {
      labels: ranking.map((r) => `${rotuloColocacao(r.colocacao)}  ${r.escola}`),
      datasets: [{ label: "Média %", data: ranking.map((r) => r.media), backgroundColor: "#2ec4b6", borderRadius: 6 }],
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      scales: {
        x: { min: 0, max: 100, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: { ticks: { color: "#9bb6c2", font: { size: 10 }, autoSkip: false }, grid: { display: false } },
      },
      plugins: { legend: { display: false } },
    },
  });
  if ($("wrapEscolas")) $("wrapEscolas").style.height = Math.max(280, ranking.length * 36 + 48) + "px";

  const hint = $("hintEscolas");
  if (hint) {
    hint.textContent = `${f.label} · ${recorteFiltroTxt()} · ${ranking.length} escolas · ${metricaRankingTxt()}. Colocação de 1º a ${ranking.length || 0}º, sem corte. ${
      f.edicao === "1"
        ? "A barra mostra Defasagem, Intermediário e Adequado."
        : "A barra de padrões inclui faltas e não informados. Escalas de ano/disciplina não são misturadas."
    }`;
  }
  $("legendEscolas").innerHTML = legendHtml(grupos);
  const colAlunos = f.temAlunos ? "Alunos" : "Avaliados";
  const colN = f.temAlunos ? "Avaliações" : "Turmas";
  $("theadEscolas").innerHTML = `<tr>
    <th>Colocação</th>
    <th>Escola</th>
    <th>${colAlunos}</th>
    <th>${colN}</th>
    <th>${rotuloMetricaAvalie(f)}</th>
    ${grupos.map((g) => `<th class="th-padrao">${g.titulo}</th>`).join("")}
  </tr>`;
  $("tbodyEscolas").innerHTML = ranking.map((r) => {
    const stacks = grupos.map((g) => {
      const counts = r.viaTurma
        ? { ...countsFaixa1(r.list), Falta: 0, "Não lançado": 0 }
        : countsPadrao(r.list.filter(g.match), g.labels);
      return `<td class="col-padrao">${stackHtml(counts, g.labels)}</td>`;
    }).join("");
    return `
    <tr>
      <td class="col-rank ${classeColocacao(r.colocacao)}">${rotuloColocacao(r.colocacao)}</td>
      <td class="col-escola">${r.escola}</td>
      <td>${Number(r.unicos || 0).toLocaleString("pt-BR")}</td>
      <td>${f.temAlunos ? r.n : r.nTurmas}</td>
      <td><b>${fmtMedia(r.media)}</b></td>
      ${stacks}
    </tr>`;
  }).join("") || `<tr><td colspan="${5 + grupos.length}">Sem escolas neste recorte.</td></tr>`;
}

function grupoHabAno(ano) {
  if (ano === "2º") return "2º";
  if (ano === "4º" || ano === "5º") return "5º";
  if (ano === "8º" || ano === "9º") return "9º";
  return ano || "";
}

function normHabCode(raw) {
  const original = String(raw || "").trim();
  let s = original.toUpperCase().replace(/\s+/g, "");
  const star = s.endsWith("*");
  s = s.replace(/\*$/, "");
  const m = s.match(/^([DH])0*(\d+)$/);
  if (!m) return { key: s, alt: "", show: original || "—" };
  const num = String(m[2]).padStart(2, "0");
  const key = m[1] + num;
  const alt = (m[1] === "H" ? "D" : "H") + num;
  return { key, alt, show: key + (star ? "*" : "") };
}

function nomeHabilidade(ano, disc, raw) {
  const { key, alt } = normHabCode(raw);
  const maps = window.HAB_NOMES || {};
  const ordem = [`${ano}|${disc}`, `${grupoHabAno(ano)}|${disc}`];
  for (const k of ordem) {
    const map = maps[k];
    if (!map) continue;
    if (map[key]) return map[key];
    if (alt && map[alt]) return map[alt];
  }
  return "";
}

function rotuloHabilidade(ano, disc, raw) {
  const { show } = normHabCode(raw);
  const nome = nomeHabilidade(ano, disc, raw);
  return nome ? `${show} — ${nome}` : show;
}

function renderDescritores() {
  const f = fonteAvalie();
  const hint = $("hintDesc");
  const rows = filteredDesc();
  if (!f.temDesc) {
    if (hint) {
      hint.textContent = f.edicao === "1"
        ? "O 1º Avalie.CE neste arquivo não tem descritores por habilidade — só médias e padrões por turma. Use Visão geral, Escolas e Turmas."
        : "Sem descritores neste recorte.";
    }
    destroyChart("chartDescPiores");
    destroyChart("chartDescMelhores");
    if ($("tbodyDesc")) $("tbodyDesc").innerHTML = "";
    return;
  }
  if (hint) hint.textContent = "";
  const acc = {};
  rows.forEach((r) => {
    const key = `${normHabCode(r.descritor).show}|${r.disciplina}|${r.ano}`;
    acc[key] = acc[key] || { descritor: r.descritor, disciplina: r.disciplina, ano: r.ano, acertos: 0, total: 0 };
    acc[key].acertos += r.acertos;
    acc[key].total += r.total;
  });
  const list = Object.values(acc)
    .filter((x) => x.total >= 20)
    .map((x) => ({ ...x, perc: (100 * x.acertos) / x.total }))
    .sort((a, b) => a.perc - b.perc);

  const piores = list.slice(0, 12);
  const melhores = list.slice(-12).reverse();

  const chartCfg = (labels, data, color) => ({
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: color, borderRadius: 8 }] },
    options: {
      indexAxis: "y",
      scales: {
        x: { min: 0, max: 100, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: { ticks: { color: "#9bb6c2", font: { size: 10 } }, grid: { display: false } },
      },
      plugins: { legend: { display: false } },
    },
  });
  makeChart("chartDescPiores", chartCfg(piores.map((x) => rotuloHabilidade(x.ano, x.disciplina, x.descritor)), piores.map((x) => x.perc), "#ef476f"));
  makeChart("chartDescMelhores", chartCfg(melhores.map((x) => rotuloHabilidade(x.ano, x.disciplina, x.descritor)), melhores.map((x) => x.perc), "#2ec4b6"));

  $("tbodyDesc").innerHTML = list.map((x) => `
    <tr>
      <td><b>${normHabCode(x.descritor).show}</b></td>
      <td>${nomeHabilidade(x.ano, x.disciplina, x.descritor) || "—"}</td>
      <td>${x.ano}</td>
      <td>${x.disciplina}</td>
      <td>${x.total}</td>
      <td>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="bar"><i style="width:${x.perc}%"></i></div>
          <b>${x.perc.toFixed(1)}%</b>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderTurmas(rows) {
  const f = fonteAvalie();
  if (f.usaTurmas) {
    const list = filteredTurmasAvalie().slice().sort((a, b) =>
      a.escola.localeCompare(b.escola, "pt-BR")
      || a.ano.localeCompare(b.ano)
      || a.turma.localeCompare(b.turma)
      || a.disciplina.localeCompare(b.disciplina, "pt-BR")
    );
    $("tbodyTurmas").innerHTML = list.map((t) => `
      <tr>
        <td>${t.escola}</td>
        <td>${t.ano}</td>
        <td>${t.turma}</td>
        <td>${t.disciplina}</td>
        <td>${t.avaliados == null ? "—" : t.avaliados}</td>
        <td><b>${fmtMedia(t.media)}</b></td>
        <td>${badge(predPadrao(t.padroes))}</td>
      </tr>
    `).join("");
    return;
  }
  const av = avaliados(rows);
  const map = {};
  av.forEach((a) => {
    const key = [a.escola, a.ano, a.turma, a.disciplina].join("|");
    map[key] = map[key] || { ...a, n: 0, sit: {}, alunos: [] };
    map[key].n += 1;
    map[key].alunos.push(a);
    map[key].sit[a.situacao] = (map[key].sit[a.situacao] || 0) + 1;
  });
  const list = Object.values(map)
    .map((v) => {
      const pred = Object.entries(v.sit)
        .filter(([k]) => k !== "Falta" && k !== "Não lançado")
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
      return { ...v, media: mediaBH58(v.alunos), pred };
    })
    .sort((a, b) => a.escola.localeCompare(b.escola, "pt-BR") || a.ano.localeCompare(b.ano) || a.turma.localeCompare(b.turma));

  $("tbodyTurmas").innerHTML = list.map((r) => `
    <tr>
      <td>${r.escola}</td>
      <td>${r.ano}</td>
      <td>${r.turma}</td>
      <td>${r.disciplina}</td>
      <td>${r.n}</td>
      <td><b>${fmtMedia(r.media)}</b></td>
      <td>${badge(r.pred)}</td>
    </tr>
  `).join("");
}

function renderAlunos(rows) {
  const f = fonteAvalie();
  if (!f.temAlunos) {
    if ($("tbodyAlunos")) $("tbodyAlunos").innerHTML = "";
    if ($("alunosInfo")) {
      $("alunosInfo").textContent = "O 1º Avalie.CE não tem lista nominal de alunos neste arquivo. A análise é por turma: use Turmas, Escolas e Visão geral.";
    }
    return;
  }
  const q = ($("buscaAluno").value || "").trim().toLowerCase();
  const av = rows.filter((a) => {
    if (a.situacao === "Não lançado" && !q) return false;
    if (!q) return true;
    return `${a.aluno} ${a.escola} ${a.turma} ${a.disciplina}`.toLowerCase().includes(q);
  });
  const show = av.slice(0, 400);
  $("tbodyAlunos").innerHTML = show.map((a) => `
    <tr>
      <td>${a.aluno}</td>
      <td>${a.escola}</td>
      <td>${a.turma}</td>
      <td>${a.disciplina}</td>
      <td>${a.acertos == null ? "—" : `${a.acertos}/${a.nquestoes}`}</td>
      <td>${a.percentual == null ? "—" : fmtPct(a.percentual)}</td>
      <td>${badge(a.situacao)}</td>
    </tr>
  `).join("");
  $("alunosInfo").textContent = `Mostrando ${show.length} de ${av.length} registros no recorte.`;
}

function filteredTurmas1() {
  if (!DATA1 || !DATA1.turmas) return [];
  const ano = $("filtroAno").value;
  const disc = $("filtroDisc").value;
  const esc = $("filtroEscola").value;
  return DATA1.turmas.filter((t) => {
    if (!ANOS_COMP.includes(t.ano)) return false;
    if (t.disciplina !== "Português" && t.disciplina !== "Matemática") return false;
    if (ano !== "Todos" && t.ano !== ano) return false;
    if (disc !== "Todas" && t.disciplina !== disc) return false;
    if (esc !== "Todas" && t.escola !== esc) return false;
    return true;
  });
}

function filteredAlunosComp() {
  const ano = $("filtroAno")?.value || "Todos";
  const disc = $("filtroDisc")?.value || "Todas";
  const esc = $("filtroEscola")?.value || "Todas";
  return ((DATA && DATA.alunos) || []).filter((a) => {
    if (!ANOS_COMP.includes(a.ano)) return false;
    if (!discAvalie(a.disciplina)) return false;
    if (ano !== "Todos" && a.ano !== ano) return false;
    if (disc !== "Todas" && a.disciplina !== disc) return false;
    if (esc !== "Todas" && a.escola !== esc) return false;
    return true;
  });
}

function mediaLista1(turmas) {
  const xs = (turmas || []).filter((t) => t.media != null).map((t) => t.media);
  return xs.length ? avg(xs) : null;
}

function faixaHarmonizada(sit) {
  if (["Adequado", "Desejável", "Avançado", "Proficiente", "Suficiente"].includes(sit)) return "Adequado";
  if (["Intermediário", "Básico"].includes(sit)) return "Intermediário";
  if (["Muito crítico", "Crítico", "Alf. incompleto", "Abaixo do básico", "Defasagem"].includes(sit)) return "Defasagem";
  return null;
}

function countsFaixa2(list) {
  const out = { Defasagem: 0, Intermediário: 0, Adequado: 0 };
  comPadrao(list).forEach((a) => {
    const f = faixaHarmonizada(a.situacao);
    if (f) out[f] += 1;
  });
  return out;
}

function countsFaixa1(turmas) {
  const out = { Defasagem: 0, Intermediário: 0, Adequado: 0 };
  (turmas || []).forEach((t) => {
    const p = t.padroes || {};
    out.Defasagem += p.Defasagem || 0;
    out.Intermediário += p.Intermediário || 0;
    out.Adequado += p.Adequado || 0;
  });
  return out;
}

function fmtDelta(n) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0.05 ? "+" : "";
  return `${sign}${n.toFixed(1).replace(".", ",")} p.p.`;
}

function deltaClass(n) {
  if (n == null || Number.isNaN(n) || Math.abs(n) < 0.05) return "delta-flat";
  return n > 0 ? "delta-up" : "delta-down";
}

function tendenciaTxt(n) {
  if (n == null || Number.isNaN(n) || Math.abs(n) < 0.05) return "estável";
  return n > 0 ? "subiu" : "desceu";
}

function groupedBars(labels, a, b) {
  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "1º Avalie", data: a, backgroundColor: "#ffbf69", borderRadius: 6 },
        { label: "2º Avalie", data: b, backgroundColor: "#2ec4b6", borderRadius: 6 },
      ],
    },
    options: {
      scales: {
        x: { ticks: { color: "#9bb6c2" }, grid: { display: false } },
        y: { min: 0, max: 100, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
      },
      plugins: { legend: { labels: { color: "#e8f2f6" } } },
    },
  };
}

function filteredTurmas2Comp() {
  const ano = $("filtroAno")?.value || "Todos";
  const disc = $("filtroDisc")?.value || "Todas";
  const esc = $("filtroEscola")?.value || "Todas";
  return ((DATA && DATA.turmas) || []).filter((t) => {
    if (!ANOS_COMP.includes(t.ano)) return false;
    if (!discAvalie(t.disciplina)) return false;
    if (ano !== "Todos" && t.ano !== ano) return false;
    if (disc !== "Todas" && t.disciplina !== disc) return false;
    if (esc !== "Todas" && t.escola !== esc) return false;
    return t.media != null;
  });
}

function media2Comp(listTurmas, listAlunos) {
  if (usaProficiencia2()) return mediaLista1(listTurmas);
  return mediaDasTurmas(listAlunos);
}

function renderComparar() {
  const t1 = filteredTurmas1();
  const t2 = usaProficiencia2() ? filteredTurmas2Comp() : [];
  const rows2 = usaProficiencia2() ? [] : filteredAlunosComp();
  const m1 = mediaLista1(t1);
  const m2 = media2Comp(t2, rows2);
  const has2 = usaProficiencia2() ? t2.length > 0 : avaliados(rows2).length > 0;
  const delta = m1 == null || !has2 ? null : m2 - m1;
  const hint = $("hintComparar");
  if (hint) {
    hint.textContent = DATA1
      ? `${DATA1.notaFonte || DATA1.fonte} Comparação só nos anos 2º, 5º e 9º (1º Avalie não teve 4º nem 8º).`
      : "Arquivo dados1.js não encontrado. Rode python dashboard/processar_1avalie.py.";
  }
  $("kpisComp").innerHTML = `
    <div class="kpi"><span>Média 1º Avalie</span><strong>${m1 == null ? "—" : fmtMedia(m1)}</strong><em>Proficiência média CAEd — média simples das turmas</em></div>
    <div class="kpi"><span>Média 2º Avalie</span><strong>${has2 ? fmtMedia(m2) : "—"}</strong><em>${usaProficiencia2() ? "Proficiência média CAEd 2026.2" : "BH58 das planilhas — sem Proficiência média 2026.2 nos arquivos"}</em></div>
    <div class="kpi"><span>Variação</span><strong class="${deltaClass(delta)}">${fmtDelta(delta)}</strong><em>2º Avalie − 1º Avalie</em></div>
    <div class="kpi"><span>Turmas no 1º</span><strong>${t1.length}</strong><em>${unique(t1.map((t) => t.escola)).length} escolas neste recorte</em></div>
  `;

  const anos = ANOS_COMP.filter((ano) => {
    const a = $("filtroAno").value;
    return a === "Todos" || a === ano;
  });
  makeChart("chartCompAno", groupedBars(
    anos,
    anos.map((ano) => mediaLista1(t1.filter((t) => t.ano === ano))),
    anos.map((ano) => media2Comp(t2.filter((t) => t.ano === ano), rows2.filter((a) => a.ano === ano)))
  ));
  const discs = ["Português", "Matemática"].filter((d) => {
    const v = $("filtroDisc").value;
    return v === "Todas" || v === d;
  });
  makeChart("chartCompDisc", groupedBars(
    discs,
    discs.map((d) => mediaLista1(t1.filter((t) => t.disciplina === d))),
    discs.map((d) => media2Comp(t2.filter((t) => t.disciplina === d), rows2.filter((a) => a.disciplina === d)))
  ));

  const faixas = ["Defasagem", "Intermediário", "Adequado"];
  const c1 = countsFaixa1(t1);
  const c2 = usaProficiencia2() ? countsFaixa1(t2) : countsFaixa2(rows2);
  const tot1 = faixas.reduce((s, k) => s + c1[k], 0) || 1;
  const tot2 = faixas.reduce((s, k) => s + c2[k], 0) || 1;
  makeChart("chartCompSit", {
    type: "bar",
    data: {
      labels: faixas,
      datasets: [
        { label: "1º Avalie %", data: faixas.map((k) => (100 * c1[k]) / tot1), backgroundColor: faixas.map((k) => SIT_COLORS[k]), borderRadius: 6 },
        { label: "2º Avalie %", data: faixas.map((k) => (100 * c2[k]) / tot2), backgroundColor: faixas.map((k) => SIT_COLORS[k] + "99"), borderRadius: 6 },
      ],
    },
    options: {
      scales: {
        x: { ticks: { color: "#9bb6c2" }, grid: { display: false } },
        y: { min: 0, max: 100, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
      },
      plugins: { legend: { labels: { color: "#e8f2f6" } } },
    },
  });

  const map1 = {};
  t1.forEach((t) => {
    map1[t.escola] = map1[t.escola] || [];
    map1[t.escola].push(t);
  });
  const map2 = {};
  (usaProficiencia2() ? t2 : rows2).forEach((a) => {
    map2[a.escola] = map2[a.escola] || [];
    map2[a.escola].push(a);
  });
  const escolas = unique([...Object.keys(map1), ...Object.keys(map2)]);
  const ranking = escolas.map((escola) => {
    const v1 = mediaLista1(map1[escola] || []);
    const v2 = usaProficiencia2()
      ? mediaLista1(map2[escola] || [])
      : ((map2[escola] || []).length ? mediaDasTurmas(map2[escola]) : null);
    const dlt = v1 == null || v2 == null ? null : v2 - v1;
    return { escola, v1, v2, dlt };
  }).sort((a, b) => (b.dlt ?? -999) - (a.dlt ?? -999));

  $("tbodyCompEscolas").innerHTML = ranking.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="col-escola">${r.escola}</td>
      <td>${r.v1 == null ? "—" : fmtMedia(r.v1)}</td>
      <td><b>${r.v2 == null ? "—" : fmtMedia(r.v2)}</b></td>
      <td class="${deltaClass(r.dlt)}">${fmtDelta(r.dlt)}</td>
      <td>${tendenciaTxt(r.dlt)}</td>
    </tr>
  `).join("");

  const linhas = [];
  anos.forEach((ano) => {
    discs.forEach((disc) => {
      const a = mediaLista1(t1.filter((t) => t.ano === ano && t.disciplina === disc));
      const t2ad = t2.filter((t) => t.ano === ano && t.disciplina === disc);
      const a2ad = rows2.filter((x) => x.ano === ano && x.disciplina === disc);
      const b = media2Comp(t2ad, a2ad);
      const ok2 = usaProficiencia2() ? t2ad.length > 0 : avaliados(a2ad).length > 0;
      const dlt = a == null || !ok2 ? null : b - a;
      linhas.push({ ano, disc, a, b: ok2 ? b : null, dlt });
    });
  });
  $("tbodyCompAnoDisc").innerHTML = linhas.map((r) => `
    <tr>
      <td>${r.ano}</td>
      <td>${r.disc}</td>
      <td>${r.a == null ? "—" : fmtMedia(r.a)}</td>
      <td>${r.b == null ? "—" : fmtMedia(r.b)}</td>
      <td class="${deltaClass(r.dlt)}">${fmtDelta(r.dlt)}</td>
    </tr>
  `).join("");
}

function setupFiltersSpaece() {
  if (!DATA_SP || !DATA_SP.escolas) return;
  const rows = DATA_SP.escolas;
  fillSelect($("filtroAnoSp"), unique(rows.map((r) => r.ano)), ["Todos"]);
  fillSelect($("filtroDiscSp"), unique(rows.map((r) => r.disciplina)), ["Todas"]);
  fillSelect($("filtroEscolaSp"), unique(rows.map((r) => r.escola).filter(Boolean)), ["Todas"]);
}

function filteredSpaece(list) {
  if (!list) return [];
  const ano = $("filtroAnoSp")?.value || "Todos";
  const disc = $("filtroDiscSp")?.value || "Todas";
  const esc = $("filtroEscolaSp")?.value || "Todas";
  return list.filter((r) => {
    if (ano !== "Todos" && r.ano !== ano) return false;
    if (disc !== "Todas" && r.disciplina !== disc) return false;
    if (esc !== "Todas" && r.escola !== esc) return false;
    return true;
  });
}

function padroesOrdemSp(rows) {
  const keys = new Set();
  rows.forEach((r) => Object.keys(r.padroes || {}).forEach((k) => keys.add(k)));
  const a = PADRAO_1000_UI.filter((k) => keys.has(k));
  const b = SIT_OUTROS.filter((k) => keys.has(k));
  return [...a, ...b];
}

function miniBarPadroes(padroes) {
  const order = [...PADRAO_1000_UI, ...SIT_OUTROS].filter((k) => (padroes || {})[k]);
  const tot = order.reduce((s, k) => s + (padroes[k] || 0), 0) || 1;
  return `<div class="mini-bar">${order.map((k) => {
    const n = padroes[k] || 0;
    const w = (100 * n) / tot;
    return `<span title="${k}: ${n}" style="width:${w}%;background:${SIT_COLORS[k] || "#5b6770"}"></span>`;
  }).join("")}</div>`;
}

function predPadrao(padroes) {
  const entries = Object.entries(padroes || {});
  if (!entries.length) return "—";
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function renderSpaece() {
  if (!DATA_SP) {
    if ($("hintSpaece")) $("hintSpaece").textContent = "Arquivo dados_spaece.js não encontrado. Rode python dashboard/processar_spaece.py.";
    return;
  }
  const escolas = filteredSpaece(DATA_SP.escolas);
  const turmas = filteredSpaece(DATA_SP.turmas);
  $("hintSpaece").textContent = DATA_SP.notaFonte;

  const medias = escolas.map((r) => r.media).filter((n) => n != null);
  const avs = escolas.reduce((s, r) => s + (r.avaliados || 0), 0);
  const nEsc = unique(escolas.map((r) => r.escola)).length;
  $("kpisSpaece").innerHTML = `
    <div class="kpi"><span>Proficiência média</span><strong>${medias.length ? fmtProf(avg(medias)) : "—"}</strong><em>média simples das escolas no recorte</em></div>
    <div class="kpi"><span>Avaliados</span><strong>${avs.toLocaleString("pt-BR")}</strong><em>soma dos avaliados nas escolas</em></div>
    <div class="kpi"><span>Escolas</span><strong>${nEsc}</strong><em>${escolas.length} recortes ano × disciplina</em></div>
    <div class="kpi"><span>Turmas no export</span><strong>${turmas.length}</strong><em>linhas de turma no recorte</em></div>
  `;

  const ordem = padroesOrdemSp(escolas);
  const tem1000 = ordem.some((k) => PADRAO_1000_UI.includes(k));
  const temSpaece = ordem.some((k) => SIT_OUTROS.includes(k));
  $("hintSitSp").textContent = tem1000 && temSpaece
    ? "Há duas escalas no recorte. Filtre o ano/disciplina para ver uma de cada vez (2º LP = escala 1000; demais = Muito crítico → Adequado)."
    : tem1000
      ? "2º ano de Português: Abaixo do básico, Básico, Proficiente e Avançado (escala 1000)."
      : "Muito crítico (vermelho), Crítico (amarelo), Intermediário (verde claro) e Adequado (verde escuro).";
  const totP = {};
  ordem.forEach((k) => { totP[k] = 0; });
  escolas.forEach((r) => {
    ordem.forEach((k) => { totP[k] += (r.padroes || {})[k] || 0; });
  });
  makeChart("chartSitSp", {
    type: tem1000 && temSpaece ? "bar" : "doughnut",
    data: {
      labels: ordem,
      datasets: [{ data: ordem.map((k) => totP[k]), backgroundColor: ordem.map((k) => SIT_COLORS[k]) }],
    },
    options: {
      plugins: { legend: { labels: { color: "#e8f2f6" } } },
      scales: tem1000 && temSpaece ? {
        x: { ticks: { color: "#9bb6c2" }, grid: { display: false } },
        y: { ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
      } : undefined,
    },
  });

  const anos = unique(escolas.map((r) => r.ano));
  makeChart("chartAnoSp", {
    type: "bar",
    data: {
      labels: anos,
      datasets: [
        {
          label: "Português",
          data: anos.map((ano) => {
            const xs = escolas.filter((r) => r.ano === ano && r.disciplina === "Português").map((r) => r.media);
            return xs.length ? avg(xs) : null;
          }),
          backgroundColor: "#2ec4b6",
          borderRadius: 6,
        },
        {
          label: "Matemática",
          data: anos.map((ano) => {
            const xs = escolas.filter((r) => r.ano === ano && r.disciplina === "Matemática").map((r) => r.media);
            return xs.length ? avg(xs) : null;
          }),
          backgroundColor: "#ffbf69",
          borderRadius: 6,
        },
      ],
    },
    options: {
      scales: {
        x: { ticks: { color: "#9bb6c2" }, grid: { display: false } },
        y: { ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
      },
      plugins: { legend: { labels: { color: "#e8f2f6" } } },
    },
  });

  const discs = unique(escolas.map((r) => r.disciplina));
  makeChart("chartDiscSp", {
    type: "bar",
    data: {
      labels: discs,
      datasets: [{
        label: "Proficiência",
        data: discs.map((d) => avg(escolas.filter((r) => r.disciplina === d).map((r) => r.media))),
        backgroundColor: ["#2ec4b6", "#ffbf69"],
        borderRadius: 6,
      }],
    },
    options: {
      scales: {
        x: { ticks: { color: "#9bb6c2" }, grid: { display: false } },
        y: { ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
      },
      plugins: { legend: { display: false } },
    },
  });

  const habAcc = {};
  escolas.forEach((r) => {
    (r.habilidades || []).forEach((h) => {
      const k = `${r.ano}|${r.disciplina}|${h.codigo}`;
      habAcc[k] = habAcc[k] || { disc: r.disciplina, codigo: h.codigo, ano: r.ano, soma: 0, n: 0 };
      habAcc[k].soma += h.percentual;
      habAcc[k].n += 1;
    });
  });
  const habs = Object.values(habAcc)
    .map((h) => ({ ...h, pct: h.soma / h.n }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 10);
  makeChart("chartHabSp", {
    type: "bar",
    data: {
      labels: habs.map((h) => rotuloHabilidade(h.ano, h.disc, h.codigo)),
      datasets: [{
        label: "% acerto",
        data: habs.map((h) => h.pct),
        backgroundColor: "#ef476f",
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: "y",
      scales: {
        x: { min: 0, max: 100, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: { ticks: { color: "#9bb6c2", font: { size: 10 } }, grid: { display: false } },
      },
      plugins: { legend: { display: false } },
    },
  });

  const ranking = [...escolas].sort((a, b) => b.media - a.media);
  $("tbodySpaeceEscolas").innerHTML = ranking.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="col-escola">${r.escola}</td>
      <td>${r.ano}</td>
      <td>${r.disciplina}</td>
      <td>${r.avaliados}</td>
      <td><b>${fmtProf(r.media)}</b></td>
      <td>${miniBarPadroes(r.padroes)}</td>
    </tr>
  `).join("");

  const turmasComEsc = turmas.filter((t) => t.escola);
  const turmasSem = turmas.length - turmasComEsc.length;
  $("hintTurmasSp").textContent = turmasSem
    ? `${turmasSem} turmas do export CAEd não trazem o nome da escola (comum em 2º MAT, 5º e 9º). As demais aparecem com escola.`
    : "Turmas do export CAEd no recorte atual.";
  $("tbodySpaeceTurmas").innerHTML = [...turmas].sort((a, b) => (b.media || 0) - (a.media || 0)).map((t) => `
    <tr>
      <td class="col-escola">${t.escola || "—"}</td>
      <td>${t.ano}</td>
      <td>${t.turma}</td>
      <td>${t.disciplina}</td>
      <td>${t.avaliados}</td>
      <td><b>${fmtProf(t.media)}</b></td>
      <td>${badge(predPadrao(t.padroes))}</td>
    </tr>
  `).join("");
}

function setupFiltersNotas() {
  setupFiltersSaep1();
  setupFiltersDiagTurmas();
}

function setupFiltersSaep1() {
  const turmas = DATA_SAEP1 && DATA_SAEP1.turmas ? DATA_SAEP1.turmas : [];
  const anos = ANOS_SAEP.filter((ano) => turmas.some((t) => t.ano === ano));
  const escolas = unique(turmas.map((t) => t.escola));
  if ($("filtroAnoN1")) fillSelect($("filtroAnoN1"), anos, ["Todos"]);
  if ($("filtroDiscN1")) fillSelect($("filtroDiscN1"), ["Português", "Matemática"], ["Todas"]);
  if ($("filtroEscolaN1")) fillSelect($("filtroEscolaN1"), escolas, ["Todas"]);
}

function setupFiltersDiagTurmas() {
  const turmas = DATA_DIAG_TURMAS && DATA_DIAG_TURMAS.turmas ? DATA_DIAG_TURMAS.turmas : [];
  const anos = ANOS_SAEP.filter((ano) => turmas.some((t) => t.ano === ano));
  const escolas = unique(turmas.map((t) => t.escola));
  if ($("filtroAnoN2")) fillSelect($("filtroAnoN2"), anos, ["Todos"]);
  if ($("filtroDiscN2")) fillSelect($("filtroDiscN2"), ["Português", "Matemática"], ["Todas"]);
  if ($("filtroEscolaN2")) fillSelect($("filtroEscolaN2"), escolas, ["Todas"]);
}

function filteredTurmasNotas(kind) {
  const suf = kind === "saep1" ? "N1" : "N2";
  const ano = $("filtroAno" + suf)?.value || "Todos";
  const disc = $("filtroDisc" + suf)?.value || "Todas";
  const esc = $("filtroEscola" + suf)?.value || "Todas";
  if (!DATA1 || !DATA1.turmas) return [];
  return DATA1.turmas.filter((t) => {
    if (!ANOS_COMP.includes(t.ano)) return false;
    if (t.disciplina !== "Português" && t.disciplina !== "Matemática") return false;
    if (ano !== "Todos" && t.ano !== ano) return false;
    if (disc !== "Todas" && t.disciplina !== disc) return false;
    if (esc !== "Todas" && t.escola !== esc) return false;
    return true;
  });
}

function notaEscolaMap() {
  const map = {};
  (DATA_DIAG && DATA_DIAG.escolas ? DATA_DIAG.escolas : []).forEach((e) => { map[e.escola] = e; });
  return map;
}

function filteredTurmasSaep1() {
  return filteredTurmasNotas10("saep1");
}

function filteredTurmasDiag() {
  return filteredTurmasNotas10("diag");
}

function filteredTurmasNotas10(kind) {
  const suf = kind === "saep1" ? "N1" : "N2";
  const ano = $("filtroAno" + suf)?.value || "Todos";
  const disc = $("filtroDisc" + suf)?.value || "Todas";
  const esc = $("filtroEscola" + suf)?.value || "Todas";
  const pack = kind === "saep1" ? DATA_SAEP1 : DATA_DIAG_TURMAS;
  if (!pack || !pack.turmas) return [];
  return pack.turmas.filter((t) => {
    if (t.disciplina !== "Português" && t.disciplina !== "Matemática") return false;
    if (ano !== "Todos" && t.ano !== ano) return false;
    if (disc !== "Todas" && t.disciplina !== disc) return false;
    if (esc !== "Todas" && t.escola !== esc) return false;
    return true;
  });
}

function rankingSaep1Escolas(turmas) {
  const by = {};
  turmas.forEach((t) => {
    const k = `${t.escola}|${t.ano}`;
    if (!by[k]) {
      by[k] = { escola: t.escola, ano: t.ano, classes: new Set(), lp: [], mat: [], all: [] };
    }
    by[k].classes.add(t.turma);
    by[k].all.push(t.media);
    if (t.disciplina === "Português") by[k].lp.push(t.media);
    if (t.disciplina === "Matemática") by[k].mat.push(t.media);
  });
  return Object.values(by).map((r) => ({
    escola: r.escola,
    ano: r.ano,
    n: r.classes.size,
    lp: r.lp.length ? avg(r.lp) : null,
    mat: r.mat.length ? avg(r.mat) : null,
    media: r.all.length ? avg(r.all) : null,
  })).sort((a, b) => (b.media || 0) - (a.media || 0));
}

function renderPainelNotas(kind) {
  const isSaep = kind === "saep1";
  const pack = isSaep ? DATA_SAEP1 : DATA_DIAG_TURMAS;
  const suf = isSaep ? "N1" : "N2";
  const nome = isSaep ? "1º SAEP" : "Diagnóstica";
  const hintId = isSaep ? "hintSaep1" : "hintDiag";
  const kpisId = isSaep ? "kpisSaep1" : "kpisDiagCut";
  const chartRank = isSaep ? "chartSaep1Rank" : "chartDiagTurmasRank";
  const chartAno = isSaep ? "chartSaep1Ano" : "chartDiagAno";
  const tbodyEsc = isSaep ? "tbodySaep1" : "tbodyDiagRecorte";
  const tbodyTur = isSaep ? "tbodySaep1Turmas" : "tbodyDiagTurmas";
  const cor = isSaep ? "#ffbf69" : "#2ec4b6";
  const turmas = filteredTurmasNotas10(kind);
  const anoF = $("filtroAno" + suf)?.value || "Todos";
  const discF = $("filtroDisc" + suf)?.value || "Todas";
  const escF = $("filtroEscola" + suf)?.value || "Todas";

  if ($(hintId)) {
    const fonte = pack && pack.notaFonte ? pack.notaFonte + " " : "";
    const tot = pack && pack.totais ? pack.totais : {};
    const por = tot.porAno || {};
    const resumo = ["1º", "3º", "6º", "7º"].map((ano) => {
      const info = por[ano];
      return info ? `${ano}: ${info.turmas} turmas / ${info.escolas} escolas` : null;
    }).filter(Boolean).join("; ");
    $(hintId).textContent = fonte
      + (resumo ? `No arquivo: ${resumo}. ` : "")
      + "Filtre o ano (1º, 3º, 6º, 7º e os demais da planilha) para ver a colocação e as turmas.";
  }

  const mCut = mediaLista1(turmas);
  const nEsc = unique(turmas.map((t) => t.escola)).length;
  const nTur = unique(turmas.map((t) => `${t.escola}|${t.ano}|${t.turma}`)).length;
  if ($(kpisId)) {
    $(kpisId).innerHTML = `
      <div class="kpi"><span>Média no recorte</span><strong>${mCut == null ? "—" : fmtMedia10(mCut)}</strong><em>0 a 10 · ${nTur} turmas</em></div>
      <div class="kpi"><span>Português</span><strong>${fmtMedia10(mediaLista1(turmas.filter((t) => t.disciplina === "Português")))}</strong><em>média das turmas</em></div>
      <div class="kpi"><span>Matemática</span><strong>${fmtMedia10(mediaLista1(turmas.filter((t) => t.disciplina === "Matemática")))}</strong><em>média das turmas</em></div>
      <div class="kpi"><span>Escolas</span><strong>${nEsc}</strong><em>${anoF} · ${discF}</em></div>
    `;
  }

  const rankEsc = {};
  turmas.forEach((t) => {
    if (!rankEsc[t.escola]) rankEsc[t.escola] = [];
    rankEsc[t.escola].push(t.media);
  });
  const rankRows = Object.entries(rankEsc).map(([escola, xs]) => ({
    escola,
    media: avg(xs),
  })).sort((a, b) => b.media - a.media);
  makeChart(chartRank, {
    type: "bar",
    data: {
      labels: rankRows.map((r) => r.escola.replace(/^EEF |^EMTI /, "")),
      datasets: [{
        label: nome,
        data: rankRows.map((r) => r.media),
        backgroundColor: cor,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { min: 0, max: 10, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: { ticks: { color: "#9bb6c2", font: { size: 10 } }, grid: { display: false } },
      },
    },
  });

  const anos = (anoF === "Todos" ? ANOS_SAEP : [anoF]).filter((ano) => turmas.some((t) => t.ano === ano));
  const discs = ["Português", "Matemática"].filter((d) => discF === "Todas" || discF === d);
  makeChart(chartAno, {
    type: "bar",
    data: {
      labels: anos,
      datasets: discs.map((d, i) => ({
        label: d,
        data: anos.map((ano) => mediaLista1(turmas.filter((t) => t.ano === ano && t.disciplina === d))),
        backgroundColor: i ? "#ffbf69" : "#2ec4b6",
        borderRadius: 6,
      })),
    },
    options: {
      scales: {
        x: { ticks: { color: "#9bb6c2" }, grid: { display: false } },
        y: { min: 0, max: 10, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
      },
      plugins: { legend: { labels: { color: "#e8f2f6" } } },
    },
  });

  const recorte = rankingSaep1Escolas(turmas);
  if ($(tbodyEsc)) {
    $(tbodyEsc).innerHTML = recorte.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="col-escola">${r.escola}</td>
        <td>${r.ano}</td>
        <td>${r.n}</td>
        <td>${fmtNota10(r.lp)}</td>
        <td>${fmtNota10(r.mat)}</td>
        <td><b>${fmtNota10(r.media)}</b></td>
      </tr>
    `).join("");
  }

  if ($(tbodyTur)) {
    $(tbodyTur).innerHTML = [...turmas]
      .sort((a, b) => (b.media || 0) - (a.media || 0))
      .map((t) => `
        <tr>
          <td class="col-escola">${t.escola}</td>
          <td>${t.ano}</td>
          <td>${t.turma}</td>
          <td>${t.disciplina}</td>
          <td><b>${fmtNota10(t.media)}</b></td>
        </tr>
      `).join("");
  }

  renderNotasGerais(kind, escF);
}

function renderNotasGerais(kind, escF) {
  if (!DATA_DIAG || !DATA_DIAG.escolas) return;
  const principal = kind === "saep1" ? "saep1" : "diag";
  const outro = kind === "saep1" ? "diag" : "saep1";
  const nomeP = kind === "saep1" ? "1º SAEP" : "Diagnóstica";
  const nomeO = kind === "saep1" ? "Diagnóstica" : "1º SAEP";
  let rows = DATA_DIAG.escolas.filter((e) => e[principal] != null);
  if (escF && escF !== "Todas") rows = rows.filter((e) => e.escola === escF);
  rows = rows.slice().sort((a, b) => b[principal] - a[principal]);
  const xs = rows.map((e) => e[principal]);
  const ys = rows.map((e) => e[outro]).filter((n) => n != null);
  const idebs = rows.map((e) => e.ideb).filter((n) => n != null);
  const dltAvg = avg(rows.filter((e) => e[outro] != null).map((e) => e[principal] - e[outro]));
  const kpiId = kind === "saep1" ? "kpisSaep1Geral" : "kpisDiag";
  if ($(kpiId)) {
    $(kpiId).innerHTML = `
    <div class="kpi"><span>Média ${nomeP}</span><strong>${xs.length ? fmtMedia10(avg(xs)) : "—"}</strong><em>média simples · ${rows.length} escolas</em></div>
    <div class="kpi"><span>Média ${nomeO}</span><strong>${ys.length ? fmtMedia10(avg(ys)) : "—"}</strong><em>mesma rede</em></div>
    <div class="kpi"><span>Média IDEB</span><strong>${idebs.length ? fmtMedia10(avg(idebs)) : "—"}</strong><em>${idebs.length} escolas com IDEB</em></div>
    <div class="kpi"><span>${nomeP} − ${nomeO}</span><strong class="${deltaClass(dltAvg)}">${fmtMedia10(dltAvg)}</strong><em>variação média</em></div>
  `;
  }
  const labels = rows.map((e) => e.escola.replace(/^EEF |^EMTI /, ""));
  if (kind !== "saep1") {
    makeChart("chartDiagRank", {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: nomeP,
          data: rows.map((e) => e[principal]),
          backgroundColor: "#2ec4b6",
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: { min: 0, max: 10, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
          y: { ticks: { color: "#9bb6c2", font: { size: 10 } }, grid: { display: false } },
        },
      },
    });
    makeChart("chartDiagComp", {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Diagnóstica", data: rows.map((e) => e.diag), backgroundColor: "#2ec4b6", borderRadius: 3 },
          { label: "1º SAEP", data: rows.map((e) => e.saep1), backgroundColor: "#ffbf69", borderRadius: 3 },
          { label: "IDEB", data: rows.map((e) => e.ideb), backgroundColor: "#9ec9ea", borderRadius: 3 },
        ],
      },
      options: {
        indexAxis: "y",
        plugins: { legend: { labels: { color: "#e8f2f6" } } },
        scales: {
          x: { min: 0, max: 10, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
          y: { ticks: { color: "#9bb6c2", font: { size: 10 } }, grid: { display: false } },
        },
      },
    });
  }
  const tbody = $(kind === "saep1" ? "tbodySaep1Geral" : "tbodyDiag");
  if (!tbody) return;
  tbody.innerHTML = rows.map((e, i) => {
    const dlt = e.diag != null && e.saep1 != null ? e.saep1 - e.diag : null;
    const a = kind === "saep1" ? e.saep1 : e.diag;
    const b = kind === "saep1" ? e.diag : e.saep1;
    return `<tr>
      <td>${i + 1}</td>
      <td class="col-escola">${e.escola}</td>
      <td><b>${fmtNota10(a)}</b></td>
      <td>${fmtNota10(b)}</td>
      <td class="${deltaClass(dlt)}">${dlt == null ? "—" : (dlt > 0 ? "+" : "") + fmtNota10(dlt)}</td>
      <td>${fmtNota10(e.ideb)}</td>
      <td>${fmtNota10(e.idebIniciais)}</td>
      <td>${fmtNota10(e.idebFinais)}</td>
    </tr>`;
  }).join("");
}

function setupFiltersPar() {
  const t1 = DATA1 && DATA1.turmas ? DATA1.turmas : [];
  const sp = DATA_SP && DATA_SP.escolas ? DATA_SP.escolas : [];
  const diag = DATA_DIAG && DATA_DIAG.escolas ? DATA_DIAG.escolas : [];
  const tDiag = DATA_DIAG_TURMAS && DATA_DIAG_TURMAS.turmas ? DATA_DIAG_TURMAS.turmas : [];
  const tSaep = DATA_SAEP1 && DATA_SAEP1.turmas ? DATA_SAEP1.turmas : [];
  const a2alunos = DATA && DATA.alunos ? DATA.alunos.filter((a) => ANOS_OK.includes(a.ano) && (a.disciplina === "Português" || a.disciplina === "Matemática")) : [];
  const a2turmas = DATA && DATA.turmas ? DATA.turmas.filter((t) => ANOS_OK.includes(t.ano) && (t.disciplina === "Português" || t.disciplina === "Matemática")) : [];
  const anos = ANOS_CARTAS.filter((ano) =>
    tDiag.some((t) => t.ano === ano) || tSaep.some((t) => t.ano === ano) || ANOS_OK.includes(ano) || ANOS_COMP.includes(ano)
  );
  const escolas = unique([
    ...diag.map((e) => e.escola),
    ...tDiag.map((t) => t.escola),
    ...tSaep.map((t) => t.escola),
    ...t1.map((t) => t.escola),
    ...a2alunos.map((a) => a.escola),
    ...a2turmas.map((t) => t.escola),
    ...sp.map((r) => r.escola).filter(Boolean),
    ...((DATA_IDEB && DATA_IDEB.escolas) ? DATA_IDEB.escolas.map((e) => e.escola) : []),
  ]);
  if ($("filtroAnoPar")) {
    fillSelect($("filtroAnoPar"), unique(anos), ["Todos"]);
    fillSelect($("filtroDiscPar"), ["Português", "Matemática"], ["Todas"]);
    fillSelect($("filtroEscolaPar"), escolas, ["Todas"]);
  }
}

function recortePar(opts) {
  if (opts) {
    return {
      ano: opts.ano || "Todos",
      disc: opts.disc || "Todas",
      esc: opts.esc || "Todas",
    };
  }
  return {
    ano: $("filtroAnoPar")?.value || "Todos",
    disc: $("filtroDiscPar")?.value || "Todas",
    esc: $("filtroEscolaPar")?.value || "Todas",
  };
}

function filtroPar() {
  return recortePar();
}

function turmas1Par(opts) {
  if (!DATA1 || !DATA1.turmas) return [];
  const { ano, disc, esc } = recortePar(opts);
  return DATA1.turmas.filter((t) => {
    if (!ANOS_COMP.includes(t.ano)) return false;
    if (t.disciplina !== "Português" && t.disciplina !== "Matemática") return false;
    if (ano !== "Todos" && t.ano !== ano) return false;
    if (disc !== "Todas" && t.disciplina !== disc) return false;
    if (esc !== "Todas" && t.escola !== esc) return false;
    return true;
  });
}

function turmasNotasPar(kind, opts) {
  const pack = kind === "saep1" ? DATA_SAEP1 : DATA_DIAG_TURMAS;
  if (!pack || !pack.turmas) return [];
  const { ano, disc, esc } = recortePar(opts);
  return pack.turmas.filter((t) => {
    if (t.disciplina !== "Português" && t.disciplina !== "Matemática") return false;
    if (ano !== "Todos" && t.ano !== ano) return false;
    if (disc !== "Todas" && t.disciplina !== disc) return false;
    if (esc !== "Todas" && t.escola !== esc) return false;
    return true;
  });
}

function mediaNotasPorEscola(turmas) {
  const map = {};
  (turmas || []).forEach((t) => {
    if (!t.escola || t.media == null) return;
    (map[t.escola] = map[t.escola] || []).push(t.media);
  });
  const out = {};
  Object.keys(map).forEach((escola) => { out[escola] = avg(map[escola]); });
  return out;
}

function rankingTurmasNotas10(pack, ano, disc) {
  const list = ((pack && pack.turmas) || []).filter(
    (t) => t.ano === ano && t.disciplina === disc && t.media != null
  );
  return rankingPorEscola(
    list,
    mediaLista1,
    (turmas) => `${turmas.length} turma${turmas.length === 1 ? "" : "s"}`
  );
}

function alunos2Par(opts) {
  const { ano, disc, esc } = recortePar(opts);
  return ((DATA && DATA.alunos) || []).filter((a) => {
    if (!ANOS_OK.includes(a.ano)) return false;
    if (a.disciplina !== "Português" && a.disciplina !== "Matemática") return false;
    if (ano !== "Todos" && a.ano !== ano) return false;
    if (disc !== "Todas" && a.disciplina !== disc) return false;
    if (esc !== "Todas" && a.escola !== esc) return false;
    return true;
  });
}

function turmas2Par(opts) {
  const { ano, disc, esc } = recortePar(opts);
  return ((DATA && DATA.turmas) || []).filter((t) => {
    if (!ANOS_OK.includes(t.ano)) return false;
    if (t.disciplina !== "Português" && t.disciplina !== "Matemática") return false;
    if (ano !== "Todos" && t.ano !== ano) return false;
    if (disc !== "Todas" && t.disciplina !== disc) return false;
    if (esc !== "Todas" && t.escola !== esc) return false;
    return t.media != null;
  });
}

function spaecePar(opts) {
  if (!DATA_SP || !DATA_SP.escolas) return [];
  const { ano, disc, esc } = recortePar(opts);
  return DATA_SP.escolas.filter((r) => {
    if (ano !== "Todos" && r.ano !== ano) return false;
    if (disc !== "Todas" && r.disciplina !== disc) return false;
    if (esc !== "Todas" && r.escola !== esc) return false;
    return true;
  });
}

function idebMap() {
  const map = {};
  (DATA_IDEB && DATA_IDEB.escolas ? DATA_IDEB.escolas : []).forEach((e) => { map[e.escola] = e; });
  return map;
}

function escolasIdebBase() {
  const map = idebMap();
  const nomes = unique([
    ...Object.keys(map),
    ...((DATA_DIAG && DATA_DIAG.escolas) ? DATA_DIAG.escolas.map((e) => e.escola) : []),
  ]);
  return nomes.map((escola) => map[escola] || {
    escola,
    ideb: null,
    idebIniciais: null,
    idebFinais: null,
    idebIniciais2023: null,
    idebFinais2023: null,
    matIniciais: null,
    portIniciais: null,
    matFinais: null,
    portFinais: null,
  });
}

function idebRecorte(e, ano) {
  if (!e) return null;
  if (ano === "2º" || ano === "4º" || ano === "5º") return e.idebIniciais ?? null;
  if (ano === "8º" || ano === "9º") return e.idebFinais ?? null;
  if (ano === "Todos") return e.ideb ?? null;
  return null;
}

function etapaDoAno(ano) {
  if (ano === "2º" || ano === "4º" || ano === "5º") return "AI";
  if (ano === "8º" || ano === "9º") return "AF";
  return "Todos";
}

function fmtIdebCel(v25, v23) {
  if (v25 != null) return `<b>${fmtNota10(v25)}</b>`;
  if (v23 != null) return `— <span class="ideb-so-2023">2023: ${fmtNota10(v23)}</span>`;
  return "—";
}

function mediaSpaeceEscola(rows) {
  const xs = (rows || []).map((r) => r.media).filter((n) => n != null);
  return xs.length ? avg(xs) : null;
}

function linhasPar(opts) {
  const { ano, disc, esc } = recortePar(opts);
  const t1 = turmas1Par(opts);
  const t2 = usaProficiencia2() ? turmas2Par(opts) : [];
  const a2 = usaProficiencia2() ? [] : alunos2Par(opts);
  const sp = spaecePar(opts);
  const recorteNotas = ano !== "Todos" || disc !== "Todas";
  const mapDiagT = mediaNotasPorEscola(turmasNotasPar("diag", opts));
  const mapSaepT = mediaNotasPorEscola(turmasNotasPar("saep1", opts));
  const map1 = {};
  t1.forEach((t) => {
    map1[t.escola] = map1[t.escola] || [];
    map1[t.escola].push(t);
  });
  const map2 = {};
  (usaProficiencia2() ? t2 : a2).forEach((a) => {
    map2[a.escola] = map2[a.escola] || [];
    map2[a.escola].push(a);
  });
  const mapSp = {};
  sp.forEach((r) => {
    if (!r.escola) return;
    mapSp[r.escola] = mapSp[r.escola] || [];
    mapSp[r.escola].push(r);
  });
  const mapNota = notaEscolaMap();
  const mapIdeb = idebMap();
  let escolas = unique([
    ...Object.keys(mapNota),
    ...Object.keys(mapDiagT),
    ...Object.keys(mapSaepT),
    ...Object.keys(map1),
    ...Object.keys(map2),
    ...Object.keys(mapSp),
    ...Object.keys(mapIdeb),
    ...Object.keys(protoMapEscola(ano, disc === "Todas" ? "Português" : disc)),
  ]);
  if (esc !== "Todas") escolas = escolas.filter((e) => e === esc);
  return escolas.map((escola) => {
    const nota = mapNota[escola] || {};
    const v1 = mediaLista1(map1[escola] || []);
    const v2 = usaProficiencia2()
      ? ((map2[escola] || []).length ? mediaLista1(map2[escola]) : null)
      : ((map2[escola] || []).length && avaliados(map2[escola]).length ? mediaDasTurmas(map2[escola]) : null);
    return {
      escola,
      diag: recorteNotas ? (mapDiagT[escola] ?? null) : nota.diag,
      saep1: recorteNotas ? (mapSaepT[escola] ?? null) : nota.saep1,
      avalie1: v1,
      avalie2: v2,
      ideb: idebRecorte(mapIdeb[escola], ano),
      ideb23: (ano === "Todos" || ["2º", "4º", "5º", "8º", "9º"].includes(ano))
        ? idebNota(mapIdeb[escola], etapaDoAno(ano), 2023)
        : null,
      spaece: mediaSpaeceEscola(mapSp[escola]),
    };
  }).sort((a, b) => a.escola.localeCompare(b.escola, "pt-BR"));
}

function renderPar() {
  const { ano, disc } = filtroPar();
  const rows = linhasPar();
  const t1 = turmas1Par();
  const sp = spaecePar();
  const misturado = ano === "Todos" && unique(sp.map((r) => `${r.ano}|${r.disciplina}`)).length > 1;
  if ($("hintPar")) {
    $("hintPar").textContent = [
      ano === "Todos" && disc === "Todas"
        ? "Diagnóstica e 1º SAEP: média geral da escola (0 a 10), sem recorte de ano ou disciplina."
        : "Diagnóstica e 1º SAEP: média das turmas (0 a 10) no ano e disciplina selecionados (inclui 1º, 3º, 6º e 7º).",
      "1º Avalie.CE: proficiência média CAEd 2026.1 (2º, 5º e 9º). 2º Avalie.CE: proficiência média CAEd 2026.2 (HABILIDADE_DESEMPENHO). Sem dados = —.",
      DATA_IDEB && DATA_IDEB.notaFonte ? DATA_IDEB.notaFonte : "Arquivo dados_ideb.js não encontrado. Rode python dashboard/processar_ideb.py.",
      misturado ? "SPAECE: recorte “Todos” mistura escalas (2º LP = 1000). Prefira um ano." : (DATA_SP ? DATA_SP.notaFonte : ""),
    ].filter(Boolean).join(" ");
  }

  const avgOf = (key, fmt) => {
    const xs = rows.map((r) => r[key]).filter((n) => n != null);
    return xs.length ? fmt(avg(xs)) : "—";
  };
  $("kpisPar").innerHTML = `
    <div class="kpi"><span>Diagnóstica</span><strong>${avgOf("diag", fmtMedia10)}</strong><em>0 a 10 · ${ano === "Todos" && disc === "Todas" ? "geral" : `${ano} · ${disc}`}</em></div>
    <div class="kpi"><span>1º SAEP</span><strong>${avgOf("saep1", fmtMedia10)}</strong><em>0 a 10 · ${ano === "Todos" && disc === "Todas" ? "geral" : `${ano} · ${disc}`}</em></div>
    <div class="kpi"><span>1º Avalie.CE</span><strong>${mediaLista1(t1) == null ? "—" : fmtMedia(mediaLista1(t1))}</strong><em>Proficiência média · ${ano} · ${disc}</em></div>
    <div class="kpi"><span>2º Avalie.CE</span><strong>${avgOf("avalie2", fmtMedia)}</strong><em>${usaProficiencia2() ? "Proficiência média" : "BH58"} · ${ano} · ${disc}</em></div>
    <div class="kpi"><span>IDEB 2025</span><strong>${avgOf("ideb", fmtMedia10)}</strong><em>${ano === "Todos" ? "média das etapas" : (["8º", "9º"].includes(ano) ? "anos finais" : (["2º", "4º", "5º"].includes(ano) ? "anos iniciais" : ano))}</em></div>
    <div class="kpi"><span>SPAECE 2025</span><strong>${avgOf("spaece", fmtProf)}</strong><em>proficiência · ${ano} · ${disc}</em></div>
  `;

  const labels = rows.map((r) => r.escola.replace(/^EEF |^EMTI /, ""));
  const axisY = { ticks: { color: "#9bb6c2", font: { size: 10 } }, grid: { display: false } };
  makeChart("chartPar10", {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Diagnóstica", data: rows.map((r) => r.diag), backgroundColor: "#2ec4b6", borderRadius: 3 },
        { label: "1º SAEP", data: rows.map((r) => r.saep1), backgroundColor: "#ffbf69", borderRadius: 3 },
        { label: "IDEB 2025", data: rows.map((r) => r.ideb), backgroundColor: "#c4a574", borderRadius: 3 },
      ],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { labels: { color: "#e8f2f6" } } },
      scales: {
        x: { min: 0, max: 10, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: axisY,
      },
    },
  });
  makeChart("chartParAvalie", {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "1º Avalie.CE", data: rows.map((r) => r.avalie1), backgroundColor: "#ffbf69", borderRadius: 3 },
        { label: "2º Avalie.CE", data: rows.map((r) => r.avalie2), backgroundColor: "#2ec4b6", borderRadius: 3 },
      ],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { labels: { color: "#e8f2f6" } } },
      scales: {
        x: { min: 0, max: 100, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: axisY,
      },
    },
  });
  makeChart("chartParSpaece", {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "SPAECE 2025",
        data: rows.map((r) => r.spaece),
        backgroundColor: "#a88cff",
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: axisY,
      },
    },
  });

  $("tbodyPar").innerHTML = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="col-escola">${r.escola}</td>
      <td>${fmtNota10(r.diag)}</td>
      <td>${fmtNota10(r.saep1)}</td>
      <td>${r.avalie1 == null ? "—" : fmtMedia(r.avalie1)}</td>
      <td><b>${r.avalie2 == null ? "—" : fmtMedia(r.avalie2)}</b></td>
      <td>${fmtIdebCel(r.ideb, r.ideb23)}</td>
      <td>${r.spaece == null ? "—" : fmtProf(r.spaece)}</td>
    </tr>
  `).join("");
}

function setupFiltersIdeb() {
  const escolas = unique(escolasIdebBase().map((e) => e.escola));
  if ($("filtroEscolaIdeb")) fillSelect($("filtroEscolaIdeb"), escolas, ["Todas"]);
}

function idebEtapa() {
  return $("filtroEtapaIdeb")?.value || "Todos";
}

function idebNota(e, etapa, ano) {
  if (!e) return null;
  if (ano === 2023) {
    if (etapa === "AI") return e.idebIniciais2023 ?? null;
    if (etapa === "AF") return e.idebFinais2023 ?? null;
    const xs = [e.idebIniciais2023, e.idebFinais2023].filter((n) => n != null);
    if (!xs.length) return null;
    return xs.length === 1 ? xs[0] : Math.round((xs[0] + xs[1]) * 5) / 10;
  }
  if (etapa === "AI") return e.idebIniciais ?? null;
  if (etapa === "AF") return e.idebFinais ?? null;
  return e.ideb ?? null;
}

function idebSaeb(e, etapa, disc) {
  if (!e) return null;
  if (disc === "LP") {
    if (etapa === "AF") return e.portFinais ?? null;
    if (etapa === "AI") return e.portIniciais ?? null;
    return e.portIniciais ?? e.portFinais ?? null;
  }
  if (etapa === "AF") return e.matFinais ?? null;
  if (etapa === "AI") return e.matIniciais ?? null;
  return e.matIniciais ?? e.matFinais ?? null;
}

function fmtDelta10(n) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0.05 ? "+" : "";
  return `${sign}${fmtNota10(n)}`;
}

function renderIdeb() {
  if (!DATA_IDEB || !DATA_IDEB.escolas) {
    if ($("hintIdeb")) $("hintIdeb").textContent = "Arquivo dados_ideb.js não encontrado. Rode python dashboard/processar_ideb.py.";
    if (!DATA_DIAG) return;
  }
  const etapa = idebEtapa();
  const esc = $("filtroEscolaIdeb")?.value || "Todas";
  const etapaNome = etapa === "AI" ? "anos iniciais" : etapa === "AF" ? "anos finais" : "média das etapas";
  let rows = escolasIdebBase();
  if (esc !== "Todas") rows = rows.filter((e) => e.escola === esc);
  const ranked = rows.map((e) => {
    const v25 = idebNota(e, etapa, 2025);
    const v23 = idebNota(e, etapa, 2023);
    const dlt = v25 == null || v23 == null ? null : v25 - v23;
    return { ...e, v25, v23, dlt, lp: idebSaeb(e, etapa, "LP"), mat: idebSaeb(e, etapa, "MAT") };
  }).sort((a, b) => {
    if (a.v25 != null && b.v25 == null) return -1;
    if (a.v25 == null && b.v25 != null) return 1;
    return (b.v25 ?? b.v23 ?? -1) - (a.v25 ?? a.v23 ?? -1);
  });
  const sem2025 = ranked.filter((r) => r.v25 == null && r.v23 != null);
  if ($("hintIdeb")) {
    $("hintIdeb").textContent = [
      DATA_IDEB && DATA_IDEB.notaFonte ? DATA_IDEB.notaFonte : "",
      `Recorte atual: ${etapaNome}.`,
      sem2025.length
        ? `Sem IDEB 2025 na divulgação INEP (aparece o 2023): ${sem2025.map((r) => r.escola.replace(/^EEF |^EMTI /, "")).join(", ")}.`
        : "",
    ].filter(Boolean).join(" ");
  }

  const xs25 = ranked.map((r) => r.v25).filter((n) => n != null);
  const xs23 = ranked.map((r) => r.v23).filter((n) => n != null);
  const dlts = ranked.filter((r) => r.dlt != null).map((r) => r.dlt);
  const n25 = ranked.filter((r) => r.v25 != null).length;
  const ini = ranked.map((r) => r.idebIniciais).filter((n) => n != null);
  const fin = ranked.map((r) => r.idebFinais).filter((n) => n != null);
  $("kpisIdeb").innerHTML = `
    <div class="kpi"><span>IDEB 2025</span><strong>${xs25.length ? fmtMedia10(avg(xs25)) : "—"}</strong><em>${etapaNome} · ${n25} escolas</em></div>
    <div class="kpi"><span>IDEB 2023</span><strong>${xs23.length ? fmtMedia10(avg(xs23)) : "—"}</strong><em>mesma etapa</em></div>
    <div class="kpi"><span>Variação</span><strong class="${deltaClass(dlts.length ? avg(dlts) : null)}">${dlts.length ? fmtDelta10(avg(dlts)) : "—"}</strong><em>2025 − 2023</em></div>
    <div class="kpi"><span>Iniciais / finais</span><strong>${ini.length ? fmtMedia10(avg(ini)) : "—"} / ${fin.length ? fmtMedia10(avg(fin)) : "—"}</strong><em>médias 2025 da rede</em></div>
  `;

  const com25 = ranked.filter((r) => r.v25 != null);
  const comAlgum = ranked.filter((r) => r.v25 != null || r.v23 != null);
  const labels25 = com25.map((r) => r.escola.replace(/^EEF |^EMTI /, ""));
  const labelsMix = comAlgum.map((r) => r.escola.replace(/^EEF |^EMTI /, ""));
  const axisY = { ticks: { color: "#9bb6c2", font: { size: 10 } }, grid: { display: false } };
  makeChart("chartIdebRank", {
    type: "bar",
    data: {
      labels: labels25,
      datasets: [{
        label: "IDEB 2025",
        data: com25.map((r) => r.v25),
        backgroundColor: "#c4a574",
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { min: 0, max: 10, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: axisY,
      },
    },
  });
  makeChart("chartIdebAno", {
    type: "bar",
    data: {
      labels: labelsMix,
      datasets: [
        { label: "2023", data: comAlgum.map((r) => r.v23), backgroundColor: "#9ec9ea", borderRadius: 3 },
        { label: "2025", data: comAlgum.map((r) => r.v25), backgroundColor: "#c4a574", borderRadius: 3 },
      ],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { labels: { color: "#e8f2f6" } } },
      scales: {
        x: { min: 0, max: 10, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: axisY,
      },
    },
  });
  const comEtapa = ranked.filter((r) => r.idebIniciais != null || r.idebFinais != null);
  makeChart("chartIdebEtapa", {
    type: "bar",
    data: {
      labels: comEtapa.map((r) => r.escola.replace(/^EEF |^EMTI /, "")),
      datasets: [
        { label: "Anos iniciais", data: comEtapa.map((r) => r.idebIniciais), backgroundColor: "#2ec4b6", borderRadius: 3 },
        { label: "Anos finais", data: comEtapa.map((r) => r.idebFinais), backgroundColor: "#ffbf69", borderRadius: 3 },
      ],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { labels: { color: "#e8f2f6" } } },
      scales: {
        x: { min: 0, max: 10, ticks: { color: "#9bb6c2" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: axisY,
      },
    },
  });

  $("tbodyIdeb").innerHTML = ranked.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="col-escola">${r.escola}</td>
      <td>${fmtIdebCel(r.v25, r.v23)}</td>
      <td>${fmtNota10(r.v23)}</td>
      <td class="${deltaClass(r.dlt)}">${fmtDelta10(r.dlt)}</td>
      <td>${fmtNota10(r.idebIniciais)}</td>
      <td>${fmtNota10(r.idebIniciais2023)}</td>
      <td>${fmtNota10(r.idebFinais)}</td>
      <td>${fmtNota10(r.idebFinais2023)}</td>
      <td>${r.lp == null ? "—" : fmtProf(r.lp)}</td>
      <td>${r.mat == null ? "—" : fmtProf(r.mat)}</td>
    </tr>
  `).join("");
}

function protoAlunos() {
  const reais = DATA_PROTO && Array.isArray(DATA_PROTO.alunos) ? DATA_PROTO.alunos : [];
  if (reais.length) return reais;
  const turmas = DATA_PROTO && Array.isArray(DATA_PROTO.turmas) ? DATA_PROTO.turmas : [];
  return turmas.map((t) => ({
    escola: t.escola,
    ano: t.ano,
    turma: t.turma,
    disciplina: t.disciplina,
    aluno: "Turma",
    falta: false,
    nee: false,
    nquestoes: t.media == null ? 0 : 100,
    nquest: t.media == null ? 0 : 100,
    acertos: t.media,
    percentual: t.media,
    protocolo: t.protocolo || "",
    situacao: t.media == null ? "Não lançado" : "Avaliado",
    _avaliados: Number(t.avaliados) || 0,
    _faltas: Number(t.faltas) || 0,
    _nee: Number(t.nee) || 0,
    _agg: true,
  }));
}

function protoEhAgregado(list) {
  return (list || []).some((r) => r._agg);
}

function protoSomaCampo(list, campo) {
  return (list || []).reduce((s, r) => s + (Number(r[campo]) || 0), 0);
}

function protoContaNee(list) {
  if (protoEhAgregado(list)) {
    const by = {};
    list.forEach((r) => {
      const k = `${r.ano}|${r.turma}`;
      by[k] = Math.max(by[k] || 0, Number(r._nee) || 0);
    });
    return Object.values(by).reduce((s, n) => s + n, 0);
  }
  return unique(list.filter((r) => r.nee).map((r) => `${r.turma}|${r.aluno}`)).length;
}

function normAnoKey(ano) {
  const s = String(ano || "").normalize("NFC");
  const m = s.match(/(\d{1,2})/);
  if (!m) return s.trim();
  const n = Number(m[1]);
  if (n >= 1 && n <= 9) return `${n}º`;
  return s.trim();
}

function mesmaEscolaLinha(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = stripAccNome(a).toUpperCase().replace(/\s+/g, " ").trim();
  const nb = stripAccNome(b).toUpperCase().replace(/\s+/g, " ").trim();
  return na === nb;
}

function protoDiscNome(disc) {
  const t = stripAccNome(disc || "").toUpperCase();
  if (t === "MAT" || t.startsWith("MATEM")) return "Matemática";
  if (t === "LP" || t.startsWith("PORTUG")) return "Português";
  if (t.startsWith("ESCRIT")) return "Escrita";
  return disc;
}

function protoDiscOk(discFiltro, disciplina) {
  const d = protoDiscNome(disciplina);
  if (!discFiltro || discFiltro === "Todas") {
    return d === "Português" || d === "Matemática";
  }
  return d === protoDiscNome(discFiltro);
}

function protoFiltered() {
  const ano = $("filtroAnoProto")?.value || "Todos";
  const disc = $("filtroDiscProto")?.value || "Todas";
  const esc = $("filtroEscolaProto")?.value || "Todas";
  const turma = $("filtroTurmaProto")?.value || "Todas";
  return protoAlunos().filter((a) => {
    if (ano !== "Todos" && a.ano !== ano) return false;
    if (esc !== "Todas" && a.escola !== esc) return false;
    if (turma !== "Todas" && a.turma !== turma) return false;
    return protoDiscOk(disc, a.disciplina);
  });
}

function protoBH58(list) {
  // BH58 = SUM(acertos) / (COUNTA(nomes) × nº questões). 0% e não lançado entram.
  // bhTotalAcertos/bhCounta = linha de totais do Excel (pode incluir acerto em linha sem nome).
  const av = (list || []).filter((a) => a.aluno);
  if (!av.length) return null;
  const tot = av.find((a) => a.bhTotalAcertos != null);
  const nqUnit = Number(tot && (tot.nquestoes || tot.nquest)) || Number(av[0].nquestoes) || Number(av[0].nquest) || 0;
  if (tot && tot.bhTotalAcertos != null && tot.bhCounta && nqUnit) {
    return (100 * Number(tot.bhTotalAcertos)) / (Number(tot.bhCounta) * nqUnit);
  }
  const ac = av.reduce((s, a) => s + (Number(a.acertos) || 0), 0);
  const nq = av.reduce((s, a) => s + (Number(a.nquestoes) || Number(a.nquest) || 0), 0);
  return nq ? (100 * ac) / nq : null;
}

function protoMediaEscolaList() {
  return DATA_PROTO && Array.isArray(DATA_PROTO.mediaEscola) ? DATA_PROTO.mediaEscola : [];
}

function protoLookupMediaEscola(escola, ano, disc) {
  const d = protoDiscNome(disc);
  const a = normAnoKey(ano);
  const hit = protoMediaEscolaList().find((o) => (
    mesmaEscolaLinha(o.escola, escola)
    && normAnoKey(o.ano) === a
    && protoDiscNome(o.disciplina) === d
    && o.media != null
  ));
  return hit ? Number(hit.media) : null;
}

function protoMediaEscolaAnoDisc(escola, ano, disc) {
  const ov = protoLookupMediaEscola(escola, ano, disc);
  if (ov != null && !Number.isNaN(ov)) return ov;
  const anoN = normAnoKey(ano);
  const rows = protoAlunos().filter((a) => {
    if (!mesmaEscolaLinha(a.escola, escola)) return false;
    if (normAnoKey(a.ano) !== anoN) return false;
    return protoDiscOk(disc, a.disciplina);
  });
  return protoMediaTurmas(rows);
}

function rankingGeralProtocolo() {
  // Ranking geral: 1 nota = 1 turma × 1 disciplina (LP ou MAT). Sem KPI de escola
  // (ex.: Araci 7º 60,5/31,3 fica nas outras abas). Sem inventar ano ou turma.
  const porEsc = {};
  protoAlunos().forEach((a) => {
    const ano = normAnoKey(a.ano);
    if (!ANOS_SAEP.includes(ano)) return;
    if (!protoDiscOk("Todas", a.disciplina)) return;
    if (!a.escola || !a.aluno) return;
    const disc = protoDiscNome(a.disciplina);
    const turma = a.turma || "—";
    const k = `${ano}|${turma}|${disc}`;
    const bucket = (porEsc[a.escola] = porEsc[a.escola] || {});
    (bucket[k] = bucket[k] || { ano, turma, disc, rows: [] }).rows.push(a);
  });
  const ranking = Object.keys(porEsc).map((escola) => {
    const notas = [];
    const lps = [];
    const mats = [];
    const porAnoMap = {};
    Object.values(porEsc[escola]).forEach((g) => {
      const m = protoBH58(g.rows);
      if (m == null) return;
      notas.push(m);
      if (g.disc === "Português") lps.push(m);
      if (g.disc === "Matemática") mats.push(m);
      const y = porAnoMap[g.ano] || (porAnoMap[g.ano] = {
        ano: g.ano, lps: [], mats: [], nNotas: 0, turmas: {},
      });
      y.nNotas += 1;
      y.turmas[g.turma] = true;
      if (g.disc === "Português") y.lps.push(m);
      if (g.disc === "Matemática") y.mats.push(m);
    });
    const porAno = ANOS_SAEP.filter((ano) => porAnoMap[ano]).map((ano) => {
      const y = porAnoMap[ano];
      return {
        ano,
        lp: y.lps.length ? avg(y.lps) : null,
        mat: y.mats.length ? avg(y.mats) : null,
        nNotas: y.nNotas,
        nTurmas: Object.keys(y.turmas).length,
      };
    });
    return {
      escola,
      media: notas.length ? avg(notas) : null,
      lp: lps.length ? avg(lps) : null,
      mat: mats.length ? avg(mats) : null,
      nAnos: porAno.length,
      nNotas: notas.length,
      porAno,
    };
  }).filter((r) => r.nNotas > 0);
  ranking.sort((a, b) => {
    if (a.media != null && b.media == null) return -1;
    if (a.media == null && b.media != null) return 1;
    if (a.media != null && b.media != null && b.media !== a.media) return b.media - a.media;
    return a.escola.localeCompare(b.escola, "pt-BR");
  });
  return ranking.map((r, i) => ({ ...r, colocacao: i + 1 }));
}

function protoMediaTurmas(rows) {
  const map = {};
  (rows || []).forEach((r) => {
    if (!r.aluno) return;
    const k = `${r.escola}|${r.ano}|${r.turma}|${r.disciplina}`;
    (map[k] = map[k] || []).push(r);
  });
  const keys = Object.keys(map);
  if (keys.length) {
    const recortes = unique(keys.map((k) => {
      const p = k.split("|");
      return `${p[0]}|${normAnoKey(p[1])}|${protoDiscNome(p[3])}`;
    }));
    const escolasAno = unique(recortes.map((r) => r.split("|").slice(0, 2).join("|")));
    if (escolasAno.length === 1) {
      const ovs = recortes.map((r) => {
        const [esc, ano, disc] = r.split("|");
        return protoLookupMediaEscola(esc, ano, disc);
      });
      if (ovs.every((n) => n != null)) return avg(ovs);
    }
  }
  const medias = Object.values(map).map((xs) => protoBH58(xs)).filter((n) => n != null);
  return medias.length ? avg(medias) : null;
}

function protoMediaDisc(rows, disc) {
  return protoMediaTurmas((rows || []).filter((r) => r.disciplina === disc));
}

function rankingEscolasProto(rows) {
  const map = {};
  (rows || []).forEach((a) => {
    (map[a.escola] = map[a.escola] || []).push(a);
  });
  const ranking = Object.entries(map).map(([escola, list]) => {
    const av = list.filter((r) => r.situacao === "Avaliado");
    const turmas = unique(list.map((r) => r.turma));
    return {
      escola,
      nTurmas: turmas.length,
      avaliados: protoEhAgregado(list) ? protoSomaCampo(list, "_avaliados") : av.length,
      faltas: protoEhAgregado(list) ? protoSomaCampo(list, "_faltas") : list.filter((r) => r.falta).length,
      nee: protoContaNee(list),
      lp: protoMediaDisc(list, "Português"),
      mat: protoMediaDisc(list, "Matemática"),
      escrita: protoMediaDisc(list, "Escrita"),
      media: protoMediaTurmas(list),
    };
  });
  ranking.sort((a, b) => {
    if (a.media != null && b.media == null) return -1;
    if (a.media == null && b.media != null) return 1;
    if (a.media != null && b.media != null && b.media !== a.media) return b.media - a.media;
    return a.escola.localeCompare(b.escola, "pt-BR");
  });
  return ranking.map((r, i) => ({ ...r, colocacao: i + 1 }));
}

function anosProtoCartas() {
  const pack = (DATA_PROTO && Array.isArray(DATA_PROTO.anos)) ? DATA_PROTO.anos : [];
  const alunos = protoAlunos().map((a) => a.ano).filter(Boolean);
  return ordenarAnos([...pack, ...alunos]);
}

function protoRowsCarta(ano, disc) {
  const anoN = ano && ano !== "Todos" ? normAnoKey(ano) : "";
  return protoAlunos().filter((a) => {
    if (anoN && normAnoKey(a.ano) !== anoN) return false;
    return protoDiscOk(disc || "Todas", a.disciplina);
  });
}

function valorProtoDisc(r, disc) {
  const d = protoDiscNome(disc);
  if (d === "Português") return r.lp != null ? r.lp : r.media;
  if (d === "Matemática") return r.mat != null ? r.mat : r.media;
  return r.media;
}

function protoMapEscola(ano, disc) {
  const map = {};
  rankingEscolasProto(protoRowsCarta(ano, disc)).forEach((r) => {
    map[r.escola] = valorProtoDisc(r, disc);
  });
  return map;
}

function rankingProtoCarta(ano, disc, extraFn) {
  return rankingEscolasProto(protoRowsCarta(ano, disc)).map((r) => ({
    escola: r.escola,
    valor: valorProtoDisc(r, disc),
    extra: extraFn ? extraFn(r) : `${r.nTurmas} turma${r.nTurmas === 1 ? "" : "s"}`,
  }));
}

function mediaDasLinhasRank(rows) {
  const xs = (rows || [])
    .map((r) => r.valor)
    .filter((n) => n != null && !Number.isNaN(Number(n)))
    .map(Number);
  return xs.length ? avg(xs) : null;
}

function valorLinhaProtocolo(ano, disc, recorte, escola) {
  const d = protoDiscNome(disc);
  if (recorte === "municipio" || !escola || escola === "Todas") {
    return mediaDasLinhasRank(rankingProtoCarta(ano, d));
  }
  const rows = protoAlunos().filter((a) => {
    if (normAnoKey(a.ano) !== normAnoKey(ano)) return false;
    if (!mesmaEscolaLinha(a.escola, escola)) return false;
    return protoDiscOk(d, a.disciplina);
  });
  return protoMediaTurmas(rows);
}

function setupFiltersProto() {
  const rows = protoAlunos();
  if ($("filtroAnoProto")) fillSelect($("filtroAnoProto"), ordenarAnos(rows.map((r) => r.ano).filter(Boolean)), ["Todos"]);
  const discs = [];
  ["Português", "Matemática", "Escrita"].forEach((d) => {
    if (rows.some((r) => r.disciplina === d)) discs.push(d);
  });
  if ($("filtroDiscProto")) fillSelect($("filtroDiscProto"), discs, ["Todas"]);
  if ($("filtroEscolaProto")) fillSelect($("filtroEscolaProto"), unique(rows.map((r) => r.escola)), ["Todas"]);
  const turmas = unique(rows.map((r) => r.turma).filter(Boolean));
  if ($("filtroTurmaProto")) fillSelect($("filtroTurmaProto"), turmas, ["Todas"]);
}

function renderProtocolo() {
  if (!DATA_PROTO || !protoAlunos().length) {
    if ($("hintProto")) {
      $("hintProto").textContent = "Arquivo dados_protocolo.js não encontrado. Rode python dashboard/processar_protocolo.py.";
    }
    return;
  }
  const rows = protoFiltered();
  const ranking = rankingEscolasProto(rows);
  const av = rows.filter((r) => r.situacao === "Avaliado");
  const nAvaliados = protoEhAgregado(rows) ? protoSomaCampo(rows, "_avaliados") : av.length;
  const nFaltas = protoEhAgregado(rows) ? protoSomaCampo(rows, "_faltas") : rows.filter((r) => r.falta).length;
  const nSemLancamento = protoEhAgregado(rows) ? rows.filter((r) => r.situacao === "Não lançado").length : rows.filter((r) => r.situacao === "Não lançado").length;
  const escolas = unique(rows.map((r) => r.escola)).length;
  const nTurmas = unique(rows.map((r) => `${r.escola}|${r.turma}`)).length;
  const media = protoMediaTurmas(rows);
  const lp = protoMediaDisc(rows, "Português");
  const mat = protoMediaDisc(rows, "Matemática");
  const discFiltro = $("filtroDiscProto")?.value || "Todas";
  if ($("hintProto")) {
    $("hintProto").textContent = [
      DATA_PROTO.notaFonte || "",
      DATA_PROTO.geradoEm ? `Gerado em ${DATA_PROTO.geradoEm}.` : "",
      `${DATA_PROTO.arquivosLidos || 0} planilhas escolares.`,
    ].filter(Boolean).join(" ");
  }
  if ($("kpisProto")) {
    $("kpisProto").innerHTML = `
      <div class="kpi"><span>% de acerto</span><strong>${fmtMedia(media)}</strong><em>média das turmas (BH58 da planilha)</em></div>
      <div class="kpi"><span>Avaliados</span><strong>${nAvaliados.toLocaleString("pt-BR")}</strong><em>${nFaltas} faltas · ${nSemLancamento} sem lançamento</em></div>
      <div class="kpi"><span>Escolas no recorte</span><strong>${escolas}</strong><em>${nTurmas} turmas · da 1ª à última colocação</em></div>
      <div class="kpi"><span>Português / Matemática</span><strong>${fmtMedia(lp)} / ${fmtMedia(mat)}</strong><em>${discFiltro === "Todas" ? "LP e MAT no recorte" : discFiltro}</em></div>
    `;
  }
  if ($("hintProtoRank")) {
    $("hintProtoRank").textContent = `${ranking.length} escolas no recorte. Colocação pelo BH58 (média das turmas, LP e MAT separados). Nenhuma escola oculta.`;
  }

  makeChart("chartProtoRank", {
    type: "bar",
    data: {
      labels: ranking.map((r) => `${rotuloColocacao(r.colocacao)}  ${r.escola.replace(/^EEF |^EMTI /, "")}`),
      datasets: [{
        label: "% acerto",
        data: ranking.map((r) => r.media),
        backgroundColor: "#5eb8d6",
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } },
        y: { ticks: { autoSkip: false } },
      },
    },
  });
  makeChart("chartProtoDisc", {
    type: "bar",
    data: {
      labels: discFiltro === "Escrita" ? ["Escrita"] : ["Português", "Matemática"],
      datasets: [{
        label: "% acerto",
        data: discFiltro === "Escrita"
          ? [protoMediaDisc(rows, "Escrita")]
          : [lp, mat],
        backgroundColor: discFiltro === "Escrita" ? ["#a88cff"] : ["#2ec4b6", "#ffbf69"],
        borderRadius: 6,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } } },
    },
  });

  if ($("tbodyProtoEscolas")) {
    $("tbodyProtoEscolas").innerHTML = ranking.map((r) => `
      <tr>
        <td class="col-rank ${classeColocacao(r.colocacao)}">${r.media == null ? "—" : rotuloColocacao(r.colocacao)}</td>
        <td class="col-escola">${r.escola}</td>
        <td>${r.nTurmas}</td>
        <td>${r.avaliados.toLocaleString("pt-BR")}</td>
        <td>${r.faltas}</td>
        <td>${r.nee}</td>
        <td>${fmtMedia(r.lp)}</td>
        <td>${fmtMedia(r.mat)}</td>
        <td><b>${fmtMedia(r.media)}</b></td>
      </tr>
    `).join("");
  }

  const turmasMap = {};
  rows.forEach((a) => {
    const k = `${a.escola}|${a.ano}|${a.turma}|${a.disciplina}`;
    (turmasMap[k] = turmasMap[k] || []).push(a);
  });
  const turmas = Object.values(turmasMap).map((list) => {
    const a0 = list[0];
    const avT = list.filter((r) => r.situacao === "Avaliado");
    return {
      escola: a0.escola,
      ano: a0.ano,
      turma: a0.turma,
      disciplina: a0.disciplina,
      avaliados: a0._agg ? protoSomaCampo(list, "_avaliados") : avT.length,
      faltas: a0._agg ? protoSomaCampo(list, "_faltas") : list.filter((r) => r.falta).length,
      nee: a0._agg ? protoContaNee(list) : unique(list.filter((r) => r.nee).map((r) => r.aluno)).length,
      media: protoBH58(list),
    };
  }).sort((a, b) => (b.media ?? -1) - (a.media ?? -1) || a.escola.localeCompare(b.escola, "pt-BR"));
  if ($("tbodyProtoTurmas")) {
    $("tbodyProtoTurmas").innerHTML = turmas.map((t) => `
      <tr>
        <td class="col-escola">${t.escola}</td>
        <td>${t.ano}</td>
        <td>${t.turma}</td>
        <td>${t.disciplina}</td>
        <td>${t.avaliados}</td>
        <td>${t.faltas}</td>
        <td>${t.nee}</td>
        <td><b>${fmtMedia(t.media)}</b></td>
      </tr>
    `).join("");
  }

  const descAll = (DATA_PROTO.descritores || []).filter((d) => {
    const ano = $("filtroAnoProto")?.value || "Todos";
    const disc = $("filtroDiscProto")?.value || "Todas";
    const esc = $("filtroEscolaProto")?.value || "Todas";
    const turma = $("filtroTurmaProto")?.value || "Todas";
    if (ano !== "Todos" && d.ano !== ano) return false;
    if (esc !== "Todas" && d.escola !== esc) return false;
    if (turma !== "Todas" && d.turma !== turma) return false;
    return protoDiscOk(disc, d.disciplina);
  });
  const descAgg = {};
  descAll.forEach((d) => {
    const k = `${d.disciplina}|${d.codigo}`;
    const cur = descAgg[k] || { disciplina: d.disciplina, codigo: d.codigo, acertos: 0, total: 0 };
    cur.acertos += Number(d.acertos) || 0;
    cur.total += Number(d.total) || 0;
    descAgg[k] = cur;
  });
  const descRows = Object.values(descAgg).map((d) => ({
    ...d,
    percentual: d.total ? (100 * d.acertos / d.total) : null,
  })).sort((a, b) => (a.percentual ?? 999) - (b.percentual ?? 999) || a.codigo.localeCompare(b.codigo, "pt-BR"));
  if ($("hintProtoDesc")) {
    $("hintProtoDesc").textContent = descRows.length
      ? `${descRows.length} descritores no recorte (só questões em que a planilha preencheu a linha SPAECE/SAEB). Ordenado do mais crítico ao mais acertado.`
      : "Nenhuma planilha deste recorte preencheu descritores nas questões avaliadas.";
  }
  const descChart = descRows.slice(0, 16);
  makeChart("chartProtoDesc", {
    type: "bar",
    data: {
      labels: descChart.map((d) => `${d.codigo} · ${d.disciplina === "Matemática" ? "MAT" : d.disciplina === "Escrita" ? "ESC" : "LP"}`),
      datasets: [{
        label: "% acerto",
        data: descChart.map((d) => d.percentual),
        backgroundColor: descChart.map((d) => (d.percentual != null && d.percentual < 50 ? "#ef476f" : "#5eb8d6")),
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: { x: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } } },
    },
  });
  if ($("tbodyProtoDesc")) {
    $("tbodyProtoDesc").innerHTML = descRows.map((d) => `
      <tr>
        <td>${d.disciplina}</td>
        <td>${d.codigo}</td>
        <td>${d.total.toLocaleString("pt-BR")}</td>
        <td><b>${fmtMedia(d.percentual)}</b></td>
      </tr>
    `).join("");
  }
}

const SIT_LIMIAR = {
  emergencia: 40,
  necessaria: 50,
  ok: 65,
  gap: 25,
  abaixoEscola: 15,
  abaixoRede: 8,
  escolaTurmasEmergPct: 50,
  redeEscolasEmergPct: 40,
};
const SIT_ORDEM = { emergencia: 0, necessaria: 1, monitor: 2, ok: 3 };

function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function sitPior(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (SIT_ORDEM[a] ?? 9) <= (SIT_ORDEM[b] ?? 9) ? a : b;
}

function sitRotulo(sit) {
  return {
    emergencia: "Emergencial",
    necessaria: "Necessária",
    monitor: "Monitorar",
    ok: "Adequado",
  }[sit] || "—";
}

function sitBadge(sit) {
  const cls = {
    emergencia: "sitint-emerg",
    necessaria: "sitint-nec",
    monitor: "sitint-mon",
    ok: "sitint-ok",
  }[sit] || "";
  return `<span class="badge ${cls}">${sitRotulo(sit)}</span>`;
}

function sitDeltaTxt(n, ref) {
  if (n == null || ref == null) return "";
  return `${(ref - n).toFixed(1).replace(".", ",")} p.p.`;
}

function classificarNotaSit(n, discCurta, mediaEscola, mediaRede) {
  const motivos = [];
  if (n == null) return { sit: null, motivos };
  let sit = "ok";
  if (n < SIT_LIMIAR.ok) sit = "monitor";
  if (n < SIT_LIMIAR.necessaria) {
    sit = "necessaria";
    motivos.push(`${discCurta} ${fmtMedia(n)} abaixo de 50%`);
  }
  if (n < SIT_LIMIAR.emergencia) {
    sit = "emergencia";
    motivos.push(`${discCurta} ${fmtMedia(n)} abaixo de 40%`);
  }
  if (mediaEscola != null && n < SIT_LIMIAR.necessaria && (mediaEscola - n) >= SIT_LIMIAR.abaixoEscola) {
    sit = "emergencia";
    motivos.push(`${discCurta} ${sitDeltaTxt(n, mediaEscola)} abaixo da média da escola no mesmo ano`);
  }
  if (sit !== "emergencia" && mediaRede != null && n < SIT_LIMIAR.ok && (mediaRede - n) >= SIT_LIMIAR.abaixoRede) {
    sit = sitPior(sit, "necessaria");
    motivos.push(`${discCurta} ${sitDeltaTxt(n, mediaRede)} abaixo da média da rede no mesmo ano`);
  }
  if (!motivos.length && sit === "monitor") {
    motivos.push(`${discCurta} ${fmtMedia(n)} na faixa 50–65%`);
  }
  if (!motivos.length && sit === "ok") {
    motivos.push(`${discCurta} ${fmtMedia(n)} ≥ 65%`);
  }
  return { sit, motivos };
}

function sitTurmasPares(rows) {
  const map = {};
  (rows || []).forEach((r) => {
    if (!r.aluno) return;
    if (r.disciplina !== "Português" && r.disciplina !== "Matemática") return;
    const k = `${r.escola}|${r.ano}|${r.turma}`;
    const cur = map[k] || {
      escola: r.escola, ano: r.ano, turma: r.turma, lpRows: [], matRows: [],
    };
    if (r.disciplina === "Português") cur.lpRows.push(r);
    else cur.matRows.push(r);
    map[k] = cur;
  });
  return Object.values(map).map((t) => ({
    escola: t.escola,
    ano: t.ano,
    turma: t.turma,
    lp: protoBH58(t.lpRows),
    mat: protoBH58(t.matRows),
  }));
}

function sitMediaMap(turmas, campo) {
  const map = {};
  (turmas || []).forEach((t) => {
    const n = t[campo];
    if (n == null) return;
    const kAno = t.ano;
    const kEsc = `${t.escola}|${t.ano}`;
    (map[`rede|${kAno}`] = map[`rede|${kAno}`] || []).push(n);
    (map[`esc|${kEsc}`] = map[`esc|${kEsc}`] || []).push(n);
  });
  const out = {};
  Object.entries(map).forEach(([k, xs]) => { out[k] = xs.length ? avg(xs) : null; });
  protoMediaEscolaList().forEach((o) => {
    const disc = protoDiscNome(o.disciplina);
    if (campo === "lp" && disc !== "Português") return;
    if (campo === "mat" && disc !== "Matemática") return;
    if (o.media == null) return;
    out[`esc|${o.escola}|${o.ano}`] = Number(o.media);
  });
  return out;
}

function sitUsaDisc(discFiltro, lado) {
  if (!discFiltro || discFiltro === "Ambas") return true;
  return discFiltro === lado;
}

function classificarUnidadeSit(lp, mat, refs, discFiltro) {
  const motivos = [];
  let sit = null;
  if (sitUsaDisc(discFiltro, "Português") && lp != null) {
    const r = classificarNotaSit(lp, "LP", refs.escLP, refs.redeLP);
    sit = sitPior(sit, r.sit);
    motivos.push(...r.motivos);
  }
  if (sitUsaDisc(discFiltro, "Matemática") && mat != null) {
    const r = classificarNotaSit(mat, "MAT", refs.escMAT, refs.redeMAT);
    sit = sitPior(sit, r.sit);
    motivos.push(...r.motivos);
  }
  if (lp != null && mat != null) {
    const gap = Math.abs(lp - mat);
    const matFraco = mat < lp;
    const aplicaGap = discFiltro === "Ambas"
      || (discFiltro === "Matemática" && matFraco)
      || (discFiltro === "Português" && !matFraco);
    if (aplicaGap && gap > SIT_LIMIAR.gap) {
      sit = "emergencia";
      motivos.push(`Diferença LP–MAT de ${gap.toFixed(1).replace(".", ",")} p.p. (acima de 25)`);
    }
  }
  return { sit, motivos: unique(motivos) };
}

function sitProblematicaTurma(t, sitEsc, redeAno) {
  const bits = [];
  if (t.lp != null && t.mat != null) {
    if (t.mat < t.lp - 15) bits.push("Matemática bem abaixo de Português: priorizar reforço em MAT nesta turma.");
    else if (t.lp < t.mat - 15) bits.push("Português bem abaixo de Matemática: priorizar leitura e compreensão nesta turma.");
  }
  if (t.ano === "6º" && t.mat != null && t.mat < SIT_LIMIAR.necessaria) {
    bits.push("O 6º ano em Matemática está baixo em toda a rede; esta turma acompanha um padrão municipal, não um caso isolado.");
  }
  if (t.ano === "9º" && t.mat != null && t.mat < SIT_LIMIAR.necessaria) {
    bits.push("O 9º ano em Matemática também exige reforço contínuo, além do olhar desta sala.");
  }
  if (t.sit === "emergencia" && sitEsc !== "emergencia") {
    bits.push("Turma isolada em relação à escola no mesmo ano: olhar o trabalho da sala (professor da turma), com apoio da coordenação.");
  } else if (t.sit === "emergencia" && sitEsc === "emergencia") {
    bits.push("O resultado acompanha a escola no mesmo ano, não só esta turma: coordenação e direção precisam de plano conjunto.");
  }
  if (redeAno && redeAno.sit === "emergencia") {
    bits.push("A SME deve tratar este ano/disciplina como pauta de rede, não só de uma unidade.");
  }
  if ((t.lp === 0 || t.mat === 0) && t.sit === "emergencia") {
    bits.push("Percentual 0% entra na média (inclui não lançado): conferir o preenchimento antes de interpretar só como aprendizagem.");
  }
  if (!bits.length && t.sit === "necessaria") {
    bits.push("Acompanhamento de reforço com o professor da turma e a coordenação pedagógica da escola.");
  }
  if (!bits.length && t.sit === "monitor") {
    bits.push("Manter monitoramento; não é intervenção imediata neste recorte.");
  }
  return bits.join(" ");
}

function sitProblematicaEscola(e, redeAno) {
  const bits = [];
  if (e.lp != null && e.mat != null) {
    if (e.mat < e.lp - 15) bits.push("Na escola, Matemática ficou bem abaixo de Português neste ano.");
    else if (e.lp < e.mat - 15) bits.push("Na escola, Português ficou bem abaixo de Matemática neste ano.");
  }
  if (e.ano === "6º" && e.mat != null && e.mat < SIT_LIMIAR.necessaria) {
    bits.push("6º ano em Matemática é ponto crítico da rede: a unidade precisa de plano de MAT alinhado à SME.");
  }
  if (e.pctEmerg != null && e.pctEmerg >= SIT_LIMIAR.escolaTurmasEmergPct) {
    bits.push("A maior parte das turmas desta escola/ano está em emergência: não se resolve só sala a sala.");
  }
  if (e.nTurmas === 1 && e.sit === "emergencia") {
    bits.push("Há uma única turma neste recorte: a ação imediata é do professor da sala, com suporte da coordenação.");
  }
  if (redeAno && redeAno.sit === "emergencia") {
    bits.push("Várias escolas falham no mesmo ano: cabe ação da Rede / SME, além da direção da unidade.");
  }
  if (!bits.length && e.sit === "necessaria") {
    bits.push("Coordenação pedagógica organiza reforço e acompanhamento dos professores das turmas.");
  }
  return bits.join(" ");
}

function sitQuemTurma(t, sitEsc, redeAno) {
  const papéis = [];
  papéis.push(`Professor da ${t.turma} (sala)`);
  papéis.push("Coordenação pedagógica da escola");
  if (sitEsc === "emergencia") papéis.push("Direção da escola");
  if (redeAno && redeAno.sit === "emergencia") papéis.push("Rede / SME");
  return papéis.join(" · ");
}

function sitQuemEscola(e, redeAno) {
  const papéis = ["Coordenação pedagógica da escola", "Direção da escola"];
  if (e.nTurmas === 1) papéis.unshift(`Professor da turma ${e.turmaUnica || ""}`.trim());
  if (redeAno && redeAno.sit === "emergencia") papéis.push("Rede / SME");
  return papéis.filter(Boolean).join(" · ");
}

function montarAnaliseSit() {
  const anoF = $("filtroAnoSit")?.value || "Todos";
  const discF = $("filtroDiscSit")?.value || "Ambas";
  const escF = $("filtroEscolaSit")?.value || "Todas";
  const rows = protoAlunos().filter((a) => {
    if (!a.aluno) return false;
    if (a.disciplina !== "Português" && a.disciplina !== "Matemática") return false;
    if (anoF !== "Todos" && a.ano !== anoF) return false;
    if (escF !== "Todas" && a.escola !== escF) return false;
    return true;
  });
  let turmas = sitTurmasPares(rows);
  if (discF === "Português") turmas = turmas.filter((t) => t.lp != null);
  if (discF === "Matemática") turmas = turmas.filter((t) => t.mat != null);
  const mapLP = sitMediaMap(turmas, "lp");
  const mapMAT = sitMediaMap(turmas, "mat");
  const refsDe = (escola, ano) => ({
    escLP: mapLP[`esc|${escola}|${ano}`] ?? null,
    escMAT: mapMAT[`esc|${escola}|${ano}`] ?? null,
    redeLP: mapLP[`rede|${ano}`] ?? null,
    redeMAT: mapMAT[`rede|${ano}`] ?? null,
  });

  const escolasMap = {};
  turmas.forEach((t) => {
    const k = `${t.escola}|${t.ano}`;
    (escolasMap[k] = escolasMap[k] || []).push(t);
  });
  const escolasBase = Object.entries(escolasMap).map(([k, list]) => {
    const [escola, ano] = k.split("|");
    const lps = list.map((x) => x.lp).filter((n) => n != null);
    const mats = list.map((x) => x.mat).filter((n) => n != null);
    return {
      escola,
      ano,
      nTurmas: unique(list.map((x) => x.turma)).length,
      turmaUnica: unique(list.map((x) => x.turma)).length === 1 ? list[0].turma : "",
      lp: protoLookupMediaEscola(escola, ano, "Português") ?? (lps.length ? avg(lps) : null),
      mat: protoLookupMediaEscola(escola, ano, "Matemática") ?? (mats.length ? avg(mats) : null),
      list,
    };
  });

  const escolasPre = escolasBase.map((e) => {
    const refs = refsDe(e.escola, e.ano);
    const cls = classificarUnidadeSit(e.lp, e.mat, refs, discF);
    return { ...e, sitNota: cls.sit, motivosNota: cls.motivos };
  });

  const redePorAno = {};
  unique(turmas.map((t) => t.ano)).forEach((ano) => {
    const doAno = escolasPre.filter((e) => e.ano === ano);
    const n = doAno.length;
    const nEm = doAno.filter((e) => e.sitNota === "emergencia").length;
    const pct = n ? (100 * nEm / n) : 0;
    const lp = mapLP[`rede|${ano}`] ?? null;
    const mat = mapMAT[`rede|${ano}`] ?? null;
    const baixoRede = (sitUsaDisc(discF, "Português") && lp != null && lp < SIT_LIMIAR.emergencia)
      || (sitUsaDisc(discF, "Matemática") && mat != null && mat < SIT_LIMIAR.emergencia);
    const sit = (baixoRede || pct >= SIT_LIMIAR.redeEscolasEmergPct) ? "emergencia" : null;
    redePorAno[ano] = { ano, nEscolas: n, nEmerg: nEm, pct, lp, mat, sit };
  });

  const escolas = escolasPre.map((e) => {
    const redeAno = redePorAno[e.ano];
    let sit = e.sitNota;
    const motivos = e.motivosNota.slice();
    const nEmTurma = e.list.filter((t) => {
      const cls = classificarUnidadeSit(t.lp, t.mat, refsDe(t.escola, t.ano), discF);
      return cls.sit === "emergencia";
    }).length;
    const pctEmerg = e.nTurmas ? (100 * nEmTurma / e.nTurmas) : 0;
    if (pctEmerg >= SIT_LIMIAR.escolaTurmasEmergPct && nEmTurma >= 2) {
      sit = "emergencia";
      motivos.push(`${nEmTurma} de ${e.nTurmas} turmas em emergência (≥ 50% da escola neste ano)`);
    }
    return {
      ...e,
      sit,
      motivos,
      pctEmerg,
      problema: sitProblematicaEscola({ ...e, sit, pctEmerg }, redeAno),
      quem: sitQuemEscola(e, redeAno),
    };
  });
  const sitEscMap = {};
  escolas.forEach((e) => { sitEscMap[`${e.escola}|${e.ano}`] = e.sit; });

  const turmasCls = turmas.map((t) => {
    const refs = refsDe(t.escola, t.ano);
    const cls = classificarUnidadeSit(t.lp, t.mat, refs, discF);
    const sitEsc = sitEscMap[`${t.escola}|${t.ano}`];
    const redeAno = redePorAno[t.ano];
    return {
      ...t,
      sit: cls.sit,
      motivos: cls.motivos,
      sitEsc,
      problema: sitProblematicaTurma({ ...t, sit: cls.sit }, sitEsc, redeAno),
      quem: sitQuemTurma(t, sitEsc, redeAno),
    };
  });

  const ord = (a, b) => {
    const sa = SIT_ORDEM[a.sit] ?? 9;
    const sb = SIT_ORDEM[b.sit] ?? 9;
    if (sa !== sb) return sa - sb;
    const minA = Math.min(a.lp ?? 999, a.mat ?? 999);
    const minB = Math.min(b.lp ?? 999, b.mat ?? 999);
    if (minA !== minB) return minA - minB;
    return String(a.escola).localeCompare(String(b.escola), "pt-BR")
      || String(a.ano).localeCompare(String(b.ano), "pt-BR")
      || String(a.turma || "").localeCompare(String(b.turma || ""), "pt-BR");
  };
  turmasCls.sort(ord);
  escolas.sort(ord);

  const piorPorEscola = {};
  escolas.forEach((e) => {
    piorPorEscola[e.escola] = sitPior(piorPorEscola[e.escola], e.sit);
  });
  const nEscEm = Object.values(piorPorEscola).filter((s) => s === "emergencia").length;
  const nEscNec = Object.values(piorPorEscola).filter((s) => s === "necessaria").length;

  return {
    anoF, discF, escF, turmas: turmasCls, escolas, redePorAno,
    nTurmasEm: turmasCls.filter((t) => t.sit === "emergencia").length,
    nTurmasNec: turmasCls.filter((t) => t.sit === "necessaria").length,
    nEscEm,
    nEscNec,
    nTurmas: turmasCls.length,
    nEscolas: Object.keys(piorPorEscola).length,
  };
}

function sitLinhaTurma(t) {
  return `<tr>
    <td class="col-escola">${escHtml(t.escola)}</td>
    <td>${escHtml(t.ano)}</td>
    <td>${escHtml(t.turma)}</td>
    <td>${fmtMedia(t.lp)}</td>
    <td>${fmtMedia(t.mat)}</td>
    <td class="sit-why">${escHtml((t.motivos || []).join("; ") || "—")}</td>
    <td class="sit-prob">${escHtml(t.problema || "—")}</td>
    <td>${escHtml(t.quem || "—")}</td>
  </tr>`;
}

function sitLinhaEscola(e) {
  return `<tr>
    <td class="col-escola">${escHtml(e.escola)}</td>
    <td>${escHtml(e.ano)}</td>
    <td>${e.nTurmas}</td>
    <td>${fmtMedia(e.lp)}</td>
    <td>${fmtMedia(e.mat)}</td>
    <td class="sit-why">${escHtml((e.motivos || []).join("; ") || "—")}</td>
    <td class="sit-prob">${escHtml(e.problema || "—")}</td>
    <td>${escHtml(e.quem || "—")}</td>
  </tr>`;
}

function sitVazio(colspan) {
  return `<tr><td colspan="${colspan}">Nenhum registro neste recorte.</td></tr>`;
}

function renderNiveisSit(pack) {
  const box = $("niveisSit");
  if (!box) return;
  const isoladas = pack.turmas.filter((t) => t.sit === "emergencia" && t.sitEsc !== "emergencia");
  const escolasEm = pack.escolas.filter((e) => e.sit === "emergencia");
  const escolasNec = pack.escolas.filter((e) => e.sit === "necessaria");
  const redeAnos = Object.values(pack.redePorAno).filter((r) => r.sit === "emergencia");
  const redeTxt = redeAnos.length
    ? `${redeAnos.map((r) => {
      const disc = pack.discF === "Português" ? `LP ${fmtMedia(r.lp)}` : pack.discF === "Matemática" ? `MAT ${fmtMedia(r.mat)}` : `LP ${fmtMedia(r.lp)} / MAT ${fmtMedia(r.mat)}`;
      return `${r.ano} (${disc}; ${r.nEmerg} de ${r.nEscolas} escolas em emergência)`;
    }).join("; ")}.`
    : "Nenhum ano com falha generalizada neste recorte.";
  box.innerHTML = `
    <div class="sit-nivel">
      <h3>Turma / professor da sala</h3>
      <p><strong>${isoladas.length}</strong> ${isoladas.length === 1 ? "turma emergencial isolada" : "turmas emergenciais isoladas"} da média da escola. Ação imediata na sala, com apoio da coordenação. Sem nome de docente nas planilhas.</p>
    </div>
    <div class="sit-nivel">
      <h3>Coordenação pedagógica</h3>
      <p>Organiza reforço e acompanhamento dos professores nas <strong>${escolasNec.length + escolasEm.length}</strong> escola-ano em intervenção necessária ou emergencial. Plano por ano/disciplina, não só por aluno isolado.</p>
    </div>
    <div class="sit-nivel">
      <h3>Direção</h3>
      <p><strong>${unique(escolasEm.map((e) => e.escola)).length}</strong> escola${unique(escolasEm.map((e) => e.escola)).length === 1 ? "" : "s"} com ao menos um ano emergencial. A direção garante tempo, agrupamento e rotina de intervenção na unidade.</p>
    </div>
    <div class="sit-nivel">
      <h3>Rede / SME</h3>
      <p>${escHtml(redeTxt)} A SME entra quando o mesmo ano falha em muitas escolas (média da rede &lt; 40% ou ≥ 40% das escolas em emergência).</p>
    </div>`;
}

function setupFiltersSit() {
  const rows = protoAlunos().filter((a) => a.disciplina === "Português" || a.disciplina === "Matemática");
  if ($("filtroAnoSit")) fillSelect($("filtroAnoSit"), anosProtoCartas(), ["Todos"]);
  if ($("filtroEscolaSit")) fillSelect($("filtroEscolaSit"), unique(rows.map((r) => r.escola)), ["Todas"]);
}

function renderSituacao() {
  if (!$("page-situacao")) return;
  if (!DATA_PROTO || !protoAlunos().length) {
    if ($("sitPrintMeta")) {
      $("sitPrintMeta").textContent = "Arquivo dados_protocolo.js não encontrado. Rode python dashboard/processar_protocolo.py.";
    }
    return;
  }
  const pack = montarAnaliseSit();
  const discTxt = pack.discF === "Ambas" ? "Português e Matemática" : pack.discF;
  const anoTxt = pack.anoF === "Todos" ? "todos os anos do Protocolo" : `${pack.anoF} ano`;
  const escTxt = pack.escF === "Todas" ? "todas as escolas" : pack.escF;
  if ($("sitPrintMeta")) {
    $("sitPrintMeta").textContent = [
      `${anoTxt} · ${discTxt} · ${escTxt}.`,
      "Fonte: Protocolo de Acompanhamento — percentual de acerto de Português e Matemática.",
      DATA_PROTO.geradoEm ? `Gerado em ${DATA_PROTO.geradoEm}.` : "",
    ].filter(Boolean).join(" ");
  }
  if ($("legendSitInt")) {
    $("legendSitInt").innerHTML = `
      <span class="sit-chip"><span class="badge sitint-emerg">Emergencial</span> percentual de acerto &lt; 40%, ou diferença LP–MAT &gt; 25 p.p., ou turma ≥ 15 p.p. abaixo da média da escola e ainda &lt; 50%.</span>
      <span class="sit-chip"><span class="badge sitint-nec">Necessária</span> percentual de acerto &lt; 50%, ou ≥ 8 p.p. abaixo da média da rede no mesmo ano (e ainda &lt; 65%).</span>
      <span class="sit-chip"><span class="badge sitint-mon">Monitorar</span> 50–65%, sem os critérios acima.</span>
      <span class="sit-chip"><span class="badge sitint-ok">Adequado</span> ≥ 65%.</span>`;
  }
  if ($("kpisSit")) {
    $("kpisSit").innerHTML = `
      <div class="kpi"><span>Turmas em emergência</span><strong>${pack.nTurmasEm}</strong><em>de ${pack.nTurmas} turmas no recorte</em></div>
      <div class="kpi"><span>Turmas em intervenção necessária</span><strong>${pack.nTurmasNec}</strong><em>reforço e acompanhamento</em></div>
      <div class="kpi"><span>Escolas em emergência</span><strong>${pack.nEscEm}</strong><em>de ${pack.nEscolas} escolas (pior ano no recorte)</em></div>
      <div class="kpi"><span>Escolas em intervenção necessária</span><strong>${pack.nEscNec}</strong><em>sem emergência no recorte</em></div>`;
  }
  renderNiveisSit(pack);
  const emT = pack.turmas.filter((t) => t.sit === "emergencia");
  const necT = pack.turmas.filter((t) => t.sit === "necessaria");
  const emE = pack.escolas.filter((e) => e.sit === "emergencia");
  const necE = pack.escolas.filter((e) => e.sit === "necessaria");
  if ($("hintSitEmerg")) {
    $("hintSitEmerg").textContent = `${emT.length} turma${emT.length === 1 ? "" : "s"} e ${emE.length} escola-ano. Ordem: do menor percentual de acerto para o maior.`;
  }
  if ($("hintSitNec")) {
    $("hintSitNec").textContent = `${necT.length} turma${necT.length === 1 ? "" : "s"} e ${necE.length} escola-ano. Apoio ao professor da sala e à coordenação.`;
  }
  if ($("tbodySitEmergTurmas")) $("tbodySitEmergTurmas").innerHTML = emT.length ? emT.map(sitLinhaTurma).join("") : sitVazio(8);
  if ($("tbodySitNecTurmas")) $("tbodySitNecTurmas").innerHTML = necT.length ? necT.map(sitLinhaTurma).join("") : sitVazio(8);
  if ($("tbodySitEmergEscolas")) $("tbodySitEmergEscolas").innerHTML = emE.length ? emE.map(sitLinhaEscola).join("") : sitVazio(8);
  if ($("tbodySitNecEscolas")) $("tbodySitNecEscolas").innerHTML = necE.length ? necE.map(sitLinhaEscola).join("") : sitVazio(8);
}

function imprimirSit() {
  document.body.classList.add("print-sit");
  document.body.classList.remove("print-cartas", "print-wide", "print-rank", "print-rankgeral", "print-linhas", "print-consulta");
  let st = document.getElementById("print-page-style");
  if (!st) {
    st = document.createElement("style");
    st.id = "print-page-style";
    document.head.appendChild(st);
  }
  st.textContent = `@media print { @page { size: A4 landscape; margin: 10mm; } ${PRINT_COLOR_CSS} }`;
  rasterizarGraficosImpressao();
  const after = () => {
    document.body.classList.remove("print-sit");
    limparGraficosImpressao();
    window.removeEventListener("afterprint", after);
  };
  window.addEventListener("afterprint", after);
  window.print();
}

function tabelaRankingCarta(rows, fmt, extraHead) {
  return `<p class="hint" style="margin:0">${rows.length} escolas, da maior para a menor.</p>
    <div class="table-wrap carta-tabela"><table>
    <thead><tr><th>#</th><th>Escola</th><th>Resultado</th>${extraHead ? `<th>${extraHead}</th>` : ""}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr>
      <td class="col-rank ${classeColocacao(i + 1)}">${rotuloColocacao(i + 1)}</td>
      <td class="col-escola">${r.escola}</td>
      <td><b>${fmt(r.valor)}</b></td>
      ${extraHead ? `<td>${r.extra ?? "—"}</td>` : ""}
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function rankingPorEscola(list, valorFn, extraFn) {
  const by = {};
  (list || []).forEach((item) => {
    const k = item.escola;
    if (!k) return;
    (by[k] = by[k] || []).push(item);
  });
  return Object.keys(by).map((escola) => {
    const valor = valorFn(by[escola]);
    return { escola, valor, extra: extraFn ? extraFn(by[escola]) : "" };
  }).filter((r) => r.valor != null && !Number.isNaN(r.valor)).sort((a, b) => b.valor - a.valor);
}

function rankingDiagCampo(campo, extraCampo) {
  return ((DATA_DIAG && DATA_DIAG.escolas) || [])
    .filter((e) => e[campo] != null)
    .map((e) => ({
      escola: e.escola,
      valor: e[campo],
      extra: e[extraCampo] != null ? fmtNota10(e[extraCampo]) : "—",
    }))
    .sort((a, b) => b.valor - a.valor);
}

function rankingIdebEtapa(etapa) {
  return escolasIdebBase().map((e) => {
    const v25 = idebNota(e, etapa, 2025);
    const v23 = idebNota(e, etapa, 2023);
    return {
      escola: e.escola,
      valor: v25,
      extra: v23 == null ? "—" : fmtNota10(v23),
      v25,
    };
  }).filter((r) => r.v25 != null || r.extra !== "—")
    .sort((a, b) => (b.v25 ?? -1) - (a.v25 ?? -1));
}

function mediaChavePar(rows, key) {
  const xs = (rows || []).map((r) => r[key]).filter((n) => n != null && !Number.isNaN(n));
  return xs.length ? avg(xs) : null;
}

function rotuloCresc(n) {
  if (n == null || Number.isNaN(n)) return "";
  if (Math.abs(n) < 0.05) return "estável";
  return n > 0 ? "crescimento" : "decrescimento";
}

function fmtDltSeq(n, kind) {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) < 0.05) return kind === "prof" ? "0" : (kind === "10" ? "0,0" : "0,0 p.p.");
  if (kind === "10") return fmtDelta10(n);
  if (kind === "prof") {
    const sign = n > 0.5 ? "+" : "";
    return `${sign}${Math.round(n).toLocaleString("pt-BR")}`;
  }
  return fmtDelta(n);
}

function htmlDeltaSeq(n, kind) {
  if (n == null || Number.isNaN(n)) return "";
  const lab = rotuloCresc(n);
  return `<small class="seq-delta ${deltaClass(n)}">${fmtDltSeq(n, kind)} ${lab}</small>`;
}

function dltPar(a, b) {
  if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return null;
  return b - a;
}

function tracksSeqPar() {
  const avalieMesma = usaProficiencia2();
  const tracks = [
    {
      titulo: "0 a 10",
      kind: "10",
      steps: [
        { key: "diag", label: "Diagnóstica" },
        { key: "saep1", label: "1º SAEP" },
      ],
    },
    {
      titulo: avalieMesma ? "Proficiência Avalie.CE" : "1º Avalie.CE",
      kind: "pct",
      steps: avalieMesma
        ? [
          { key: "avalie1", label: "1º Avalie" },
          { key: "avalie2", label: "2º Avalie" },
        ]
        : [{ key: "avalie1", label: "1º Avalie" }],
    },
  ];
  if (avalieMesma) {
    tracks.push({
      titulo: "% de acerto",
      kind: "pct",
      steps: [{ key: "proto", label: "Protocolo" }],
    });
  } else {
    tracks.push({
      titulo: "% de acerto",
      kind: "pct",
      steps: [
        { key: "avalie2", label: "2º Avalie" },
        { key: "proto", label: "Protocolo" },
      ],
    });
  }
  tracks.push({
    titulo: "IDEB",
    kind: "10",
    noDelta: true,
    steps: [
      { key: "ideb23", label: "IDEB 2023" },
      { key: "ideb", label: "IDEB 2025" },
    ],
  });
  return tracks;
}

function htmlSeqTrack(vals, spec) {
  const steps = spec.steps.filter((s) => vals[s.key] != null && !Number.isNaN(vals[s.key]));
  if (!steps.length) return "";
  const fmt = spec.kind === "10" ? fmtMedia10 : (spec.kind === "prof" ? fmtProf : fmtMedia);
  const parts = [];
  steps.forEach((s, i) => {
    if (i > 0 && !spec.noDelta) {
      const prev = steps[i - 1];
      if (prev.key !== "ideb" && prev.key !== "ideb23" && s.key !== "ideb" && s.key !== "ideb23") {
        const dlt = vals[s.key] - vals[prev.key];
        parts.push(`<span class="carta-seq-dlt ${deltaClass(dlt)}">${fmtDltSeq(dlt, spec.kind)} <em>${rotuloCresc(dlt)}</em></span>`);
      }
    }
    parts.push(`<span class="carta-seq-step"><em>${s.label}</em><strong>${fmt(vals[s.key])}</strong></span>`);
  });
  return `<div class="carta-seq-track"><span class="carta-seq-esc">${spec.titulo}</span>${parts.join("")}</div>`;
}

function htmlSeqResultados(vals) {
  const tracks = tracksSeqPar().map((spec) => htmlSeqTrack(vals, spec)).filter(Boolean);
  if (!tracks.length) return "";
  return `<div class="carta-seq">
    <h4>Sequência de resultados</h4>
    <p class="hint" style="margin:0">Crescimento e decrescimento só entre avaliações da <b>mesma escala</b> (Diagnóstica → 1º SAEP; Avalie; % de acerto). O IDEB aparece como nota, sem variação. Protocolo não entra no delta do Avalie quando a escala é outra.</p>
    ${tracks.join("")}
  </div>`;
}

function deltasCelPar(r) {
  return {
    saep: dltPar(r.diag, r.saep1),
    avalie2: usaProficiencia2() ? dltPar(r.avalie1, r.avalie2) : null,
    proto: usaProficiencia2() ? null : dltPar(r.avalie2, r.proto),
  };
}

function celSeq(valorHtml, extras) {
  const bits = (extras || []).filter(Boolean).join("");
  return `<td class="cel-seq">${valorHtml}${bits}</td>`;
}

function tabelaEmparelhada(rows) {
  return `<p class="hint" style="margin:0">${rows.length} escolas, em ordem alfabética. Em cada coluna seguinte da mesma escala aparece o <b>crescimento</b> ou <b>decrescimento</b> (o IDEB entra só como nota).</p>
    <div class="table-wrap carta-tabela"><table class="carta-emparelhada">
    <thead><tr>
      <th>#</th><th>Escola</th>
      <th class="th-diag">Diagnóstica</th><th class="th-saep">1º SAEP</th>
      <th class="th-avalie1">1º Avalie</th><th class="th-avalie2">2º Avalie</th>
      <th class="th-proto">Protocolo</th>
      <th class="th-ideb">IDEB 2025</th><th class="th-spaece">SPAECE</th>
    </tr></thead>
    <tbody>${rows.map((r, i) => {
      const d = deltasCelPar(r);
      return `<tr>
      <td>${i + 1}</td>
      <td class="col-escola">${r.escola}</td>
      ${celSeq(fmtNota10(r.diag))}
      ${celSeq(fmtNota10(r.saep1), [htmlDeltaSeq(d.saep, "10")])}
      ${celSeq(r.avalie1 == null ? "—" : fmtMedia(r.avalie1))}
      ${celSeq(`<b>${r.avalie2 == null ? "—" : fmtMedia(r.avalie2)}</b>`, [htmlDeltaSeq(d.avalie2, "pct")])}
      ${celSeq(r.proto == null ? "—" : fmtMedia(r.proto), [htmlDeltaSeq(d.proto, "pct")])}
      ${celSeq(fmtIdebCel(r.ideb, r.ideb23))}
      ${celSeq(r.spaece == null ? "—" : fmtProf(r.spaece))}
    </tr>`;
    }).join("")}</tbody>
  </table></div>`;
}

function kpisEmparelhada(rows, t1, ano, disc) {
  const avgOf = (key, fmt) => {
    const n = mediaChavePar(rows, key);
    return n == null ? "—" : fmt(n);
  };
  const vals = {
    diag: mediaChavePar(rows, "diag"),
    saep1: mediaChavePar(rows, "saep1"),
    avalie1: mediaLista1(t1),
    avalie2: mediaChavePar(rows, "avalie2"),
    proto: mediaChavePar(rows, "proto"),
    ideb: mediaChavePar(rows, "ideb"),
    ideb23: mediaChavePar(rows, "ideb23"),
  };
  return `<div class="carta-kpis-row">
    <span class="kpi-chip kpi-diag"><em>Diagnóstica</em><strong>${avgOf("diag", fmtMedia10)}</strong></span>
    <span class="kpi-chip kpi-saep"><em>1º SAEP</em><strong>${avgOf("saep1", fmtMedia10)}</strong></span>
    <span class="kpi-chip kpi-avalie1"><em>1º Avalie</em><strong>${vals.avalie1 == null ? "—" : fmtMedia(vals.avalie1)}</strong></span>
    <span class="kpi-chip kpi-avalie2"><em>2º Avalie</em><strong>${avgOf("avalie2", fmtMedia)}</strong></span>
    <span class="kpi-chip kpi-proto"><em>Protocolo</em><strong>${avgOf("proto", fmtMedia)}</strong></span>
    <span class="kpi-chip kpi-ideb"><em>IDEB 2025</em><strong>${avgOf("ideb", fmtMedia10)}</strong></span>
    <span class="kpi-chip kpi-spaece"><em>SPAECE</em><strong>${avgOf("spaece", fmtProf)}</strong></span>
  </div>
  ${htmlSeqResultados(vals)}
  <p class="hint" style="margin:0">Recorte: ${ano} · ${disc}</p>`;
}

function specEmparelhada(ano, disc) {
  const opts = { ano, disc, esc: "Todas" };
  const mapProto = protoMapEscola(ano, disc);
  const rows = linhasPar(opts).map((r) => {
    let proto = mapProto[r.escola];
    if (proto == null) {
      const k = Object.keys(mapProto).find((esc) => mesmaEscolaLinha(esc, r.escola));
      proto = k ? mapProto[k] : null;
    }
    return { ...r, proto: proto ?? null };
  });
  const t1 = turmas1Par(opts);
  const geral = ano === "Todos" && disc === "Todas";
  const etapaIdeb = ["8º", "9º"].includes(ano)
    ? "anos finais"
    : (["2º", "4º", "5º"].includes(ano) ? "anos iniciais" : (ano === "Todos" ? "média das etapas" : "sem IDEB neste ano"));
  const anosP = anosProtoCartas();
  const protoTxt = anosP.length
    ? (geral
      ? `Protocolo: % de acerto (LP e MAT) nos anos ${anosP.join(", ")}.`
      : (anosP.includes(ano)
        ? "Protocolo: % de acerto neste ano e disciplina (LP/MAT)."
        : "Protocolo: sem recorte neste ano (—)."))
    : "Protocolo: sem dados.";
  return {
    id: `par-${ano}-${disc}`,
    tipo: "par",
    ano,
    disc,
    wide: true,
    tag: "Emparelhadas",
    titulo: geral ? "Resultados emparelhados — rede" : `Emparelhadas — ${ano} ${disc}`,
    kpi: String(rows.length),
    kpiSub: "escolas",
    kpisHtml: kpisEmparelhada(rows, t1, ano, disc),
    nota: [
      geral
        ? "Diagnóstica e 1º SAEP: média geral da escola (0 a 10), sem ano/disciplina."
        : "Diagnóstica e 1º SAEP: média das turmas (0 a 10) neste ano e disciplina.",
      geral
        ? "1º Avalie, 2º Avalie e SPAECE misturam anos e disciplinas neste recorte. 2º LP do SPAECE usa escala 1000."
        : `1º Avalie (só 2º, 5º e 9º), 2º Avalie e SPAECE neste ano e disciplina. IDEB = ${etapaIdeb}. Sem dados = —.`,
      protoTxt,
      "Sequência: crescimento/decrescimento só na mesma escala (Diagnóstica → 1º SAEP; 1º Avalie → 2º Avalie quando ambos são proficiência; 2º Avalie → Protocolo quando ambos são % de acerto). IDEB não entra no crescimento/decrescimento.",
    ].join(" "),
    tabela: tabelaEmparelhada(rows),
  };
}

function specsCartas() {
  const out = [];
  out.push(specEmparelhada("Todos", "Todas"));
  ANOS_CARTAS.forEach((ano) => {
    ["Português", "Matemática"].forEach((disc) => out.push(specEmparelhada(ano, disc)));
  });
  const rd = rankingDiagCampo("diag", "saep1");
  out.push({
    id: "diag",
    tipo: "diag",
    tag: "0 a 10",
    titulo: "Avaliação diagnóstica — média geral",
    kpi: rd.length ? fmtMedia10(avg(rd.map((r) => r.valor))) : "—",
    kpiSub: `média simples · ${rd.length} escolas`,
    nota: (DATA_DIAG && DATA_DIAG.notaFonte) || "Sem dados da diagnóstica.",
    tabela: tabelaRankingCarta(rd, fmtNota10, "1º SAEP"),
  });
  ANOS_CARTAS.forEach((ano) => {
    ["Português", "Matemática"].forEach((disc) => {
      const rows = rankingTurmasNotas10(DATA_DIAG_TURMAS, ano, disc);
      const xs = rows.map((r) => r.valor);
      out.push({
        id: `diag-${ano}-${disc}`,
        tipo: "diag",
        ano,
        disc,
        tag: "0 a 10 · turmas",
        titulo: `Diagnóstica — ${ano} ${disc}`,
        kpi: xs.length ? fmtMedia10(avg(xs)) : "—",
        kpiSub: `média das escolas · ${rows.length} escolas`,
        nota: (DATA_DIAG_TURMAS && DATA_DIAG_TURMAS.notaFonte) || "Sem dados da diagnóstica por turma.",
        tabela: tabelaRankingCarta(rows, fmtNota10, "Turmas"),
      });
    });
  });
  const rs = rankingDiagCampo("saep1", "diag");
  out.push({
    id: "saep",
    tipo: "saep",
    tag: "0 a 10 · geral",
    titulo: "1º SAEP — média geral",
    kpi: rs.length ? fmtMedia10(avg(rs.map((r) => r.valor))) : "—",
    kpiSub: `média simples · ${rs.length} escolas · sem disciplina`,
    nota: "Média geral da escola (0 a 10), sem divisão por disciplina ou ano.",
    tabela: tabelaRankingCarta(rs, fmtNota10, "Diagnóstica"),
  });
  ANOS_CARTAS.forEach((ano) => {
    ["Português", "Matemática"].forEach((disc) => {
      const rows = rankingTurmasNotas10(DATA_SAEP1, ano, disc);
      const xs = rows.map((r) => r.valor);
      out.push({
        id: `saep-${ano}-${disc}`,
        tipo: "saep",
        ano,
        disc,
        tag: "0 a 10 · turmas",
        titulo: `1º SAEP — ${ano} ${disc}`,
        kpi: xs.length ? fmtMedia10(avg(xs)) : "—",
        kpiSub: `média das escolas · ${rows.length} escolas`,
        nota: (DATA_SAEP1 && DATA_SAEP1.notaFonte) || "Sem dados do 1º SAEP por turma.",
        tabela: tabelaRankingCarta(rows, fmtNota10, "Turmas"),
      });
    });
  });
  if (DATA_PROTO && protoAlunos().length) {
    const anosP = anosProtoCartas();
    const unicoAno = anosP.length === 1 ? anosP[0] : undefined;
    const rg = rankingProtoCarta("Todos", "Todas", (r) => `${fmtMedia(r.lp)} / ${fmtMedia(r.mat)}`);
    const xsG = rg.map((r) => r.valor).filter((n) => n != null);
    out.push({
      id: "proto",
      tipo: "protocolo",
      ano: unicoAno,
      tag: "Protocolo · % de acerto",
      titulo: "Protocolo de Acompanhamento — média geral",
      kpi: xsG.length ? fmtMedia(avg(xsG)) : "—",
      kpiSub: `média das escolas · ${rg.length} escolas · LP e MAT`,
      nota: (DATA_PROTO && DATA_PROTO.notaFonte) || "Sem dados do Protocolo de Acompanhamento.",
      tabela: tabelaRankingCarta(rg, (v) => (v == null ? "—" : fmtMedia(v)), "LP / MAT"),
    });
    anosP.forEach((ano) => {
      ["Português", "Matemática"].forEach((disc) => {
        const rows = rankingProtoCarta(ano, disc);
        const xs = rows.map((r) => r.valor).filter((n) => n != null);
        out.push({
          id: `proto-${ano}-${disc}`,
          tipo: "protocolo",
          ano,
          disc,
          tag: "Protocolo · % de acerto",
          titulo: `Protocolo de Acompanhamento — ${ano} ${disc}`,
          kpi: xs.length ? fmtMedia(avg(xs)) : "—",
          kpiSub: `média das escolas · ${rows.length} escolas`,
          nota: (DATA_PROTO && DATA_PROTO.notaFonte) || "Sem dados do Protocolo de Acompanhamento.",
          tabela: tabelaRankingCarta(rows, (v) => (v == null ? "—" : fmtMedia(v)), "Turmas"),
        });
      });
    });
  }
  [["AI", "Anos iniciais"], ["AF", "Anos finais"]].forEach(([et, nome]) => {
    const rows = rankingIdebEtapa(et);
    const xs = rows.map((r) => r.v25).filter((n) => n != null);
    out.push({
      id: "ideb-" + et,
      tipo: "ideb",
      tag: "INEP 2025",
      titulo: "IDEB 2025 — " + nome,
      kpi: xs.length ? fmtMedia10(avg(xs)) : "—",
      kpiSub: `${xs.length} escolas com IDEB 2025`,
      nota: (DATA_IDEB && DATA_IDEB.notaFonte) || "Sem dados do IDEB.",
      tabela: tabelaRankingCarta(rows, (v) => (v == null ? "—" : fmtNota10(v)), "IDEB 2023"),
    });
  });
  ["Português", "Matemática"].forEach((disc) => {
    ANOS_COMP.forEach((ano) => {
      const rows = rankingPorEscola(
        ((DATA1 && DATA1.turmas) || []).filter((t) => t.ano === ano && t.disciplina === disc),
        mediaLista1,
        (turmas) => `${turmas.length} turmas`
      );
      const xs = rows.map((r) => r.valor);
      out.push({
        id: `a1-${ano}-${disc}`,
        tipo: "avalie1",
        ano,
        disc,
        tag: "1º Avalie.CE · Proficiência média",
        titulo: `1º Avalie.CE — ${ano} ${disc}`,
        kpi: xs.length ? fmtMedia(avg(xs)) : "—",
        kpiSub: `média das escolas · ${rows.length} escolas`,
        nota: (DATA1 && DATA1.notaFonte) || "",
        tabela: tabelaRankingCarta(rows, fmtMedia, "Turmas"),
      });
    });
  });
  ["Português", "Matemática"].forEach((disc) => {
    ANOS_OK.forEach((ano) => {
      const rows = usaProficiencia2()
        ? rankingPorEscola(
            ((DATA.turmas || []).filter((t) => t.ano === ano && t.disciplina === disc && t.media != null)),
            mediaLista1,
            (list) => `${list.reduce((s, t) => s + (Number(t.avaliados) || 0), 0).toLocaleString("pt-BR")} aval.`
          )
        : rankingPorEscola(
            (DATA.alunos || []).filter((a) => a.ano === ano && a.disciplina === disc),
            mediaDasTurmas,
            (alunos) => `${uniqueStudents(alunos).toLocaleString("pt-BR")} alunos`
          );
      const xs = rows.map((r) => r.valor);
      out.push({
        id: `a2-${ano}-${disc}`,
        tipo: "avalie2",
        ano,
        disc,
        tag: usaProficiencia2() ? "2º Avalie.CE · Proficiência média" : "2º Avalie.CE · BH58 (sem CAEd 2026.2)",
        titulo: `2º Avalie.CE — ${ano} ${disc}`,
        kpi: xs.length ? fmtMedia(avg(xs)) : "—",
        kpiSub: usaProficiencia2()
          ? `Proficiência média CAEd · ${rows.length} escolas`
          : `média das turmas por escola · ${rows.length} escolas`,
        nota: (DATA && DATA.notaFonte) || (DATA && DATA.fonte) || "",
        tabela: tabelaRankingCarta(rows, fmtMedia, usaProficiencia2() ? "Avaliados" : "Alunos"),
      });
    });
  });
  const anosSp = unique(((DATA_SP && DATA_SP.escolas) || []).map((r) => r.ano)).sort();
  ["Português", "Matemática"].forEach((disc) => {
    anosSp.forEach((ano) => {
      const rows = ((DATA_SP && DATA_SP.escolas) || [])
        .filter((r) => r.ano === ano && r.disciplina === disc && r.media != null)
        .map((r) => ({
          escola: r.escola,
          valor: r.media,
          extra: `${(r.avaliados || 0).toLocaleString("pt-BR")} aval.`,
        }))
        .sort((a, b) => b.valor - a.valor);
      const xs = rows.map((r) => r.valor);
      out.push({
        id: `sp-${ano}-${disc}`,
        tipo: "spaece",
        ano,
        disc,
        tag: "SPAECE 2025 · proficiência",
        titulo: `SPAECE 2025 — ${ano} ${disc}`,
        kpi: xs.length ? fmtProf(avg(xs)) : "—",
        kpiSub: `média simples das escolas · ${rows.length} escolas`,
        nota: ano === "2º" && disc === "Português"
          ? "2º LP usa escala 1000. Os demais recortes usam a escala SPAECE usual."
          : ((DATA_SP && DATA_SP.notaFonte) || ""),
        tabela: tabelaRankingCarta(rows, fmtProf, "Avaliados"),
      });
    });
  });
  return out;
}

function classeDiscCarta(c) {
  const d = c.disc || "";
  const t = c.titulo || "";
  if (d === "Português" || (t.includes("Português") && !t.includes("Matemática"))) return " carta-lp";
  if (d === "Matemática" || t.includes("Matemática")) return " carta-mat";
  return "";
}

function cartaHtml(c) {
  return `<article class="carta-aval${c.wide ? " carta-wide" : ""}${classeDiscCarta(c)}" data-id="${c.id}" data-tipo="${c.tipo}"${c.disc ? ` data-disc="${c.disc}"` : ""}>
    <header>
      <div>
        <div class="carta-tag">${c.tag}</div>
        <h3>${c.titulo}</h3>
      </div>
      <button type="button" class="btn-print-one" data-print="${c.id}">PDF desta carta</button>
    </header>
    <p class="hint" style="margin:0">Rede Municipal de Pacajus</p>
    ${c.kpisHtml || `<div class="carta-kpi"><strong>${c.kpi}</strong><em>${c.kpiSub}</em></div>`}
    ${c.nota ? `<p class="hint">${c.nota}</p>` : ""}
    ${c.tabela}
  </article>`;
}

const PRINT_COLOR_CSS = "html,body,*,canvas,img,table,th,td{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}";

function rasterizarGraficosImpressao() {
  document.querySelectorAll("canvas").forEach((canvas) => {
    const next = canvas.nextElementSibling;
    if (canvas.classList.contains("chart-print-hide") && next && next.classList.contains("chart-print-img") && next.getAttribute("src")) {
      return;
    }
    if (next && next.classList.contains("chart-print-img")) next.remove();
    if (canvas.offsetWidth < 8 || canvas.offsetHeight < 8) return;
    try {
      const chart = (typeof Chart !== "undefined" && Chart.getChart && Chart.getChart(canvas))
        || (canvas.id && charts[canvas.id])
        || null;
      if (chart) {
        if (typeof chart.stop === "function") chart.stop();
        const prevAnim = chart.options.animation;
        chart.options.animation = false;
        chart.update("none");
        chart.options.animation = prevAnim;
      }
      if (!canvas.width || !canvas.height) return;
      const tmp = document.createElement("canvas");
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const tctx = tmp.getContext("2d");
      tctx.fillStyle = "#ffffff";
      tctx.fillRect(0, 0, tmp.width, tmp.height);
      tctx.drawImage(canvas, 0, 0);
      const src = tmp.toDataURL("image/png");
      if (!src || src === "data:," || src.length < 80) return;
      const img = document.createElement("img");
      img.className = "chart-print-img";
      img.alt = canvas.getAttribute("aria-label") || "Gráfico";
      img.src = src;
      const cssW = canvas.offsetWidth || Math.round(canvas.width / (window.devicePixelRatio || 1));
      const cssH = canvas.offsetHeight || Math.round(canvas.height / (window.devicePixelRatio || 1));
      img.style.width = `${cssW}px`;
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      canvas.insertAdjacentElement("afterend", img);
      canvas.classList.add("chart-print-hide");
    } catch (err) { /* canvas vazio ou protegido */ }
  });
}

function limparGraficosImpressao() {
  document.querySelectorAll(".chart-print-img").forEach((el) => el.remove());
  document.querySelectorAll(".chart-print-hide").forEach((el) => el.classList.remove("chart-print-hide"));
}

function imprimirCartas(id) {
  document.body.classList.add("print-cartas");
  document.body.classList.remove("print-sit", "print-rank", "print-rankgeral", "print-linhas", "print-consulta");
  document.querySelectorAll(".carta-aval").forEach((el) => {
    el.classList.toggle("print-hide", Boolean(id) && el.dataset.id !== id);
  });
  const vis = [...document.querySelectorAll(".carta-aval")].filter((el) => !el.classList.contains("print-hide"));
  const allWide = vis.length > 0 && vis.every((el) => el.classList.contains("carta-wide"));
  document.body.classList.toggle("print-wide", allWide);
  let st = document.getElementById("print-page-style");
  if (!st) {
    st = document.createElement("style");
    st.id = "print-page-style";
    document.head.appendChild(st);
  }
  st.textContent = allWide
    ? `@media print { @page { size: A4 landscape; margin: 10mm; } ${PRINT_COLOR_CSS} }`
    : `@media print { @page { size: A4 portrait; margin: 12mm; } ${PRINT_COLOR_CSS} }`;
  rasterizarGraficosImpressao();
  const after = () => {
    document.body.classList.remove("print-cartas", "print-wide");
    document.querySelectorAll(".carta-aval").forEach((el) => el.classList.remove("print-hide"));
    limparGraficosImpressao();
    window.removeEventListener("afterprint", after);
  };
  window.addEventListener("afterprint", after);
  window.print();
}

function renderCartas() {
  const tipo = $("filtroTipoCarta")?.value || "todas";
  const ano = $("filtroAnoCarta")?.value || "Todos";
  const specs = specsCartas().filter((c) => {
    if (tipo !== "todas" && c.tipo !== tipo) return false;
    if (ano === "Todos") return true;
    return c.ano === ano;
  });
  const box = $("gradeCartas");
  if (!box) return;
  box.innerHTML = specs.map(cartaHtml).join("") || "<p class='hint'>Nenhum recorte neste filtro.</p>";
}

function setupFiltersCartas() {
  if ($("filtroAnoCarta")) {
    fillSelect($("filtroAnoCarta"), ordenarAnos([...ANOS_CARTAS, ...anosProtoCartas()]), ["Todos"]);
    $("filtroAnoCarta").addEventListener("change", renderCartas);
  }
  if ($("filtroTipoCarta")) $("filtroTipoCarta").addEventListener("change", renderCartas);
  if ($("btnPrintTodas")) $("btnPrintTodas").addEventListener("click", () => imprimirCartas(null));
  const box = $("gradeCartas");
  if (box) {
    box.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-print]");
      if (btn) imprimirCartas(btn.getAttribute("data-print"));
    });
  }
}

function specFonteRank(id) {
  const map = {
    avalie1: {
      id: "avalie1",
      label: "1º Avalie.CE",
      col: "Proficiência",
      fmt: fmtMedia,
      nota: (DATA1 && DATA1.notaFonte) || "Proficiência média CAEd. Média da escola = média simples das turmas.",
    },
    avalie2: {
      id: "avalie2",
      label: "2º Avalie.CE",
      col: usaProficiencia2() ? "Proficiência" : "% de acerto",
      fmt: fmtMedia,
      nota: usaProficiencia2()
        ? ((DATA && DATA.notaFonte) || "Proficiência média CAEd.")
        : "Média simples das BH58 das turmas — pasta 2026.2 ainda sem HABILIDADE_DESEMPENHO.",
    },
    saep1: {
      id: "saep1",
      label: "1º SAEP",
      col: "Média 0–10",
      fmt: fmtNota10,
      nota: (DATA_SAEP1 && DATA_SAEP1.notaFonte) || "Média 0 a 10 das turmas (LP e MAT).",
    },
    diag: {
      id: "diag",
      label: "Diagnóstica",
      col: "Média 0–10",
      fmt: fmtNota10,
      nota: (DATA_DIAG_TURMAS && DATA_DIAG_TURMAS.notaFonte) || "Média 0 a 10 das turmas (LP e MAT).",
    },
    protocolo: {
      id: "protocolo",
      label: "Protocolo de Acompanhamento",
      col: "% de acerto",
      fmt: (v) => (v == null ? "—" : fmtMedia(v)),
      nota: (DATA_PROTO && DATA_PROTO.notaFonte) || "BH58 da planilha. Média da escola = média simples das turmas.",
    },
  };
  return map[id] || map.avalie2;
}

function comColocacaoRank(rows) {
  return (rows || []).map((r, i) => ({
    escola: r.escola,
    valor: r.valor,
    colocacao: i + 1,
  }));
}

function listasRankFonte(id, ano) {
  if (id === "avalie1") {
    return {
      lp: comColocacaoRank(rankingAvalie1Slide(ano, "Português")),
      mat: comColocacaoRank(rankingAvalie1Slide(ano, "Matemática")),
    };
  }
  if (id === "avalie2") {
    return {
      lp: comColocacaoRank(rankingAvalie2Slide(ano, "Português")),
      mat: comColocacaoRank(rankingAvalie2Slide(ano, "Matemática")),
    };
  }
  if (id === "saep1") {
    return {
      lp: comColocacaoRank(rankingNotas10Slide(DATA_SAEP1, ano, "Português")),
      mat: comColocacaoRank(rankingNotas10Slide(DATA_SAEP1, ano, "Matemática")),
    };
  }
  if (id === "diag") {
    return {
      lp: comColocacaoRank(rankingNotas10Slide(DATA_DIAG_TURMAS, ano, "Português")),
      mat: comColocacaoRank(rankingNotas10Slide(DATA_DIAG_TURMAS, ano, "Matemática")),
    };
  }
  if (id === "protocolo") {
    return {
      lp: comColocacaoRank(rankingProtoCarta(ano, "Português")),
      mat: comColocacaoRank(rankingProtoCarta(ano, "Matemática")),
    };
  }
  return { lp: [], mat: [] };
}

function mediaRedeRank(id, ano, disc) {
  // Protocolo: Geral = média simples das linhas de escola da tabela (inclui KPI da Araci 7º).
  // Avalie / SAEP / Diagnóstica: média das turmas no recorte (ano + disciplina).
  if (id === "protocolo") return mediaDasLinhasRank(rankingProtoCarta(ano, disc));
  if (id === "avalie1") {
    const list = ((DATA1 && DATA1.turmas) || []).filter((t) => {
      if (!ANOS_COMP.includes(t.ano)) return false;
      if (t.disciplina !== disc) return false;
      if (ano && ano !== "Todos" && t.ano !== ano) return false;
      return t.media != null;
    });
    return mediaLista1(list);
  }
  if (id === "avalie2") {
    if (usaProficiencia2()) {
      const list = (DATA.turmas || []).filter((t) => {
        if (!ANOS_OK.includes(t.ano)) return false;
        if (t.disciplina !== disc) return false;
        if (ano && ano !== "Todos" && t.ano !== ano) return false;
        return t.media != null;
      });
      return mediaLista1(list);
    }
    const rows = alunosSlide(ano, disc);
    return gruposTurma(rows).length ? mediaDasTurmas(rows) : null;
  }
  if (id === "saep1" || id === "diag") {
    const pack = id === "saep1" ? DATA_SAEP1 : DATA_DIAG_TURMAS;
    const list = ((pack && pack.turmas) || []).filter((t) => {
      if (t.disciplina !== disc) return false;
      if (ano && ano !== "Todos" && t.ano !== ano) return false;
      return t.media != null;
    });
    return mediaLista1(list);
  }
  return null;
}

function linhaRedeRankHtml(fmt, valor) {
  if (valor == null) return "";
  return `<tr class="rank-rede">
      <th class="col-rank" scope="row">Geral</th>
      <th class="col-escola" scope="row">Geral do município <small>Rede Municipal de Pacajus</small></th>
      <th><b>${fmt(valor)}</b></th>
    </tr>`;
}

function anosFonteRank(id) {
  let cands = [];
  if (id === "avalie1") cands = ANOS_COMP.slice();
  else if (id === "avalie2") {
    const rows = usaProficiencia2() ? (DATA.turmas || []) : (DATA.alunos || []);
    cands = ordenarAnos(rows.filter((r) => discAvalie(r.disciplina)).map((r) => r.ano));
    if (!cands.length) cands = ANOS_OK.slice();
  } else if (id === "saep1") {
    cands = ordenarAnos(((DATA_SAEP1 && DATA_SAEP1.turmas) || []).map((t) => t.ano));
    if (!cands.length) cands = ANOS_SAEP.slice();
  } else if (id === "diag") {
    cands = ordenarAnos(((DATA_DIAG_TURMAS && DATA_DIAG_TURMAS.turmas) || []).map((t) => t.ano));
    if (!cands.length) cands = ANOS_SAEP.slice();
  } else if (id === "protocolo") cands = anosProtoCartas();
  return cands.filter((ano) => {
    const { lp, mat } = listasRankFonte(id, ano);
    return lp.length || mat.length;
  });
}

function tabelaRankHtml(rows, titulo, fmt, colValor, disc, mediaRede) {
  const discCls = disc === "Português" ? " rank-card-lp" : disc === "Matemática" ? " rank-card-mat" : "";
  const corpo = rows.length
    ? rows.map((r) => `
      <tr>
        <td class="col-rank ${classeColocacao(r.colocacao)}">${rotuloColocacao(r.colocacao)}</td>
        <td class="col-escola">${r.escola}</td>
        <td><b>${fmt(r.valor)}</b></td>
      </tr>`).join("")
    : `<tr><td colspan="3">Nenhuma escola com dados neste recorte.</td></tr>`;
  const linhaRede = linhaRedeRankHtml(fmt, mediaRede);
  const nEsc = rows.length;
  const hintRede = mediaRede != null
    ? ` Geral do município: <b>${fmt(mediaRede)}</b> (média da rede neste ano, fora da colocação).`
    : "";
  return `<article class="card rank-card${discCls}">
    <h2>${titulo}</h2>
    <p class="hint">${nEsc} escola${nEsc === 1 ? "" : "s"}, da 1ª à última colocação.${hintRede}</p>
    <div class="table-wrap">
      <table class="rank-table">
        <thead>
          <tr><th>Posição</th><th>Escola</th><th>${colValor}</th></tr>
          ${linhaRede}
        </thead>
        <tbody>${corpo}</tbody>
        ${linhaRede ? `<tfoot>${linhaRede}</tfoot>` : ""}
      </table>
    </div>
  </article>`;
}

function preencherAnosRank() {
  const selAval = $("filtroAvalRank");
  const selAno = $("filtroAnoRank");
  if (!selAval || !selAno) return;
  const id = selAval.value || "avalie2";
  const anos = anosFonteRank(id);
  const prefer = selAno.value || $("filtroAno")?.value || "";
  fillSelect(selAno, anos, []);
  if (anos.includes(prefer)) selAno.value = prefer;
  else if (anos.length) selAno.value = anos[0];
}

function renderRank() {
  const box = $("rankTables");
  if (!box) return;
  const id = $("filtroAvalRank")?.value || "avalie2";
  const spec = specFonteRank(id);
  const anos = anosFonteRank(id);
  const ano = $("filtroAnoRank")?.value || anos[0] || "";
  const disc = $("filtroDiscRank")?.value || "Ambas";
  const dataTxt = new Date().toLocaleDateString("pt-BR");
  const anoTxt = ano ? `${ano} ano` : "sem ano neste recorte";
  if ($("rankPrintTitulo")) {
    $("rankPrintTitulo").textContent = `Resultado ranqueado — ${spec.label}`;
  }
  if ($("rankPrintMeta")) {
    const geralTxt = id === "protocolo"
      ? "Geral do município = média simples das escolas listadas neste ano (fora da colocação)."
      : "Geral do município = média da rede neste ano (fora da colocação).";
    $("rankPrintMeta").textContent = `${anoTxt} · ${dataTxt}. ${spec.nota} ${geralTxt}`;
  }
  if (!ano) {
    box.className = "rank-tables rank-tables-1";
    box.innerHTML = `<article class="card rank-card"><p class="hint">Sem escolas com dados nesta avaliação (o ano escolhido precisa existir na fonte).</p></article>`;
    return;
  }
  const { lp, mat } = listasRankFonte(id, ano);
  const redeLP = mediaRedeRank(id, ano, "Português");
  const redeMAT = mediaRedeRank(id, ano, "Matemática");
  const blocos = [];
  if (disc !== "Matemática") blocos.push(tabelaRankHtml(lp, "Português", spec.fmt, spec.col, "Português", redeLP));
  if (disc !== "Português") blocos.push(tabelaRankHtml(mat, "Matemática", spec.fmt, spec.col, "Matemática", redeMAT));
  box.className = blocos.length === 1 ? "rank-tables rank-tables-1" : "rank-tables";
  box.innerHTML = blocos.join("");
}

function imprimirRank() {
  document.body.classList.add("print-rank");
  document.body.classList.remove("print-cartas", "print-wide", "print-sit", "print-rankgeral", "print-linhas", "print-consulta");
  let st = document.getElementById("print-page-style");
  if (!st) {
    st = document.createElement("style");
    st.id = "print-page-style";
    document.head.appendChild(st);
  }
  st.textContent = `@media print { @page { size: A4 portrait; margin: 12mm; } ${PRINT_COLOR_CSS} }`;
  rasterizarGraficosImpressao();
  const after = () => {
    document.body.classList.remove("print-rank");
    limparGraficosImpressao();
    window.removeEventListener("afterprint", after);
  };
  window.addEventListener("afterprint", after);
  window.print();
}

function setupFiltersRank() {
  const selAval = $("filtroAvalRank");
  const selAno = $("filtroAnoRank");
  const selDisc = $("filtroDiscRank");
  preencherAnosRank();
  if (selAval) {
    selAval.addEventListener("change", () => {
      preencherAnosRank();
      renderRank();
    });
  }
  if (selAno) selAno.addEventListener("change", renderRank);
  if (selDisc) selDisc.addEventListener("change", renderRank);
  if ($("btnPrintRank")) $("btnPrintRank").addEventListener("click", imprimirRank);
}

function linhaRedeRankGeralHtml(ranking) {
  const medias = ranking.map((r) => r.media).filter((n) => n != null);
  const lps = ranking.map((r) => r.lp).filter((n) => n != null);
  const mats = ranking.map((r) => r.mat).filter((n) => n != null);
  if (!medias.length) return "";
  return `<tr class="rank-rede">
      <th class="col-rank" scope="row">Geral</th>
      <th class="col-escola" scope="row">Geral do município <small>Rede Municipal de Pacajus — média das médias das escolas</small></th>
      <th><b>${fmtMedia(avg(medias))}</b></th>
      <th>${lps.length ? fmtMedia(avg(lps)) : "—"}</th>
      <th>${mats.length ? fmtMedia(avg(mats)) : "—"}</th>
      <th>—</th>
      <th>—</th>
    </tr>`;
}

function htmlDetalheAnosRankGeral(r) {
  if (!r.porAno || !r.porAno.length) return "";
  const linhas = r.porAno.map((y) => `
      <tr>
        <td>${y.ano}</td>
        <td>${y.nTurmas != null ? y.nTurmas : "—"}</td>
        <td>${y.nNotas != null ? y.nNotas : "—"}</td>
        <td>${fmtMedia(y.lp)}</td>
        <td>${fmtMedia(y.mat)}</td>
      </tr>`).join("");
  return `<table class="rankg-anos">
      <thead><tr><th>Ano</th><th>n turmas</th><th>n notas</th><th>LP</th><th>MAT</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

function renderRankGeral() {
  const tbody = $("tbodyRankGeralProto");
  if (!tbody) return;
  if (!DATA_PROTO || !protoAlunos().length) {
    if ($("rankGeralPrintMeta")) {
      $("rankGeralPrintMeta").textContent = "Arquivo dados_protocolo.js não encontrado. Rode python dashboard/processar_protocolo.py.";
    }
    tbody.innerHTML = `<tr><td colspan="7">Sem dados do Protocolo.</td></tr>`;
    if ($("tfootRankGeralProto")) $("tfootRankGeralProto").innerHTML = "";
    return;
  }
  const ranking = rankingGeralProtocolo();
  const medias = ranking.map((r) => r.media).filter((n) => n != null);
  const geral = medias.length ? avg(medias) : null;
  const dataTxt = new Date().toLocaleDateString("pt-BR");
  if ($("rankGeralPrintMeta")) {
    $("rankGeralPrintMeta").textContent = [
      `${ranking.length} escolas · Protocolo 1º ao 9º · só Português e Matemática.`,
      `Gerado em ${dataTxt}.`,
      DATA_PROTO.geradoEm ? `Fonte processada em ${DATA_PROTO.geradoEm}.` : "",
      "Média da escola = soma das notas de turma (cada turma LP e cada turma MAT) ÷ n notas. Geral do município = média das médias das escolas, fora da colocação.",
    ].filter(Boolean).join(" ");
  }
  if ($("hintRankGeralTab")) {
    $("hintRankGeralTab").textContent = `${ranking.length} escolas, da 1ª à última colocação. n notas = quantidade de médias de turma (turma × LP e turma × MAT) que entram na conta. Abra o nome da escola para ver turmas e notas por ano.`;
  }
  if ($("kpisRankGeral")) {
    $("kpisRankGeral").innerHTML = `
      <div class="kpi"><span>Escolas</span><strong>${ranking.length}</strong><em>1º ao 9º · LP e MAT</em></div>
      <div class="kpi"><span>Geral do município</span><strong>${fmtMedia(geral)}</strong><em>média das médias das escolas</em></div>
      <div class="kpi"><span>n notas (rede)</span><strong>${ranking.reduce((s, r) => s + r.nNotas, 0)}</strong><em>soma das notas de turma × disciplina</em></div>
      <div class="kpi"><span>Regra</span><strong>turma × disc.</strong><em>mesma regra em todas as escolas · Protocolo</em></div>`;
  }
  const linhaRede = linhaRedeRankGeralHtml(ranking);
  tbody.innerHTML = ranking.length
    ? ranking.map((r) => `
      <tr>
        <td class="col-rank ${classeColocacao(r.colocacao)}">${rotuloColocacao(r.colocacao)}</td>
        <td class="col-escola">
          <details class="rankg-det">
            <summary>${r.escola}</summary>
            ${htmlDetalheAnosRankGeral(r)}
          </details>
        </td>
        <td><b>${fmtMedia(r.media)}</b></td>
        <td>${fmtMedia(r.lp)}</td>
        <td>${fmtMedia(r.mat)}</td>
        <td>${r.nAnos}</td>
        <td>${r.nNotas}</td>
      </tr>`).join("")
    : `<tr><td colspan="7">Nenhuma escola com Protocolo de 1º a 9º em LP ou MAT.</td></tr>`;
  if ($("tfootRankGeralProto")) $("tfootRankGeralProto").innerHTML = linhaRede;
  const thead = $("tabelaRankGeral") && $("tabelaRankGeral").tHead;
  if (thead) {
    const extra = thead.querySelector("tr.rank-rede");
    if (extra) extra.remove();
    if (linhaRede) thead.insertAdjacentHTML("beforeend", linhaRede);
  }
}

function imprimirRankGeral() {
  document.body.classList.add("print-rankgeral");
  document.body.classList.remove("print-cartas", "print-wide", "print-sit", "print-rank", "print-linhas", "print-consulta");
  let st = document.getElementById("print-page-style");
  if (!st) {
    st = document.createElement("style");
    st.id = "print-page-style";
    document.head.appendChild(st);
  }
  st.textContent = `@media print { @page { size: A4 landscape; margin: 10mm; } @page rankgeral { size: A4 landscape; margin: 10mm; } ${PRINT_COLOR_CSS} }`;
  rasterizarGraficosImpressao();
  const after = () => {
    document.body.classList.remove("print-rankgeral");
    limparGraficosImpressao();
    window.removeEventListener("afterprint", after);
  };
  window.addEventListener("afterprint", after);
  window.print();
}

function setupFiltersRankGeral() {
  if ($("btnPrintRankGeral")) $("btnPrintRankGeral").addEventListener("click", imprimirRankGeral);
}

const FONTES_LINHA = ["diag", "saep1", "avalie1", "avalie2", "protocolo"];
const COR_LP_LINHA = "#2ec4b6";
const COR_MAT_LINHA = "#e8a317";

function escolasLinhaAno(ano) {
  const nomes = [];
  FONTES_LINHA.forEach((id) => {
    const { lp, mat } = listasRankFonte(id, ano);
    (lp || []).forEach((r) => { if (r.escola) nomes.push(r.escola); });
    (mat || []).forEach((r) => { if (r.escola) nomes.push(r.escola); });
  });
  protoAlunos().forEach((a) => {
    if (a.escola && normAnoKey(a.ano) === normAnoKey(ano)) nomes.push(a.escola);
  });
  return unique(nomes);
}

function anosFonteLinha() {
  return ANOS_CARTAS.filter((ano) => escolasLinhaAno(ano).length);
}

function recorteLinha() {
  const rec = $("filtroRecorteLinha")?.value || "municipio";
  const esc = $("filtroEscolaLinha")?.value || "Todas";
  if (rec === "escola" && esc && esc !== "Todas") {
    return { recorte: "escola", escola: esc };
  }
  return { recorte: "municipio", escola: "Todas" };
}

function valorLinhaFonte(id, ano, disc, recorte, escola) {
  if (id === "protocolo") return valorLinhaProtocolo(ano, disc, recorte, escola);
  if (recorte === "municipio" || !escola || escola === "Todas") {
    return mediaRedeRank(id, ano, disc);
  }
  const { lp, mat } = listasRankFonte(id, ano);
  const rows = protoDiscNome(disc) === "Português" ? lp : mat;
  const hit = (rows || []).find((r) => mesmaEscolaLinha(r.escola, escola));
  return hit && hit.valor != null && !Number.isNaN(hit.valor) ? hit.valor : null;
}

function valorLinhaIdeb(ano, recorte, escola) {
  const map = idebMap();
  if (recorte === "escola" && escola && escola !== "Todas") {
    const n = idebRecorte(map[escola], ano);
    return n == null || Number.isNaN(n) ? null : n;
  }
  const xs = Object.values(map).map((e) => idebRecorte(e, ano)).filter((n) => n != null && !Number.isNaN(n));
  return xs.length ? avg(xs) : null;
}

function packValoresLinha(ano, recorte, escola) {
  const discDe = (id, disc) => valorLinhaFonte(id, ano, disc, recorte, escola);
  return {
    diag: { lp: discDe("diag", "Português"), mat: discDe("diag", "Matemática") },
    saep1: { lp: discDe("saep1", "Português"), mat: discDe("saep1", "Matemática") },
    avalie1: { lp: discDe("avalie1", "Português"), mat: discDe("avalie1", "Matemática") },
    avalie2: { lp: discDe("avalie2", "Português"), mat: discDe("avalie2", "Matemática") },
    proto: {
      lp: valorLinhaProtocolo(ano, "Português", recorte, escola),
      mat: valorLinhaProtocolo(ano, "Matemática", recorte, escola),
    },
    ideb: valorLinhaIdeb(ano, recorte, escola),
  };
}

const SEQ_LINHA = [
  { key: "diag", lab: "Diagnóstica", esc: "Nota 0 a 10", kind: "10", x10: true },
  { key: "saep1", lab: "1º SAEP", esc: "Nota 0 a 10", kind: "10", x10: true },
  { key: "avalie1", lab: "1º Avalie", esc: "Proficiência 0 a 100", kind: "avalie", x10: false },
  { key: "avalie2", lab: "2º Avalie", esc: "Proficiência 0 a 100", kind: "avalie", x10: false },
  { key: "proto", lab: "Protocolo", esc: "% de acerto", kind: "proto", x10: false },
  { key: "ideb", lab: "IDEB 2025", esc: "Nota 0 a 10", kind: "10", x10: true, soNota: true },
];

function nuloNum(n) {
  return n == null || Number.isNaN(n);
}

function origTxtLinha(spec, n) {
  if (nuloNum(n)) return "";
  if (spec.kind === "10") return `${fmtMedia10(n)} nota 0–10`;
  if (spec.kind === "proto") return `${n.toFixed(1).replace(".", ",")}% de acerto`;
  return `${n.toFixed(1).replace(".", ",")} proficiência`;
}

function plotLinhaPonto(spec, n) {
  if (nuloNum(n)) return null;
  return spec.x10 ? n * 10 : n;
}

function parSeqLinha(v, spec) {
  if (spec.soNota) {
    const n = nuloNum(v.ideb) ? null : v.ideb;
    return { lp: n, mat: n };
  }
  return v[spec.key] || { lp: null, mat: null };
}

function temPontoLinha(par, discF) {
  if (!par) return false;
  if (discF === "Português") return par.lp != null;
  if (discF === "Matemática") return par.mat != null;
  return par.lp != null || par.mat != null;
}

function seriesDiscLinha(par, discF) {
  const out = [];
  if (discF !== "Matemática") out.push({ label: "Português", data: par.lp, color: COR_LP_LINHA });
  if (discF !== "Português") out.push({ label: "Matemática", data: par.mat, color: COR_MAT_LINHA });
  return out;
}

function pluginRotulosOrigLinha() {
  return {
    id: "rotulosOrigLinha",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.font = "10px DM Sans, sans-serif";
      ctx.textAlign = "center";
      const text = corCss("--text", "#e8f2f6");
      chart.data.datasets.forEach((ds, di) => {
        const meta = chart.getDatasetMeta(di);
        if (!meta || meta.hidden) return;
        ctx.textBaseline = di % 2 === 0 ? "bottom" : "top";
        (ds.origTxt || []).forEach((txt, i) => {
          if (!txt) return;
          const pt = meta.data[i];
          if (!pt) return;
          const pos = typeof pt.getProps === "function" ? pt.getProps(["x", "y"], true) : pt;
          if (pos.x == null || pos.y == null) return;
          ctx.fillStyle = ds.borderColor || text;
          ctx.fillText(txt, pos.x, pos.y + (di % 2 === 0 ? -9 : 9));
        });
      });
      ctx.restore();
    },
  };
}

function makeLineChart(id, labels, series, yTitle, yMax) {
  const datasets = series
    .map((s) => ({
      label: s.label,
      data: s.data,
      origTxt: s.origTxt || [],
      borderColor: s.color,
      backgroundColor: s.color,
      spanGaps: true,
      fill: false,
      tension: 0.15,
      pointRadius: 6,
      pointHoverRadius: 8,
      borderWidth: 3,
      clip: false,
    }))
    .filter((s) => s.data.some((n) => n != null && !Number.isNaN(n)));
  if (!datasets.length) {
    destroyChart(id);
    return false;
  }
  const tick = corCss("--muted", "#9bb6c2");
  const text = corCss("--text", "#e8f2f6");
  makeChart(id, {
    type: "line",
    data: { labels, datasets },
    plugins: [pluginRotulosOrigLinha()],
    options: {
      layout: { padding: { top: 28, right: 12, bottom: 18 } },
      plugins: {
        legend: { labels: { color: text } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const txt = ctx.dataset.origTxt && ctx.dataset.origTxt[ctx.dataIndex];
              return `${ctx.dataset.label}: ${txt || "—"}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: tick },
          title: { display: true, text: yTitle, color: text },
          grid: { color: corCss("--chart-grid", "rgba(255,255,255,.06)") },
        },
        y: {
          min: 0,
          max: yMax,
          ticks: {
            color: tick,
            callback: (v) => (yMax <= 10 ? String(v).replace(".", ",") : v),
          },
        },
      },
    },
  });
  return true;
}

function preencherAnosLinha() {
  const selAno = $("filtroAnoLinha");
  if (!selAno) return;
  const anos = anosFonteLinha();
  const prefer = selAno.value || $("filtroAno")?.value || "5º";
  fillSelect(selAno, anos, []);
  if (anos.includes(prefer)) selAno.value = prefer;
  else if (anos.includes("5º")) selAno.value = "5º";
  else if (anos.length) selAno.value = anos[0];
}

function preencherEscolasLinha() {
  const selEsc = $("filtroEscolaLinha");
  const selRec = $("filtroRecorteLinha");
  if (!selEsc) return;
  const ano = $("filtroAnoLinha")?.value || anosFonteLinha()[0] || "";
  const escolas = escolasLinhaAno(ano);
  const prefer = selEsc.value;
  fillSelect(selEsc, escolas, ["Todas"]);
  const optTodas = [...selEsc.options].find((o) => o.value === "Todas");
  if (optTodas) optTodas.textContent = "Todas as escolas (município)";
  const rec = selRec?.value || "municipio";
  if (rec === "escola") {
    if (escolas.includes(prefer)) selEsc.value = prefer;
    else if (escolas.length) selEsc.value = escolas[0];
    else selEsc.value = "Todas";
    selEsc.disabled = !escolas.length;
  } else {
    selEsc.value = "Todas";
    selEsc.disabled = false;
  }
}

function syncRecorteEscolaLinha(origem) {
  const selRec = $("filtroRecorteLinha");
  const selEsc = $("filtroEscolaLinha");
  if (!selRec || !selEsc) return;
  if (origem === "escola") {
    selRec.value = selEsc.value && selEsc.value !== "Todas" ? "escola" : "municipio";
  }
  preencherEscolasLinha();
}

function htmlDeltaLinha(n, kind) {
  if (n == null || Number.isNaN(n)) return "—";
  return `<span class="${deltaClass(n)}">${fmtDltSeq(n, kind)} ${rotuloCresc(n)}</span>`;
}

function renderLinhas() {
  if (!$("page-linhas")) return;
  preencherAnosLinha();
  preencherEscolasLinha();
  const anos = anosFonteLinha();
  const ano = $("filtroAnoLinha")?.value || anos[0] || "";
  const discF = $("filtroDiscLinha")?.value || "Ambas";
  const { recorte, escola } = recorteLinha();
  const rede = recorte === "municipio";
  const alvo = rede ? "Rede Municipal de Pacajus" : escola;
  const dataTxt = new Date().toLocaleDateString("pt-BR");
  if ($("linhasPrintTitulo")) {
    $("linhasPrintTitulo").textContent = `Gráficos de linhas — ${ano} ano · ${alvo}`;
  }
  if ($("linhasPrintMeta")) {
    $("linhasPrintMeta").textContent = [
      `${ano} ano · ${discF === "Ambas" ? "Português e Matemática" : discF} · ${dataTxt}.`,
      rede
        ? "Média da rede (mesmo critério do Geral do município no Resultado ranqueado)."
        : `Escola: ${escola}.`,
      "Sequência do emparelhamento. Notas 0–10 ×10 só no traço. IDEB só como ponto, sem crescimento.",
    ].join(" ");
  }

  const v = packValoresLinha(ano, recorte, escola);
  const fmtA = fmtMedia10;
  const fmtB = fmtMedia;
  const fmtC = fmtMedia;
  destroyChart("chartLinhaA");
  destroyChart("chartLinhaB");
  destroyChart("chartLinhaC");

  const kpiBit = (lab, par, fmt) => {
    const lp = discF === "Matemática" ? null : par.lp;
    const mat = discF === "Português" ? null : par.mat;
    const txt = discF === "Ambas"
      ? `LP ${fmt(lp)} · MAT ${fmt(mat)}`
      : fmt(discF === "Português" ? lp : mat);
    return `<div class="kpi"><span>${lab}</span><strong>${txt}</strong><em>${alvo}</em></div>`;
  };
  const kpiIdeb = () => {
    if (nuloNum(v.ideb)) return "";
    return `<div class="kpi"><span>IDEB 2025</span><strong>${fmtA(v.ideb)}</strong><em>${alvo} · só nota</em></div>`;
  };
  if ($("kpisLinhas")) {
    $("kpisLinhas").innerHTML = [
      temPontoLinha(v.diag, discF) ? kpiBit("Diagnóstica", v.diag, fmtA) : "",
      temPontoLinha(v.saep1, discF) ? kpiBit("1º SAEP", v.saep1, fmtA) : "",
      temPontoLinha(v.avalie1, discF) ? kpiBit("1º Avalie", v.avalie1, fmtB) : "",
      temPontoLinha(v.avalie2, discF) ? kpiBit("2º Avalie", v.avalie2, fmtB) : "",
      temPontoLinha(v.proto, discF) ? kpiBit("Protocolo", v.proto, fmtC) : "",
      kpiIdeb(),
    ].join("");
  }

  const yTitle = "valores na sequência (notas 0–10 ×10 para alinhar; Avalie 0–100; Protocolo %)";
  const labels = SEQ_LINHA.map((s) => s.lab);
  const mkSerie = (label, color, pick) => {
    const data = [];
    const origTxt = [];
    SEQ_LINHA.forEach((spec) => {
      if (spec.soNota) {
        data.push(label === "IDEB 2025" ? plotLinhaPonto(spec, v.ideb) : null);
        origTxt.push(label === "IDEB 2025" ? origTxtLinha(spec, v.ideb) : "");
        return;
      }
      if (label === "IDEB 2025") {
        data.push(null);
        origTxt.push("");
        return;
      }
      const n = pick(parSeqLinha(v, spec));
      data.push(plotLinhaPonto(spec, n));
      origTxt.push(origTxtLinha(spec, n));
    });
    return { label, color, data, origTxt };
  };
  const series = [];
  if (discF !== "Matemática") series.push(mkSerie("Português", COR_LP_LINHA, (p) => p.lp));
  if (discF !== "Português") series.push(mkSerie("Matemática", COR_MAT_LINHA, (p) => p.mat));
  if (!nuloNum(v.ideb)) series.push(mkSerie("IDEB 2025", "#c4a574", () => v.ideb));

  const temAlgum = series.some((s) => s.data.some((n) => n != null && !Number.isNaN(n)));
  if ($("cardLinhaSeq")) $("cardLinhaSeq").classList.toggle("hidden", !temAlgum);
  if (temAlgum) {
    makeLineChart("chartLinhaSeq", labels, series, yTitle, 100);
    if ($("hintLinhaSeq")) {
      $("hintLinhaSeq").textContent = "Ordem das Cartas emparelhadas. Ponto ausente = sem dado (não é zero); a linha liga os pontos vizinhos. IDEB sem rótulo de crescimento.";
    }
  } else destroyChart("chartLinhaSeq");

  const fmtTab = (spec) => (spec.kind === "10" ? fmtA : fmtB);
  const corpo = SEQ_LINHA.filter((spec) => {
    if (spec.soNota) return !nuloNum(v.ideb);
    return temPontoLinha(parSeqLinha(v, spec), discF);
  }).map((spec, i, arr) => {
    const par = parSeqLinha(v, spec);
    const fmt = fmtTab(spec);
    const prev = i > 0 ? arr[i - 1] : null;
    const mesma = prev && !spec.soNota && !prev.soNota && prev.kind === spec.kind && spec.kind === "10";
    const mesmaAvalie = prev && !spec.soNota && !prev.soNota && prev.key === "avalie1" && spec.key === "avalie2";
    const dltDe = (mesma || mesmaAvalie) ? parSeqLinha(v, prev) : null;
    const kindDlt = mesma ? "10" : "pct";
    const dLp = dltDe ? dltPar(dltDe.lp, par.lp) : null;
    const dMat = dltDe ? dltPar(dltDe.mat, par.mat) : null;
    const lpTxt = spec.soNota ? fmt(v.ideb) : (discF === "Matemática" ? "—" : fmt(par.lp));
    const matTxt = spec.soNota ? fmt(v.ideb) : (discF === "Português" ? "—" : fmt(par.mat));
    const vLp = spec.soNota || discF === "Matemática" ? "—" : (dltDe ? htmlDeltaLinha(dLp, kindDlt) : "—");
    const vMat = spec.soNota || discF === "Português" ? "—" : (dltDe ? htmlDeltaLinha(dMat, kindDlt) : "—");
    return `<tr>
      <td>${spec.lab}</td>
      <td>${spec.esc}</td>
      <td><b>${lpTxt}</b></td>
      <td><b>${matTxt}</b></td>
      <td>${vLp}</td>
      <td>${vMat}</td>
    </tr>`;
  }).join("");
  if ($("tbodyLinhas")) {
    $("tbodyLinhas").innerHTML = corpo || `<tr><td colspan="6">Sem dados neste recorte (ano, escola ou município).</td></tr>`;
  }
}

function imprimirLinhas() {
  document.body.classList.add("print-linhas");
  document.body.classList.remove("print-cartas", "print-wide", "print-sit", "print-rank", "print-rankgeral", "print-consulta");
  let st = document.getElementById("print-page-style");
  if (!st) {
    st = document.createElement("style");
    st.id = "print-page-style";
    document.head.appendChild(st);
  }
  st.textContent = `@media print { @page { size: A4 landscape; margin: 10mm; } @page linhas { size: A4 landscape; margin: 10mm; } ${PRINT_COLOR_CSS} }`;
  const chartEl = $("chartLinhaSeq");
  const ch = chartEl && typeof Chart !== "undefined" && Chart.getChart ? Chart.getChart(chartEl) : charts.chartLinhaSeq;
  if (ch) {
    if (typeof ch.stop === "function") ch.stop();
    ch.options.animation = false;
    ch.update("none");
  }
  const disparar = () => {
    rasterizarGraficosImpressao();
    const after = () => {
      document.body.classList.remove("print-linhas");
      limparGraficosImpressao();
      window.removeEventListener("afterprint", after);
    };
    window.addEventListener("afterprint", after);
    window.print();
  };
  requestAnimationFrame(() => requestAnimationFrame(disparar));
}

function setupFiltersLinha() {
  preencherAnosLinha();
  preencherEscolasLinha();
  if ($("filtroAnoLinha")) {
    $("filtroAnoLinha").addEventListener("change", () => {
      preencherEscolasLinha();
      renderLinhas();
    });
  }
  if ($("filtroRecorteLinha")) {
    $("filtroRecorteLinha").addEventListener("change", () => {
      syncRecorteEscolaLinha("recorte");
      renderLinhas();
    });
  }
  if ($("filtroEscolaLinha")) {
    $("filtroEscolaLinha").addEventListener("change", () => {
      syncRecorteEscolaLinha("escola");
      renderLinhas();
    });
  }
  if ($("filtroDiscLinha")) $("filtroDiscLinha").addEventListener("change", renderLinhas);
  if ($("btnPrintLinhas")) $("btnPrintLinhas").addEventListener("click", imprimirLinhas);
}

function consultaAnoSel() {
  return $("filtroAnoConsulta")?.value || "9º";
}

function consultaPack() {
  const ano = consultaAnoSel();
  if (ano === "2º") return window.CONSULTA_AVAL_2 || { itens: [], lpLista: [], matLista: [] };
  if (ano === "5º") return window.CONSULTA_AVAL_5 || { itens: [], lpLista: [], matLista: [] };
  return window.CONSULTA_AVAL || { itens: [], lpLista: [], matLista: [] };
}

function consultaDescTexto(item) {
  const pack = consultaPack();
  const lista = item.disc === "LP" ? pack.lpLista : pack.matLista;
  const hit = (lista || []).find((d) => d.c === item.desc);
  if (item.desc && hit) return `${hit.c} — ${hit.t}`;
  if (item.desc) return item.desc;
  const ano = consultaAnoSel();
  return `Sem descritor direto na matriz SPAECE/CAED ${ano}`;
}

function consultaItensFiltrados() {
  const pack = consultaPack();
  const disc = $("filtroDiscConsulta")?.value || "Ambas";
  const desc = $("filtroDescConsulta")?.value || "Todos";
  return (pack.itens || []).filter((it) => {
    if (disc === "LP" && it.disc !== "LP") return false;
    if (disc === "MAT" && it.disc !== "MAT") return false;
    if (desc && desc !== "Todos") {
      if (desc === "sem") return !it.desc;
      if (desc.includes(":")) {
        const [dDisc, dCod] = desc.split(":");
        if (it.disc !== dDisc || it.desc !== dCod) return false;
      } else if (it.desc !== desc) return false;
    }
    return true;
  });
}

function preencherDescConsulta() {
  const sel = $("filtroDescConsulta");
  if (!sel) return;
  const pack = consultaPack();
  const disc = $("filtroDiscConsulta")?.value || "Ambas";
  const prev = sel.value;
  const itens = (pack.itens || []).filter((it) => disc === "Ambas" || it.disc === disc);
  const used = [...new Set(itens.map((it) => it.desc).filter(Boolean))];
  const mapaLp = new Map();
  const mapaMat = new Map();
  (pack.lpLista || []).forEach((d) => mapaLp.set(d.c, d.t));
  (pack.matLista || []).forEach((d) => mapaMat.set(d.c, d.t));
  const txt = (dDisc, c) => (dDisc === "LP" ? mapaLp : mapaMat).get(c) || "";
  const opts = [`<option value="Todos">Todos os descritores</option>`];
  if (disc === "Ambas") {
    const pares = [];
    const seen = new Set();
    itens.forEach((it) => {
      if (!it.desc) return;
      const k = `${it.disc}:${it.desc}`;
      if (seen.has(k)) return;
      seen.add(k);
      pares.push(it);
    });
    pares.sort((a, b) => a.disc.localeCompare(b.disc) || a.desc.localeCompare(b.desc, "pt-BR", { numeric: true }));
    pares.forEach((it) => {
      const lab = it.disc === "LP" ? "LP" : "MAT";
      opts.push(`<option value="${it.disc}:${it.desc}">${lab} ${it.desc} — ${txt(it.disc, it.desc)}</option>`);
    });
  } else {
    used.sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })).forEach((c) => {
      opts.push(`<option value="${c}">${c} — ${txt(disc, c)}</option>`);
    });
  }
  if (itens.some((it) => !it.desc)) {
    opts.push(`<option value="sem">Sem descritor direto na matriz ${consultaAnoSel()}</option>`);
  }
  sel.innerHTML = opts.join("");
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

function consultaCardHtml(it) {
  const discLab = it.disc === "LP" ? "Língua Portuguesa" : "Matemática";
  const cls = it.disc === "LP" ? "lp" : "mat";
  const escrita = it.tipo === "escrita" || it.gab === "P";
  const alts = (it.alts || []).map((a) => {
    const letra = (a.match(/^[A-D]/) || [""])[0];
    return `<li class="${letra === it.gab ? "is-gab" : ""}">${a}${letra === it.gab ? " <b>(gabarito)</b>" : ""}</li>`;
  }).join("");
  const gabLab = escrita ? "Produção do aluno" : `Gabarito ${it.gab}`;
  return `<article class="consulta-card consulta-card-${cls}">
    <div class="consulta-head">
      <span class="consulta-n">Questão ${String(it.n).padStart(2, "0")}</span>
      <span class="consulta-badge consulta-badge-${cls}">${discLab}${escrita ? " · escrita" : ""}</span>
      <span class="consulta-gab">${gabLab}</span>
      <span class="consulta-desc">${consultaDescTexto(it)}</span>
    </div>
    <p class="consulta-stem">${it.stem}</p>
    ${it.texto ? `<p class="consulta-meta"><b>Texto (resumo):</b> ${it.texto}</p>` : ""}
    ${it.figura ? `<p class="consulta-meta"><b>Figura / tabela:</b> ${it.figura}</p>` : ""}
    ${alts ? `<ul class="consulta-alts">${alts}</ul>` : ""}
    ${it.incerteza || it.descNota ? `<p class="consulta-incerteza">${it.incerteza ? "Mapeamento incerto. " : ""}${it.descNota || ""}</p>` : ""}
    <p class="consulta-analise"><b>O que cobra:</b> ${it.cobra}</p>
    <p class="consulta-analise"><b>Erro típico:</b> ${it.erro}</p>
    <p class="consulta-just"><b>Justificativa do gabarito:</b> ${it.just}</p>
  </article>`;
}

function renderConsulta() {
  if (!$("page-consulta")) return;
  preencherDescConsulta();
  const pack = consultaPack();
  const ano = consultaAnoSel();
  const itens = consultaItensFiltrados();
  const lpAll = (pack.itens || []).filter((i) => i.disc === "LP");
  const nLpObj = lpAll.filter((i) => i.tipo !== "escrita").length;
  const nEsc = lpAll.filter((i) => i.tipo === "escrita").length;
  const nMat = (pack.itens || []).filter((i) => i.disc === "MAT").length;
  const visLp = itens.filter((i) => i.disc === "LP" && i.tipo !== "escrita").length;
  const visMat = itens.filter((i) => i.disc === "MAT").length;
  const etapa = ano === "2º" ? "Fund I · SPAECE-Alfa/CAED" : (ano === "5º" ? "Fund I · SPAECE/CAED" : "Fund II · SPAECE/CAED");
  if ($("kpisConsulta")) {
    $("kpisConsulta").innerHTML = `
      <div class="kpi"><span>Itens LP</span><strong>${nLpObj}</strong><em>${visLp} visíveis${nEsc ? ` · ${nEsc} de escrita` : ""}</em></div>
      <div class="kpi"><span>Itens MAT</span><strong>${nMat}</strong><em>${visMat} visíveis no filtro</em></div>
      <div class="kpi"><span>Gabarito</span><strong>Pedagógico</strong><em>PDF sem chave oficial</em></div>
      <div class="kpi"><span>Ano</span><strong>${ano}</strong><em>${etapa}</em></div>`;
  }
  if ($("consultaPrintTitulo")) {
    $("consultaPrintTitulo").textContent = `2º Protocolo de Acompanhamento — 2º simulado LP-MAT · ${ano} ano`;
  }
  if ($("consultaPrintMeta")) {
    $("consultaPrintMeta").textContent = `${pack.rede || "Rede Municipal de Pacajus"} · ${itens.length} item(ns) no recorte · caderno ${pack.caderno || ""}`;
  }
  if ($("hintConsultaFonte")) {
    $("hintConsultaFonte").textContent = `${pack.gabaritoFonte || ""} Fontes dos descritores: ${(pack.descritoresFonte || []).join(" ")}`;
  }
  if ($("consultaLista")) {
    $("consultaLista").innerHTML = itens.length
      ? itens.map(consultaCardHtml).join("")
      : `<article class="card"><p class="hint">Nenhum item neste filtro.</p></article>`;
  }
}

function imprimirConsulta() {
  document.body.classList.add("print-consulta");
  document.body.classList.remove("print-cartas", "print-wide", "print-sit", "print-rank", "print-rankgeral", "print-linhas");
  let st = document.getElementById("print-page-style");
  if (!st) {
    st = document.createElement("style");
    st.id = "print-page-style";
    document.head.appendChild(st);
  }
  st.textContent = `@media print { @page { size: A4 portrait; margin: 12mm; } @page consulta { size: A4 portrait; margin: 12mm; } ${PRINT_COLOR_CSS} }`;
  const after = () => {
    document.body.classList.remove("print-consulta");
    window.removeEventListener("afterprint", after);
  };
  window.addEventListener("afterprint", after);
  window.print();
}

function setupFiltersConsulta() {
  if ($("filtroAnoConsulta")) {
    $("filtroAnoConsulta").addEventListener("change", () => {
      const desc = $("filtroDescConsulta");
      if (desc) desc.value = "Todos";
      preencherDescConsulta();
      renderConsulta();
      if (state.page === "consulta") {
        const titles = titulosPagina("consulta");
        if ($("pageTitle")) $("pageTitle").textContent = titles[0];
        if ($("pageSubtitle")) $("pageSubtitle").textContent = titles[1];
      }
    });
  }
  if ($("filtroDiscConsulta")) {
    $("filtroDiscConsulta").addEventListener("change", () => {
      preencherDescConsulta();
      renderConsulta();
    });
  }
  if ($("filtroDescConsulta")) $("filtroDescConsulta").addEventListener("change", renderConsulta);
  if ($("btnPrintConsulta")) $("btnPrintConsulta").addEventListener("click", imprimirConsulta);
}

function render() {
  const rows = rowsAnalise();
  if (state.page === "geral") renderGeral(rows);
  if (state.page === "escolas") renderEscolas(rows);
  if (state.page === "descritores") renderDescritores();
  if (state.page === "turmas") renderTurmas(rows);
  if (state.page === "alunos") renderAlunos(filteredAlunos());
  if (state.page === "comparar") renderComparar();
  if (state.page === "spaece") renderSpaece();
  if (state.page === "saep1") renderPainelNotas("saep1");
  if (state.page === "diag") renderPainelNotas("diag");
  if (state.page === "par") renderPar();
  if (state.page === "ideb") renderIdeb();
  if (state.page === "protocolo") renderProtocolo();
  if (state.page === "situacao") renderSituacao();
  if (state.page === "cartas") renderCartas();
  if (state.page === "rank") renderRank();
  if (state.page === "rankgeral") renderRankGeral();
  if (state.page === "linhas") renderLinhas();
  if (state.page === "consulta") renderConsulta();
}

function titulosPagina(page) {
  const f = fonteAvalie();
  const ed = f.label;
  const avalie = {
    geral: [
      "Visão geral da rede",
      f.edicao === "1" && !f.temAlunos
        ? `Resultados do ${ed} — médias por turma e colocação das escolas (sem lista nominal de alunos)`
        : `Resultados consolidados e colocação das escolas — ${ed}`,
    ],
    escolas: [
      "Colocação das escolas",
      `${ed} · ${recorteFiltroTxt()} · ${metricaRankingTxt()} · da 1ª à última colocação`,
    ],
    descritores: [
      "Análise de descritores",
      f.temDesc
        ? `Habilidades com menor e maior percentual de acerto — ${ed}`
        : `O ${ed} neste arquivo não traz descritores por habilidade`,
    ],
    turmas: ["Turmas", `Desempenho de cada turma no ${ed}`],
    alunos: [
      "Alunos",
      f.temAlunos ? `Busca nominal no ${ed}` : `O ${ed} não tem lista nominal de alunos`,
    ],
  };
  const outras = {
    comparar: ["Comparar 1º × 2º Avalie", "As páginas Visão geral, Escolas, Turmas etc. seguem a edição escolhida em Avalie.CE"],
    spaece: ["SPAECE 2025", "Proficiência e padrões do export CAEd — Pacajus"],
    saep1: ["1º SAEP", "Notas 0 a 10 por turma (LP e MAT) — 1º, 3º, 6º, 7º e demais anos da planilha"],
    diag: ["Diagnóstica", "Notas 0 a 10 por turma (LP e MAT) — 1º, 3º, 6º, 7º e demais anos da planilha"],
    ideb: ["IDEB 2025", "Divulgação INEP — escolas municipais de Pacajus"],
    protocolo: ["Protocolo de Acompanhamento", "1º Protocolo do 1º ao 9º ano — BH58 da planilha, Português e Matemática separados"],
    situacao: ["Situação", "Intervenções emergenciais e necessárias a partir do Protocolo (Português e Matemática)"],
    par: ["Emparelhar avaliações", "Diagnóstica → 1º SAEP → 1º Avalie.CE → 2º Avalie.CE → IDEB 2025 → SPAECE 2025"],
    cartas: ["Cartas por avaliação", "Emparelhadas (1º a 9º) e resultado ranqueado da Diagnóstica, do 1º SAEP e do Protocolo de Acompanhamento por ano e disciplina"],
    rank: ["Resultado ranqueado", "Colocação das escolas por avaliação e ano — só Português e Matemática"],
    rankgeral: ["Ranking geral", "Protocolo de Acompanhamento 1º ao 9º — média simples das notas de turma (LP e MAT), depois colocação"],
    linhas: ["Gráficos de linhas", "Sequência do emparelhamento (todas as avaliações) por ano, escola ou município — LP e MAT"],
    corretor: ["Eixo de avaliação", "Avaliação isolada do 1º ao 9º ano. No lançamento, escola, ano, disciplina, turma e aluno são menus. Tudo fica só neste navegador."],
    consulta: [
      "Consulta de avaliação",
      consultaAnoSel() === "2º"
        ? "2º Protocolo / 2º simulado LP-MAT, 2º ano — questões, gabarito pedagógico e descritores SPAECE-Alfa/CAED"
        : consultaAnoSel() === "5º"
          ? "2º Protocolo / 2º simulado LP-MAT, 5º ano — questões, gabarito pedagógico e descritores SPAECE/CAED"
          : "2º Protocolo / 2º simulado LP-MAT, 9º ano — questões, gabarito pedagógico e descritores SPAECE/CAED",
    ],
  };
  return avalie[page] || outras[page] || ["Dashboard", ""];
}

function goto(page) {
  state.page = page;
  const alvo = $("page-" + page);
  if (!alvo) return;
  document.querySelectorAll(".page").forEach((el) => el.classList.add("hidden"));
  alvo.classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.page === page));
  const btnComp = $("btnComparar");
  if (btnComp) btnComp.classList.toggle("active", page === "comparar");
  const btnRank = $("btnRank");
  if (btnRank) btnRank.classList.toggle("active", page === "rank");
  if (page === "rank") {
    preencherAnosRank();
    const anoDash = $("filtroAno")?.value;
    const selAnoRank = $("filtroAnoRank");
    if (selAnoRank && anoDash && anoDash !== "Todos" && [...selAnoRank.options].some((o) => o.value === anoDash)) {
      selAnoRank.value = anoDash;
    }
  }
  atualizarNavEdicao();
  document.body.classList.toggle("page-spaece", page === "spaece");
  document.body.classList.toggle("page-saep1", page === "saep1");
  document.body.classList.toggle("page-diag", page === "diag");
  document.body.classList.toggle("page-par", page === "par");
  document.body.classList.toggle("page-ideb", page === "ideb");
  document.body.classList.toggle("page-protocolo", page === "protocolo");
  document.body.classList.toggle("page-situacao", page === "situacao");
  document.body.classList.toggle("page-cartas", page === "cartas");
  document.body.classList.toggle("page-rank", page === "rank");
  document.body.classList.toggle("page-rankgeral", page === "rankgeral");
  document.body.classList.toggle("page-linhas", page === "linhas");
  document.body.classList.toggle("page-consulta", page === "consulta");
  const titles = titulosPagina(page);
  $("pageTitle").textContent = titles[0];
  $("pageSubtitle").textContent = titles[1];
  document.title = titles[0] + " · Eixo de Avaliação";
  render();
}

const CAPA_FOTOS = [
  {
    id: "spaece",
    src: "assets/capa-spaece-run.jpg",
    alt: "SPAECE RUN XP. Correndo em busca de resultados. Inscrições abertas. Público-alvo: 9º ano. Secretaria de Educação de Pacajus.",
    legenda: "SPAECE RUN XP",
  },
  {
    id: "ideb",
    src: "assets/capa-ideb-2025.jpg",
    alt: "Resultado IDEB 2025. Pacajus: anos iniciais 7,1 e anos finais 5,6. Superamos a média nacional!",
    legenda: "Resultado IDEB 2025",
  },
  {
    id: "servidor",
    src: "assets/capa-servidor.jpg",
    alt: "28 de Outubro. Dia do Servidor Público. Secretaria de Educação de Pacajus.",
    legenda: "Dia do Servidor Público",
  },
];

let capaFotoIdx = 0;

function aplicarFotoCapa(idx) {
  const foto = CAPA_FOTOS[idx];
  if (!foto) return;
  capaFotoIdx = idx;
  const fundo = $("capaFundo");
  if (fundo) fundo.src = foto.src;
}

function mostrarPalcoCapa(id) {
  const cinco = $("capaCinco");
  if (cinco) cinco.hidden = id !== "capaCinco";
  document.querySelectorAll(".capa-grupo").forEach((el) => {
    el.hidden = el.id !== id;
  });
  window.scrollTo(0, 0);
  const titulo = document.querySelector("#" + id + " .capa-secretaria, #" + id + " .capa-titulo");
  if (titulo) titulo.focus();
}

function mostrarCinco() {
  mostrarPalcoCapa("capaCinco");
}

function abrirGrupoCapa(id) {
  mostrarPalcoCapa(id);
}

function mostrarCapa() {
  if (slideState.on) sairModoSlide();
  limparIdleSlide();
  document.body.classList.add("capa-ativa");
  document.title = "Eixo de Avaliação · Pacajus";
  mostrarCinco();
  const titulo = document.querySelector(".capa-titulo");
  if (titulo) titulo.focus();
}

function abrirPainelDaCapa(page) {
  document.body.classList.remove("capa-ativa");
  window.scrollTo(0, 0);
  const main = document.querySelector(".main");
  if (main) void main.offsetWidth;
  goto(page);
  armarIdleSlide();
  const voltar = $("btnVoltarCapa");
  if (voltar) voltar.focus({ preventScroll: true });
}

function rotuloAnoDisc(ano, disc) {
  const a = !ano || ano === "Todos" ? "Todos os anos" : `${ano} ano`;
  const d = !disc || disc === "Todas" ? "Português e Matemática" : disc;
  return `${a} · ${d}`;
}

function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sampleArr(arr, n) {
  return shuffleArr(arr).slice(0, Math.max(0, n));
}

function alunosSlide(ano, disc, esc) {
  return (DATA.alunos || []).filter((a) => {
    if (!ANOS_OK.includes(a.ano)) return false;
    if (a.disciplina !== "Português" && a.disciplina !== "Matemática") return false;
    if (ano && ano !== "Todos" && a.ano !== ano) return false;
    if (disc && disc !== "Todas" && a.disciplina !== disc) return false;
    if (esc && esc !== "Todas" && a.escola !== esc) return false;
    return true;
  });
}

function rankingAvalie2Slide(ano, disc) {
  if (usaProficiencia2()) {
    const list = (DATA.turmas || []).filter((t) => {
      if (!ANOS_OK.includes(t.ano)) return false;
      if (t.disciplina !== "Português" && t.disciplina !== "Matemática") return false;
      if (ano && ano !== "Todos" && t.ano !== ano) return false;
      if (disc && disc !== "Todas" && t.disciplina !== disc) return false;
      return t.media != null;
    });
    return rankingPorEscola(list, mediaLista1);
  }
  const rows = alunosSlide(ano, disc);
  const by = {};
  rows.forEach((a) => {
    (by[a.escola] = by[a.escola] || []).push(a);
  });
  return Object.keys(by).map((escola) => ({
    escola,
    valor: mediaDasTurmas(by[escola]),
  })).filter((r) => r.valor).sort((a, b) => b.valor - a.valor);
}

function rankingAvalie1Slide(ano, disc) {
  if (!DATA1 || !DATA1.turmas) return [];
  const list = DATA1.turmas.filter((t) => {
    if (!ANOS_COMP.includes(t.ano)) return false;
    if (t.disciplina !== "Português" && t.disciplina !== "Matemática") return false;
    if (ano && ano !== "Todos" && t.ano !== ano) return false;
    if (disc && disc !== "Todas" && t.disciplina !== disc) return false;
    return t.media != null;
  });
  return rankingPorEscola(list, mediaLista1, (turmas) => `${turmas.length} turma${turmas.length === 1 ? "" : "s"}`);
}

function rankingNotas10Slide(pack, ano, disc) {
  if (!pack || !pack.turmas) return [];
  const list = pack.turmas.filter((t) => {
    if (t.disciplina !== "Português" && t.disciplina !== "Matemática") return false;
    if (ano && ano !== "Todos" && t.ano !== ano) return false;
    if (disc && disc !== "Todas" && t.disciplina !== disc) return false;
    return t.media != null;
  });
  return rankingPorEscola(list, mediaLista1);
}

function rankingSpaeceSlide(ano, disc) {
  if (!DATA_SP || !DATA_SP.escolas) return [];
  const list = DATA_SP.escolas.filter((r) => {
    if (!r.escola || r.media == null) return false;
    if (r.disciplina !== "Português" && r.disciplina !== "Matemática") return false;
    if (ano && ano !== "Todos" && r.ano !== ano) return false;
    if (disc && disc !== "Todas" && r.disciplina !== disc) return false;
    return true;
  });
  return rankingPorEscola(list, (rows) => mediaSpaeceEscola(rows));
}

function rankSnippet(rows, fmt, n = 3) {
  return rows.slice(0, n).map((r, i) => (
    `<li><span><em>${i + 1}º</em>${r.escola}</span><strong>${fmt(r.valor)}</strong></li>`
  )).join("");
}

function pushSlide(pool, spec) {
  if (!spec || spec.value == null || spec.value === "—") return;
  pool.push(spec);
}

function montarSlides() {
  const pool = [];
  const discs = ["Português", "Matemática"];
  const recortesA2 = [];
  ["Todos", ...ANOS_OK].forEach((ano) => {
    ["Todas", ...discs].forEach((disc) => recortesA2.push({ ano, disc }));
  });
  const recortesA1 = [];
  ["Todos", ...ANOS_COMP].forEach((ano) => {
    ["Todas", ...discs].forEach((disc) => recortesA1.push({ ano, disc }));
  });
  const recortes10 = [];
  ["Todos", ...ANOS_SAEP].forEach((ano) => {
    ["Todas", ...discs].forEach((disc) => recortes10.push({ ano, disc }));
  });
  const recortesSp = [];
  const anosSp = unique(((DATA_SP && DATA_SP.escolas) || []).map((r) => r.ano)).filter(Boolean);
  ["Todos", ...anosSp].forEach((ano) => {
    ["Todas", ...discs].forEach((disc) => recortesSp.push({ ano, disc }));
  });

  recortesA2.forEach(({ ano, disc }) => {
    const rank = rankingAvalie2Slide(ano, disc);
    if (!rank.length) return;
    const m = avg(rank.map((r) => r.valor));
    const meta = `${rotuloAnoDisc(ano, disc)} · ${usaProficiencia2() ? "Proficiência média" : "BH58"}`;
    pushSlide(pool, {
      kind: "rede",
      accent: "avalie2",
      kicker: "2º Avalie.CE",
      title: "Rede Municipal",
      meta,
      value: fmtMedia(m),
      hint: `${rank.length} escolas · ${usaProficiencia2() ? "Proficiência média CAEd" : "média das turmas (peso igual)"}`,
      rank: rankSnippet(rank, fmtMedia),
    });
    pushSlide(pool, {
      kind: "ranking",
      accent: "avalie2",
      kicker: "2º Avalie.CE · colocação",
      title: "Melhores médias da rede",
      meta,
      value: fmtMedia(rank[0].valor),
      hint: `1º lugar · ${rank[0].escola}`,
      rank: rankSnippet(rank, fmtMedia),
    });
    sampleArr(rank, 3).forEach((r) => {
      const pos = rank.findIndex((x) => x.escola === r.escola) + 1;
      pushSlide(pool, {
        kind: "escola",
        accent: "avalie2",
        kicker: "2º Avalie.CE",
        title: r.escola,
        meta,
        value: fmtMedia(r.valor),
        hint: `${pos}º lugar de ${rank.length} escolas neste recorte`,
        rank: rankSnippet(rank, fmtMedia),
      });
    });
  });

  recortesA1.forEach(({ ano, disc }) => {
    const rank = rankingAvalie1Slide(ano, disc);
    if (!rank.length) return;
    const m = avg(rank.map((r) => r.valor));
    const meta = `${rotuloAnoDisc(ano, disc)} · Proficiência média`;
    pushSlide(pool, {
      kind: "rede",
      accent: "avalie1",
      kicker: "1º Avalie.CE",
      title: "Rede Municipal",
      meta,
      value: fmtMedia(m),
      hint: `${rank.length} escolas · média simples das turmas`,
      rank: rankSnippet(rank, fmtMedia),
    });
    pushSlide(pool, {
      kind: "ranking",
      accent: "avalie1",
      kicker: "1º Avalie.CE · colocação",
      title: "Melhores médias da rede",
      meta,
      value: fmtMedia(rank[0].valor),
      hint: `1º lugar · ${rank[0].escola}`,
      rank: rankSnippet(rank, fmtMedia),
    });
    sampleArr(rank, 3).forEach((r) => {
      const pos = rank.findIndex((x) => x.escola === r.escola) + 1;
      pushSlide(pool, {
        kind: "escola",
        accent: "avalie1",
        kicker: "1º Avalie.CE",
        title: r.escola,
        meta,
        value: fmtMedia(r.valor),
        hint: `${pos}º lugar de ${rank.length} escolas neste recorte`,
        rank: rankSnippet(rank, fmtMedia),
      });
    });
  });

  const rankDiagGeral = rankingDiagCampo("diag", "saep1");
  if (rankDiagGeral.length) {
    const m = avg(rankDiagGeral.map((r) => r.valor));
    pushSlide(pool, {
      kind: "rede",
      accent: "diag",
      kicker: "Diagnóstica",
      title: "Rede Municipal",
      meta: "Média geral da escola · 0 a 10",
      value: fmtMedia10(m),
      hint: `${rankDiagGeral.length} escolas · sem recorte de ano ou disciplina`,
      rank: rankSnippet(rankDiagGeral, fmtNota10),
    });
    sampleArr(rankDiagGeral, 4).forEach((r) => {
      const pos = rankDiagGeral.findIndex((x) => x.escola === r.escola) + 1;
      pushSlide(pool, {
        kind: "escola",
        accent: "diag",
        kicker: "Diagnóstica",
        title: r.escola,
        meta: "Média geral · 0 a 10",
        value: fmtNota10(r.valor),
        hint: `${pos}º lugar na rede`,
        rank: rankSnippet(rankDiagGeral, fmtNota10),
      });
    });
  }

  const rankSaepGeral = rankingDiagCampo("saep1", "diag");
  if (rankSaepGeral.length) {
    const m = avg(rankSaepGeral.map((r) => r.valor));
    pushSlide(pool, {
      kind: "rede",
      accent: "saep",
      kicker: "1º SAEP",
      title: "Rede Municipal",
      meta: "Média geral da escola · 0 a 10",
      value: fmtMedia10(m),
      hint: `${rankSaepGeral.length} escolas · sem recorte de ano ou disciplina`,
      rank: rankSnippet(rankSaepGeral, fmtNota10),
    });
    sampleArr(rankSaepGeral, 4).forEach((r) => {
      const pos = rankSaepGeral.findIndex((x) => x.escola === r.escola) + 1;
      pushSlide(pool, {
        kind: "escola",
        accent: "saep",
        kicker: "1º SAEP",
        title: r.escola,
        meta: "Média geral · 0 a 10",
        value: fmtNota10(r.valor),
        hint: `${pos}º lugar na rede`,
        rank: rankSnippet(rankSaepGeral, fmtNota10),
      });
    });
  }

  recortes10.forEach(({ ano, disc }) => {
    [
      { pack: DATA_DIAG_TURMAS, kicker: "Diagnóstica", accent: "diag", nome: "Diagnóstica" },
      { pack: DATA_SAEP1, kicker: "1º SAEP", accent: "saep", nome: "1º SAEP" },
    ].forEach((src) => {
      if (ano === "Todos" && disc === "Todas") return;
      const rank = rankingNotas10Slide(src.pack, ano, disc);
      if (!rank.length) return;
      const m = avg(rank.map((r) => r.valor));
      const meta = `${rotuloAnoDisc(ano, disc)} · 0 a 10`;
      pushSlide(pool, {
        kind: "rede",
        accent: src.accent,
        kicker: src.kicker,
        title: "Rede Municipal",
        meta,
        value: fmtMedia10(m),
        hint: `${rank.length} escolas · média das turmas`,
        rank: rankSnippet(rank, fmtNota10),
      });
      pushSlide(pool, {
        kind: "ranking",
        accent: src.accent,
        kicker: `${src.kicker} · colocação`,
        title: "Melhores médias da rede",
        meta,
        value: fmtNota10(rank[0].valor),
        hint: `1º lugar · ${rank[0].escola}`,
        rank: rankSnippet(rank, fmtNota10),
      });
      sampleArr(rank, 2).forEach((r) => {
        const pos = rank.findIndex((x) => x.escola === r.escola) + 1;
        pushSlide(pool, {
          kind: "escola",
          accent: src.accent,
          kicker: src.kicker,
          title: r.escola,
          meta,
          value: fmtNota10(r.valor),
          hint: `${pos}º lugar de ${rank.length} neste recorte`,
          rank: rankSnippet(rank, fmtNota10),
        });
      });
    });
  });

  [
    { etapa: "Todos", nome: "média das etapas" },
    { etapa: "AI", nome: "anos iniciais" },
    { etapa: "AF", nome: "anos finais" },
  ].forEach(({ etapa, nome }) => {
    const rank = rankingIdebEtapa(etapa).filter((r) => r.v25 != null);
    if (!rank.length) return;
    const m = avg(rank.map((r) => r.valor));
    pushSlide(pool, {
      kind: "rede",
      accent: "ideb",
      kicker: "IDEB 2025",
      title: "Rede Municipal",
      meta: nome,
      value: fmtMedia10(m),
      hint: `${rank.length} escolas com IDEB 2025 na divulgação INEP`,
      rank: rankSnippet(rank, fmtNota10),
    });
    pushSlide(pool, {
      kind: "ranking",
      accent: "ideb",
      kicker: "IDEB 2025 · colocação",
      title: "Melhores índices da rede",
      meta: nome,
      value: fmtNota10(rank[0].valor),
      hint: `1º lugar · ${rank[0].escola}`,
      rank: rankSnippet(rank, fmtNota10),
    });
    sampleArr(rank, 3).forEach((r) => {
      const pos = rank.findIndex((x) => x.escola === r.escola) + 1;
      pushSlide(pool, {
        kind: "escola",
        accent: "ideb",
        kicker: "IDEB 2025",
        title: r.escola,
        meta: nome,
        value: fmtNota10(r.valor),
        hint: `${pos}º lugar · ${nome}`,
        rank: rankSnippet(rank, fmtNota10),
      });
    });
  });

  recortesSp.forEach(({ ano, disc }) => {
    if (ano === "Todos" || disc === "Todas") return;
    const rank = rankingSpaeceSlide(ano, disc);
    if (!rank.length) return;
    const m = avg(rank.map((r) => r.valor));
    const escala = ano === "2º" && disc === "Português" ? "escala 1000" : "proficiência CAEd";
    const meta = `${rotuloAnoDisc(ano, disc)} · ${escala}`;
    pushSlide(pool, {
      kind: "rede",
      accent: "spaece",
      kicker: "SPAECE 2025",
      title: "Rede Municipal",
      meta,
      value: fmtProf(m),
      hint: `${rank.length} escolas · média simples`,
      rank: rankSnippet(rank, fmtProf),
    });
    pushSlide(pool, {
      kind: "ranking",
      accent: "spaece",
      kicker: "SPAECE 2025 · colocação",
      title: "Maiores proficiências",
      meta,
      value: fmtProf(rank[0].valor),
      hint: `1º lugar · ${rank[0].escola}`,
      rank: rankSnippet(rank, fmtProf),
    });
    sampleArr(rank, 2).forEach((r) => {
      const pos = rank.findIndex((x) => x.escola === r.escola) + 1;
      pushSlide(pool, {
        kind: "escola",
        accent: "spaece",
        kicker: "SPAECE 2025",
        title: r.escola,
        meta,
        value: fmtProf(r.valor),
        hint: `${pos}º lugar de ${rank.length} neste recorte`,
        rank: rankSnippet(rank, fmtProf),
      });
    });
  });

  const turmasDiag = ((DATA_DIAG_TURMAS && DATA_DIAG_TURMAS.turmas) || []).filter(
    (t) => (t.disciplina === "Português" || t.disciplina === "Matemática") && t.media != null
  );
  const turmasSaep = ((DATA_SAEP1 && DATA_SAEP1.turmas) || []).filter(
    (t) => (t.disciplina === "Português" || t.disciplina === "Matemática") && t.media != null
  );
  sampleArr(turmasDiag, 6).forEach((t) => {
    pushSlide(pool, {
      kind: "escola",
      accent: "diag",
      kicker: "Diagnóstica",
      title: t.escola,
      meta: `${t.turma} · ${t.disciplina} · 0 a 10`,
      value: fmtNota10(t.media),
      hint: `${t.ano} ano · nota da turma`,
      rank: "",
    });
  });
  sampleArr(turmasSaep, 6).forEach((t) => {
    pushSlide(pool, {
      kind: "escola",
      accent: "saep",
      kicker: "1º SAEP",
      title: t.escola,
      meta: `${t.turma} · ${t.disciplina} · 0 a 10`,
      value: fmtNota10(t.media),
      hint: `${t.ano} ano · nota da turma`,
      rank: "",
    });
  });

  return shuffleArr(pool);
}

const SLIDE_TRANSICOES = [
  "fade",
  "fade-scale",
  "from-left",
  "from-right",
  "from-up",
  "from-down",
  "rotate-zoom",
  "blur-in",
];
const SLIDE_TRANS_MS = 900;

const slideState = {
  on: false,
  deck: [],
  idx: 0,
  lastKind: "",
  lastTrans: "",
  painted: false,
  timer: null,
  idle: null,
  animTimer: null,
  animEl: null,
  onAnimEnd: null,
  exitArmed: false,
  armTimer: null,
  cursorTimer: null,
  lastMove: 0,
};

function elFullscreenSlide() {
  return $("slideOverlay") || document.documentElement;
}

function estaEmFullscreen() {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement
  );
}

function pedirFullscreenSlide() {
  if (estaEmFullscreen()) return;
  const el = elFullscreenSlide();
  if (!el) return;
  const req =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.webkitRequestFullScreen ||
    el.msRequestFullscreen;
  if (!req) return;
  try {
    let p;
    try {
      p = req.call(el, { navigationUI: "hide" });
    } catch (_) {
      p = req.call(el);
    }
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        const root = document.documentElement;
        if (!root || root === el || estaEmFullscreen()) return;
        const req2 =
          root.requestFullscreen ||
          root.webkitRequestFullscreen ||
          root.webkitRequestFullScreen;
        if (!req2) return;
        try {
          let p2;
          try {
            p2 = req2.call(root, { navigationUI: "hide" });
          } catch (_) {
            p2 = req2.call(root);
          }
          if (p2 && typeof p2.catch === "function") p2.catch(() => {});
        } catch (_) { /* idle sem gesto do usuário */ }
      });
    }
  } catch (_) { /* idle / política do navegador */ }
}

function sairFullscreenSlide() {
  if (!estaEmFullscreen()) return;
  const exit =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen;
  if (!exit) return;
  try {
    const p = exit.call(document);
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (_) { /* já saiu */ }
}

function limparCursorSlide() {
  if (slideState.cursorTimer) {
    clearTimeout(slideState.cursorTimer);
    slideState.cursorTimer = null;
  }
  document.body.classList.remove("slide-hide-cursor");
  const overlay = $("slideOverlay");
  if (overlay) overlay.classList.remove("slide-hide-cursor");
}

function armarCursorSlide() {
  limparCursorSlide();
  slideState.cursorTimer = setTimeout(() => {
    document.body.classList.add("slide-hide-cursor");
    const overlay = $("slideOverlay");
    if (overlay) overlay.classList.add("slide-hide-cursor");
    slideState.cursorTimer = null;
  }, 1000);
}

function limparTimerSlide() {
  if (slideState.timer) {
    clearTimeout(slideState.timer);
    slideState.timer = null;
  }
}

function limparIdleSlide() {
  if (slideState.idle) {
    clearTimeout(slideState.idle);
    slideState.idle = null;
  }
}

function limparAnimSlide() {
  if (slideState.animTimer) {
    clearTimeout(slideState.animTimer);
    slideState.animTimer = null;
  }
  if (slideState.animEl && slideState.onAnimEnd) {
    slideState.animEl.removeEventListener("animationend", slideState.onAnimEnd);
  }
  slideState.animEl = null;
  slideState.onAnimEnd = null;
}

function camadasSlide() {
  const stage = $("slideStage");
  if (!stage) return { stage: null, current: null, idle: null, all: [] };
  const all = Array.from(stage.querySelectorAll(".slide-inner"));
  const current = all.find((el) => el.classList.contains("is-current")) || all[0] || null;
  const idle = all.find((el) => el !== current) || null;
  return { stage, current, idle, all };
}

function garantirCamadasSlide() {
  const stage = $("slideStage");
  if (!stage) return;
  let layers = Array.from(stage.querySelectorAll(".slide-inner"));
  const first = layers[0];
  if (!first) return;
  first.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  if (layers.length < 2) {
    first.classList.add("is-current");
    const clone = first.cloneNode(true);
    clone.classList.remove("is-current", "is-in", "is-out", "is-leaving");
    clone.classList.add("is-idle");
    clone.hidden = true;
    clone.setAttribute("aria-hidden", "true");
    clone.removeAttribute("data-trans");
    clone.removeAttribute("data-accent");
    stage.appendChild(clone);
    layers = Array.from(stage.querySelectorAll(".slide-inner"));
  }
  if (!layers.some((el) => el.classList.contains("is-current"))) {
    layers[0].classList.add("is-current");
    layers[0].classList.remove("is-idle");
    layers[0].hidden = false;
  }
}

function sortearTransicaoSlide() {
  const pool = SLIDE_TRANSICOES.filter((nome) => nome !== slideState.lastTrans);
  const lista = pool.length ? pool : SLIDE_TRANSICOES;
  const nome = lista[Math.floor(Math.random() * lista.length)];
  slideState.lastTrans = nome;
  return nome;
}

function preencherCamadaSlide(layer, s) {
  if (!layer || !s) return;
  layer.dataset.accent = s.accent || "avalie2";
  const kicker = layer.querySelector(".slide-kicker");
  const title = layer.querySelector(".slide-title");
  const meta = layer.querySelector(".slide-meta");
  const value = layer.querySelector(".slide-value");
  const hint = layer.querySelector(".slide-hint");
  const rank = layer.querySelector(".slide-rank");
  if (kicker) kicker.textContent = s.kicker || "";
  if (title) title.textContent = s.title || "";
  if (meta) meta.textContent = s.meta || "";
  if (value) value.textContent = s.value || "—";
  if (hint) hint.textContent = s.hint || "";
  if (rank) rank.innerHTML = s.rank || "";
}

function limparClassesTransicao(el) {
  if (!el) return;
  el.classList.remove("is-in", "is-out", "is-leaving");
  el.removeAttribute("data-trans");
}

function finalizarTransicaoSlide() {
  limparAnimSlide();
  const { all } = camadasSlide();
  all.forEach((el) => {
    limparClassesTransicao(el);
    const visivel = el.classList.contains("is-current");
    el.classList.toggle("is-idle", !visivel);
    el.hidden = !visivel;
    el.setAttribute("aria-hidden", visivel ? "false" : "true");
  });
}

function armarFimTransicaoSlide(el) {
  const concluir = (ev) => {
    if (ev && ev.target !== el) return;
    finalizarTransicaoSlide();
  };
  slideState.onAnimEnd = concluir;
  slideState.animEl = el;
  el.addEventListener("animationend", concluir);
  slideState.animTimer = setTimeout(() => finalizarTransicaoSlide(), SLIDE_TRANS_MS);
}

function pintarSlide(s, comSaida) {
  if (!s) return;
  garantirCamadasSlide();
  finalizarTransicaoSlide();
  const { current, idle } = camadasSlide();
  if (!current) return;
  const trans = sortearTransicaoSlide();

  if (!comSaida || !idle) {
    preencherCamadaSlide(current, s);
    current.hidden = false;
    current.classList.remove("is-idle", "is-in", "is-out", "is-leaving");
    current.classList.add("is-current");
    current.setAttribute("aria-hidden", "false");
    if (idle) {
      idle.classList.remove("is-current", "is-in", "is-out", "is-leaving");
      idle.classList.add("is-idle");
      idle.hidden = true;
      idle.setAttribute("aria-hidden", "true");
    }
    void current.offsetWidth;
    current.dataset.trans = trans;
    current.classList.add("is-in");
    armarFimTransicaoSlide(current);
    return;
  }

  preencherCamadaSlide(idle, s);
  idle.hidden = false;
  idle.classList.remove("is-idle", "is-in", "is-out", "is-leaving");
  idle.classList.add("is-current");
  idle.setAttribute("aria-hidden", "false");
  current.classList.remove("is-current", "is-in", "is-out");
  current.classList.add("is-leaving");
  current.setAttribute("aria-hidden", "true");
  void idle.offsetWidth;
  void current.offsetWidth;
  idle.dataset.trans = trans;
  current.dataset.trans = trans;
  idle.classList.add("is-in");
  current.classList.add("is-out");
  armarFimTransicaoSlide(idle);
}

function proximoSlide() {
  if (!slideState.deck.length) return;
  let guard = 0;
  let s = slideState.deck[slideState.idx % slideState.deck.length];
  while (guard < slideState.deck.length && s && s.kind === slideState.lastKind && slideState.deck.length > 1) {
    slideState.idx += 1;
    s = slideState.deck[slideState.idx % slideState.deck.length];
    guard += 1;
  }
  slideState.idx = (slideState.idx + 1) % slideState.deck.length;
  if (slideState.idx === 0) slideState.deck = shuffleArr(slideState.deck);
  const comSaida = slideState.painted;
  slideState.painted = true;
  slideState.lastKind = s.kind;
  pintarSlide(s, comSaida);
}

function agendarProximoSlide() {
  limparTimerSlide();
  const ms = 8000 + Math.floor(Math.random() * 4001);
  slideState.timer = setTimeout(() => {
    proximoSlide();
    agendarProximoSlide();
  }, ms);
}

function sairModoSlide(opts) {
  if (!slideState.on) return;
  slideState.on = false;
  slideState.exitArmed = false;
  slideState.painted = false;
  slideState.lastTrans = "";
  limparTimerSlide();
  limparCursorSlide();
  finalizarTransicaoSlide();
  if (slideState.armTimer) {
    clearTimeout(slideState.armTimer);
    slideState.armTimer = null;
  }
  window.removeEventListener("click", onSaidaSlide, true);
  window.removeEventListener("keydown", onSaidaSlide, true);
  window.removeEventListener("mousemove", onSaidaSlide, true);
  window.removeEventListener("touchstart", onSaidaSlide, true);
  window.removeEventListener("pointerdown", onSaidaSlide, true);
  document.body.classList.remove("slide-mode");
  const overlay = $("slideOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
  }
  const btn = $("btnModoSlide");
  if (btn) btn.setAttribute("aria-pressed", "false");
  if (!opts || !opts.fromFsEvent) sairFullscreenSlide();
  armarIdleSlide();
}

function onSaidaSlide(ev) {
  if (!slideState.on) return;
  if (ev.type === "mousemove" && !slideState.exitArmed) return;
  sairModoSlide();
}

function onFullscreenChangeSlide() {
  if (!slideState.on) return;
  if (!estaEmFullscreen()) sairModoSlide({ fromFsEvent: true });
}

function entrarModoSlide(opts) {
  if (slideState.on) return;
  const overlay = $("slideOverlay");
  if (!overlay) return;
  slideState.deck = montarSlides();
  if (!slideState.deck.length) return;
  slideState.idx = 0;
  slideState.lastKind = "";
  slideState.lastTrans = "";
  slideState.painted = false;
  slideState.on = true;
  slideState.exitArmed = false;
  limparIdleSlide();
  limparTimerSlide();
  garantirCamadasSlide();
  finalizarTransicaoSlide();
  document.body.classList.add("slide-mode");
  overlay.classList.remove("hidden");
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  const btn = $("btnModoSlide");
  if (btn) btn.setAttribute("aria-pressed", "true");
  proximoSlide();
  agendarProximoSlide();
  armarCursorSlide();
  window.addEventListener("click", onSaidaSlide, true);
  window.addEventListener("keydown", onSaidaSlide, true);
  window.addEventListener("mousemove", onSaidaSlide, true);
  window.addEventListener("touchstart", onSaidaSlide, true);
  window.addEventListener("pointerdown", onSaidaSlide, true);
  if (slideState.armTimer) clearTimeout(slideState.armTimer);
  slideState.armTimer = setTimeout(() => {
    slideState.exitArmed = true;
    slideState.armTimer = null;
  }, 700);
  if (opts && opts.pedirFs) pedirFullscreenSlide();
}

function armarIdleSlide() {
  limparIdleSlide();
  if (slideState.on) return;
  if (document.body.classList.contains("capa-ativa")) return;
  slideState.idle = setTimeout(() => entrarModoSlide({ pedirFs: true }), 90000);
}

function onAtividadeSlide(ev) {
  if (slideState.on) return;
  if (document.body.classList.contains("capa-ativa")) return;
  if (ev.type === "mousemove") {
    const now = Date.now();
    if (now - slideState.lastMove < 1200) return;
    slideState.lastMove = now;
  }
  armarIdleSlide();
}

function setupModoSlide() {
  garantirCamadasSlide();
  const btn = $("btnModoSlide");
  if (btn) {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (slideState.on) {
        pedirFullscreenSlide();
        return;
      }
      entrarModoSlide();
      pedirFullscreenSlide();
    });
  }
  document.addEventListener("fullscreenchange", onFullscreenChangeSlide);
  document.addEventListener("webkitfullscreenchange", onFullscreenChangeSlide);
  document.addEventListener("MSFullscreenChange", onFullscreenChangeSlide);
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach((ev) => {
    document.addEventListener(ev, onAtividadeSlide, { passive: true });
  });
  document.addEventListener("mousemove", onAtividadeSlide, { passive: true });
  armarIdleSlide();
}

if (!DATA) {
  document.body.innerHTML = "<p style='padding:40px'>Arquivo dados.js não encontrado. Execute processar_dados.py.</p>";
} else {
  Chart.defaults.color = corCss("--text", "#e8f2f6");
  Chart.defaults.font.family = "DM Sans";
  window.addEventListener("beforeprint", rasterizarGraficosImpressao);
  window.addEventListener("afterprint", limparGraficosImpressao);
  setupTema();
  setupModoSlide();
  const selEd = $("selEdicaoAvalie");
  if (selEd) {
    selEd.value = state.edicao;
    selEd.addEventListener("change", () => setEdicaoAvalie(selEd.value));
  }
  atualizarNavEdicao();
  atualizarMetaFonte();
  setupFilters();
  setupFiltersSpaece();
  setupFiltersNotas();
  setupFiltersPar();
  setupFiltersIdeb();
  setupFiltersProto();
  setupFiltersSit();
  setupFiltersCartas();
  setupFiltersRank();
  setupFiltersRankGeral();
  setupFiltersLinha();
  setupFiltersConsulta();
  ["filtroAno", "filtroDisc", "filtroEscola"].forEach((id) => $(id).addEventListener("change", render));
  ["filtroAnoSp", "filtroDiscSp", "filtroEscolaSp"].forEach((id) => {
    if ($(id)) $(id).addEventListener("change", () => { if (state.page === "spaece") renderSpaece(); });
  });
  ["filtroAnoN1", "filtroDiscN1", "filtroEscolaN1"].forEach((id) => {
    if ($(id)) $(id).addEventListener("change", () => { if (state.page === "saep1") renderPainelNotas("saep1"); });
  });
  ["filtroAnoN2", "filtroDiscN2", "filtroEscolaN2"].forEach((id) => {
    if ($(id)) $(id).addEventListener("change", () => { if (state.page === "diag") renderPainelNotas("diag"); });
  });
  ["filtroAnoPar", "filtroDiscPar", "filtroEscolaPar"].forEach((id) => {
    if ($(id)) $(id).addEventListener("change", () => { if (state.page === "par") renderPar(); });
  });
  ["filtroEtapaIdeb", "filtroEscolaIdeb"].forEach((id) => {
    if ($(id)) $(id).addEventListener("change", () => { if (state.page === "ideb") renderIdeb(); });
  });
  ["filtroAnoProto", "filtroDiscProto", "filtroEscolaProto", "filtroTurmaProto"].forEach((id) => {
    if ($(id)) $(id).addEventListener("change", () => { if (state.page === "protocolo") renderProtocolo(); });
  });
  ["filtroAnoSit", "filtroDiscSit", "filtroEscolaSit"].forEach((id) => {
    if ($(id)) $(id).addEventListener("change", () => { if (state.page === "situacao") renderSituacao(); });
  });
  if ($("btnPrintSit")) $("btnPrintSit").addEventListener("click", imprimirSit);
  $("buscaAluno").addEventListener("input", () => renderAlunos(filteredAlunos()));
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    if (!btn.dataset.page) return;
    btn.addEventListener("click", () => goto(btn.dataset.page));
  });
  function abrirCorretorJanela(ev, realizar) {
    const versao = "eixo24";
    const url = realizar ? "corretor.html?realizar=1&v=" + versao : "corretor.html?v=" + versao;
    let janela = null;
    let reaproveitou = false;
    try {
      janela = window.open("", "avalieCorretor");
    } catch (e) {
      janela = null;
    }
    if (janela && !janela.closed) {
      try {
        const mesmaVersao = janela.CORRETOR_VER === versao;
        if (mesmaVersao && typeof janela.corretorIrPara === "function") {
          janela.corretorIrPara(!!realizar);
          janela.focus();
          reaproveitou = true;
        } else if (janela.location && !/^about:blank/i.test(String(janela.location.href || ""))) {
          janela.location.href = url;
          janela.focus();
          reaproveitou = true;
        }
      } catch (e) {
        reaproveitou = false;
      }
    }
    if (!reaproveitou) {
      try {
        janela = window.open(url, "avalieCorretor");
      } catch (e) {
        janela = null;
      }
    }
    if (janela) {
      ev.preventDefault();
      try { janela.focus(); } catch (e) { /* o link com target abre a mesma janela */ }
    }
  }
  const abrirCorretor = $("abrirCorretor");
  if (abrirCorretor) abrirCorretor.addEventListener("click", (ev) => abrirCorretorJanela(ev, false));
  const abrirRealizar = $("abrirRealizar");
  if (abrirRealizar) abrirRealizar.addEventListener("click", (ev) => abrirCorretorJanela(ev, true));
  const btnComp = $("btnComparar");
  if (btnComp) btnComp.addEventListener("click", () => goto("comparar"));
  const btnRank = $("btnRank");
  if (btnRank) btnRank.addEventListener("click", () => goto("rank"));
  const abrirCorretorCapa = $("abrirCorretorCapa");
  if (abrirCorretorCapa) abrirCorretorCapa.addEventListener("click", (ev) => abrirCorretorJanela(ev, false));
  const abrirRealizarCapa = $("abrirRealizarCapa");
  if (abrirRealizarCapa) abrirRealizarCapa.addEventListener("click", (ev) => abrirCorretorJanela(ev, true));
  document.querySelectorAll("[data-capa-page]").forEach((btn) => {
    btn.addEventListener("click", () => abrirPainelDaCapa(btn.dataset.capaPage));
  });
  document.querySelectorAll("[data-capa-edicao]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ed = btn.dataset.capaEdicao === "1" ? "1" : "2";
      if (!document.body.classList.contains("capa-ativa")) {
        setEdicaoAvalie(ed);
        return;
      }
      state.edicao = ed;
      try { localStorage.setItem("avalie-edicao", state.edicao); } catch (e) { /* ignore */ }
      const sel = $("selEdicaoAvalie");
      if (sel) sel.value = state.edicao;
      atualizarNavEdicao();
      atualizarMetaFonte();
      setupFilters();
    });
  });
  if ($("btnVoltarCapa")) $("btnVoltarCapa").addEventListener("click", mostrarCapa);
  document.querySelectorAll("[data-capa-grupo]").forEach((btn) => {
    btn.addEventListener("click", () => abrirGrupoCapa(btn.dataset.capaGrupo));
  });
  document.querySelectorAll("[data-capa-voltar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const destino = btn.dataset.capaVoltar || "capaCinco";
      if (destino === "capaCinco") mostrarCinco();
      else abrirGrupoCapa(destino);
    });
  });
  aplicarFotoCapa(0);
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setInterval(() => {
      if (!document.body.classList.contains("capa-ativa")) return;
      aplicarFotoCapa((capaFotoIdx + 1) % CAPA_FOTOS.length);
    }, 8000);
  }
}
