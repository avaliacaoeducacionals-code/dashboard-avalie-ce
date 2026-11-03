/* Corretor por ano. Dados só neste navegador. */
(function () {
  const ANOS = ["1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º"];
  const CHAVE = "avalie-corretor-v1";
  const NUM_FALA = {
    UM: 1, UMA: 1, DOIS: 2, DUAS: 2, TRES: 3, QUATRO: 4, CINCO: 5,
    SEIS: 6, SETE: 7, OITO: 8, NOVE: 9, DEZ: 10, ONZE: 11, DOZE: 12,
    TREZE: 13, CATORZE: 14, QUATORZE: 14, QUINZE: 15, DEZESSEIS: 16,
    DEZESSETE: 17, DEZOITO: 18, DEZENOVE: 19, VINTE: 20,
  };

  const $ = (id) => document.getElementById(id);
  let pack = null;
  let anoAtual = "1º";
  let editIndex = -1;
  let chartQ = null;
  let chartP = null;
  let recognition = null;
  let ouvindo = false;
  let iniciado = false;

  function soltarRotulosGlobais() {
    try {
      if (window.Chart && window.ChartDataLabels) Chart.unregister(ChartDataLabels);
    } catch (e) { /* o plugin pode não ter se registrado */ }
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function disciplinasPadrao() {
    return [
      { id: "d-portugues", nome: "Português" },
      { id: "d-matematica", nome: "Matemática" },
    ];
  }

  function anoVazio() {
    return {
      escolaId: "",
      disciplinaId: "",
      nome: "",
      data: "",
      matriculados: "",
      nQuestoes: 10,
      escalas: [
        { nome: "Crítico", min: 0, max: 30 },
        { nome: "Básico", min: 31, max: 60 },
        { nome: "Adequado", min: 61, max: 100 },
      ],
      questions: [],
      students: [],
    };
  }

  function packVazio() {
    const anos = {};
    ANOS.forEach((a) => { anos[a] = anoVazio(); });
    return { escolas: [], disciplinas: disciplinasPadrao(), anos };
  }

  function carregar() {
    try {
      const raw = localStorage.getItem(CHAVE);
      if (!raw) return packVazio();
      const data = JSON.parse(raw);
      const base = packVazio();
      base.escolas = Array.isArray(data.escolas) ? data.escolas.filter((e) => e && e.id && e.nome) : [];
      if (Array.isArray(data.disciplinas)) {
        base.disciplinas = data.disciplinas.filter((d) => d && d.id && d.nome);
      }
      ANOS.forEach((a) => {
        const salvo = data.anos && data.anos[a];
        if (salvo && typeof salvo === "object") base.anos[a] = { ...anoVazio(), ...salvo };
      });
      return base;
    } catch (e) {
      return packVazio();
    }
  }

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(pack)); } catch (e) { /* armazenamento cheio ou bloqueado */ }
  }

  function atual() {
    return pack.anos[anoAtual];
  }

  function nomeEscola(id) {
    const hit = pack.escolas.find((e) => e.id === id);
    return hit ? hit.nome : "";
  }

  function nomeDisciplina(id) {
    const hit = pack.disciplinas.find((d) => d.id === id);
    return hit ? hit.nome : "";
  }

  function opcoesTipo(tipo) {
    if (tipo === "2") return ["V", "F"];
    if (tipo === "5") return ["1", "2", "3", "4", "5"];
    return ["1", "2", "3", "4"];
  }

  function selectHtml(id, valor, opcoes, comBranco) {
    const lista = comBranco ? ["-", ...opcoes] : opcoes.slice();
    const atualValor = lista.includes(valor) ? valor : lista[0];
    const idAttr = id ? ` id="${id}"` : "";
    return `<select${idAttr}>${lista.map((op) => `<option value="${op}"${op === atualValor ? " selected" : ""}>${op === "-" ? "—" : op}</option>`).join("")}</select>`;
  }

  function lerEscalas() {
    return [...document.querySelectorAll("#crEscalas .corretor-escala")].map((row) => ({
      nome: row.querySelector(".cr-nome").value.trim(),
      min: Number(row.querySelector(".cr-min").value),
      max: Number(row.querySelector(".cr-max").value),
    }));
  }

  function lerQuestoesDoDom() {
    const nodes = [...document.querySelectorAll("#crGabarito .corretor-q")];
    return nodes.map((node, i) => {
      const tipo = node.querySelector(".cr-tipo").value;
      const op = opcoesTipo(tipo);
      let correta = node.querySelector(".cr-correta").value;
      if (!op.includes(correta)) correta = op[0];
      return { type: tipo, correct: correta, i };
    }).map(({ type, correct }) => ({ type, correct }));
  }

  function gravarFormulario() {
    const a = atual();
    const escola = $("crEscola");
    if (escola) a.escolaId = escola.value;
    const disciplina = $("crDisciplina");
    if (disciplina) a.disciplinaId = disciplina.value;
    if ($("crNome")) a.nome = $("crNome").value.trim();
    if ($("crData")) a.data = $("crData").value;
    if ($("crMatriculados")) a.matriculados = $("crMatriculados").value;
    if ($("crNQuest")) a.nQuestoes = Math.max(1, Number($("crNQuest").value) || a.nQuestoes || 10);
    if (document.querySelector("#crEscalas .corretor-escala")) a.escalas = lerEscalas();
    if (document.querySelector("#crGabarito .corretor-q")) a.questions = lerQuestoesDoDom();
  }

  function nivelDe(p) {
    const xs = (atual().escalas || [])
      .filter((s) => s.nome && Number.isFinite(Number(s.min)) && Number.isFinite(Number(s.max)))
      .map((s) => ({ nome: s.nome, min: Number(s.min), max: Number(s.max) }))
      .sort((a, b) => a.min - b.min);
    const hit = xs.find((s) => p >= s.min && p <= s.max);
    if (hit) return hit.nome;
    let abaixo = null;
    xs.forEach((s) => { if (s.max < p) abaixo = s; });
    return abaixo ? abaixo.nome : "N/A";
  }

  function notaAluno(student) {
    const qs = atual().questions;
    if (!qs.length) return 0;
    let certos = 0;
    qs.forEach((q, i) => { if (student.answers[i] === q.correct) certos += 1; });
    return (100 * certos) / qs.length;
  }

  function pintarAbas() {
    const box = $("corretorAnos");
    box.innerHTML = ANOS.map((ano) => `
      <button type="button" role="tab" data-ano="${ano}" aria-selected="${ano === anoAtual ? "true" : "false"}">${ano} ano</button>
    `).join("");
  }

  function pintarEscolas() {
    const ul = $("crEscolasLista");
    if (!pack.escolas.length) {
      ul.innerHTML = "<li><span>Nenhuma escola cadastrada.</span></li>";
    } else {
      ul.innerHTML = pack.escolas.map((e) => `
        <li>
          <span>${esc(e.nome)}</span>
          <button type="button" class="btn-compare corretor-excluir" data-del-escola="${esc(e.id)}">Excluir</button>
        </li>
      `).join("");
    }
    const sel = $("crEscola");
    const id = atual().escolaId;
    sel.innerHTML = `<option value="">Selecione a escola</option>` + pack.escolas.map((e) => `
      <option value="${esc(e.id)}">${esc(e.nome)}</option>
    `).join("");
    sel.value = pack.escolas.some((e) => e.id === id) ? id : "";
    atual().escolaId = sel.value;
  }

  function pintarDisciplinas() {
    const ul = $("crDisciplinasLista");
    if (!pack.disciplinas.length) {
      ul.innerHTML = "<li><span>Nenhuma disciplina cadastrada.</span></li>";
    } else {
      ul.innerHTML = pack.disciplinas.map((d) => `
        <li>
          <span>${esc(d.nome)}</span>
          <button type="button" class="btn-compare corretor-excluir" data-del-disciplina="${esc(d.id)}">Excluir</button>
        </li>
      `).join("");
    }
    const sel = $("crDisciplina");
    const id = atual().disciplinaId;
    sel.innerHTML = `<option value="">Selecione a disciplina</option>` + pack.disciplinas.map((d) => `
      <option value="${esc(d.id)}">${esc(d.nome)}</option>
    `).join("");
    sel.value = pack.disciplinas.some((d) => d.id === id) ? id : "";
    atual().disciplinaId = sel.value;
  }

  function pintarCampos() {
    const a = atual();
    $("crNome").value = a.nome || "";
    $("crData").value = a.data || "";
    $("crMatriculados").value = a.matriculados || "";
    $("crNQuest").value = a.nQuestoes || a.questions.length || 10;
  }

  function pintarEscalas() {
    const box = $("crEscalas");
    const escalas = atual().escalas.length ? atual().escalas : anoVazio().escalas;
    box.innerHTML = escalas.map((s) => `
      <div class="corretor-escala">
        <input class="cr-nome" type="text" value="${esc(s.nome)}" placeholder="Nome do nível" />
        <input class="cr-min" type="number" min="0" max="100" value="${Number.isFinite(Number(s.min)) ? s.min : 0}" aria-label="Percentual mínimo" />
        <input class="cr-max" type="number" min="0" max="100" value="${Number.isFinite(Number(s.max)) ? s.max : 0}" aria-label="Percentual máximo" />
        <button type="button" class="btn-compare corretor-excluir cr-remover-escala">Excluir</button>
      </div>
    `).join("");
  }

  function pintarGabarito() {
    const box = $("crGabarito");
    const qs = atual().questions;
    box.innerHTML = qs.map((q, i) => {
      const tipo = q.type === "5" || q.type === "2" ? q.type : "4";
      const op = opcoesTipo(tipo);
      const correta = op.includes(q.correct) ? q.correct : op[0];
      return `
        <div class="corretor-q">
          <strong>Questão ${i + 1}</strong>
          ${selectHtml("", correta, op, false).replace("<select", '<select class="cr-correta" aria-label="Resposta da questão ' + (i + 1) + '"')}
          <select class="cr-tipo" aria-label="Tipo da questão ${i + 1}">
            <option value="4"${tipo === "4" ? " selected" : ""}>4 opções</option>
            <option value="5"${tipo === "5" ? " selected" : ""}>5 opções</option>
            <option value="2"${tipo === "2" ? " selected" : ""}>V/F</option>
          </select>
        </div>
      `;
    }).join("");
    $("crLancamento").hidden = qs.length === 0;
    if (qs.length) pintarRespostas();
  }

  function pintarRespostas(valores) {
    const qs = atual().questions;
    const box = $("crRespostas");
    box.innerHTML = qs.map((q, i) => {
      const op = opcoesTipo(q.type);
      const valor = valores && valores[i] ? valores[i] : "-";
      return `
        <div class="corretor-q">
          <strong>Q${i + 1}</strong>
          ${selectHtml("crResp" + i, valor, op, true)}
        </div>
      `;
    }).join("");
  }

  function pintarAlunos() {
    const alunos = atual().students;
    $("crListaBox").hidden = alunos.length === 0 && editIndex < 0;
    $("crQtdAlunos").textContent = String(alunos.length);
    $("crLista").innerHTML = alunos.map((s, i) => `
      <tr>
        <td>${esc(s.name)}</td>
        <td>${esc((s.answers || []).join(" "))}</td>
        <td>
          <button type="button" class="btn-compare" data-edit-aluno="${i}">Editar</button>
          <button type="button" class="btn-compare corretor-excluir" data-del-aluno="${i}">Excluir</button>
        </td>
      </tr>
    `).join("");
    const btn = $("crSalvarAluno");
    btn.textContent = editIndex >= 0 ? "Atualizar aluno" : "Salvar respostas do aluno";
  }

  function pintar() {
    pintarAbas();
    pintarEscolas();
    pintarDisciplinas();
    pintarCampos();
    pintarEscalas();
    pintarGabarito();
    pintarAlunos();
    $("crResultados").hidden = true;
  }

  function querRealizar() {
    try {
      return new URLSearchParams(location.search).get("realizar") === "1";
    } catch (e) {
      return false;
    }
  }

  function marcarTela(realizar) {
    try {
      const u = new URL(location.href);
      if (realizar) u.searchParams.set("realizar", "1");
      else u.searchParams.delete("realizar");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (e) { /* o endereço acompanha a tela quando o navegador permite */ }
  }

  function mostrarBanco() {
    pararVoz();
    $("crAplicacao").hidden = true;
    $("crBanco").hidden = false;
    marcarTela(false);
  }

  function mostrarAplicacao() {
    const a = atual();
    const escola = nomeEscola(a.escolaId) || "Escola não escolhida";
    const disciplina = nomeDisciplina(a.disciplinaId) || "Disciplina não escolhida";
    $("crAplicacaoContexto").textContent = `${anoAtual} ano · ${escola} · ${disciplina}`;
    $("crBanco").hidden = true;
    $("crAplicacao").hidden = false;
    $("crLancamento").hidden = false;
    const emEdicao = editIndex >= 0 ? a.students[editIndex] : null;
    const jaTem = document.querySelectorAll("#crRespostas .corretor-q").length;
    if (emEdicao) pintarRespostas(emEdicao.answers);
    else if (jaTem !== a.questions.length) pintarRespostas();
    pintarAlunos();
    if (a.questions.length && a.students.length) gerarResultados(false);
    else $("crResultados").hidden = true;
    marcarTela(true);
    $("crAluno").focus();
  }

  function adicionarEscola() {
    const nome = $("crNovaEscola").value.trim();
    if (!nome) {
      $("crNovaEscola").focus();
      return;
    }
    const repetida = pack.escolas.some((e) => e.nome.localeCompare(nome, "pt-BR", { sensitivity: "accent" }) === 0);
    if (repetida) {
      alert("Essa escola já está cadastrada.");
      return;
    }
    gravarFormulario();
    pack.escolas.push({ id: "e" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36), nome });
    pack.escolas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    $("crNovaEscola").value = "";
    salvar();
    pintarEscolas();
  }

  function excluirEscola(id) {
    const escola = pack.escolas.find((e) => e.id === id);
    if (!escola) return;
    const uso = ANOS.filter((ano) => pack.anos[ano].escolaId === id);
    if (uso.length) {
      alert(`${escola.nome} está em uso na avaliação do ${uso.join(", ")}. Escolha outra escola nesses anos antes de excluir.`);
      return;
    }
    gravarFormulario();
    pack.escolas = pack.escolas.filter((e) => e.id !== id);
    salvar();
    pintarEscolas();
  }

  function adicionarDisciplina() {
    const nome = $("crNovaDisciplina").value.trim();
    if (!nome) {
      $("crNovaDisciplina").focus();
      return;
    }
    const repetida = pack.disciplinas.some((d) => d.nome.localeCompare(nome, "pt-BR", { sensitivity: "accent" }) === 0);
    if (repetida) {
      alert("Essa disciplina já está cadastrada.");
      return;
    }
    gravarFormulario();
    pack.disciplinas.push({ id: "d" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36), nome });
    pack.disciplinas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    $("crNovaDisciplina").value = "";
    salvar();
    pintarDisciplinas();
  }

  function excluirDisciplina(id) {
    const disciplina = pack.disciplinas.find((d) => d.id === id);
    if (!disciplina) return;
    const uso = ANOS.filter((ano) => pack.anos[ano].disciplinaId === id);
    if (uso.length) {
      alert(`${disciplina.nome} está em uso na avaliação do ${uso.join(", ")}. Escolha outra disciplina nesses anos antes de excluir.`);
      return;
    }
    gravarFormulario();
    pack.disciplinas = pack.disciplinas.filter((d) => d.id !== id);
    salvar();
    pintarDisciplinas();
  }

  function selecionarAno(ano) {
    if (!ANOS.includes(ano) || ano === anoAtual) return;
    gravarFormulario();
    salvar();
    anoAtual = ano;
    editIndex = -1;
    $("crAluno").value = "";
    pintar();
    mostrarBanco();
  }

  function configurarQuestoes() {
    gravarFormulario();
    const n = Math.max(1, Math.min(60, Number($("crNQuest").value) || 0));
    if (!n) {
      alert("Informe o número de questões.");
      return;
    }
    const a = atual();
    if (a.students.length && n !== a.questions.length) {
      const segue = confirm("O número de questões mudou. As respostas já lançadas serão ajustadas a esse tamanho. Continuar?");
      if (!segue) {
        $("crNQuest").value = a.questions.length || a.nQuestoes;
        return;
      }
    }
    const qs = a.questions.slice(0, n);
    while (qs.length < n) qs.push({ type: "4", correct: "1" });
    a.questions = qs;
    a.nQuestoes = n;
    a.students.forEach((s) => {
      const resp = (s.answers || []).slice(0, n);
      while (resp.length < n) resp.push("-");
      s.answers = resp;
    });
    salvar();
    pintarGabarito();
    pintarAlunos();
  }

  function salvarGabarito() {
    if (!document.querySelector("#crGabarito .corretor-q")) {
      alert("Configure as questões antes de salvar o gabarito.");
      return;
    }
    gravarFormulario();
    salvar();
    pintarRespostas();
    pintarAlunos();
  }

  function lerRespostasDom() {
    return atual().questions.map((_, i) => {
      const el = $("crResp" + i);
      return el ? el.value : "-";
    });
  }

  function salvarAluno() {
    const nome = $("crAluno").value.trim();
    if (!nome) {
      alert("Informe o nome do aluno.");
      $("crAluno").focus();
      return;
    }
    if (!atual().questions.length) {
      alert("Salve o gabarito antes de lançar alunos.");
      return;
    }
    gravarFormulario();
    const answers = lerRespostasDom();
    if (editIndex >= 0) {
      atual().students[editIndex] = { name: nome, answers };
      editIndex = -1;
    } else {
      atual().students.push({ name: nome, answers });
    }
    salvar();
    $("crAluno").value = "";
    pintarRespostas();
    pintarAlunos();
    $("crListaBox").hidden = false;
    $("crAluno").focus();
  }

  function editarAluno(index) {
    const aluno = atual().students[index];
    if (!aluno) return;
    editIndex = index;
    $("crAluno").value = aluno.name;
    pintarRespostas(aluno.answers);
    pintarAlunos();
    $("crLancamento").hidden = false;
    $("crAluno").focus();
  }

  function excluirAluno(index) {
    if (!confirm("Excluir as respostas deste aluno?")) return;
    atual().students.splice(index, 1);
    if (editIndex === index) editIndex = -1;
    salvar();
    pintarRespostas();
    pintarAlunos();
  }

  function gerarResultados(rolar) {
    gravarFormulario();
    salvar();
    const a = atual();
    if (!a.questions.length || !a.students.length) {
      alert("Salve o gabarito e lance ao menos um aluno.");
      return;
    }
    const presentes = a.students.length;
    const aptos = Number(a.matriculados) || 0;
    const ausencia = aptos > 0 ? ((aptos - presentes) / aptos) * 100 : 0;
    const notas = a.students.map(notaAluno);
    const media = notas.reduce((s, n) => s + n, 0) / notas.length;
    const ordenadas = [...notas].sort((x, y) => x - y);
    const meio = Math.floor(ordenadas.length / 2);
    const mediana = ordenadas.length % 2 ? ordenadas[meio] : (ordenadas[meio - 1] + ordenadas[meio]) / 2;
    const variancia = notas.reduce((s, n) => s + (n - media) ** 2, 0) / notas.length;
    const desvio = Math.sqrt(variancia);
    const escola = nomeEscola(a.escolaId) || "Escola não escolhida";
    const disciplina = nomeDisciplina(a.disciplinaId) || "Disciplina não escolhida";
    $("crTituloResultado").textContent = `Resultado — ${anoAtual} ano — ${disciplina}`;
    $("crMetaResultado").textContent = `${escola} · ${disciplina} · ${a.nome || "Avaliação sem nome"}${a.data ? " · " + a.data : ""}`;
    $("crKpis").innerHTML = `
      <div class="kpi"><span>Presentes</span><strong>${presentes}</strong></div>
      <div class="kpi"><span>Ausência</span><strong>${ausencia.toFixed(1)}%</strong></div>
      <div class="kpi"><span>Média</span><strong>${media.toFixed(1)}%</strong></div>
      <div class="kpi"><span>Nível</span><strong>${esc(nivelDe(media))}</strong></div>
      <div class="kpi"><span>Mediana</span><strong>${mediana.toFixed(1)}%</strong></div>
      <div class="kpi"><span>Desvio</span><strong>${desvio.toFixed(2)}</strong></div>
    `;
    $("crResultados").hidden = false;
    pintarMatriz();
    pintarGraficos();
    if (rolar) $("crResultados").scrollIntoView({ behavior: "smooth" });
  }

  function pintarMatriz() {
    const a = atual();
    const qs = a.questions;
    const alunos = [...a.students].sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));
    const acertosQ = new Array(qs.length).fill(0);
    const marcas = ["1", "2", "3", "4"];
    if (qs.some((q) => q.type === "5")) marcas.push("5");
    if (qs.some((q) => q.type === "2")) marcas.push("V", "F");
    marcas.push("-");
    const freq = qs.map(() => Object.fromEntries(marcas.map((m) => [m, 0])));

    let head = "<thead><tr><th>Estudante</th>";
    qs.forEach((_, i) => { head += `<th>${i + 1}</th>`; });
    head += "<th>Acertos</th><th>%</th><th>Nível</th></tr></thead>";

    let body = "<tbody>";
    alunos.forEach((aluno) => {
      let certos = 0;
      let row = `<tr><td>${esc(aluno.name)}</td>`;
      qs.forEach((q, i) => {
        const resp = aluno.answers[i] || "-";
        if (freq[i][resp] == null) freq[i][resp] = 0;
        freq[i][resp] += 1;
        if (resp === q.correct) {
          certos += 1;
          acertosQ[i] += 1;
          row += '<td class="ok">✓</td>';
        } else {
          row += `<td class="erro">${esc(resp)} (X)</td>`;
        }
      });
      const perc = qs.length ? Math.round((100 * certos) / qs.length) : 0;
      const classe = perc === 100 ? "alta" : (perc >= 50 ? "media" : "baixa");
      row += `<td>${certos}</td><td class="${classe}">${perc}</td><td>${esc(nivelDe(perc))}</td></tr>`;
      body += row;
    });
    body += "</tbody>";

    let foot = `<tfoot><tr><td>Acertos da turma</td>`;
    acertosQ.forEach((n) => { foot += `<td>${n}</td>`; });
    foot += "<td></td><td></td><td></td></tr><tr><td>% de acerto</td>";
    const percQ = acertosQ.map((n) => (alunos.length ? Math.round((100 * n) / alunos.length) : 0));
    percQ.forEach((p) => {
      const classe = p >= 70 ? "ok" : (p <= 30 ? "erro" : "");
      foot += `<td class="${classe}">${p}%</td>`;
    });
    foot += "<td></td><td></td><td></td></tr><tr><td>Nível da questão</td>";
    percQ.forEach((p) => { foot += `<td>${esc(nivelDe(p))}</td>`; });
    foot += "<td></td><td></td><td></td></tr>";
    marcas.forEach((marca) => {
      foot += `<tr><td>Marcaram ${marca === "-" ? "em branco" : marca}</td>`;
      freq.forEach((f, i) => {
        const certa = qs[i].correct === marca;
        foot += `<td${certa ? ' class="ok"' : ""}>${f[marca] || 0}</td>`;
      });
      foot += "<td></td><td></td><td></td></tr>";
    });
    foot += "</tfoot>";
    $("crMatriz").innerHTML = head + body + foot;
  }

  function pintarGraficos() {
    if (!window.Chart) return;
    const a = atual();
    const qs = a.questions;
    const acertos = qs.map((q, i) => a.students.filter((s) => s.answers[i] === q.correct).length);
    const perc = acertos.map((n) => (a.students.length ? (100 * n) / a.students.length : 0));
    const plugin = window.ChartDataLabels ? [ChartDataLabels] : [];
    if (chartQ) chartQ.destroy();
    chartQ = new Chart($("crChartQ"), {
      type: "bar",
      plugins: plugin,
      data: {
        labels: qs.map((_, i) => "Q" + (i + 1)),
        datasets: [{ label: "% de acerto", data: perc, backgroundColor: "#2ec4b6", borderRadius: 4 }],
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: "Acertos por questão" },
          legend: { display: false },
          datalabels: { color: "#062027", font: { weight: "bold" }, formatter: (v) => Math.round(v) + "%" },
        },
        scales: { y: { beginAtZero: true, max: 100 } },
      },
    });

    const faixas = {};
    (a.escalas || []).forEach((s) => { if (s.nome) faixas[s.nome] = 0; });
    a.students.forEach((s) => {
      const nivel = nivelDe(notaAluno(s));
      if (faixas[nivel] == null) faixas[nivel] = 0;
      faixas[nivel] += 1;
    });
    if (chartP) chartP.destroy();
    chartP = new Chart($("crChartP"), {
      type: "doughnut",
      plugins: plugin,
      data: {
        labels: Object.keys(faixas),
        datasets: [{
          data: Object.values(faixas),
          backgroundColor: ["#e53935", "#ffbf69", "#7bd389", "#5eb8d6", "#c4a574"],
        }],
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: "Alunos por nível" },
          datalabels: {
            color: "#062027",
            font: { weight: "bold" },
            formatter: (v, ctx) => {
              const total = ctx.dataset.data.reduce((s, n) => s + n, 0);
              return v > 0 && total ? Math.round((100 * v) / total) + "%" : "";
            },
          },
        },
      },
    });
  }

  async function exportarPdf() {
    if ($("crResultados").hidden) {
      alert("Gere o relatório antes de exportar.");
      return;
    }
    const btn = $("crPdf");
    const texto = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Gerando PDF...";
    try {
      window.scrollTo(0, 0);
      const topo = await html2canvas($("crDashboardTop"), { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const tabela = await html2canvas($("crMatrizBox"), { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("l", "pt", "a4");
      const largura = pdf.internal.pageSize.getWidth();
      const altura = pdf.internal.pageSize.getHeight();
      const a = atual();
      const escola = nomeEscola(a.escolaId) || "Escola não escolhida";
      const disciplina = nomeDisciplina(a.disciplinaId) || "Disciplina não escolhida";
      pdf.setFontSize(16);
      pdf.text(`Corretor — ${anoAtual} ano — ${disciplina}`, 24, 28);
      pdf.setFontSize(11);
      pdf.text(`${escola}  ·  ${disciplina}  ·  ${a.nome || "Avaliação sem nome"}`, 24, 46);
      const h1 = ((largura - 48) * topo.height) / topo.width;
      pdf.addImage(topo.toDataURL("image/png"), "PNG", 24, 60, largura - 48, h1);
      const h2 = ((largura - 48) * tabela.height) / tabela.width;
      const altPagina = Math.max(altura, h2 + 36);
      pdf.addPage([largura, altPagina], "l");
      pdf.addImage(tabela.toDataURL("image/png"), "PNG", 24, 18, largura - 48, h2);
      const arquivo = `Corretor_${anoAtual.replace("º", "ano")}_${escola}_${disciplina}`.replace(/[^\w\-]+/g, "_");
      pdf.save(arquivo + ".pdf");
    } catch (e) {
      alert("Não foi possível gerar o PDF neste navegador.");
    } finally {
      btn.disabled = false;
      btn.textContent = texto;
    }
  }

  function aplicarFala(texto) {
    let fala = texto.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (/\b(PARAR|FINALIZAR)\b/.test(fala)) {
      pararVoz();
      return;
    }
    fala = fala.replace(/\bQUESTAO\b/g, "Q");
    Object.entries(NUM_FALA).forEach(([palavra, n]) => {
      fala = fala.replace(new RegExp("\\b" + palavra + "\\b", "g"), String(n));
    });
    const padroes = [
      /Q\s*(\d{1,2})\s*[:\-]?\s*([1-5]|V|F)\b/g,
      /(\d{1,2})\s*[:\-]\s*([1-5]|V|F)\b/g,
      /(\d{1,2})\s+([1-5]|V|F)\b/g,
    ];
    padroes.forEach((re) => {
      let match = re.exec(fala);
      while (match) {
        const indice = Number(match[1]) - 1;
        const resp = match[2];
        const q = atual().questions[indice];
        const campo = $("crResp" + indice);
        if (q && campo && (resp === "-" || opcoesTipo(q.type).includes(resp))) campo.value = resp;
        match = re.exec(fala);
      }
    });
  }

  function prepararVoz() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    recognition = new SR();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        if (ev.results[i].isFinal) aplicarFala(ev.results[i][0].transcript);
      }
      $("crVozTexto").textContent = "Ditado aplicado nos campos numéricos.";
    };
  }

  function iniciarVoz() {
    if (!recognition) {
      $("crVozTexto").textContent = "Este navegador não oferece ditado. Use Chrome.";
      return;
    }
    recognition.start();
    ouvindo = true;
    $("crVozIniciar").disabled = true;
    $("crVozPausar").disabled = false;
    $("crVozParar").disabled = false;
    $("crVozTexto").textContent = "Pode falar: “um 1”, “dois 3” ou “questão 1: 2”.";
  }

  function pausarVoz() {
    if (!recognition) return;
    if (ouvindo) {
      recognition.stop();
      ouvindo = false;
      $("crVozPausar").textContent = "Continuar";
    } else {
      recognition.start();
      ouvindo = true;
      $("crVozPausar").textContent = "Pausar";
    }
  }

  function pararVoz() {
    if (recognition) recognition.stop();
    ouvindo = false;
    $("crVozIniciar").disabled = false;
    $("crVozPausar").disabled = true;
    $("crVozParar").disabled = true;
    $("crVozPausar").textContent = "Pausar";
  }

  function iniciar() {
    if (iniciado) return;
    iniciado = true;
    soltarRotulosGlobais();
    pack = carregar();
    prepararVoz();
    $("crAddEscola").addEventListener("click", adicionarEscola);
    $("crNovaEscola").addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") adicionarEscola();
    });
    $("crEscolasLista").addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-del-escola]");
      if (btn) excluirEscola(btn.dataset.delEscola);
    });
    $("crAddDisciplina").addEventListener("click", adicionarDisciplina);
    $("crNovaDisciplina").addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") adicionarDisciplina();
    });
    $("crDisciplinasLista").addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-del-disciplina]");
      if (btn) excluirDisciplina(btn.dataset.delDisciplina);
    });
    $("corretorAnos").addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-ano]");
      if (btn) selecionarAno(btn.dataset.ano);
    });
    $("crEscola").addEventListener("change", () => { gravarFormulario(); salvar(); });
    $("crDisciplina").addEventListener("change", () => { gravarFormulario(); salvar(); });
    ["crNome", "crData", "crMatriculados", "crNQuest"].forEach((id) => {
      $(id).addEventListener("change", () => { gravarFormulario(); salvar(); });
    });
    $("crAddEscala").addEventListener("click", () => {
      gravarFormulario();
      atual().escalas.push({ nome: "", min: 0, max: 0 });
      pintarEscalas();
    });
    $("crEscalas").addEventListener("click", (ev) => {
      if (!ev.target.closest(".cr-remover-escala")) return;
      gravarFormulario();
      const linhas = [...document.querySelectorAll("#crEscalas .corretor-escala")];
      const idx = linhas.indexOf(ev.target.closest(".corretor-escala"));
      if (idx >= 0) atual().escalas.splice(idx, 1);
      salvar();
      pintarEscalas();
    });
    $("crEscalas").addEventListener("change", () => { gravarFormulario(); salvar(); });
    $("crConfigurar").addEventListener("click", configurarQuestoes);
    $("crGabarito").addEventListener("change", (ev) => {
      if (ev.target.classList.contains("cr-tipo")) {
        const card = ev.target.closest(".corretor-q");
        const correta = card.querySelector(".cr-correta");
        const op = opcoesTipo(ev.target.value);
        const valor = op.includes(correta.value) ? correta.value : op[0];
        correta.innerHTML = op.map((item) => `<option value="${item}">${item}</option>`).join("");
        correta.value = valor;
      }
      gravarFormulario();
      salvar();
    });
    $("crSalvarGabarito").addEventListener("click", salvarGabarito);
    $("crVoltarBanco").addEventListener("click", mostrarBanco);
    $("crSalvarAluno").addEventListener("click", salvarAluno);
    $("crAluno").addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") salvarAluno();
    });
    $("crLista").addEventListener("click", (ev) => {
      const ed = ev.target.closest("[data-edit-aluno]");
      const del = ev.target.closest("[data-del-aluno]");
      if (ed) editarAluno(Number(ed.dataset.editAluno));
      if (del) excluirAluno(Number(del.dataset.delAluno));
    });
    $("crGerar").addEventListener("click", () => gerarResultados(true));
    $("crPdf").addEventListener("click", exportarPdf);
    $("crVozIniciar").addEventListener("click", iniciarVoz);
    $("crVozPausar").addEventListener("click", pausarVoz);
    $("crVozParar").addEventListener("click", pararVoz);
    pintar();
    if (querRealizar()) mostrarAplicacao();
    else mostrarBanco();
  }

  window.corretorIrPara = function corretorIrPara(realizar) {
    iniciar();
    if (realizar) mostrarAplicacao();
    else mostrarBanco();
  };

  window.corretorAoAbrir = function corretorAoAbrir() {
    iniciar();
  };

  if (document.getElementById("crAddEscola")) {
    const subir = document.body.classList.contains("corretor-solo") ? window.corretorAoAbrir : iniciar;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", subir);
    else subir();
  }
})();
