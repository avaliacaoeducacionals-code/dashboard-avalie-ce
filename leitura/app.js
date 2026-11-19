const NIVEIS = [
  { id: "NÃO LEITOR", grupo: "inicial", cor: "#8d6e63", desc: "Não reconhece letras ou não realiza leitura." },
  { id: "LETRAS", grupo: "inicial", cor: "#c47b4a", desc: "Reconhece letras isoladas." },
  { id: "SÍLABAS", grupo: "inicial", cor: "#c4960a", desc: "Realiza leitura silábica; leitura lenta, com segmentação excessiva." },
  { id: "PALAVRAS", grupo: "inicial", cor: "#5b8c3e", desc: "Lê palavras isoladas; dificuldade para leitura contínua de textos." },
  { id: "FRASES", grupo: "inicial", cor: "#2f7d6d", desc: "Lê frases simples, ainda sem sustentar um texto completo." },
  { id: "TEXTO", grupo: "texto", cor: "#1d6a8a", desc: "Consegue ler o texto completo; leitura acima de 1 minuto." },
  { id: "SF/SC", grupo: "texto", cor: "#c0392b", desc: "Lê o texto completo em mais de 1 minuto e responde parcialmente às perguntas." },
  { id: "SF/CC", grupo: "texto", cor: "#d4760a", desc: "Lê o texto completo em mais de 1 minuto e responde todas as perguntas corretamente." },
  { id: "CF/SC", grupo: "texto", cor: "#2e86ab", desc: "Lê o texto completo em até 1 minuto e responde parcialmente às perguntas." },
  { id: "CF/CC", grupo: "texto", cor: "#1e7a46", desc: "Lê o texto completo em até 1 minuto e responde todas as perguntas corretamente." },
];

const ORDEM_RELATORIO = {
  inicial: ["NÃO LEITOR", "LETRAS", "SÍLABAS", "PALAVRAS", "FRASES"],
  texto: ["TEXTO", "CF/CC", "CF/SC", "SF/CC", "SF/SC"],
};

const RANK = {
  "NÃO LEITOR": 1,
  LETRAS: 2,
  "SÍLABAS": 3,
  PALAVRAS: 4,
  FRASES: 5,
  TEXTO: 6,
  "SF/SC": 7,
  "CF/SC": 8,
  "SF/CC": 9,
  "CF/CC": 10,
};

const ESCRITA = {
  palavra: [
    { p: 1, nome: "Pré-silábico", desc: "Ainda não estabelece relação entre fala e escrita. Usa rabiscos, desenhos ou letras sem correspondência sonora." },
    { p: 2, nome: "Silábico", desc: "Representa cada sílaba com uma letra, nem sempre com correspondência sonora adequada." },
    { p: 3, nome: "Silábico-alfabético", desc: "Alterna hipóteses silábicas e alfabéticas e avança na correspondência entre som e letra." },
    { p: 4, nome: "Alfabético", desc: "Compreende o princípio alfabético, ainda que com erros ortográficos próprios da aprendizagem." },
  ],
  frase: [
    { p: 1, nome: "Não escreve", desc: "Não registra frases." },
    { p: 2, nome: "Escreve parcialmente", desc: "Registra frases incompletas ou com falhas." },
    { p: 3, nome: "Escreve corretamente", desc: "Registra frases completas e compreensíveis." },
  ],
  texto: [
    { p: 1, nome: "Não produz texto", desc: "Não elabora texto." },
    { p: 2, nome: "Produz parcialmente", desc: "Elabora texto incompleto ou com falhas." },
    { p: 3, nome: "Produz corretamente", desc: "Elabora texto completo e coerente." },
  ],
};

const TITULOS = {
  painel: "Painel da turma",
  leitura: "Lançar leitura",
  escrita: "Lançar escrita",
  alunos: "Alunos e turma",
  relatorio: "Relatório de consolidação",
};

const ui = {
  view: "painel",
  teste: 4,
  alunoLeitura: null,
  alunoEscrita: null,
  buscaLeitura: "",
  buscaEscrita: "",
  autoNext: localStorage.getItem("leitura-autoNext") !== "0",
  geral: false,
  testeManual: false,
};

let dados = null;
const filas = new Map();

function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function nivelInfo(id) {
  return NIVEIS.find((n) => n.id === id) || null;
}

function corNivel(id) {
  return (nivelInfo(id) || {}).cor || "#c8bfb2";
}

function visaoGeral() {
  return ui.geral === true;
}

function turmaConcreta() {
  return (dados.turmas || []).find((t) => t.id === ui.turmaId) || null;
}

function turmaAtual() {
  if (visaoGeral()) return null;
  return turmaConcreta();
}

function escolaAtual() {
  const turma = turmaAtual();
  if (!turma) return null;
  return (dados.escolas || []).find((e) => e.id === turma.escola_id) || null;
}

function turmasDoEscopo() {
  if (visaoGeral()) return (dados.turmas || []).filter((t) => t.ano === ui.ano);
  const turma = turmaAtual();
  return turma ? [turma] : [];
}

function listaAlunos() {
  const ids = new Set(turmasDoEscopo().map((t) => t.id));
  return dados.alunos.filter((a) => ids.has(a.turma_id));
}

function ativos() {
  return listaAlunos().filter((a) => a.status === "ativo");
}

function turmaDoAluno(aluno) {
  return (dados.turmas || []).find((t) => t.id === aluno.turma_id) || null;
}

function escolaDoAluno(aluno) {
  const turma = turmaDoAluno(aluno);
  if (!turma) return null;
  return (dados.escolas || []).find((e) => e.id === turma.escola_id) || null;
}

function nomeNoEscopo(aluno) {
  if (!visaoGeral()) return aluno.nome;
  const turma = turmaDoAluno(aluno);
  const escola = escolaDoAluno(aluno);
  const sala = turma ? `Turma ${turma.turma}` : "";
  const local = escola ? escola.nome : "";
  return [aluno.nome, sala, local].filter(Boolean).join(" · ");
}

function ordenarMapa(a, b) {
  if (!visaoGeral()) return porNumero(a, b);
  const ea = (escolaDoAluno(a) || {}).nome || "";
  const eb = (escolaDoAluno(b) || {}).nome || "";
  const ta = (turmaDoAluno(a) || {}).turma || "";
  const tb = (turmaDoAluno(b) || {}).turma || "";
  return ea.localeCompare(eb, "pt-BR")
    || String(ta).localeCompare(String(tb), "pt-BR")
    || porNumero(a, b);
}

function modoDaTurma(turma) {
  return turma && turma.modo_escrita === "producao" ? "producao" : "classica";
}

function modoAtual() {
  if (visaoGeral()) {
    const modos = new Set(turmasDoEscopo().map((t) => modoDaTurma(t)));
    if (modos.size === 1) return [...modos][0];
    if (!modos.size) return "classica";
    return "misto";
  }
  return modoDaTurma(turmaAtual());
}

function porNumero(a, b) {
  return a.numero - b.numero || a.nome.localeCompare(b.nome, "pt-BR");
}

function regLeitura(alunoId, teste) {
  return dados.leitura.find((r) => r.aluno_id === alunoId && r.teste === teste) || null;
}

function regEscrita(alunoId) {
  return dados.escrita.find((r) => r.aluno_id === alunoId) || null;
}

