/* Consulta de resultados da turma. A senha em texto nao entra aqui. */
(function () {
  const ANOS = ["1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º"];
  const CHAVE_PACK = "avalie-corretor-v1";
  const CHAVE_SESSAO = "avalie-resultados";
  const SITUACOES = ["N.D", "Falta", "Transferência"];
  const TURMA_TODA = "__escola__";
  const $ = (id) => document.getElementById(id);
  let sessao = null;
  let nominalPronto = false;

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleUpperCase("pt-BR");
  }

  function normalizarTurma(nome) {
    return String(nome || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/º/g, "")
      .replace(/\bANO\b/gi, "")
      .replace(/[^0-9A-Za-z]/g, "")
      .toLocaleUpperCase("pt-BR");
  }

  function rotrHash(x, n) {
    return ((x >>> n) | (x << (32 - n))) >>> 0;
  }

  function sha256Hex(mensagem) {
    const K = new Uint32Array([
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);
    const bytes = new TextEncoder().encode(mensagem);
    const bitLen = bytes.length * 8;
    const comUm = bytes.length + 1;
    const zeros = (56 - (comUm % 64) + 64) % 64;
    const total = bytes.length + 1 + zeros + 8;
    const buf = new Uint8Array(total);
    buf.set(bytes);
    buf[bytes.length] = 0x80;
    const view = new DataView(buf.buffer);
    view.setUint32(total - 8, Math.floor(bitLen / 0x100000000));
    view.setUint32(total - 4, bitLen >>> 0);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Uint32Array(64);
    for (let i = 0; i < buf.length; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rotrHash(w[t - 15], 7) ^ rotrHash(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotrHash(w[t - 2], 17) ^ rotrHash(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let t = 0; t < 64; t++) {
        const s1 = rotrHash(e, 6) ^ rotrHash(e, 11) ^ rotrHash(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + s1 + ch + K[t] + w[t]) >>> 0;
        const s0 = rotrHash(a, 2) ^ rotrHash(a, 13) ^ rotrHash(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7].map((n) => n.toString(16).padStart(8, "0")).join("");
  }

  async function hashSenha(senha) {
    if (window.crypto && crypto.subtle && window.isSecureContext) {
      const dados = new TextEncoder().encode(senha);
      const buf = await crypto.subtle.digest("SHA-256", dados);
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return sha256Hex(senha);
  }

  function catalogo() {
    return Array.isArray(window.ACESSO_ESCOLAS) ? window.ACESSO_ESCOLAS : [];
  }

  function buscarLogin(login) {
    const chave = String(login || "").trim().toLowerCase();
    if (!chave) return null;
    return catalogo().find((item) => String(item.login || "").toLowerCase() === chave) || null;
  }

  function lerSessao() {
    try {
      const bruto = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || "null");
      const item = buscarLogin(bruto && bruto.login);
      if (!item) return null;
      if (item.mestre) return { login: item.login, mestre: true };
      return { login: item.login, escola: item.escola || "" };
    } catch (e) {
      return null;
    }
  }

  function mostrarLogin() {
    sessao = null;
    if ($("resLogin")) $("resLogin").hidden = false;
    if ($("resConsulta")) $("resConsulta").hidden = true;
    if ($("resRelatorio")) $("resRelatorio").innerHTML = "";
  }

  const REDE_MUNICIPIO = "__municipio__";

  function escolaEscolhida() {
    if (!sessao) return "";
    if (!sessao.mestre) return sessao.escola || "";
    const sel = $("resRede");
    const valor = sel ? sel.value : "";
    if (!valor || valor === REDE_MUNICIPIO) return "";
    return valor;
  }

  function recorteMunicipal() {
    return !!(sessao && sessao.mestre && $("resRede") && $("resRede").value === REDE_MUNICIPIO);
  }

  function carregarScript(src) {
    return new Promise((resolve, reject) => {
      const ja = document.querySelector(`script[src="${src}"]`);
      if (ja) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(src));
      document.body.appendChild(s);
    });
  }

  async function garantirNominal() {
    if (nominalPronto && Array.isArray(window.CORRETOR_NOMINAL)) return;
    await carregarScript("dados_rede.js?v=eixo26");
    await carregarScript("dados_nominal.js?v=eixo26");
    nominalPronto = Array.isArray(window.CORRETOR_NOMINAL);
  }

  function escolasDaRede() {
    const rede = window.CORRETOR_REDE && window.CORRETOR_REDE.escolas;
    if (Array.isArray(rede) && rede.length) return rede.slice();
    return [];
  }

  function turmasDa(escola, ano) {
    const alvo = fold(escola);
    const nomes = new Set();
    (window.CORRETOR_NOMINAL || []).forEach((aluno) => {
      if (aluno.ano === ano && fold(aluno.escola) === alvo && aluno.turma) nomes.add(String(aluno.turma));
    });
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  }

  function preencherAno() {
    const sel = $("resAno");
    if (!sel) return;
    sel.innerHTML = `<option value="">Selecione a série</option>` + ANOS.map((ano) => (
      `<option value="${esc(ano)}">${esc(ano)} ano</option>`
    )).join("");
    sel.value = "";
  }

  function preencherEscolas() {
    const box = $("resEscolaBox");
    const fixa = $("resEscolaFixa");
    const sel = $("resEscola");
    if (!box || !fixa || !sel) return;
    if (!sessao || !sessao.mestre) {
      box.hidden = true;
      fixa.hidden = false;
      fixa.textContent = sessao ? sessao.escola : "";
      sel.innerHTML = "";
      return;
    }
    box.hidden = false;
    fixa.hidden = true;
    fixa.textContent = "";
    const antes = sel.value;
    const lista = escolasDaRede();
    sel.innerHTML = `<option value="">Selecione a escola</option>` + lista.map((nome) => (
      `<option value="${esc(nome)}">${esc(nome)}</option>`
    )).join("");
    sel.value = lista.includes(antes) ? antes : "";
  }

  function preencherAvaliacoes() {
    const sel = $("resAvaliacao");
    if (!sel) return;
    const antes = sel.value;
    const lista = avaliacoesCadastradas();
    if (!lista.length) {
      sel.innerHTML = `<option value="">Nenhuma avaliação cadastrada</option>`;
      sel.value = "";
      return;
    }
    sel.innerHTML = `<option value="">Selecione a avaliação</option>` + lista.map((nome) => (
      `<option value="${esc(nome)}">${esc(nome)}</option>`
    )).join("");
    sel.value = lista.includes(antes) ? antes : "";
  }

  function preencherRede() {
    const sel = $("resRede");
    if (!sel || !sessao) return;
    if (!sessao.mestre) {
      const nome = sessao.escola || "";
      sel.innerHTML = `<option value="${esc(nome)}">${esc(nome)}</option>`;
      sel.value = nome;
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    const antes = sel.value;
    const escolas = escolasDaRede();
    sel.innerHTML = `<option value="">Selecione a rede</option>`
      + `<option value="${REDE_MUNICIPIO}">Rede municipal</option>`
      + escolas.map((nome) => `<option value="${esc(nome)}">${esc(nome)}</option>`).join("");
    const validos = [REDE_MUNICIPIO].concat(escolas);
    sel.value = validos.includes(antes) ? antes : "";
  }

  function preencherTurmas() {
    const sel = $("resTurma");
    if (!sel) return;
    atualizarTurmaVisivel();
    if (recorteMunicipal()) {
      sel.value = "";
      return;
    }
    const antes = sel.value;
    const escola = escolaEscolhida();
    const ano = $("resAno") ? $("resAno").value : "";
    const lista = escola && ano ? turmasDa(escola, ano) : [];
    const toda = ano ? `<option value="${TURMA_TODA}">Escola toda</option>` : "";
    sel.innerHTML = `<option value="">Selecione a turma</option>` + toda + lista.map((turma) => (
      `<option value="${esc(turma)}">${esc(turma)}</option>`
    )).join("");
    sel.value = antes === TURMA_TODA || lista.includes(antes) ? antes : "";
  }

  function avaliacoesCadastradas() {
    try {
      const bruto = JSON.parse(localStorage.getItem("avalie-cadastro-avaliacoes") || "[]");
      if (!Array.isArray(bruto)) return [];
      return bruto.map((item) => String(item && item.nome || "").trim()).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function resultadoPodeAparecer() {
    const nomes = [...new Set(avaliacoesCadastradas())];
    if (!nomes.length) return true;
    let flags = {};
    try {
      const bruto = JSON.parse(localStorage.getItem("avalie-resultado-liberacao") || "{}");
      if (bruto && typeof bruto === "object" && !Array.isArray(bruto)) flags = bruto;
    } catch (e) { /* ainda em lançamento */ }
    return nomes.every((nome) => flags[nome] === true);
  }

  function aplicarLiberacao() {
    const liberado = resultadoPodeAparecer();
    const aviso = $("resLiberacao");
    const grade = document.querySelector("#resConsulta .res-grade");
    const gerar = $("resGerar");
    if (aviso) aviso.hidden = liberado;
    if (grade) grade.hidden = !liberado;
    if (gerar) gerar.hidden = !liberado;
    const imprimir = $("resImprimir");
    if (imprimir) imprimir.hidden = !liberado;
    if (!liberado) limparRelatorio();
    return liberado;
  }

  function atualizarBotao() {
    const btn = $("resGerar");
    if (!btn) return;
    const avaliacao = $("resAvaliacao") && $("resAvaliacao").value;
    const ano = $("resAno") && $("resAno").value;
    const turma = $("resTurma") && $("resTurma").value;
    const disciplina = $("resDisciplina") && $("resDisciplina").value;
    const recorte = recorteMunicipal() || (escolaEscolhida() && turma);
    btn.disabled = !(avaliacao && ano && disciplina && recorte);
  }

  function atualizarTurmaVisivel() {
    const box = $("resTurmaBox");
    if (!box) return;
    box.hidden = recorteMunicipal();
  }

  function limparRelatorio() {
    if ($("resRelatorio")) $("resRelatorio").innerHTML = "";
    atualizarImpressao();
  }

  function atualizarImpressao() {
    const btn = $("resImprimir");
    const box = $("resRelatorio");
    if (!btn) return;
    btn.disabled = !(box && box.querySelector(".res-bloco"));
  }

  function imprimirRelatorio() {
    const box = $("resRelatorio");
    if (!box || !box.querySelector(".res-bloco")) return;
    document.body.classList.add("res-imprimindo");
    window.print();
  }

  async function mostrarConsulta() {
    sessao = lerSessao();
    if (!sessao) {
      mostrarLogin();
      return;
    }
    if ($("resLogin")) $("resLogin").hidden = true;
    if ($("resConsulta")) $("resConsulta").hidden = false;
    if ($("resEscolaBox")) $("resEscolaBox").hidden = true;
    const titulo = $("resConsultaTitulo");
    if (titulo) titulo.textContent = sessao.mestre ? "Consulta do relatório" : (sessao.escola || "Consulta do relatório");
    if (!sessao.mestre) {
      const box = $("resEscolaBox");
      const fixa = $("resEscolaFixa");
      if (box) box.hidden = true;
      if (fixa) {
        fixa.hidden = false;
        fixa.textContent = sessao.escola || "";
      }
    }
    if (!aplicarLiberacao()) return;
    limparRelatorio();
    if ($("resDisciplina")) $("resDisciplina").value = "";
    try {
      await garantirNominal();
    } catch (e) {
      const rel = $("resRelatorio");
      if (rel) rel.innerHTML = `<p class="res-aviso">Não foi possível carregar as turmas.</p>`;
      atualizarImpressao();
      return;
    }
    preencherAvaliacoes();
    preencherRede();
    preencherAno();
    preencherTurmas();
    atualizarBotao();
    atualizarImpressao();
  }

  function mesmoLancamento(a, b) {
    if (!a || !b) return false;
    if (a.alunoId && b.alunoId && String(a.alunoId) === String(b.alunoId)) return true;
    const nome = fold(a.name || a.nome);
    return !!nome && nome === fold(b.name || b.nome);
  }

  function alunosDoRelatorio(anoObj, slot) {
    const vivo = Array.isArray(anoObj && anoObj.students) ? anoObj.students : [];
    const foto = slot && Array.isArray(slot.students) ? slot.students : null;
    if (!foto) return vivo;
    const usados = new Set();
    const lista = foto.map((aluno) => {
      const outro = vivo.find((item) => mesmoLancamento(aluno, item));
      if (outro) usados.add(outro);
      if (temRespostaLancada(aluno) || !temRespostaLancada(outro)) return aluno;
      return Object.assign({}, aluno, { answers: outro.answers });
    });
    vivo.forEach((aluno) => {
      if (!usados.has(aluno)) lista.push(aluno);
    });
    return lista;
  }

  function anoDoRelatorio(pack, ano) {
    const anoObj = pack && pack.anos && pack.anos[ano] ? pack.anos[ano] : {};
    const nome = String(anoObj.nome || "").trim();
    const slot = nome && anoObj.porAvaliacao && anoObj.porAvaliacao[nome];
    if (!slot || typeof slot !== "object") return anoObj;
    return Object.assign({}, anoObj, slot, {
      nome: nome,
      porAvaliacao: anoObj.porAvaliacao,
      students: alunosDoRelatorio(anoObj, slot),
    });
  }

  function lerPack() {
    try {
      const bruto = JSON.parse(localStorage.getItem(CHAVE_PACK) || "null");
      return bruto && typeof bruto === "object" ? bruto : null;
    } catch (e) {
      return null;
    }
  }

  function disciplinaPorNome(pack, nome) {
    const lista = (pack && pack.disciplinas) || [];
    const hit = lista.find((d) => fold(d.nome) === fold(nome));
    if (hit) return hit;
    if (fold(nome) === "PORTUGUES") return { id: "d-portugues", nome: "Português" };
    return { id: "d-matematica", nome: "Matemática" };
  }

  function questoesDe(anoObj, disciplina, pack) {
    const provas = anoObj && anoObj.provas;
    const prova = provas && provas[disciplina.id];
    if (prova && Array.isArray(prova.questions) && prova.questions.length) return prova.questions;
    const port = disciplinaPorNome(pack, "Português");
    if (disciplina.id === port.id && anoObj && Array.isArray(anoObj.questions) && anoObj.questions.length) {
      return anoObj.questions;
    }
    return [];
  }

  function rosterDaTurma(pack, escola, ano, turma) {
    const alvo = fold(escola);
    const turmaNorm = normalizarTurma(turma);
    const nominais = (window.CORRETOR_NOMINAL || []).filter((aluno) => (
      aluno.ano === ano && fold(aluno.escola) === alvo && normalizarTurma(aluno.turma) === turmaNorm
    ));
    const nomes = new Set(nominais.map((aluno) => fold(aluno.nome)));
    const ids = new Set();
    if (pack) {
      const escolaIds = new Set((pack.escolas || []).filter((e) => fold(e.nome) === alvo).map((e) => String(e.id)));
      const turmaIds = new Set((pack.turmas || []).filter((t) => normalizarTurma(t.nome) === turmaNorm).map((t) => String(t.id)));
      (pack.alunos || []).forEach((aluno) => {
        if (aluno.ano === ano && escolaIds.has(String(aluno.escolaId)) && turmaIds.has(String(aluno.turmaId))) {
          ids.add(String(aluno.id));
          nomes.add(fold(aluno.nome));
        }
      });
    }
    return { nomes, ids, total: Math.max(nominais.length, ids.size) };
  }

  function slotDaAvaliacao(pack, ano, nome) {
    const anoObj = pack && pack.anos && pack.anos[ano] ? pack.anos[ano] : {};
    const pedido = String(nome || "").trim();
    const nomeAno = String(anoObj.nome || "").trim();
    const mapa = anoObj.porAvaliacao;
    const slot = pedido && mapa && mapa[pedido];
    const vivo = nomeAno === pedido ? anoObj : { students: [] };
    if (slot && typeof slot === "object") {
      return Object.assign({}, anoObj, slot, {
        nome: pedido,
        porAvaliacao: mapa,
        students: alunosDoRelatorio(vivo, slot),
      });
    }
    if (nomeAno === pedido) return anoObj;
    return null;
  }

  function lancamentosNo(slot, pack, disciplina, roster) {
    if (!slot) return [];
    const port = disciplinaPorNome(pack, "Português");
    return (slot.students || []).filter((aluno) => {
      const daTurma = (aluno.alunoId && roster.ids.has(String(aluno.alunoId))) || roster.nomes.has(fold(aluno.name));
      if (!daTurma) return false;
      if (aluno.disciplinaId) return aluno.disciplinaId === disciplina.id;
      return disciplina.id === port.id;
    });
  }

  function escalasPadrao() {
    return [
      { nome: "Muito crítico", min: 0, max: 38, cor: "#e23b32" },
      { nome: "Crítico", min: 39, max: 58, cor: "#f39a3e" },
      { nome: "Intermediário", min: 59, max: 85, cor: "#f2c94c" },
      { nome: "Adequado", min: 86, max: 100, cor: "#2f9e44" },
    ];
  }

  function escalasDe(slot) {
    const lista = slot && Array.isArray(slot.escalas) ? slot.escalas : [];
    const antiga = lista.length === 3
      && lista.map((s) => `${s && s.nome}|${Number(s && s.min)}|${Number(s && s.max)}`).join(";")
        === "Crítico|0|30;Básico|31|60;Adequado|61|100";
    const reservas = ["#e23b32", "#f39a3e", "#f2c94c", "#2f9e44"];
    const base = !lista.length || antiga ? escalasPadrao() : lista;
    const xs = base
      .filter((s) => s && s.nome && Number.isFinite(Number(s.min)) && Number.isFinite(Number(s.max)))
      .map((s) => ({ nome: String(s.nome), min: Number(s.min), max: Number(s.max), cor: String(s.cor || "").trim() }))
      .sort((a, b) => a.min - b.min)
      .map((s, i) => ({
        ...s,
        cor: /^#[0-9a-fA-F]{6}$/.test(s.cor) ? s.cor : reservas[Math.min(i, reservas.length - 1)],
      }));
    return xs.length ? xs : escalasPadrao();
  }

  function caminhosDoArco(escalas) {
    const faixas = escalas.filter((s) => s.max > s.min);
    const ponto = (pct) => {
      const t = Math.max(0, Math.min(100, Number(pct))) / 100;
      const theta = Math.PI * (1 - t);
      return [100 + 82 * Math.cos(theta), 102 - 82 * Math.sin(theta)];
    };
    let cursor = 0;
    return faixas.map((s) => {
      const min = Number(s.min);
      const max = Math.min(100, Number(s.max));
      const comeco = min - cursor <= 1 ? cursor : min;
      const fim = Math.max(comeco, max);
      const a = ponto(comeco);
      const b = ponto(fim);
      const item = fim - comeco >= 0.2 ? {
        cor: s.cor,
        d: `M${a[0].toFixed(1)} ${a[1].toFixed(1)} A82 82 0 0 1 ${b[0].toFixed(1)} ${b[1].toFixed(1)}`,
      } : null;
      cursor = Math.max(cursor, fim);
      return item;
    }).filter(Boolean);
  }

  function fmtNum(n) {
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }

  function faixaDeNota(nota, faixas) {
    let indice = faixas.findIndex((s) => nota >= s.min && nota <= s.max);
    if (indice >= 0) return indice;
    faixas.forEach((s, i) => { if (s.max < nota) indice = i; });
    return indice;
  }

  function medirAvaliacao(pack, nome, ano, disciplina) {
    const slot = slotDaAvaliacao(pack, ano, nome);
    const qs = slot ? questoesDe(slot, disciplina, pack) : [];
    const escalas = escalasDe(slot);
    const escolas = recorteMunicipal() ? escolasDaRede() : [escolaEscolhida()].filter(Boolean);
    const turmaSel = $("resTurma") ? $("resTurma").value : "";
    let alunos = [];
    let rosterTotal = 0;
    escolas.forEach((escola) => {
      let turmas = [];
      if (recorteMunicipal() || turmaSel === TURMA_TODA) turmas = turmasDa(escola, ano);
      else if (turmaSel) turmas = [turmaSel];
      turmas.forEach((nomeTurma) => {
        const roster = rosterDaTurma(pack, escola, ano, nomeTurma);
        rosterTotal += roster.total;
        alunos = alunos.concat(lancamentosNo(slot, pack, disciplina, roster));
      });
    });
    const presentes = alunos.filter(entraNaMedia);
    const notas = presentes.map((aluno) => notaDe(aluno, qs)).filter((n) => n != null);
    const media = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null;
    const contagens = escalas.map(() => 0);
    notas.forEach((nota) => {
      const indice = faixaDeNota(nota, escalas);
      if (indice >= 0) contagens[indice] += 1;
    });
    const ausencia = rosterTotal > 0 ? (Math.max(0, rosterTotal - presentes.length) / rosterTotal) * 100 : null;
    return { nome, qs, escalas, alunos, presentes, notas, media, contagens, rosterTotal, ausencia };
  }

  function situacao(aluno) {
    const s = aluno && aluno.situacao;
    return SITUACOES.includes(s) ? s : "";
  }

  function respostaLancada(valor) {
    if (valor == null) return "";
    const texto = String(valor).trim();
    if (!texto || texto === "-") return "";
    return texto;
  }

  function temRespostaLancada(aluno) {
    return (aluno && Array.isArray(aluno.answers) ? aluno.answers : []).some((item) => respostaLancada(item));
  }

  function naoFezProva(aluno) {
    const s = situacao(aluno);
    return s === "Falta" || s === "Transferência";
  }

  function entraNaMedia(aluno) {
    return !!aluno && !naoFezProva(aluno) && temRespostaLancada(aluno);
  }

  function notaDe(aluno, qs) {
    if (!qs.length || !entraNaMedia(aluno)) return null;
    let certos = 0;
    qs.forEach((q, i) => {
      const resp = respostaLancada((aluno.answers || [])[i]);
      const correta = q && q.correct != null ? String(q.correct).trim() : "";
      if (resp && correta && resp === correta) certos += 1;
    });
    return (100 * certos) / qs.length;
  }

  function nivelDe(p, escalas) {
    const xs = (escalas || [])
      .filter((s) => s && s.nome && Number.isFinite(Number(s.min)) && Number.isFinite(Number(s.max)))
      .map((s) => ({ nome: s.nome, min: Number(s.min), max: Number(s.max) }))
      .sort((a, b) => a.min - b.min);
    const hit = xs.find((s) => p >= s.min && p <= s.max);
    if (hit) return hit.nome;
    let abaixo = null;
    xs.forEach((s) => { if (s.max < p) abaixo = s; });
    return abaixo ? abaixo.nome : "N/A";
  }

  function textoAluno(aluno, qs, escalas) {
    if (!aluno) return "Sem lançamento";
    if (naoFezProva(aluno)) return situacao(aluno);
    if (!temRespostaLancada(aluno)) return situacao(aluno) || "ND";
    if (!qs.length) return "Sem gabarito";
    const nota = notaDe(aluno, qs);
    if (nota == null) return "ND";
    return `${nota.toFixed(1)}% · ${nivelDe(nota, escalas)}`;
  }

  function htmlBloco(disciplina, qs, alunos, rosterTotal, escalas) {
    const titulo = `<h3>${esc(disciplina.nome)}</h3>`;
    if (!qs.length || !alunos.length) {
      let aviso = "Ainda não há lançamento desta disciplina.";
      if (!qs.length && alunos.length) aviso = "Ainda não há gabarito desta disciplina.";
      else if (qs.length) aviso = `${qs.length} questões. Ainda não há lançamento desta disciplina.`;
      return `<section class="res-bloco">${titulo}<p class="res-aviso">${esc(aviso)}</p></section>`;
    }
    const presentesLista = alunos.filter(entraNaMedia);
    const presentes = presentesLista.length;
    const ausencia = rosterTotal > 0 ? (Math.max(0, rosterTotal - presentes) / rosterTotal) * 100 : null;
    const notas = presentesLista.map((aluno) => notaDe(aluno, qs)).filter((n) => n != null);
    const media = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null;
    const fmt = (n) => (n == null ? "—" : `${n.toFixed(1)}%`);
    return `
      <section class="res-bloco">
        ${titulo}
        <p class="res-aviso">${qs.length} questões</p>
        <div class="res-kpis">
          <div class="res-kpi"><span>Presentes</span><strong>${presentes}</strong></div>
          <div class="res-kpi"><span>Ausência</span><strong>${ausencia == null ? "—" : `${ausencia.toFixed(1)}%`}</strong></div>
          <div class="res-kpi"><span>Média</span><strong>${fmt(media)}</strong></div>
          <div class="res-kpi"><span>Nível</span><strong>${media == null ? "—" : esc(nivelDe(media, escalas))}</strong></div>
        </div>
        ${htmlRespostas(qs, alunos)}
      </section>
    `;
  }

  function htmlRespostas(qs, alunos) {
    const lista = [...alunos].sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"));
    if (!lista.length || !qs.length) return "";
    const head = `<tr><th>Aluno</th>${qs.map((_, i) => `<th>Q${i + 1}</th>`).join("")}</tr>`;
    const body = lista.map((aluno) => {
      const nome = esc(aluno.name || "");
      if (naoFezProva(aluno) || !temRespostaLancada(aluno)) {
        const rotulo = situacao(aluno) || "ND";
        return `<tr><td>${nome}</td><td colspan="${qs.length}">${esc(rotulo)}</td></tr>`;
      }
      const cols = qs.map((q, i) => {
        const resp = respostaLancada((aluno.answers || [])[i]);
        if (!resp) return `<td>ND</td>`;
        const texto = esc(resp);
        const correta = q && q.correct != null ? String(q.correct).trim() : "";
        const certa = !!correta && resp === correta;
        return `<td class="${certa ? "res-certa" : "res-errada"}">${texto}</td>`;
      }).join("");
      return `<tr><td>${nome}</td>${cols}</tr>`;
    }).join("");
    return `
      <h4>Respostas dos alunos</h4>
      <div class="table-wrap res-respostas"><table class="res-tabela"><thead>${head}</thead><tbody>${body}</tbody></table></div>
    `;
  }

  function htmlLista(blocos, escalas) {
    const unicos = new Map();
    blocos.forEach((bloco) => {
      bloco.alunos.forEach((aluno) => {
        const chave = aluno.alunoId ? "id:" + aluno.alunoId : "nome:" + fold(aluno.name || "");
        if (!unicos.has(chave)) unicos.set(chave, aluno.name || "");
      });
    });
    const linhas = [...unicos.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
    if (!linhas.length) {
      return `<section class="res-bloco"><h3>Resultado por aluno</h3><p class="res-aviso">Nenhum aluno lançado nesta turma.</p></section>`;
    }
    const head = `<tr><th>Aluno</th>${blocos.map((b) => `<th>${esc(b.disciplina.nome)}</th>`).join("")}</tr>`;
    const body = linhas.map(([chave, nome]) => {
      const cols = blocos.map((bloco) => {
        const aluno = bloco.alunos.find((item) => (item.alunoId ? "id:" + item.alunoId : "nome:" + fold(item.name || "")) === chave);
        return `<td>${esc(textoAluno(aluno, bloco.qs, escalas))}</td>`;
      }).join("");
      return `<tr><td>${esc(nome)}</td>${cols}</tr>`;
    }).join("");
    return `
      <section class="res-bloco">
        <h3>Resultado por aluno</h3>
        <div class="table-wrap"><table class="res-tabela"><thead>${head}</thead><tbody>${body}</tbody></table></div>
      </section>
    `;
  }

  function htmlDelta(atual, anterior) {
    if (atual == null || anterior == null) return "";
    const dif = Math.round((atual - anterior) * 10) / 10;
    if (dif === 0) return `<span class="res-delta">0 pts</span>`;
    const sobe = dif > 0;
    const abs = Math.abs(dif);
    const texto = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
    return `<span class="res-delta${sobe ? "" : " desce"}">${sobe ? "↑" : "↓"} ${texto} pts</span>`;
  }

  function proficienciaDe(media) {
    if (media == null) return null;
    return (Math.round(media * 10) / 10) * 10;
  }

  function htmlMedidor(medicao, deltaHtml, comparado) {
    const media = medicao.media;
    const prof = proficienciaDe(media);
    const ang = prof == null ? -90 : (Math.max(0, Math.min(1000, prof)) / 1000) * 180 - 90;
    const nota = prof == null ? "—" : fmtNum(prof);
    const total = medicao.notas.length;
    const segmentos = medicao.escalas.map((faixa, i) => {
      const n = medicao.contagens[i] || 0;
      const pct = total ? (100 * n) / total : 0;
      return { nome: faixa.nome, n, pct, cor: faixa.cor };
    });
    const barra = total
      ? `<div class="res-barra">${segmentos.map((s) => `<i style="width:${s.pct}%;background:${s.cor}"></i>`).join("")}</div>`
      : `<p class="res-aviso">Sem respostas lançadas para distribuir.</p>`;
    const legenda = segmentos.map((s) => `
      <div class="res-leg-nome"><i style="background:${s.cor}"></i>${esc(s.nome)}<small>${s.n} estudante(s)</small></div>
      <div class="res-leg-pct">${total ? fmtNum(s.pct) + "%" : "—"}</div>
    `).join("");
    const ponteiro = media == null ? "" : `
      <g transform="rotate(${ang} 100 102)"><polygon points="100,30 96.5,102 103.5,102" fill="#1c2434"/></g>
      <circle cx="100" cy="102" r="5" fill="#1c2434"/>
    `;
    const ausencia = medicao.ausencia == null ? "—" : `${fmtNum(medicao.ausencia)}%`;
    const nivel = media == null ? "—" : nivelDe(media, medicao.escalas);
    return `
      <article class="res-medidor res-bloco${comparado ? " comparado" : ""}">
        <h3>${esc(medicao.nome)}</h3>
        <p class="res-prof">Proficiência média</p>
        <svg class="res-gauge" viewBox="0 0 200 122" role="img" aria-label="${esc(medicao.nome)} ${esc(nota)}">
          ${caminhosDoArco(medicao.escalas).map((trecho) => `<path d="${trecho.d}" fill="none" stroke="${trecho.cor}" stroke-width="18"/>`).join("")}
          <text x="6" y="118" font-size="11" fill="#667085">0</text>
          <text x="194" y="118" font-size="11" fill="#667085" text-anchor="end">1000</text>
          ${ponteiro}
        </svg>
        <p class="res-nota">${esc(nota)}</p>
        ${deltaHtml ? `<p class="res-delta-linha">${deltaHtml}</p>` : ""}
        <h4>Distribuição por níveis de aprendizagem</h4>
        ${barra}
        <div class="res-legenda">${legenda}</div>
        <p class="res-presenca">Presentes ${medicao.presentes.length} · Ausência ${ausencia} · Nível ${esc(nivel)}</p>
      </article>
    `;
  }

  function htmlAbas() {
    const municipal = recorteMunicipal();
    const escola = escolaEscolhida();
    const botoes = [];
    if (sessao && sessao.mestre) {
      botoes.push(`<button type="button" class="res-aba${municipal ? " ativa" : ""}" data-res-aba="municipio">Município</button>`);
      if (escola) botoes.push(`<button type="button" class="res-aba${!municipal ? " ativa" : ""}" data-res-aba="rede" data-escola="${esc(escola)}">Rede</button>`);
    } else if (escola) {
      botoes.push(`<button type="button" class="res-aba ativa" data-res-aba="rede" data-escola="${esc(escola)}">Rede</button>`);
    }
    if (!botoes.length) return "";
    return `<div class="res-abas" role="tablist">${botoes.join("")}</div>`;
  }

  function parComparavel(pack, ano, disciplina, escolhida) {
    const nomes = avaliacoesCadastradas();
    const comDado = nomes.filter((nome) => {
      const med = medirAvaliacao(pack, nome, ano, disciplina);
      return med.media != null;
    });
    if (!comDado.includes(escolhida) || comDado.length < 2) return [escolhida];
    const idx = nomes.indexOf(escolhida);
    let outra = "";
    for (let i = idx - 1; i >= 0; i -= 1) {
      if (comDado.includes(nomes[i])) { outra = nomes[i]; break; }
    }
    if (!outra) {
      for (let i = idx + 1; i < nomes.length; i += 1) {
        if (comDado.includes(nomes[i])) { outra = nomes[i]; break; }
      }
    }
    return [outra, escolhida].filter(Boolean).sort((a, b) => nomes.indexOf(a) - nomes.indexOf(b));
  }

  function gerarRelatorio() {
    if (!aplicarLiberacao()) return;
    const escolhida = $("resAvaliacao") ? $("resAvaliacao").value : "";
    const ano = $("resAno") ? $("resAno").value : "";
    const turma = $("resTurma") ? $("resTurma").value : "";
    const disciplinaNome = $("resDisciplina") ? $("resDisciplina").value : "";
    const box = $("resRelatorio");
    if (!box) return;
    const recorteOk = recorteMunicipal() || (escolaEscolhida() && turma);
    if (!escolhida || !ano || !disciplinaNome || !recorteOk) {
      limparRelatorio();
      return;
    }
    const pack = lerPack();
    const disciplina = disciplinaPorNome(pack, disciplinaNome);
    const nomes = parComparavel(pack, ano, disciplina, escolhida);
    const medicoes = nomes.map((nome) => medirAvaliacao(pack, nome, ano, disciplina));
    const cartoes = medicoes.map((med, i) => {
      const atual = proficienciaDe(med.media);
      const anterior = i > 0 ? proficienciaDe(medicoes[i - 1].media) : null;
      const delta = i > 0 && atual != null && anterior != null ? htmlDelta(atual, anterior) : "";
      return htmlMedidor(med, delta, i > 0, i);
    }).join("");
    const detalhes = medicoes.map((med) => `
      <section class="res-detalhe">
        <h3>${esc(med.nome)}</h3>
        ${htmlBloco(disciplina, med.qs, med.alunos, med.rosterTotal, med.escalas)}
        ${htmlLista([{ disciplina, qs: med.qs, alunos: med.alunos }], med.escalas)}
      </section>
    `).join("");
    const recorte = recorteMunicipal() ? "Rede municipal" : `${escolaEscolhida()} · ${turma === TURMA_TODA ? "Escola toda" : turma}`;
    box.innerHTML = `
      ${htmlAbas()}
      <p class="res-aviso">${esc(ano)} ano · ${esc(disciplina.nome)} · ${esc(recorte)}</p>
      <div class="res-painel-cards">${cartoes}</div>
      ${detalhes}
    `;
    atualizarImpressao();
  }

  async function entrar(ev) {
    ev.preventDefault();
    const loginEl = $("resLoginCampo");
    const senhaEl = $("resSenhaCampo");
    const erro = $("resErro");
    const botao = ev.currentTarget.querySelector("button[type='submit']");
    const login = loginEl ? loginEl.value.trim() : "";
    const senha = senhaEl ? senhaEl.value.trim() : "";
    if (erro) erro.textContent = "";
    if (!login || !senha) {
      if (erro) erro.textContent = "Informe o login e a senha.";
      return;
    }
    if (botao) botao.disabled = true;
    try {
      const item = buscarLogin(login);
      const hash = await hashSenha(senha);
      const esperado = item && item.senhaHash ? String(item.senhaHash).toLowerCase() : "";
      if (!item || hash !== esperado) {
        if (erro) erro.textContent = "Login ou senha incorretos.";
        return;
      }
      const gravada = item.mestre
        ? { login: item.login, mestre: true }
        : { login: item.login, escola: item.escola };
      if (item.mestre && window.gravarSessaoMestre) window.gravarSessaoMestre(item.login);
      else sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(gravada));
      if (senhaEl) senhaEl.value = "";
      sessao = gravada;
      await mostrarConsulta();
    } finally {
      if (botao) botao.disabled = false;
    }
  }

  function sair() {
    if (sessao && sessao.mestre && window.sairSessaoMestre) window.sairSessaoMestre();
    else {
      try { sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* volta ao login */ }
    }
    if ($("resSenhaCampo")) $("resSenhaCampo").value = "";
    if ($("resLoginCampo")) $("resLoginCampo").value = "";
    if ($("resErro")) $("resErro").textContent = "";
    mostrarLogin();
    const campo = $("resLoginCampo");
    if (campo) campo.focus();
  }

  function ligar() {
    const form = $("resLogin");
    if (!form || form.dataset.ligado) return;
    form.dataset.ligado = "1";
    form.addEventListener("submit", entrar);
    const sairBtn = $("resSair");
    if (sairBtn) sairBtn.addEventListener("click", sair);
    const gerar = $("resGerar");
    if (gerar) gerar.addEventListener("click", gerarRelatorio);
    const imprimir = $("resImprimir");
    if (imprimir) imprimir.addEventListener("click", imprimirRelatorio);
    ["resAvaliacao", "resRede", "resAno", "resTurma", "resDisciplina"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", () => {
        if (id === "resRede" || id === "resAno") preencherTurmas();
        limparRelatorio();
        atualizarBotao();
      });
    });
    const relatorio = $("resRelatorio");
    if (relatorio) {
      relatorio.addEventListener("click", (ev) => {
        const aba = ev.target.closest("[data-res-aba]");
        if (!aba || !sessao || !sessao.mestre) return;
        const rede = $("resRede");
        if (!rede) return;
        if (aba.dataset.resAba === "municipio") rede.value = REDE_MUNICIPIO;
        else if (aba.dataset.escola) rede.value = aba.dataset.escola;
        preencherTurmas();
        limparRelatorio();
        atualizarBotao();
        const gerar = $("resGerar");
        if (gerar && !gerar.disabled) gerarRelatorio();
      });
    }
    const abrir = $("abrirResultadosCapa");
    if (abrir) abrir.addEventListener("click", pedirSenha);
    mostrarLogin();
  }

  function pedirSenha() {
    try { sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* pede a senha de novo */ }
    sessao = null;
    if ($("resSenhaCampo")) $("resSenhaCampo").value = "";
    if ($("resErro")) $("resErro").textContent = "";
    mostrarLogin();
    const campo = $("resLoginCampo");
    if (campo) campo.focus();
  }

    window.addEventListener("storage", (ev) => {
      if (ev.key && ev.key !== "avalie-resultado-liberacao" && ev.key !== "avalie-cadastro-avaliacoes") return;
      if ($("resConsulta") && !$("resConsulta").hidden && lerSessao()) mostrarConsulta();
    });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ligar);
    else ligar();
    window.addEventListener("afterprint", () => document.body.classList.remove("res-imprimindo"));
})();
