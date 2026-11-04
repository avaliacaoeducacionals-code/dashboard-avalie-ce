/* Consulta de resultados da turma. A senha em texto nao entra aqui. */
(function () {
  const ANOS = ["1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º"];
  const CHAVE_PACK = "avalie-corretor-v1";
  const CHAVE_SESSAO = "avalie-resultados";
  const SITUACOES = ["N.D", "Falta", "Transferência"];
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

  function escolaEscolhida() {
    if (!sessao) return "";
    if (!sessao.mestre) return sessao.escola || "";
    const sel = $("resEscola");
    return sel ? sel.value : "";
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
    await carregarScript("dados_rede.js?v=eixo24");
    await carregarScript("dados_nominal.js?v=eixo24");
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
    const antes = sel.value;
    sel.innerHTML = `<option value="">Selecione o ano</option>` + ANOS.map((ano) => (
      `<option value="${esc(ano)}">${esc(ano)} ano</option>`
    )).join("");
    sel.value = ANOS.includes(antes) ? antes : "";
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

  function preencherTurmas() {
    const sel = $("resTurma");
    if (!sel) return;
    const antes = sel.value;
    const escola = escolaEscolhida();
    const ano = $("resAno") ? $("resAno").value : "";
    const lista = escola && ano ? turmasDa(escola, ano) : [];
    sel.innerHTML = `<option value="">Selecione a turma</option>` + lista.map((turma) => (
      `<option value="${esc(turma)}">${esc(turma)}</option>`
    )).join("");
    sel.value = lista.includes(antes) ? antes : "";
  }

  function atualizarBotao() {
    const btn = $("resGerar");
    if (!btn) return;
    const ano = $("resAno") && $("resAno").value;
    const turma = $("resTurma") && $("resTurma").value;
    btn.disabled = !(escolaEscolhida() && ano && turma);
  }

  async function mostrarConsulta() {
    sessao = lerSessao();
    if (!sessao) {
      mostrarLogin();
      return;
    }
    if ($("resLogin")) $("resLogin").hidden = true;
    if ($("resConsulta")) $("resConsulta").hidden = false;
    if (!sessao.mestre) {
      const box = $("resEscolaBox");
      const fixa = $("resEscolaFixa");
      if (box) box.hidden = true;
      if (fixa) {
        fixa.hidden = false;
        fixa.textContent = sessao.escola || "";
      }
    }
    const rel = $("resRelatorio");
    if (rel) rel.innerHTML = `<p class="res-aviso">Carregando as turmas da escola.</p>`;
    try {
      await garantirNominal();
    } catch (e) {
      if (rel) rel.innerHTML = `<p class="res-aviso">Não foi possível carregar as turmas.</p>`;
      return;
    }
    if (rel) rel.innerHTML = "";
    preencherEscolas();
    preencherAno();
    preencherTurmas();
    atualizarBotao();
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

  function lancamentosDe(pack, ano, disciplina, roster) {
    const anoObj = pack && pack.anos && pack.anos[ano];
    if (!anoObj) return [];
    const port = disciplinaPorNome(pack, "Português");
    return (anoObj.students || []).filter((aluno) => {
      const daTurma = (aluno.alunoId && roster.ids.has(String(aluno.alunoId))) || roster.nomes.has(fold(aluno.name));
      if (!daTurma) return false;
      if (aluno.disciplinaId) return aluno.disciplinaId === disciplina.id;
      return disciplina.id === port.id;
    });
  }

  function situacao(aluno) {
    const s = aluno && aluno.situacao;
    return SITUACOES.includes(s) ? s : "";
  }

  function notaDe(aluno, qs) {
    if (!qs.length) return null;
    let certos = 0;
    qs.forEach((q, i) => { if ((aluno.answers || [])[i] === q.correct) certos += 1; });
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
    const sit = situacao(aluno);
    if (sit) return sit;
    if (!qs.length) return "Sem gabarito";
    const nota = notaDe(aluno, qs);
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
    const presentesLista = alunos.filter((aluno) => !situacao(aluno));
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
      </section>
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

  function gerarRelatorio() {
    const escola = escolaEscolhida();
    const ano = $("resAno") ? $("resAno").value : "";
    const turma = $("resTurma") ? $("resTurma").value : "";
    const box = $("resRelatorio");
    if (!box) return;
    if (!escola || !ano || !turma) {
      box.innerHTML = `<p class="res-aviso">Escolha o ano e a turma.</p>`;
      return;
    }
    const pack = lerPack();
    const roster = rosterDaTurma(pack, escola, ano, turma);
    const anoObj = pack && pack.anos && pack.anos[ano] ? pack.anos[ano] : {};
    const escalas = Array.isArray(anoObj.escalas) && anoObj.escalas.length ? anoObj.escalas : [
      { nome: "Crítico", min: 0, max: 30 },
      { nome: "Básico", min: 31, max: 60 },
      { nome: "Adequado", min: 61, max: 100 },
    ];
    const blocos = ["Português", "Matemática"].map((nome) => {
      const disciplina = disciplinaPorNome(pack, nome);
      const qs = questoesDe(anoObj, disciplina, pack);
      const alunos = lancamentosDe(pack, ano, disciplina, roster);
      return { disciplina, qs, alunos };
    });
    const titulo = `Resultado — ${ano} ano — ${escola} — ${turma} — Português e Matemática`;
    box.innerHTML = `
      <h2>${esc(titulo)}</h2>
      <p class="res-aviso">${esc(escola)} · ${esc(turma)} · Português e Matemática</p>
      ${blocos.map((b) => htmlBloco(b.disciplina, b.qs, b.alunos, roster.total, escalas)).join("")}
      ${htmlLista(blocos, escalas)}
    `;
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
      sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(gravada));
      if (senhaEl) senhaEl.value = "";
      sessao = gravada;
      await mostrarConsulta();
    } finally {
      if (botao) botao.disabled = false;
    }
  }

  function sair() {
    try { sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* volta ao login */ }
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
    ["resEscola", "resAno", "resTurma"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", () => {
        if (id !== "resTurma") preencherTurmas();
        if ($("resRelatorio")) $("resRelatorio").innerHTML = "";
        atualizarBotao();
      });
    });
    const abrir = $("abrirResultadosCapa");
    if (abrir) {
      abrir.addEventListener("click", () => {
        if (lerSessao()) mostrarConsulta();
        else {
          mostrarLogin();
          const campo = $("resLoginCampo");
          if (campo) campo.focus();
        }
      });
    }
    sessao = lerSessao();
    if (sessao) mostrarConsulta();
    else mostrarLogin();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ligar);
  else ligar();
})();