function formatTempo(segundos) {
  if (segundos == null || segundos === "") return "";
  const total = Number(segundos);
  if (!Number.isFinite(total) || total <= 0) return "";
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${min}:${String(seg).padStart(2, "0")}`;
}

function htmlTempoMapa(segundos) {
  const texto = formatTempo(segundos);
  if (!texto) return "";
  return `<span class="tempo-leitura">${esc(texto)}</span>`;
}

function parseTempo(texto) {
  const limpo = String(texto || "").trim();
  if (!limpo) return null;
  if (limpo.includes(":")) {
    const [min, seg] = limpo.split(":");
    const m = Number(min);
    const s = Number(seg);
    if (!Number.isInteger(m) || !Number.isInteger(s) || m < 0 || s < 0 || s > 59) return undefined;
    return m * 60 + s;
  }
  if (!/^\d+$/.test(limpo)) return undefined;
  const n = Number(limpo);
  if (n > 3600) return undefined;
  return n;
}

function dataBR(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function hojeBR() {
  return new Date().toLocaleDateString("pt-BR");
}

function enfileirar(chave, tarefa) {
  const anterior = filas.get(chave) || Promise.resolve();
  const atual = anterior.then(tarefa, tarefa);
  filas.set(chave, atual);
  return atual;
}

const CHAVE_LEITURA = "avalie-leitura-dados";
const NIVEIS_LEITURA = NIVEIS.map((n) => n.id);
const APELIDO_ESCOLA = {
  "eef alba laranjeira de albuquerque": "ALBA LARANJEIRA",
  "eef alice fernandes lopes": "ALICE LOPES",
  "eef francisco da silva filho": "FRANCISCO DA SILVA FILHO",
  "eef joaquim nogueira lopes": "VER JOAQUIM NOGUEIRA",
  "eef josé augusto carvalho": "JOSÉ AUGUSTO",
  "eef joão de castro e silva": "JOÃO DE CASTRO",
  "eef maria valcira": "MARIA VALCIRA",
  "eef pedro costa lima": "PEDRO COSTA",
  "eef virgílio de moraes fernandes tavora": "SEN VIRGÍLIO TÁVORA",
  "emti artur bandeira": "ARTUR BANDEIRA",
  "emti edite nogueira da costa": "PROF EDITE NOGUEIRA",
  "emti eldér gurgel souza moreira": "ELDER GURGEL",
  "emti esaú nogueira de queiroz": "ESAÚ NOGUEIRA",
  "emti francisco cosmo da silva": "FRANCISCO COSMO",
  "emti joaquim amâncio bezerra": "JOAQUIM AMÂNCIO",
  "emti joaquim tavares braga": "VER JOAQUIM TAVARES",
  "emti josé elton de lima": "JOSÉ ELTON",
  "emti josé geraldo filho": "JOSÉ GERALDO",
  "emti joão ronaldo matias": "JOÃO RONALDO",
  "emti maria do carmo de sousa lope": "PROF MARIA DO CARMO",
  "emti nazaré farias de lima": "NAZARÉ FARIAS",
  "emti professora hermínia mendonça de queiroz": "HERMÍNIA MENDONÇA",
  "emti quilombola raimundo agostinho da silva": "RAIMUNDO AGOSTINHO",
  "emti senador carlos jereissati": "SEN CARLOS JEREISSATI",
};

let arquivoLeitura = null;
let recorteEscola = false;

function sessaoLeitura() {
  try { return JSON.parse(sessionStorage.getItem("avalie-leitura") || "null"); }
  catch (e) { return null; }
}

function baseVazia() {
  if (window.LEITURA_BASE && Array.isArray(window.LEITURA_BASE.alunos)) {
    return JSON.parse(JSON.stringify(window.LEITURA_BASE));
  }
  return {
    config: { ano_letivo: "2026" },
    escolas: [],
    turmas: [],
    testes: [1, 2, 3, 4, 5].map((n) => ({ numero: n, nome: `${n}º teste`, data: null })),
    alunos: [],
    leitura: [],
    escrita: [],
  };
}

function carregarArquivo() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_LEITURA) || "null");
    if (salvo && Array.isArray(salvo.alunos) && Array.isArray(salvo.turmas)) return salvo;
  } catch (e) { /* usa a base deste computador */ }
  return baseVazia();
}

function persistirLeitura() {
  if (!arquivoLeitura) return;
  if (!recorteEscola) {
    localStorage.setItem(CHAVE_LEITURA, JSON.stringify(dados));
    arquivoLeitura = dados;
    return;
  }
  const turmaIds = new Set((dados.turmas || []).map((t) => t.id));
  const ids = new Set([
    ...(arquivoLeitura.alunos || []).filter((a) => turmaIds.has(a.turma_id)).map((a) => a.id),
    ...(dados.alunos || []).map((a) => a.id),
  ]);
  arquivoLeitura.alunos = (arquivoLeitura.alunos || []).filter((a) => !turmaIds.has(a.turma_id)).concat(dados.alunos || []);
  arquivoLeitura.leitura = (arquivoLeitura.leitura || []).filter((r) => !ids.has(r.aluno_id)).concat(dados.leitura || []);
  arquivoLeitura.escrita = (arquivoLeitura.escrita || []).filter((r) => !ids.has(r.aluno_id)).concat(dados.escrita || []);
  arquivoLeitura.testes = dados.testes;
  arquivoLeitura.config = dados.config;
  localStorage.setItem(CHAVE_LEITURA, JSON.stringify(arquivoLeitura));
}

function recortarPorEscola(origem) {
  const sessao = sessaoLeitura();
  if (!sessao || sessao.mestre || !sessao.escola) return origem;
  const apelido = APELIDO_ESCOLA[String(sessao.escola).trim().toLocaleLowerCase("pt-BR")];
  const escola = apelido
    ? (origem.escolas || []).find((e) => e.nome === apelido)
    : null;
  if (!escola) {
    return {
      config: origem.config || { ano_letivo: "2026" },
      escolas: [],
      turmas: [],
      testes: origem.testes || [],
      alunos: [],
      leitura: [],
      escrita: [],
    };
  }
  const turmas = (origem.turmas || []).filter((t) => t.escola_id === escola.id);
  const turmaIds = new Set(turmas.map((t) => t.id));
  const alunos = (origem.alunos || []).filter((a) => turmaIds.has(a.turma_id));
  const alunoIds = new Set(alunos.map((a) => a.id));
  return {
    config: origem.config || { ano_letivo: "2026" },
    escolas: [escola],
    turmas,
    testes: origem.testes || [],
    alunos,
    leitura: (origem.leitura || []).filter((r) => alunoIds.has(r.aluno_id)),
    escrita: (origem.escrita || []).filter((r) => alunoIds.has(r.aluno_id)),
  };
}

function inteiroOuNulo(valor, nome, minimo, maximo) {
  if (valor == null || valor === "") return null;
  if (typeof valor !== "number" || !Number.isInteger(valor)) throw new Error(`${nome} inválido.`);
  if (valor < minimo || valor > maximo) throw new Error(`${nome} fora da faixa esperada.`);
  return valor;
}

function flagLeitura(valor) {
  return valor === 1 || valor === true || valor === "1" ? 1 : 0;
}

function exigirAluno(alunoId) {
  if (!dados.alunos.some((a) => a.id === alunoId)) throw new Error("Aluno não encontrado.");
}

function salvarLeituraApi(payload) {
  const alunoId = payload.aluno_id;
  const teste = payload.teste;
  if (!Number.isInteger(alunoId) || !Number.isInteger(teste) || teste < 1 || teste > 5) {
    throw new Error("Informe o aluno e o teste (1 a 5).");
  }
  let nivel = payload.nivel === "" ? null : payload.nivel;
  if (nivel != null && !NIVEIS_LEITURA.includes(nivel)) throw new Error("Nível de leitura não reconhecido.");
  const tempo = inteiroOuNulo(payload.tempo_segundos, "Tempo", 0, 60 * 60);
  const faltou = flagLeitura(payload.faltou);
  if (faltou) nivel = null;
  exigirAluno(alunoId);
  return { aluno_id: alunoId, teste, nivel, tempo_segundos: tempo, faltou };
}

function salvarEscritaApi(payload) {
  const alunoId = payload.aluno_id;
  if (!Number.isInteger(alunoId)) throw new Error("Informe o aluno.");
  exigirAluno(alunoId);
  return {
    aluno_id: alunoId,
    pontos_palavra: inteiroOuNulo(payload.pontos_palavra, "Escrita de palavra", 1, 4),
    pontos_frase: inteiroOuNulo(payload.pontos_frase, "Escrita de frase", 1, 3),
    pontos_texto: inteiroOuNulo(payload.pontos_texto, "Escrita de texto", 1, 3),
    pontos_linhas: inteiroOuNulo(payload.pontos_linhas, "Texto até 5 linhas", 1, 3),
    pontos_legivel: inteiroOuNulo(payload.pontos_legivel, "Letra legível", 1, 3),
    pontos_coerencia: inteiroOuNulo(payload.pontos_coerencia, "Coerência", 1, 3),
    pontos_genero: inteiroOuNulo(payload.pontos_genero, "Gênero", 1, 3),
    faltou: flagLeitura(payload.faltou),
  };
}

function salvarAlunoApi(payload, alunoId) {
  const nome = String(payload.nome || "").trim();
  if (!nome || nome.length > 120) throw new Error("Informe o nome do aluno.");
  const numero = payload.numero;
  if (!Number.isInteger(numero) || numero < 1 || numero > 200) throw new Error("Informe o número do aluno.");
  const status = payload.status || "ativo";
  if (status !== "ativo" && status !== "transferido") throw new Error("Situação inválida.");
  const nee = flagLeitura(payload.nee);
  const turmaId = payload.turma_id;
  if (alunoId == null) {
    if (!Number.isInteger(turmaId) || !dados.turmas.some((t) => t.id === turmaId)) {
      throw new Error("Escolha a turma antes de adicionar o aluno.");
    }
    const ids = []
      .concat((arquivoLeitura && arquivoLeitura.alunos) || [], dados.alunos || [])
      .map((a) => a.id);
    const id = (ids.length ? Math.max(...ids) : 0) + 1;
    return { id, turma_id: turmaId, numero, nome: nome.toUpperCase(), nee, status };
  }
  exigirAluno(alunoId);
  const atual = dados.alunos.find((a) => a.id === alunoId);
  return {
    id: alunoId,
    turma_id: Number.isInteger(turmaId) ? turmaId : atual.turma_id,
    numero,
    nome: nome.toUpperCase(),
    nee,
    status,
  };
}

function salvarTesteApi(numero, payload) {
  if (numero < 1 || numero > 5) throw new Error("Teste inválido.");
  let nome = String(payload.nome || "").trim() || `${numero}º teste`;
  if (nome.length > 40) throw new Error("Nome do teste longo demais.");
  let data = payload.data || null;
  if (data === "") data = null;
  if (data != null) {
    const partes = String(data).split("-");
    if (partes.length !== 3 || partes.some((p) => !/^\d+$/.test(p))) throw new Error("Data inválida.");
  }
  return { numero, nome, data };
}

async function api(method, url, body) {
    if (method === "GET" && url === "/api/dados") return dados;
    if (method === "PUT" && url === "/api/leitura") return salvarLeituraApi(body || {});
    if (method === "PUT" && url === "/api/escrita") return salvarEscritaApi(body || {});
    if (method === "POST" && url === "/api/alunos") return salvarAlunoApi(body || {});
    if (method === "PUT" && url.startsWith("/api/alunos/")) {
      return salvarAlunoApi(body || {}, Number(url.slice(url.lastIndexOf("/") + 1)));
    }
    if (method === "DELETE" && url.startsWith("/api/alunos/")) {
      const id = Number(url.slice(url.lastIndexOf("/") + 1));
      exigirAluno(id);
      return { ok: true };
    }
    if (method === "PUT" && url.startsWith("/api/testes/")) {
      return salvarTesteApi(Number(url.slice(url.lastIndexOf("/") + 1)), body || {});
    }
    throw new Error("Não foi possível concluir.");
}

function avisar(texto, erro) {
  const el = document.getElementById("aviso-salvar");
  el.textContent = texto;
  el.style.color = erro ? "var(--bad)" : "var(--good)";
}

function aplicarMarca() {
  if (dados && dados.testes) testeEscolhido();
  const geral = visaoGeral();
  const turma = turmaAtual();
  const escola = escolaAtual();
  const titulo = document.getElementById("topo-titulo");
  const tituloGeral = `Resultado geral do ${ui.ano}º ano — ${nomeTeste(ui.teste)} — todas as escolas`;
  document.getElementById("marca-turma").textContent = geral
    ? `Geral do ${ui.ano}º ano`
    : (turma ? turma.rotulo : "Turma");
  document.getElementById("topo-escola").textContent = geral
    ? `Todas as escolas · ${dados.config.ano_letivo || ""}`
    : (escola ? `${escola.nome} · ${dados.config.ano_letivo || ""}` : "Escola");
  const usaTituloGeral = geral && (ui.view === "painel" || ui.view === "relatorio");
  titulo.textContent = usaTituloGeral ? tituloGeral : TITULOS[ui.view];
  titulo.classList.toggle("titulo-longo", usaTituloGeral);
  document.title = usaTituloGeral ? tituloGeral : "Painel de Leitura e Escrita";
}

function mostrar(view) {
  ui.view = view;
  document.querySelectorAll(".menu button").forEach((b) => {
    b.classList.toggle("ativo", b.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((secao) => {
    secao.classList.toggle("oculto", secao.id !== `view-${view}`);
  });
  aplicarMarca();
  if (view === "painel") renderPainel();
  if (view === "leitura") renderLeitura();
  if (view === "escrita") renderEscrita();
  if (view === "alunos") renderAlunos();
  if (view === "relatorio") renderRelatorio();
}

function consolidarLeitura(teste) {
  const base = ativos();
  const faltas = [];
  const sem = [];
  const com = [];
  base.forEach((aluno) => {
    const reg = regLeitura(aluno.id, teste);
    if (reg && reg.faltou) faltas.push(aluno);
    else if (reg && reg.nivel) com.push({ aluno, reg });
    else sem.push(aluno);
  });
  const contar = (ids) => ids.map((id) => ({
    id,
    cor: corNivel(id),
    total: com.filter((item) => item.reg.nivel === id).length,
  }));
  return {
    matriculados: base.length,
    faltas,
    sem,
    com,
    avaliados: base.length - faltas.length,
    inicial: contar(ORDEM_RELATORIO.inicial),
    texto: contar(ORDEM_RELATORIO.texto),
  };
}

function ultimoNivel(alunoId) {
  const regs = dados.leitura
    .filter((r) => r.aluno_id === alunoId && r.nivel && !r.faltou)
    .sort((a, b) => b.teste - a.teste);
  return regs[0] || null;
}

function movimento(antes, depois) {
  if (!antes || !depois || !RANK[antes] || !RANK[depois]) return null;
  if (RANK[depois] > RANK[antes]) return "avancou";
  if (RANK[depois] < RANK[antes]) return "recuou";
  return "manteve";
}

function nivelEscrita(total, completo, modo) {
  if (!total) return null;
  const producao = (modo || modoAtual()) === "producao";
  let nome = "Nível inicial";
  if (producao) {
    if (total >= 11) nome = "Avançado";
    else if (total >= 8) nome = "Intermediário";
    else if (total >= 5) nome = "Em desenvolvimento";
  } else if (total >= 9) nome = "Avançado";
  else if (total >= 7) nome = "Intermediário";
  else if (total >= 5) nome = "Em desenvolvimento";
  return completo ? nome : `${nome} (parcial)`;
}

function pontosEscrita(reg, modo) {
  const escolhido = modo || modoAtual();
  const producao = escolhido === "producao";
  if (!reg || reg.faltou) return { total: 0, completo: false, partes: 0, modo: escolhido };
  const valores = (producao
    ? [reg.pontos_linhas, reg.pontos_legivel, reg.pontos_coerencia, reg.pontos_genero]
    : [reg.pontos_palavra, reg.pontos_frase, reg.pontos_texto]).filter((n) => n != null);
  return {
    total: valores.reduce((s, n) => s + n, 0),
    completo: valores.length === (producao ? 4 : 3),
    partes: valores.length,
    modo: escolhido,
  };
}

function barras(itens, denominador) {
  if (!denominador) {
    return `<p class="nota">Sem resultados neste grupo.</p>`;
  }
  return itens.map((item) => {
    const pct = Math.round((item.total / denominador) * 100);
    return `<div class="barra-linha">
      <span>${esc(item.id)}</span>
      <div class="trilho" title="${item.total} aluno(s)"><span style="width:${pct}%;background:${item.cor}"></span></div>
      <b>${item.total}</b>
    </div>`;
  }).join("");
}

function htmlBarrasLeitura(bloco) {
  const denominador = bloco.com.length || 1;
  return `<div class="grupo-barras"><h4>Leitura inicial</h4>${barras(bloco.inicial, bloco.com.length ? denominador : 0)}</div>
    <div class="grupo-barras"><h4>Leitura de texto</h4>${barras(bloco.texto, bloco.com.length ? denominador : 0)}</div>`;
}

function renderPainel() {
  const teste = testeEscolhido();
  const bloco = consolidarLeitura(teste);
  const nee = ativos().filter((a) => a.nee).length;
  const transferidos = listaAlunos().filter((a) => a.status === "transferido").length;
  const escritaResumo = resumoEscrita();
  const geral = visaoGeral();
  const nTurmas = turmasDoEscopo().length;
  const nEscolas = new Set(turmasDoEscopo().map((t) => t.escola_id)).size;
  const rotuloTeste = esc(nomeTeste(teste));
  const chamada = geral
    ? `Resultado geral do ${ui.ano}º ano no ${rotuloTeste}: ${nEscolas} escolas e ${nTurmas} turmas somadas. O lançamento continua em uma turma.`
    : "Escolha a escola, o ano, a turma e o teste. O nível entra na consolidação assim que você clica.";
  const rodape = geral
    ? `Todas as escolas · ${ui.ano}º ano · ${rotuloTeste} · ${nEscolas} escolas · ${nTurmas} turmas. Nos nomes repetidos, a turma e a escola aparecem juntas.`
    : `${escolaAtual() ? esc(escolaAtual().nome) : ""} · ${turmaAtual() ? esc(turmaAtual().rotulo) : ""} · ${rotuloTeste}. Nomes com PCD, NEE ou TEA já entram marcados. Os demais casos de NEE podem ser marcados em Alunos e turma.`;

  document.getElementById("view-painel").innerHTML = `
    <div class="chamada">${chamada}</div>
    <div class="grade grade-4">
      ${stat("Matriculados", bloco.matriculados, geral ? `${nEscolas} escolas · ${nTurmas} turmas` : "alunos ativos")}
      ${stat("Com resultado", bloco.com.length, nomeTeste(teste))}
      ${stat("Faltas", bloco.faltas.length, nomeTeste(teste))}
      ${stat("NEE", nee, transferidos ? `${transferidos} transferido(s)` : "marque na ficha do aluno")}
    </div>
    <div class="grade grade-2" style="margin-top:14px">
      <article class="cartao">
        <h2>${rotuloTeste}</h2>
        ${bloco.com.length ? htmlBarrasLeitura(bloco) : `<p class="vazio">Ainda não há leitura lançada.</p>`}
        <p class="nota" style="margin-top:10px">${bloco.sem.length ? `${bloco.sem.length} aluno(s) ativo(s) ainda sem lançamento neste teste.` : "Todos os alunos ativos têm lançamento ou falta neste teste."}</p>
      </article>
      <article class="cartao">
        ${htmlSituacaoLeitura(teste)}
      </article>
    </div>
    <article class="cartao" style="margin-top:14px">
      <h3>Escrita</h3>
      ${escritaResumo.html}
    </article>
    <p class="nota" style="margin-top:12px">${rodape}</p>
  `;
}

function stat(rotulo, valor, detalhe) {
  return `<article class="cartao stat"><em>${esc(rotulo)}</em><strong>${valor}</strong><span>${esc(detalhe)}</span></article>`;
}

function etiquetaLista(titulo, nomes, classe) {
  const miolo = nomes.length
    ? nomes.map((n) => `<span class="etiqueta ${classe}">${esc(n)}</span>`).join("")
    : `<span class="nota">Ninguém.</span>`;
  return `<strong>${esc(titulo)} (${nomes.length})</strong><div class="lista-nomes" style="margin-top:6px">${miolo}</div>`;
}

function ultimoTesteComDados() {
  const ids = new Set(listaAlunos().map((a) => a.id));
  const conhecidos = new Set((dados.testes || []).map((t) => t.numero));
  const usados = dados.leitura
    .filter((r) => ids.has(r.aluno_id) && conhecidos.has(r.teste) && (r.nivel || r.faltou))
    .map((r) => r.teste);
  return usados.length ? Math.max(...usados) : null;
}

function testeExiste(numero) {
  return (dados.testes || []).some((t) => t.numero === numero);
}

function nomeTeste(numero) {
  const teste = (dados.testes || []).find((t) => t.numero === numero);
  return teste ? teste.nome : `${numero}º teste`;
}

function testeTemDados(numero) {
  const ids = new Set(listaAlunos().map((a) => a.id));
  return dados.leitura.some((r) => ids.has(r.aluno_id) && r.teste === numero && (r.nivel || r.faltou));
}

function testeEscolhido() {
  if (testeExiste(ui.teste)) return ui.teste;
  ui.teste = ultimoTesteComDados() || ((dados.testes[0] || {}).numero || 1);
  return ui.teste;
}

function ajustarTesteAoEscopo() {
  if (ui.testeManual && testeExiste(ui.teste)) return;
  if (testeExiste(ui.teste) && testeTemDados(ui.teste)) return;
  const recente = ultimoTesteComDados();
  if (recente) ui.teste = recente;
  else if (!testeExiste(ui.teste)) ui.teste = (dados.testes[0] || {}).numero || 1;
}

function testesDoMapa() {
  const escolhido = testeEscolhido();
  if (!visaoGeral()) return dados.testes;
  const numeros = new Set([escolhido]);
  if (escolhido > 1) numeros.add(escolhido - 1);
  return dados.testes.filter((t) => numeros.has(t.numero));
}

function htmlCelulaMapa(aluno, numero, selecionado) {
  const reg = regLeitura(aluno.id, numero);
  const tempo = htmlTempoMapa(reg && reg.tempo_segundos);
  const classes = selecionado ? "celula-mapa col-teste-sel" : "celula-mapa";
  if (aluno.status === "transferido" && !(reg && (reg.nivel || reg.faltou || tempo))) {
    return `<td class="${classes} nota">—</td>`;
  }
  if (reg && reg.faltou) return `<td class="${classes}"><span class="etiqueta falta">Falta</span>${tempo}</td>`;
  if (reg && reg.nivel) {
    return `<td class="${classes}"><span class="pill" style="background:${corNivel(reg.nivel)};color:white">${esc(reg.nivel)}</span>${tempo}</td>`;
  }
  if (tempo) return `<td class="${classes}">${tempo}</td>`;
  return `<td class="${classes} nota">—</td>`;
}

function compararComAnterior(teste) {
  const grupos = { avancou: [], manteve: [], recuou: [] };
  if (teste <= 1) return grupos;
  ativos().forEach((aluno) => {
    const atual = regLeitura(aluno.id, teste);
    const anterior = regLeitura(aluno.id, teste - 1);
    if (!atual || !anterior || atual.faltou || anterior.faltou || !atual.nivel || !anterior.nivel) return;
    const tipo = movimento(anterior.nivel, atual.nivel);
    if (tipo) grupos[tipo].push(nomeNoEscopo(aluno));
  });
  return grupos;
}

function htmlAindaNaoLeitor(teste) {
  const iniciais = consolidarLeitura(teste).com
    .filter((item) => item.reg.nivel === "NÃO LEITOR" || item.reg.nivel === "LETRAS")
    .map((item) => nomeNoEscopo(item.aluno));
  const miolo = iniciais.length
    ? iniciais.map((n) => `<span class="etiqueta">${esc(n)}</span>`).join("")
    : `<span class="nota">Nenhum neste teste.</span>`;
  return `<h3 style="margin-top:16px">Ainda em não leitor ou letras</h3>
    <div class="lista-nomes" style="margin-top:8px">${miolo}</div>`;
}

function htmlSituacaoLeitura(teste) {
  if (teste <= 1) return htmlAindaNaoLeitor(teste);
  const pares = compararComAnterior(teste);
  return `<h3>Do ${esc(nomeTeste(teste - 1))} para o ${esc(nomeTeste(teste))}</h3>
    <p class="nota">A comparação usa uma ordem pedagógica: compreensão completa fica acima de compreensão parcial e, no mesmo tipo de compreensão, a leitura em até 1 minuto fica acima.</p>
    <p style="margin:12px 0">${etiquetaLista("Avançaram", pares.avancou, "ok")}</p>
    <p style="margin:12px 0">${etiquetaLista("Permaneceram", pares.manteve, "")}</p>
    <p style="margin:12px 0">${etiquetaLista("Recuaram", pares.recuou, "queda")}</p>
    ${htmlAindaNaoLeitor(teste)}`;
}

function resumoEscrita() {
  const linhas = [];
  ativos().forEach((aluno) => {
    const reg = regEscrita(aluno.id);
    if (!reg || reg.faltou) return;
    const modo = modoDaTurma(turmaDoAluno(aluno));
    const info = pontosEscrita(reg, modo);
    if (!info.partes) return;
    linhas.push({ aluno, reg, info, nivel: nivelEscrita(info.total, info.completo, modo) });
  });
  if (!linhas.length) {
    return { html: `<p class="nota">Nenhum resultado de escrita lançado. As planilhas de escrita vieram sem pontuação.</p>` };
  }
  const faixas = ["Nível inicial", "Em desenvolvimento", "Intermediário", "Avançado"];
  const completos = linhas.filter((l) => l.info.completo);
  const barrasNivel = faixas.map((nome) => {
    const total = completos.filter((l) => l.nivel === nome).length;
    return { id: nome, total, cor: "var(--teal)" };
  });
  return {
    html: `<p class="nota">${linhas.length} aluno(s) com algum lançamento · ${completos.length} avaliação(ões) completa(s).</p>
      <div style="margin-top:10px">${barras(barrasNivel, completos.length)}</div>`,
  };
}

function renderLeitura() {
  const raiz = document.getElementById("view-leitura");
  if (visaoGeral()) {
    delete raiz.dataset.pronto;
    raiz.innerHTML = htmlEscolherTurma("O lançamento de leitura");
    ligarEscolherTurma(raiz);
    return;
  }
  if (!raiz.dataset.pronto) {
    raiz.dataset.pronto = "1";
    raiz.innerHTML = `
      <div class="toolbar no-print">
        <div class="abas" id="abas-teste"></div>
        <label class="campo">Data do teste
          <input type="date" id="data-teste">
        </label>
        <label class="campo">Buscar
          <input class="busca" id="busca-leitura" placeholder="Nome do aluno">
        </label>
        <label class="check"><input type="checkbox" id="auto-next"> Ir ao próximo em branco</label>
      </div>
      <p class="progresso" id="progresso-leitura"></p>
      <div class="grade grade-split" id="corpo-leitura"></div>
    `;
    document.getElementById("busca-leitura").addEventListener("input", (ev) => {
      ui.buscaLeitura = ev.target.value;
      const antes = ui.alunoLeitura;
      pintarListaLeitura();
      if (ui.alunoLeitura !== antes) pintarEditorLeitura();
    });
    document.getElementById("auto-next").addEventListener("change", (ev) => {
      ui.autoNext = ev.target.checked;
      localStorage.setItem("leitura-autoNext", ev.target.checked ? "1" : "0");
    });
    document.getElementById("data-teste").addEventListener("change", salvarDataTeste);
  }
  document.getElementById("auto-next").checked = ui.autoNext;
  document.getElementById("busca-leitura").value = ui.buscaLeitura;
  pintarAbas();
  pintarListaLeitura();
  pintarEditorLeitura();
}

function pintarAbas() {
  document.getElementById("abas-teste").innerHTML = dados.testes.map((teste) =>
    `<button type="button" data-teste="${teste.numero}" class="${teste.numero === ui.teste ? "ativo" : ""}">${esc(teste.nome)}</button>`
  ).join("");
  document.getElementById("abas-teste").onclick = (ev) => {
    const botao = ev.target.closest("button");
    if (!botao) return;
    ui.teste = Number(botao.dataset.teste);
    ui.testeManual = true;
    ui.alunoLeitura = null;
    const selTeste = document.getElementById("sel-teste");
    if (selTeste) selTeste.value = String(ui.teste);
    pintarAbas();
    pintarListaLeitura();
    pintarEditorLeitura();
  };
  const teste = dados.testes.find((t) => t.numero === ui.teste);
  document.getElementById("data-teste").value = teste && teste.data ? teste.data : "";
}

async function salvarDataTeste(ev) {
  const teste = dados.testes.find((t) => t.numero === ui.teste);
  try {
    const salvo = await api("PUT", `/api/testes/${ui.teste}`, { nome: teste.nome, data: ev.target.value });
    Object.assign(teste, salvo);
    persistirLeitura();
    avisar("Data salva");
  } catch (erro) {
    avisar(erro.message, true);
  }
}

function alunosFiltrados(busca) {
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  return listaAlunos().sort(porNumero).filter((aluno) =>
    !termo || aluno.nome.toLocaleLowerCase("pt-BR").includes(termo)
  );
}

function pintarListaLeitura() {
  const bloco = consolidarLeitura(ui.teste);
  document.getElementById("progresso-leitura").innerHTML =
    `<b>${bloco.com.length}</b> com resultado · <b>${bloco.faltas.length}</b> faltas · <b>${bloco.sem.length}</b> em branco`;
  const lista = alunosFiltrados(ui.buscaLeitura);
  if (!lista.some((a) => a.id === ui.alunoLeitura)) {
    const pendente = lista.find((a) => a.status === "ativo" && !lancado(a.id));
    ui.alunoLeitura = (pendente || lista[0] || {}).id || null;
  }
  const html = lista.map((aluno) => {
    const reg = regLeitura(aluno.id, ui.teste);
    let pill = "em branco";
    let cor = "#efe7db";
    let letra = "#5d6b64";
    if (aluno.status === "transferido") {
      pill = "transferido";
    } else if (reg && reg.faltou) {
      pill = "faltou";
      cor = "#fde8e4";
      letra = "#a33b32";
    } else if (reg && reg.nivel) {
      pill = reg.nivel;
      cor = corNivel(reg.nivel);
      letra = "white";
    }
    return `<button type="button" class="item-aluno ${aluno.id === ui.alunoLeitura ? "sel" : ""} ${aluno.status === "transferido" ? "dim" : ""}" data-id="${aluno.id}">
      <span class="num">${aluno.numero}</span>
      <span>${esc(aluno.nome)}${aluno.nee ? `<small>NEE</small>` : ""}</span>
      <span class="pill" style="background:${cor};color:${letra}">${esc(pill)}</span>
    </button>`;
  }).join("");
  const corpo = document.getElementById("corpo-leitura");
  let coluna = document.getElementById("lista-leitura");
  if (!coluna) {
    corpo.innerHTML = `<div class="lista-alunos" id="lista-leitura"></div><article class="cartao editor" id="editor-leitura"></article>`;
    coluna = document.getElementById("lista-leitura");
    coluna.addEventListener("click", (ev) => {
      const item = ev.target.closest(".item-aluno");
      if (!item) return;
      ui.alunoLeitura = Number(item.dataset.id);
      pintarListaLeitura();
      pintarEditorLeitura();
    });
  }
  coluna.innerHTML = html || `<p class="vazio">Nenhum aluno encontrado.</p>`;
}

function lancado(alunoId) {
  const reg = regLeitura(alunoId, ui.teste);
  return !!(reg && (reg.faltou || reg.nivel));
}

function pintarEditorLeitura() {
  const editor = document.getElementById("editor-leitura");
  if (!editor) return;
  const aluno = dados.alunos.find((a) => a.id === ui.alunoLeitura);
  if (!aluno) {
    editor.innerHTML = `<p class="vazio">Cadastre um aluno para lançar.</p>`;
    return;
  }
  const reg = regLeitura(aluno.id, ui.teste) || { nivel: null, tempo_segundos: null, faltou: 0 };
  const info = nivelInfo(reg.nivel);
  const chips = (grupo) => NIVEIS.filter((n) => n.grupo === grupo).map((n) =>
    `<button type="button" class="chip ${reg.nivel === n.id ? "sel" : ""}" data-nivel="${esc(n.id)}" style="${reg.nivel === n.id ? `background:${n.cor}` : ""}">${esc(n.id)}</button>`
  ).join("");
  editor.innerHTML = `
    <h3>${aluno.numero}. ${esc(aluno.nome)}</h3>
    <p class="meta">${ui.teste}º teste${aluno.nee ? " · NEE" : ""}${aluno.status === "transferido" ? " · transferido, fora da consolidação" : ""}</p>
    <div class="blocos-nivel">
      <div class="bloco"><h4>Leitura inicial</h4><div class="chips">${chips("inicial")}</div></div>
      <div class="bloco"><h4>Leitura de texto</h4><div class="chips">${chips("texto")}</div></div>
    </div>
    <p class="desc-nivel">${info ? esc(info.desc) : "Escolha o nível observado. SF = mais de 1 minuto. CF = até 1 minuto. SC = compreensão parcial. CC = compreensão completa."}</p>
    <div class="linha-tempo">
      <label class="campo tempo">Tempo (min:seg)
        <input id="campo-tempo" inputmode="numeric" placeholder="1:25" value="${esc(formatTempo(reg.tempo_segundos))}" ${reg.faltou ? "disabled" : ""}>
      </label>
      <button type="button" id="btn-falta" class="btn-claro btn-falta ${reg.faltou ? "ativo" : ""}">${reg.faltou ? "Faltou neste teste" : "Marcar falta"}</button>
      <button type="button" id="btn-limpar" class="btn-claro">Limpar lançamento</button>
    </div>
    <div id="aviso-tempo"></div>
  `;
  editor.querySelectorAll("[data-nivel]").forEach((botao) => {
    botao.addEventListener("click", () => escolherNivel(aluno.id, botao.dataset.nivel));
  });
  document.getElementById("btn-falta").addEventListener("click", () => marcarFalta(aluno.id, reg.faltou ? 0 : 1));
  document.getElementById("btn-limpar").addEventListener("click", () => limparLeitura(aluno.id));
  const campo = document.getElementById("campo-tempo");
  campo.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      campo.blur();
    }
  });
  campo.addEventListener("change", () => salvarTempo(aluno.id, campo));
  mostrarAvisoTempo(reg.nivel, reg.tempo_segundos);
}

function mostrarAvisoTempo(nivel, segundos) {
  const alvo = document.getElementById("aviso-tempo");
  if (!alvo || segundos == null || !nivel) {
    if (alvo) alvo.innerHTML = "";
    return;
  }
  const fluente = segundos <= 60;
  let texto = "";
  if (nivel.startsWith("CF") && !fluente) texto = "Este tempo passa de 1 minuto. Pela legenda, CF é a leitura feita em até 1 minuto.";
  if (nivel.startsWith("SF") && fluente) texto = "Este tempo está em até 1 minuto. Pela legenda, isso corresponde a CF (com fluência).";
  if (nivel === "TEXTO" && fluente) texto = "A legenda de TEXTO descreve leitura acima de 1 minuto.";
  alvo.innerHTML = texto ? `<p class="alerta-tempo">${esc(texto)}</p>` : "";
}

async function escolherNivel(alunoId, nivel) {
  const ok = await salvarLeitura(alunoId, { nivel, faltou: 0 });
  if (!ok) return;
  if (ui.autoNext) ui.alunoLeitura = proximoPendente(alunoId);
  pintarListaLeitura();
  pintarEditorLeitura();
}

async function marcarFalta(alunoId, faltou) {
  const ok = await salvarLeitura(alunoId, { faltou, nivel: faltou ? null : regNivelAtual(alunoId) });
  if (!ok) return;
  if (faltou && ui.autoNext) ui.alunoLeitura = proximoPendente(alunoId);
  pintarListaLeitura();
  pintarEditorLeitura();
}

function regNivelAtual(alunoId) {
  const reg = regLeitura(alunoId, ui.teste);
  return reg ? reg.nivel : null;
}

async function limparLeitura(alunoId) {
  const ok = await salvarLeitura(alunoId, { nivel: null, tempo_segundos: null, faltou: 0 });
  if (!ok) return;
  pintarListaLeitura();
  pintarEditorLeitura();
}

async function salvarTempo(alunoId, campo) {
  const tempo = parseTempo(campo.value);
  if (tempo === undefined) {
    avisar("Use minuto:segundo, como 1:25 ou 0:49.", true);
    return;
  }
  await salvarLeitura(alunoId, { tempo_segundos: tempo });
  campo.value = formatTempo(tempo);
  const reg = regLeitura(alunoId, ui.teste);
  mostrarAvisoTempo(reg && reg.nivel, tempo);
}

function proximoPendente(atualId) {
  const lista = ativos().slice().sort(porNumero);
  const inicio = Math.max(0, lista.findIndex((a) => a.id === atualId));
  for (let passo = 1; passo <= lista.length; passo += 1) {
    const aluno = lista[(inicio + passo) % lista.length];
    if (!lancado(aluno.id)) return aluno.id;
  }
  return atualId;
}

function salvarLeitura(alunoId, patch) {
  if (visaoGeral() || !turmaAtual()) {
    avisar("Escolha uma turma para lançar a leitura.", true);
    return Promise.resolve(false);
  }
  const teste = ui.teste;
  return enfileirar(`L${alunoId}-${teste}`, async () => {
    const atual = regLeitura(alunoId, teste) || {
      aluno_id: alunoId,
      teste,
      nivel: null,
      tempo_segundos: null,
      faltou: 0,
    };
    const proximo = { ...atual, ...patch, aluno_id: alunoId, teste };
    try {
      const salvo = await api("PUT", "/api/leitura", {
        aluno_id: proximo.aluno_id,
        teste: proximo.teste,
        nivel: proximo.nivel,
        tempo_segundos: proximo.tempo_segundos,
        faltou: proximo.faltou ? 1 : 0,
      });
      gravarLocalLeitura(salvo);
      avisar("Salvo");
      return true;
    } catch (erro) {
      avisar(erro.message, true);
      return false;
    }
  });
}

function gravarLocalLeitura(row) {
  const i = dados.leitura.findIndex((r) => r.aluno_id === row.aluno_id && r.teste === row.teste);
  if (i >= 0) dados.leitura[i] = row;
  else dados.leitura.push(row);
  persistirLeitura();
}

function renderEscrita() {
  const raiz = document.getElementById("view-escrita");
  if (visaoGeral()) {
    raiz.innerHTML = htmlEscolherTurma("O lançamento de escrita");
    ligarEscolherTurma(raiz);
    return;
  }
  raiz.innerHTML = `
    <div class="toolbar">
      <label class="campo">Buscar
        <input class="busca" id="busca-escrita" placeholder="Nome do aluno" value="${esc(ui.buscaEscrita)}">
      </label>
    </div>
    <p class="nota" style="margin-bottom:12px">${modoAtual() === "producao"
      ? "Produção textual: cada critério vale de 1 a 3. O total vai até 12. Até 4 é nível inicial, 5 a 7 em desenvolvimento, 8 a 10 intermediário, 11 e 12 avançado."
      : "Escrita: palavra de 1 a 4, frase de 1 a 3, texto de 1 a 3. O total vai até 10. Até 4 é nível inicial, 5 e 6 em desenvolvimento, 7 e 8 intermediário, 9 e 10 avançado."}</p>
    <div class="grade grade-split">
      <div class="lista-alunos" id="lista-escrita"></div>
      <article class="cartao editor" id="editor-escrita"></article>
    </div>
    <details class="cartao" style="margin-top:14px">
      <summary>Legenda da escrita</summary>
      <div class="grade" style="margin-top:12px">${legendaEscrita()}</div>
    </details>
  `;
  document.getElementById("busca-escrita").addEventListener("input", (ev) => {
    ui.buscaEscrita = ev.target.value;
    pintarListaEscrita();
  });
  document.getElementById("lista-escrita").addEventListener("click", (ev) => {
    const item = ev.target.closest(".item-aluno");
    if (!item) return;
    ui.alunoEscrita = Number(item.dataset.id);
    pintarListaEscrita();
    pintarEditorEscrita();
  });
  pintarListaEscrita();
  pintarEditorEscrita();
}

const PRODUCAO = [
  { chave: "linhas", titulo: "Texto até 5 linhas", itens: [
    { p: 1, nome: "Não atende", desc: "Não produz o texto ou ultrapassa o limite." },
    { p: 2, nome: "Atende parcialmente", desc: "Produz o texto, com inadequações de extensão ou organização." },
    { p: 3, nome: "Atende plenamente", desc: "Produz texto com até 5 linhas, de forma organizada." },
  ]},
  { chave: "legivel", titulo: "Letra legível", itens: [
    { p: 1, nome: "Não atende", desc: "A letra é ilegível." },
    { p: 2, nome: "Atende parcialmente", desc: "A letra é parcialmente legível." },
    { p: 3, nome: "Atende plenamente", desc: "A letra permite a leitura clara." },
  ]},
  { chave: "coerencia", titulo: "Coerência", itens: [
    { p: 1, nome: "Não atende", desc: "Ideias desorganizadas, sem sentido lógico." },
    { p: 2, nome: "Atende parcialmente", desc: "Há ideias coerentes, com falhas de organização." },
    { p: 3, nome: "Atende plenamente", desc: "Ideias organizadas e articuladas." },
  ]},
  { chave: "genero", titulo: "Atende ao gênero", itens: [
    { p: 1, nome: "Não atende", desc: "O texto não apresenta o gênero proposto." },
    { p: 2, nome: "Atende parcialmente", desc: "Apresenta o gênero de forma incompleta." },
    { p: 3, nome: "Atende plenamente", desc: "Apresenta as características do gênero." },
  ]},
];

function legendaEscrita() {
  const bloco = (titulo, itens) => `<div><h3>${titulo}</h3><div class="nota">${itens.map((item) =>
    `<p style="margin:8px 0"><b>${item.p} · ${esc(item.nome)}.</b> ${esc(item.desc)}</p>`
  ).join("")}</div></div>`;
  if (modoAtual() === "producao") {
    return PRODUCAO.map((grupo) => bloco(grupo.titulo, grupo.itens)).join("");
  }
  return bloco("Palavra", ESCRITA.palavra) + bloco("Frase", ESCRITA.frase) + bloco("Texto", ESCRITA.texto);
}

function pintarListaEscrita() {
  const lista = alunosFiltrados(ui.buscaEscrita);
  if (!lista.some((a) => a.id === ui.alunoEscrita)) ui.alunoEscrita = (lista[0] || {}).id || null;
  document.getElementById("lista-escrita").innerHTML = lista.map((aluno) => {
    const reg = regEscrita(aluno.id);
    const info = pontosEscrita(reg);
    let pill = "em branco";
    if (aluno.status === "transferido") pill = "transferido";
    else if (reg && reg.faltou) pill = "faltou";
    else if (info.partes) pill = nivelEscrita(info.total, info.completo);
    return `<button type="button" class="item-aluno ${aluno.id === ui.alunoEscrita ? "sel" : ""} ${aluno.status === "transferido" ? "dim" : ""}" data-id="${aluno.id}">
      <span class="num">${aluno.numero}</span>
      <span>${esc(aluno.nome)}</span>
      <span class="pill">${esc(pill)}</span>
    </button>`;
  }).join("");
}

function pintarEditorEscrita() {
  const editor = document.getElementById("editor-escrita");
  const aluno = dados.alunos.find((a) => a.id === ui.alunoEscrita);
  if (!aluno) {
    editor.innerHTML = `<p class="vazio">Cadastre um aluno para lançar.</p>`;
    return;
  }
  const reg = regEscrita(aluno.id) || {
    pontos_palavra: null, pontos_frase: null, pontos_texto: null,
    pontos_linhas: null, pontos_legivel: null, pontos_coerencia: null, pontos_genero: null,
    faltou: 0,
  };
  const info = pontosEscrita(reg);
  const nomeNivel = nivelEscrita(info.total, info.completo);
  const grupos = modoAtual() === "producao"
    ? PRODUCAO.map((grupo) => grupoPontos(grupo.chave, grupo.titulo, grupo.itens, reg[`pontos_${grupo.chave}`])).join("")
    : grupoPontos("palavra", "Escrita de palavra", ESCRITA.palavra, reg.pontos_palavra)
      + grupoPontos("frase", "Escrita de frase", ESCRITA.frase, reg.pontos_frase)
      + grupoPontos("texto", "Escrita de texto", ESCRITA.texto, reg.pontos_texto);
  const escala = modoAtual() === "producao"
    ? `${faixaProducao(1, 4, "Inicial", "1–4", info)}${faixaProducao(5, 7, "Desenvolvimento", "5–7", info)}${faixaProducao(8, 10, "Intermediário", "8–10", info)}${faixaProducao(11, 12, "Avançado", "11–12", info)}`
    : `${faixa(1, "Inicial", "1–4", info)}${faixa(5, "Desenvolvimento", "5–6", info)}${faixa(7, "Intermediário", "7–8", info)}${faixa(9, "Avançado", "9–10", info)}`;
  editor.innerHTML = `
    <h3>${aluno.numero}. ${esc(aluno.nome)}</h3>
    <p class="meta">${aluno.nee ? "NEE · " : ""}${aluno.status === "transferido" ? "transferido, fora da consolidação" : "aluno ativo"}</p>
    ${grupos}
    <div class="linha-tempo">
      <div class="total-box">${info.total || "—"}<span>${esc(nomeNivel || "sem pontuação")}</span></div>
      <button type="button" id="falta-escrita" class="btn-claro btn-falta ${reg.faltou ? "ativo" : ""}">${reg.faltou ? "Faltou" : "Marcar falta"}</button>
      <button type="button" id="limpar-escrita" class="btn-claro">Limpar</button>
    </div>
    <div class="escala" title="Faixas do nível geral">${escala}</div>
  `;
  editor.querySelectorAll("[data-eixo]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const eixo = botao.dataset.eixo;
      const pontos = Number(botao.dataset.pontos);
      const atual = regEscrita(aluno.id) || {};
      const chave = `pontos_${eixo}`;
      salvarEscrita(aluno.id, { [chave]: atual[chave] === pontos ? null : pontos, faltou: 0 });
    });
  });
  document.getElementById("falta-escrita").addEventListener("click", () => {
    salvarEscrita(aluno.id, { faltou: reg.faltou ? 0 : 1 });
  });
  document.getElementById("limpar-escrita").addEventListener("click", () => {
    salvarEscrita(aluno.id, {
      pontos_palavra: null, pontos_frase: null, pontos_texto: null,
      pontos_linhas: null, pontos_legivel: null, pontos_coerencia: null, pontos_genero: null,
      faltou: 0,
    });
  });
}

function faixaProducao(minimo, maximo, nome, faixaTxt, info) {
  const ativo = info.completo && info.total >= minimo && info.total <= maximo;
  return `<div class="${ativo ? "ativo" : ""}"><b>${esc(nome)}</b><br>${faixaTxt}</div>`;
}

function faixa(minimo, nome, faixaTxt, info) {
  const ativo = info.completo && (
    (minimo === 1 && info.total <= 4) ||
    (minimo === 5 && info.total >= 5 && info.total <= 6) ||
    (minimo === 7 && info.total >= 7 && info.total <= 8) ||
    (minimo === 9 && info.total >= 9)
  );
  return `<div class="${ativo ? "ativo" : ""}"><b>${esc(nome)}</b><br>${faixaTxt}</div>`;
}

function grupoPontos(eixo, titulo, itens, selecionado) {
  return `<div class="bloco" style="margin-top:12px"><h4>${titulo}</h4><div class="chips">${itens.map((item) =>
    `<button type="button" class="chip ${selecionado === item.p ? "sel" : ""}" data-eixo="${eixo}" data-pontos="${item.p}" style="${selecionado === item.p ? "background:var(--teal);color:white" : ""}" title="${esc(item.desc)}">${item.p} · ${esc(item.nome)}</button>`
  ).join("")}</div></div>`;
}

function salvarEscrita(alunoId, patch) {
  if (visaoGeral() || !turmaAtual()) {
    avisar("Escolha uma turma para lançar a escrita.", true);
    return;
  }
  return enfileirar(`E${alunoId}`, async () => {
    const atual = regEscrita(alunoId) || {
      aluno_id: alunoId,
      pontos_palavra: null,
      pontos_frase: null,
      pontos_texto: null,
      pontos_linhas: null,
      pontos_legivel: null,
      pontos_coerencia: null,
      pontos_genero: null,
      faltou: 0,
    };
    const proximo = { ...atual, ...patch, aluno_id: alunoId };
    try {
      const salvo = await api("PUT", "/api/escrita", {
        aluno_id: alunoId,
        pontos_palavra: proximo.pontos_palavra,
        pontos_frase: proximo.pontos_frase,
        pontos_texto: proximo.pontos_texto,
        pontos_linhas: proximo.pontos_linhas,
        pontos_legivel: proximo.pontos_legivel,
        pontos_coerencia: proximo.pontos_coerencia,
        pontos_genero: proximo.pontos_genero,
        faltou: proximo.faltou ? 1 : 0,
      });
      gravarLocalEscrita(salvo);
      avisar("Salvo");
      pintarListaEscrita();
      pintarEditorEscrita();
    } catch (erro) {
      avisar(erro.message, true);
    }
  });
}

function gravarLocalEscrita(row) {
  const i = dados.escrita.findIndex((r) => r.aluno_id === row.aluno_id);
  if (i >= 0) dados.escrita[i] = row;
  else dados.escrita.push(row);
  persistirLeitura();
}

function renderAlunos() {
  const raiz = document.getElementById("view-alunos");
  if (visaoGeral()) {
    raiz.innerHTML = htmlEscolherTurma("O cadastro de alunos");
    ligarEscolherTurma(raiz);
    return;
  }
  const turma = turmaAtual();
  const escola = escolaAtual();
  raiz.innerHTML = `
    <article class="cartao" style="margin-bottom:14px">
      <h2>${escola ? esc(escola.nome) : "Escola"} · ${turma ? esc(turma.rotulo) : "Turma"}</h2>
      <p class="nota" style="margin-top:8px">Para ver outra sala, use os menus de escola, ano e turma no topo.</p>
    </article>
    <article class="cartao">
      <h2>Alunos</h2>
      <form id="form-aluno" class="form-linha" style="margin-top:12px">
        <label class="campo">Nº<input name="numero" type="number" min="1" value="${proximoNumero()}" required style="width:80px"></label>
        <label class="campo">Nome<input name="nome" required placeholder="Nome do aluno" style="min-width:260px"></label>
        <label class="check"><input name="nee" type="checkbox"> NEE</label>
        <button class="btn" type="submit">Adicionar</button>
      </form>
      <table class="tabela">
        <thead><tr><th>Nº</th><th>Aluno</th><th>Situação</th><th>NEE</th><th></th></tr></thead>
        <tbody id="tbody-alunos"></tbody>
      </table>
    </article>
  `;
  document.getElementById("form-aluno").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const turma = turmaAtual();
    if (visaoGeral() || !turma) {
      avisar("Escolha uma turma para cadastrar o aluno.", true);
      return;
    }
    const form = new FormData(ev.target);
    try {
      const aluno = await api("POST", "/api/alunos", {
        turma_id: turma.id,
        numero: Number(form.get("numero")),
        nome: form.get("nome"),
        nee: form.get("nee") ? 1 : 0,
        status: "ativo",
      });
      dados.alunos.push(aluno);
      dados.alunos.sort(porNumero);
      persistirLeitura();
      avisar("Aluno adicionado");
      renderAlunos();
    } catch (erro) {
      avisar(erro.message, true);
    }
  });
  pintarTabelaAlunos();
}

function proximoNumero() {
  return listaAlunos().reduce((max, aluno) => Math.max(max, aluno.numero), 0) + 1;
}

function pintarTabelaAlunos() {
  document.getElementById("tbody-alunos").innerHTML = listaAlunos().sort(porNumero).map((aluno) => `
    <tr data-id="${aluno.id}">
      <td><input data-campo="numero" type="number" min="1" value="${aluno.numero}" style="width:70px"></td>
      <td><input data-campo="nome" value="${esc(aluno.nome)}" style="width:100%"></td>
      <td>
        <select data-campo="status">
          <option value="ativo" ${aluno.status === "ativo" ? "selected" : ""}>Ativo</option>
          <option value="transferido" ${aluno.status === "transferido" ? "selected" : ""}>Transferido</option>
        </select>
      </td>
      <td><input data-campo="nee" type="checkbox" ${aluno.nee ? "checked" : ""}></td>
      <td>
        <button type="button" class="btn btn-claro btn-miudo" data-acao="salvar">Salvar</button>
        <button type="button" class="btn-perigo btn-miudo" data-acao="excluir">Excluir</button>
      </td>
    </tr>
  `).join("");
  document.getElementById("tbody-alunos").onclick = async (ev) => {
    const botao = ev.target.closest("button");
    if (!botao) return;
    const linha = botao.closest("tr");
    const id = Number(linha.dataset.id);
    if (botao.dataset.acao === "excluir") {
      const aluno = dados.alunos.find((a) => a.id === id);
      if (!confirm(`Excluir ${aluno.nome} e os resultados deste aluno?`)) return;
      try {
        await api("DELETE", `/api/alunos/${id}`);
        dados.alunos = dados.alunos.filter((a) => a.id !== id);
        dados.leitura = dados.leitura.filter((r) => r.aluno_id !== id);
        dados.escrita = dados.escrita.filter((r) => r.aluno_id !== id);
        persistirLeitura();
        avisar("Aluno excluído");
        renderAlunos();
      } catch (erro) {
        avisar(erro.message, true);
      }
      return;
    }
    const payload = {
      numero: Number(linha.querySelector('[data-campo="numero"]').value),
      nome: linha.querySelector('[data-campo="nome"]').value,
      status: linha.querySelector('[data-campo="status"]').value,
      nee: linha.querySelector('[data-campo="nee"]').checked ? 1 : 0,
    };
    try {
      const salvo = await api("PUT", `/api/alunos/${id}`, payload);
      const i = dados.alunos.findIndex((a) => a.id === id);
      dados.alunos[i] = salvo;
      dados.alunos.sort(porNumero);
      persistirLeitura();
      avisar("Aluno salvo");
      pintarTabelaAlunos();
    } catch (erro) {
      avisar(erro.message, true);
    }
  };
}

function renderRelatorio() {
  const geral = visaoGeral();
  const nee = ativos().filter((a) => a.nee);
  const transferidos = listaAlunos().filter((a) => a.status === "transferido");
  const numero = testeEscolhido();
  const teste = (dados.testes || []).find((t) => t.numero === numero) || { numero, nome: nomeTeste(numero), data: null };
  const nTurmas = turmasDoEscopo().length;
  const nEscolas = new Set(turmasDoEscopo().map((t) => t.escola_id)).size;
  const tituloRel = geral
    ? `Resultado geral do ${ui.ano}º ano — ${teste.nome} — todas as escolas`
    : `Consolidação do ${teste.nome}`;
  const subtitulo = geral
    ? `${ui.ano}º ano · ${esc(teste.nome)} · ${nEscolas} escolas · ${nTurmas} turmas · ${esc(dados.config.ano_letivo || "")} · emitido em ${hojeBR()}`
    : `${esc(turmaAtual() ? turmaAtual().rotulo : "")} · ${esc(teste.nome)} · ${esc(dados.config.ano_letivo || "")} · emitido em ${hojeBR()}`;
  const bloco = consolidarLeitura(numero);
  const vazio = !bloco.com.length && !bloco.faltas.length;
  const blocos = `<article class="cartao" style="margin-top:14px">
      <h2>Consolidação do ${esc(teste.nome)}${teste.data ? ` · ${dataBR(teste.data)}` : ""}</h2>
      ${vazio ? `<p class="nota" style="margin-top:8px">Ainda sem lançamentos neste teste.</p>` : `
        <p class="nota" style="margin:8px 0 12px">${bloco.com.length} com resultado, ${bloco.faltas.length} ${bloco.faltas.length === 1 ? "falta" : "faltas"}, ${bloco.sem.length} em branco. Os percentuais usam quem tem resultado.</p>
        ${htmlBarrasLeitura(bloco)}
        <div class="grade grade-2" style="margin-top:12px">
          ${tabelaContagem("Leitura inicial", bloco.inicial, bloco.com.length)}
          ${tabelaContagem("Leitura de texto", bloco.texto, bloco.com.length)}
        </div>
        ${bloco.faltas.length ? `<p class="nota" style="margin-top:8px">Faltas: ${bloco.faltas.map((a) => esc(nomeNoEscopo(a))).join(", ")}.</p>` : ""}
      `}
    </article>
    <article class="cartao" style="margin-top:14px">${numero >= 2 ? htmlSituacaoLeitura(numero) : htmlAindaNaoLeitor(numero)}</article>`;

  const colunasTeste = testesDoMapa();
  const evolucao = listaAlunos().sort(ordenarMapa).map((aluno) => {
    const celulas = colunasTeste.map((item) => htmlCelulaMapa(aluno, item.numero, item.numero === numero)).join("");
    const turmaAluno = turmaDoAluno(aluno);
    const escolaAluno = escolaDoAluno(aluno);
    const colunasLocais = geral
      ? `<td>${esc(escolaAluno ? escolaAluno.nome : "")}</td><td>${esc(turmaAluno ? turmaAluno.turma : "")}</td>`
      : "";
    return `<tr>${colunasLocais}<td>${aluno.numero}</td><td>${esc(aluno.nome)}${aluno.nee ? " · NEE" : ""}${aluno.status === "transferido" ? " · transf." : ""}</td>${celulas}<td>${celulaEscrita(aluno.id)}</td></tr>`;
  }).join("");
  const cabecaMapa = geral
    ? "<th>Escola</th><th>Turma</th><th>Nº</th><th>Aluno</th>"
    : "<th>Nº</th><th>Aluno</th>";

  document.getElementById("view-relatorio").innerHTML = `
    <article class="cartao" id="relatorio-papel">
      <div class="relatorio-cabeca">
        <div>
          <p class="sobre-titulo">${esc(geral ? "Todas as escolas" : (escolaAtual() ? escolaAtual().nome : ""))}</p>
          <h2 style="font-size:26px;margin-top:4px">${esc(tituloRel)}</h2>
          <p class="nota">${subtitulo}</p>
        </div>
        <button type="button" class="btn no-print" id="btn-imprimir">Imprimir / salvar PDF</button>
      </div>
      <div class="grade grade-4" style="margin-top:16px">
        ${stat("Matriculados", ativos().length, "situação ativa")}
        ${stat("NEE", nee.length, nee.length ? "ver lista abaixo" : "nenhum marcado")}
        ${stat("Transferidos", transferidos.length, "fora das contagens")}
        ${stat("Escrita completa", ativos().filter(temEscritaCompleta).length, geral ? "avaliações completas" : "palavra, frase e texto")}
      </div>
      <p class="nota" style="margin-top:12px">${nee.length ? `NEE: ${nee.map((a) => esc(nomeNoEscopo(a))).join(", ")}.` : "Nenhum aluno marcado como NEE."} ${transferidos.length ? `Transferidos: ${transferidos.map((a) => esc(nomeNoEscopo(a))).join(", ")}.` : ""}</p>
    </article>
    ${blocos}
    <article class="cartao" style="margin-top:14px">
      <h2>Escrita</h2>
      ${htmlEscritaRelatorio()}
    </article>
    <article class="cartao" style="margin-top:14px">
      <h2>${geral ? `Mapa do ${esc(teste.nome)}` : "Mapa da turma"}</h2>
      <p class="nota">${geral
        ? `Cada linha é um aluno do ${ui.ano}º ano, com a escola e a turma. ${numero > 1 ? `O mapa mostra o ${esc(nomeTeste(numero - 1))} e o ${esc(teste.nome)}, em destaque.` : `O mapa mostra o ${esc(teste.nome)}, em destaque.`} O tempo de leitura aparece ao lado do nível, quando foi informado.`
        : `O ${esc(teste.nome)} está em destaque. As demais colunas continuam no mapa, e o tempo de leitura aparece ao lado do nível, quando foi informado.`}</p>
      <div style="overflow:auto">
        <table class="tabela">
          <thead><tr>${cabecaMapa}${colunasTeste.map((t) => `<th${t.numero === numero ? ` class="col-teste-sel"` : ""}>${esc(t.nome)}</th>`).join("")}<th>Escrita</th></tr></thead>
          <tbody>${evolucao}</tbody>
        </table>
      </div>
      <div class="mini-legenda" style="margin-top:12px">
        <p>SF/SC: mais de 1 minuto, compreensão parcial. SF/CC: mais de 1 minuto, compreensão completa. CF/SC: até 1 minuto, compreensão parcial. CF/CC: até 1 minuto, compreensão completa.</p>
        <p>${geral && modoAtual() === "producao"
          ? "Escrita (produção): até 4 inicial · 5–7 em desenvolvimento · 8–10 intermediário · 11–12 avançado. O nível geral aparece quando os quatro critérios foram lançados."
          : "Escrita: até 4 inicial · 5–6 em desenvolvimento · 7–8 intermediário · 9–10 avançado. O nível geral aparece quando palavra, frase e texto foram lançados."}</p>
      </div>
      <div class="assinaturas">
        <div>Professor(a)</div>
        <div>Coordenação</div>
      </div>
    </article>
  `;
  document.getElementById("btn-imprimir").onclick = () => window.print();
}

function tabelaContagem(titulo, itens, base) {
  const linhas = itens.map((item) => {
    const pct = base ? `${Math.round((item.total / base) * 100)}%` : "—";
    return `<tr><td>${esc(item.id)}</td><td class="num">${item.total}</td><td class="num">${pct}</td></tr>`;
  }).join("");
  return `<div><h3>${titulo}</h3><table class="tabela"><thead><tr><th>Nível</th><th class="num">Qtd.</th><th class="num">%</th></tr></thead><tbody>${linhas}</tbody></table></div>`;
}

function temEscritaCompleta(aluno) {
  const reg = regEscrita(aluno.id);
  return pontosEscrita(reg, modoDaTurma(turmaDoAluno(aluno))).completo && !(reg || {}).faltou;
}

function celulaEscrita(alunoId) {
  const aluno = dados.alunos.find((a) => a.id === alunoId);
  const modo = modoDaTurma(aluno ? turmaDoAluno(aluno) : turmaAtual());
  const reg = regEscrita(alunoId);
  if (reg && reg.faltou) return `<span class="etiqueta falta">Falta</span>`;
  const info = pontosEscrita(reg, modo);
  if (!info.partes) return `<span class="nota">—</span>`;
  return `${esc(nivelEscrita(info.total, info.completo, modo))} <small>(${info.total})</small>`;
}

function htmlEscritaRelatorio() {
  if (modoAtual() === "misto") {
    return `<h3>Escrita de palavra, frase e texto</h3>${mioloEscrita("classica")}
      <h3 style="margin-top:18px">Produção textual</h3>${mioloEscrita("producao")}`;
  }
  return mioloEscrita(modoAtual());
}

function mioloEscrita(modo) {
  const categorias = modo === "producao"
    ? PRODUCAO.map((grupo) => [grupo.titulo, `pontos_${grupo.chave}`, grupo.itens])
    : [
      ["Palavra", "pontos_palavra", ESCRITA.palavra],
      ["Frase", "pontos_frase", ESCRITA.frase],
      ["Texto", "pontos_texto", ESCRITA.texto],
    ];
  const presentes = [];
  ativos().forEach((aluno) => {
    if (modoDaTurma(turmaDoAluno(aluno)) !== modo) return;
    const reg = regEscrita(aluno.id);
    if (!reg || reg.faltou) return;
    if (pontosEscrita(reg, modo).partes) presentes.push({ aluno, reg });
  });
  if (!presentes.length) return `<p class="nota">Nenhum resultado de escrita lançado.</p>`;
  const colunas = categorias.map(([titulo, campo, itens]) => {
    const linhas = itens.map((item) => {
      const total = presentes.filter((p) => p.reg[campo] === item.p).length;
      return { id: `${item.p} ${item.nome}`, total, cor: "var(--teal)" };
    });
    const base = presentes.filter((p) => p.reg[campo] != null).length;
    return `<div><h3>${titulo}</h3>${barras(linhas, base)}</div>`;
  }).join("");
  const faixas = modo === "producao"
    ? [
      ["Nível inicial", (t) => t <= 4],
      ["Em desenvolvimento", (t) => t >= 5 && t <= 7],
      ["Intermediário", (t) => t >= 8 && t <= 10],
      ["Avançado", (t) => t >= 11],
    ]
    : [
      ["Nível inicial", (t) => t <= 4],
      ["Em desenvolvimento", (t) => t >= 5 && t <= 6],
      ["Intermediário", (t) => t >= 7 && t <= 8],
      ["Avançado", (t) => t >= 9],
    ];
  const completos = presentes.filter((p) => pontosEscrita(p.reg, modo).completo);
  const barrasGerais = faixas.map(([nome, teste]) => ({
    id: nome,
    cor: "var(--orange)",
    total: completos.filter((p) => teste(pontosEscrita(p.reg, modo).total)).length,
  }));
  return `<p class="nota">${presentes.length} com lançamento · ${completos.length} avaliações completas entram no nível geral.</p>
    <div class="grade ${modo === "producao" ? "grade-4" : "grade-3"}" style="margin-top:12px">${colunas}</div>
    <h3 style="margin-top:16px">Nível geral de escrita</h3>
    ${barras(barrasGerais, completos.length)}`;
}

function baixarCopia() {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const turma = turmaAtual();
  const nomeArquivo = visaoGeral()
    ? `leitura-escrita-geral-${ui.ano}-ano`
    : (turma ? turma.rotulo.replace(/\s+/g, "-") : "turma");
  link.download = `${nomeArquivo}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function anosDaEscola(escolaId) {
  return [...new Set(dados.turmas.filter((t) => t.escola_id === escolaId).map((t) => t.ano))].sort((a, b) => a - b);
}

function anosGerais() {
  return [...new Set(dados.turmas.map((t) => t.ano))].sort((a, b) => a - b);
}

function escolasDoAno(ano) {
  const ids = new Set(dados.turmas.filter((t) => t.ano === ano).map((t) => t.escola_id));
  return dados.escolas.filter((e) => ids.has(e.id));
}

function turmasDoAno(escolaId, ano) {
  return dados.turmas
    .filter((t) => t.escola_id === escolaId && t.ano === ano)
    .sort((a, b) => a.turma.localeCompare(b.turma, "pt-BR"));
}

function atualizarDica() {
  const dica = document.getElementById("dica-escopo");
  if (!dica) return;
  if (!visaoGeral()) {
    dica.hidden = true;
    dica.textContent = "";
    return;
  }
  const turmas = turmasDoEscopo();
  const nEscolas = new Set(turmas.map((t) => t.escola_id)).size;
  dica.hidden = false;
  dica.textContent = `Todas as escolas e todas as turmas do ${ui.ano}º ano (${nEscolas} escolas, ${turmas.length} turmas). Para lançar ou editar alunos, escolha uma escola.`;
}

function preencherSeletores() {
  const escola = document.getElementById("sel-escola");
  const ano = document.getElementById("sel-ano");
  const turma = document.getElementById("sel-turma");
  if (visaoGeral()) {
    escola.disabled = false;
    turma.disabled = true;
    ano.disabled = false;
    escola.innerHTML = `<option value="geral" selected>Todas as escolas</option>${escolasDoAno(ui.ano).map((item) =>
      `<option value="${item.id}">${esc(item.nome)}</option>`
    ).join("")}`;
    ano.innerHTML = anosGerais().map((item) =>
      `<option value="${item}" ${item === ui.ano ? "selected" : ""}>${item}º ano</option>`
    ).join("");
    turma.innerHTML = `<option value="geral" selected>Todas as turmas</option>`;
  } else {
    escola.disabled = false;
    turma.disabled = false;
    ano.disabled = false;
    escola.innerHTML = dados.escolas.map((item) =>
      `<option value="${item.id}" ${item.id === ui.escolaId ? "selected" : ""}>${esc(item.nome)}</option>`
    ).join("");
    ano.innerHTML = anosDaEscola(ui.escolaId).map((item) =>
      `<option value="${item}" ${item === ui.ano ? "selected" : ""}>${item}º ano</option>`
    ).join("");
    turma.innerHTML = `<option value="geral">Resultado geral do ano</option>${turmasDoAno(ui.escolaId, ui.ano).map((item) =>
      `<option value="${item.id}" ${item.id === ui.turmaId ? "selected" : ""}>Turma ${esc(item.turma)}</option>`
    ).join("")}`;
  }
  const teste = document.getElementById("sel-teste");
  if (teste) {
    teste.disabled = false;
    teste.innerHTML = (dados.testes || []).map((item) =>
      `<option value="${item.numero}" ${item.numero === ui.teste ? "selected" : ""}>${esc(item.nome)}</option>`
    ).join("");
  }
  atualizarDica();
}

function prepararTroca() {
  ui.alunoLeitura = null;
  ui.alunoEscrita = null;
  ajustarTesteAoEscopo();
  const leitura = document.getElementById("view-leitura");
  if (leitura) delete leitura.dataset.pronto;
  preencherSeletores();
  mostrar(ui.view);
}

function definirTurma(escolaId, ano, turmaId) {
  const anos = anosDaEscola(escolaId);
  if (!anos.includes(ano)) ano = anos[0];
  const turmas = turmasDoAno(escolaId, ano);
  if (!turmas.some((t) => t.id === turmaId)) turmaId = (turmas[0] || {}).id || null;
  ui.geral = false;
  ui.escolaId = escolaId;
  ui.ano = ano;
  ui.turmaId = turmaId;
  localStorage.setItem("leitura-escopo", "0");
  localStorage.setItem("leitura-escola", String(escolaId));
  localStorage.setItem("leitura-ano", String(ano));
  localStorage.setItem("leitura-turma", String(turmaId));
  prepararTroca();
}

function entrarGeral(ano) {
  const anos = anosGerais();
  if (!anos.length) return;
  if (!anos.includes(ano)) ano = anos[0];
  ui.geral = true;
  ui.ano = ano;
  localStorage.setItem("leitura-escopo", "1");
  localStorage.setItem("leitura-ano", String(ano));
  prepararTroca();
}

function escolherTurmaInicial() {
  const salva = Number(localStorage.getItem("leitura-turma"));
  const salvaOk = dados.turmas.find((t) => t.id === salva);
  const anoSalvo = Number(localStorage.getItem("leitura-ano"));
  if (localStorage.getItem("leitura-escopo") === "1" && anosGerais().length) {
    ui.geral = true;
    ui.ano = anosGerais().includes(anoSalvo) ? anoSalvo : anosGerais()[0];
    if (salvaOk) {
      ui.escolaId = salvaOk.escola_id;
      ui.turmaId = salvaOk.id;
    } else if (dados.turmas[0]) {
      ui.escolaId = dados.turmas[0].escola_id;
      ui.turmaId = dados.turmas[0].id;
    }
    return;
  }
  ui.geral = false;
  if (salvaOk) {
    ui.escolaId = salvaOk.escola_id;
    ui.ano = salvaOk.ano;
    ui.turmaId = salvaOk.id;
    return;
  }
  const joaquim = dados.escolas.find((e) => e.nome.includes("JOAQUIM TAVARES"));
  const preferida = dados.turmas.find((t) => joaquim && t.escola_id === joaquim.id && t.ano === 2 && t.turma === "U")
    || dados.turmas[0];
  if (!preferida) return;
  ui.escolaId = preferida.escola_id;
  ui.ano = preferida.ano;
  ui.turmaId = preferida.id;
}

function ligarSeletores() {
  document.getElementById("sel-escola").addEventListener("change", (ev) => {
    if (ev.target.value === "geral") {
      entrarGeral(ui.ano);
      return;
    }
    const escolaId = Number(ev.target.value);
    if (visaoGeral()) {
      const anos = anosDaEscola(escolaId);
      const ano = anos.includes(ui.ano) ? ui.ano : anos[0];
      const turmas = turmasDoAno(escolaId, ano);
      const concreta = turmaConcreta();
      const manter = concreta && concreta.escola_id === escolaId && concreta.ano === ano
        ? concreta.id
        : (turmas[0] || {}).id;
      definirTurma(escolaId, ano, manter);
      return;
    }
    const anos = anosDaEscola(escolaId);
    const turmas = turmasDoAno(escolaId, anos[0]);
    definirTurma(escolaId, anos[0], (turmas[0] || {}).id);
  });
  document.getElementById("sel-ano").addEventListener("change", (ev) => {
    const ano = Number(ev.target.value);
    if (visaoGeral()) {
      entrarGeral(ano);
      return;
    }
    const turmas = turmasDoAno(ui.escolaId, ano);
    definirTurma(ui.escolaId, ano, (turmas[0] || {}).id);
  });
  document.getElementById("sel-turma").addEventListener("change", (ev) => {
    if (ev.target.value === "geral") {
      entrarGeral(ui.ano);
      return;
    }
    definirTurma(ui.escolaId, ui.ano, Number(ev.target.value));
  });
  document.getElementById("sel-teste").addEventListener("change", (ev) => {
    ui.teste = Number(ev.target.value);
    ui.testeManual = true;
    ui.alunoLeitura = null;
    mostrar(ui.view);
  });
}

function htmlEscolherTurma(acao) {
  const escolas = escolasDoAno(ui.ano);
  const opcoes = escolas.map((e) =>
    `<option value="${e.id}" ${e.id === ui.escolaId ? "selected" : ""}>${esc(e.nome)}</option>`
  ).join("");
  return `<article class="cartao">
    <h2>Escolha uma escola e uma turma</h2>
    <p class="nota" style="margin:8px 0 12px">${esc(acao)} fica em uma turma só. O resultado geral do ${ui.ano}º ano junta todas as escolas, e nada é gravado nesta tela.</p>
    <form class="form-escolher-turma form-linha">
      <label class="campo">Escola<select name="escola">${opcoes}</select></label>
      <label class="campo">Turma do ${ui.ano}º ano<select name="turma"></select></label>
      <button class="btn" type="submit">Abrir esta turma</button>
    </form>
  </article>`;
}

function ligarEscolherTurma(raiz) {
  const form = raiz.querySelector(".form-escolher-turma");
  if (!form) return;
  const selEscola = form.querySelector('[name="escola"]');
  const selTurma = form.querySelector('[name="turma"]');
  const preencher = () => {
    const escolaId = Number(selEscola.value);
    const turmas = turmasDoAno(escolaId, ui.ano);
    selTurma.innerHTML = turmas.map((t) =>
      `<option value="${t.id}">Turma ${esc(t.turma)}</option>`
    ).join("") || `<option value="">Sem turma neste ano</option>`;
  };
  selEscola.addEventListener("change", preencher);
  preencher();
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const turmaId = Number(selTurma.value);
    const turma = dados.turmas.find((t) => t.id === turmaId);
    if (!turma) {
      avisar("Escolha uma turma deste ano.", true);
      return;
    }
    definirTurma(turma.escola_id, turma.ano, turma.id);
  });
}

function imprimirRelatorio() {
  mostrar("relatorio");
  setTimeout(() => window.print(), 200);
}

async function iniciar() {
  arquivoLeitura = carregarArquivo();
  const sessao = sessaoLeitura();
  recorteEscola = !!(sessao && !sessao.mestre && sessao.escola);
  dados = recortarPorEscola(arquivoLeitura);
  escolherTurmaInicial();
  ui.testeManual = false;
  const recente = ultimoTesteComDados();
  if (recente) ui.teste = recente;
  preencherSeletores();
  ligarSeletores();
  document.querySelectorAll(".menu button").forEach((botao) => {
    botao.addEventListener("click", () => mostrar(botao.dataset.view));
  });
  document.getElementById("btn-backup").addEventListener("click", baixarCopia);
  document.getElementById("btn-imprimir-topo").addEventListener("click", imprimirRelatorio);
  mostrar("painel");
}

iniciar().catch((erro) => {
  document.querySelector("main").innerHTML = `<article class="cartao"><h1>Não foi possível abrir os dados</h1><p class="nota">${esc(erro.message)}</p></article>`;
});
