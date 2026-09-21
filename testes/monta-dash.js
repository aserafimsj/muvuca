// Monta uma pagina de teste com o Dashboard, dados de mentira espalhados no
// tempo e um Supabase falso. Sem login, sem rede, sem tocar no banco.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1]
  .replace(/ReactDOM\.createRoot\(document\.getElementById\('root'\)\)\.render\(<App\/>\);/, '');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

const CFG = {
  sentimentos:[{id:1,nome:'Positivo'},{id:2,nome:'Negativo'},{id:3,nome:'Neutro'},
               {id:4,nome:'Dúvida'},{id:5,nome:'Bot'},{id:6,nome:'Político'}],
  redes:[{id:1,nome:'Instagram'},{id:2,nome:'Facebook'},{id:3,nome:'YouTube'}],
  produtos:[{id:1,nome:'Selic'},{id:2,nome:'IPCA+'},{id:3,nome:'Prefixado'}],
  editorias:[{id:1,nome:'Educativo'},{id:2,nome:'Institucional'}],
};

// 60 comentarios espalhados nos ultimos 40 dias, com alguns dias vazios de
// proposito (o dia 9 e o 10 atras ficam sem nada), mais 3 SEM DATA.
const AUTORES = ['ana','bruno','carla','diego','ana','ana','bruno','elisa'];
const hoje = new Date();
const dia = n => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const COMENTARIOS = [];
let id = 1;
for(let atras = 39; atras >= 0; atras--){
  if(atras === 9 || atras === 10) continue;           // dois dias parados
  const quantos = (atras % 3 === 0) ? 2 : 1;
  for(let k = 0; k < quantos; k++){
    COMENTARIOS.push({
      id: id++, autor: AUTORES[id % AUTORES.length], texto: 'comentario ' + id,
      resposta: id % 3 === 0 ? 'resposta pronta' : '',
      sentimento_id: (id % 6) + 1,
      rede_id: (id % 3) + 1,
      produto_id: id % 4 === 0 ? null : (id % 3) + 1,
      editoria_id: id % 5 === 0 ? null : (id % 2) + 1,
      origem: id % 4 === 0 ? 'DM' : 'Feed',
      triagem: id % 5 === 0 ? 'Respondido' : (id % 7 === 0 ? 'Ignorar' : 'Pendente'),
      data_publicacao: dia(atras), link_conteudo: null,
      ia_em: '2026-09-20T23:00:00Z', ia_triagem: 'responder',
      ia_juridico: id % 11 === 0,
    });
  }
}
// Sem data nenhuma: so podem aparecer em "Todo o periodo".
for(let k = 0; k < 3; k++){
  COMENTARIOS.push({id: id++, autor:'semdata', texto:'sem data', resposta:'',
    sentimento_id:1, rede_id:1, produto_id:1, editoria_id:1, origem:'Feed',
    triagem:'Pendente', data_publicacao:null, link_conteudo:null, ia_em:null,
    ia_triagem:null, ia_juridico:false});
}
// Um na lixeira: nao pode aparecer em lugar nenhum do relatorio.
COMENTARIOS.push({id: id++, autor:'lixo', texto:'jogado fora', resposta:'',
  sentimento_id:2, rede_id:1, produto_id:1, editoria_id:1, origem:'Feed',
  triagem:'Lixeira', data_publicacao:dia(1), link_conteudo:null, ia_em:null,
  ia_triagem:null, ia_juridico:true});

const pagina = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>${css}</style>
<script src="./node_modules/react/umd/react.development.js"></script>
<script src="./node_modules/react-dom/umd/react-dom.development.js"></script>
<script src="./node_modules/@babel/standalone/babel.min.js"></script>
<script>
  window.supabase = { createClient: () => ({ from: () => ({}), auth: {} }) };
</script>
</head>
<body style="padding:20px;background:#F6F6F3">
<div id="root"></div>
<script type="text/babel">
${src}
const CFG = ${JSON.stringify(CFG)};
const COMENTARIOS = ${JSON.stringify(COMENTARIOS)};
window.__total = COMENTARIOS.length;
window.__semData = COMENTARIOS.filter(c => !c.data_publicacao).length;
window.__naLixeira = COMENTARIOS.filter(c => c.triagem === 'Lixeira').length;
ReactDOM.createRoot(document.getElementById('root'))
  .render(<Dashboard cfg={CFG} interacoes={COMENTARIOS} clienteNome="Tesouro Direto" />);
</script></body></html>`;

fs.writeFileSync(path.join(__dirname, 'dash.html'), pagina);
console.log(`dash.html montada (${COMENTARIOS.length} comentarios de teste)`);
