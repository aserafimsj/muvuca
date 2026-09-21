// Monta uma pagina de teste com a aba Conteudos, publicacoes de mentira e
// comentarios cujos links estao escritos de formas DIFERENTES do link da
// publicacao — que e o caso que quebrava a contagem antes.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1]
  .replace(/ReactDOM\.createRoot\(document\.getElementById\('root'\)\)\.render\(<App\/>\);/, '');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

const CFG = {
  sentimentos:[{id:1,nome:'Positivo'}],
  redes:[{id:1,nome:'Instagram'},{id:2,nome:'Facebook'},{id:3,nome:'YouTube'}],
  produtos:[{id:1,nome:'Selic'}],
  editorias:[{id:1,nome:'Educativo'}],
};

const PUBLICACOES = [
  // 1) Instagram, com todas as metricas nas duas colunas.
  {id:1, rede_id:1, formato:'Reels', data_post:'2026-09-10',
   link:'https://www.instagram.com/p/ABC123/',
   visu_org:1000, visu_pago:500, curtidas_org:100, curtidas_pago:40,
   coment_org:10, coment_pago:2, compart_org:5, compart_pago:1,
   salvos_org:7, salvos_pago:0},
  // 2) Instagram, planilha com UMA coluna so: tudo em _org, _pago vazio.
  {id:2, rede_id:1, formato:'Carrossel', data_post:'2026-09-08',
   link:'https://www.instagram.com/p/DEF456/',
   visu_org:800, visu_pago:null, curtidas_org:140, curtidas_pago:null,
   coment_org:9, coment_pago:null, compart_org:null, salvos_org:null},
  // 3) Link que nao da para mostrar dentro da pagina.
  {id:3, rede_id:3, formato:'Vídeo', data_post:'2026-09-05',
   link:'https://exemplo.com/video/1',
   visu_org:null, curtidas_org:null, coment_org:null},
  // 4) Facebook.
  {id:4, rede_id:2, formato:'Estático', data_post:'2026-09-01',
   link:'https://www.facebook.com/tesouro/posts/999',
   curtidas_org:20, curtidas_pago:5},
];
// Mais 10 para a paginacao aparecer (12 por pagina).
for(let k = 5; k <= 14; k++){
  PUBLICACOES.push({id:k, rede_id:1, formato:'Reels', data_post:'2026-08-'+String(k).padStart(2,'0'),
    link:'https://www.instagram.com/p/EXTRA'+k+'/', curtidas_org:k});
}

const COMENTARIOS = [
  // Tres comentarios do post 1, cada um com o link escrito de um jeito.
  {id:1, autor:'ana',   texto:'oi', triagem:'Pendente', link_conteudo:'https://www.instagram.com/p/ABC123/'},
  {id:2, autor:'bruno', texto:'oi', triagem:'Pendente', link_conteudo:'instagram.com/p/ABC123'},
  {id:3, autor:'carla', texto:'oi', triagem:'Respondido', link_conteudo:'https://www.instagram.com/p/ABC123/?utm_source=ig_web'},
  // Um do post 2.
  {id:4, autor:'diego', texto:'oi', triagem:'Pendente', link_conteudo:'https://instagram.com/p/DEF456'},
  // Na lixeira, do post 1: NAO pode ser contado.
  {id:5, autor:'lixo',  texto:'oi', triagem:'Lixeira',  link_conteudo:'https://www.instagram.com/p/ABC123/'},
  // Orfao: aponta para um post que nao esta importado.
  {id:6, autor:'elisa', texto:'oi', triagem:'Pendente', link_conteudo:'https://www.instagram.com/p/NAOEXISTE/'},
  // Sem link nenhum: nao pode ser contado em post nenhum.
  {id:7, autor:'fabio', texto:'oi', triagem:'Pendente', link_conteudo:null},
];

const pagina = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>${css}</style>
<script src="./node_modules/react/umd/react.development.js"></script>
<script src="./node_modules/react-dom/umd/react-dom.development.js"></script>
<script src="./node_modules/@babel/standalone/babel.min.js"></script>
<script>window.supabase = { createClient: () => ({ from: () => ({}), auth: {} }) };</script>
</head>
<body style="padding:20px;background:#F6F6F3">
<div id="root"></div>
<script type="text/babel">
${src}
const CFG = ${JSON.stringify(CFG)};
const PUBLICACOES = ${JSON.stringify(PUBLICACOES)};
const COMENTARIOS = ${JSON.stringify(COMENTARIOS)};
window.__publicacoes = PUBLICACOES.length;
ReactDOM.createRoot(document.getElementById('root')).render(
  <Conteudos cfg={CFG} publicacoes={PUBLICACOES} interacoes={COMENTARIOS} clienteNome="Tesouro Direto" />);
</script></body></html>`;

fs.writeFileSync(path.join(__dirname, 'conteudos.html'), pagina);
console.log(`conteudos.html montada (${PUBLICACOES.length} publicacoes, ${COMENTARIOS.length} comentarios)`);
