// Monta o MUVUCA INTEIRO — do login ao ultimo modulo — com um Supabase de
// mentira. As outras bancadas testam componentes isolados; esta e a unica que
// exercita a LIGACAO entre eles: props passadas, navegacao, carregamento.
// Um erro de fiacao (prop esquecida, modulo sem rota) so aparece aqui.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1];
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

const hoje = new Date();
const dia = n => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const BANCO = {
  perfis: [{id:'u1', nome:'Adilson', cargo:'Dono', onboarded:true}],
  clientes: [{id:1, nome:'Tesouro Direto'}, {id:2, nome:'Outro Cliente'}],
  redes: [
    {id:1, cliente_id:1, nome:'Instagram'}, {id:2, cliente_id:1, nome:'Facebook'},
    {id:9, cliente_id:2, nome:'Instagram'},
  ],
  produtos:  [{id:1, cliente_id:1, nome:'Selic'}, {id:2, cliente_id:1, nome:'IPCA+'}],
  editorias: [{id:1, cliente_id:1, nome:'Educativo'}],
  categorias_sentimento: [
    {id:1, cliente_id:1, nome:'Positivo', cor:'#7AC943'}, {id:2, cliente_id:1, nome:'Negativo', cor:'#E63329'},
    {id:3, cliente_id:1, nome:'Neutro',   cor:'#F5A623'}, {id:4, cliente_id:1, nome:'Dúvida',   cor:'#3FA9F5'},
  ],
  interacoes: [
    {id:1, cliente_id:1, rede_id:1, origem:'Feed', autor:'ana', texto:'Como invisto?',
     resposta:'Oi!', sentimento_id:4, produto_id:1, editoria_id:1, triagem:'Pendente',
     link_conteudo:'https://www.instagram.com/p/ABC/', data_publicacao:dia(2),
     ia_em:'2026-09-20T23:00:00Z', ia_triagem:'responder', ia_motivo:'duvida', ia_juridico:false},
    {id:2, cliente_id:1, rede_id:1, origem:'DM', autor:'bruno', texto:'spam',
     resposta:'', sentimento_id:2, produto_id:null, editoria_id:null, triagem:'Ignorar',
     link_conteudo:null, data_publicacao:dia(5),
     ia_em:'2026-09-20T23:00:00Z', ia_triagem:'nao_responder', ia_motivo:'spam', ia_juridico:false},
    {id:3, cliente_id:1, rede_id:2, origem:'Feed', autor:'carla', texto:'melhor que aposta?',
     resposta:'', sentimento_id:2, produto_id:null, editoria_id:null, triagem:'Respondido',
     link_conteudo:null, data_publicacao:dia(9),
     ia_em:'2026-09-20T23:00:00Z', ia_triagem:'responder', ia_motivo:'sensivel', ia_juridico:true},
    {id:4, cliente_id:1, rede_id:1, origem:'Feed', autor:'lixo', texto:'fora',
     resposta:'', sentimento_id:null, produto_id:null, editoria_id:null, triagem:'Lixeira',
     link_conteudo:null, data_publicacao:null, ia_em:null, ia_triagem:null, ia_juridico:null},
    // Do OUTRO cliente: nao pode aparecer enquanto o Tesouro Direto estiver aberto.
    {id:5, cliente_id:2, rede_id:9, origem:'Feed', autor:'outro', texto:'de outro cliente',
     resposta:'', sentimento_id:null, produto_id:null, editoria_id:null, triagem:'Pendente',
     link_conteudo:null, data_publicacao:dia(1), ia_em:null, ia_triagem:null, ia_juridico:null},
  ],
  publicacoes: [
    {id:1, cliente_id:1, rede_id:1, produto_id:1, editoria_id:1, data_post:dia(3),
     link:'https://www.instagram.com/p/ABC/', formato:'Reels', status:'Publicado',
     curtidas_org:100, curtidas_pago:40, coment_org:10, coment_pago:null,
     visu_org:1000, visu_pago:null, compart_org:null, salvos_org:null,
     engaj_org:150, engaj_pago:41, tx_engaj_org:1.5, tx_engaj_pago:null},
  ],
};

const pagina = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>${css}</style>
<script src="./node_modules/react/umd/react.development.js"></script>
<script src="./node_modules/react-dom/umd/react-dom.development.js"></script>
<script src="./node_modules/@babel/standalone/babel.min.js"></script>
<script>
const BANCO = ${JSON.stringify(BANCO)};
window.__banco = BANCO;
window.__gravacoes = [];
window.__exclusoes = [];

/* Supabase de mentira, fiel o bastante para o App inteiro rodar:
   .select().eq().order().maybeSingle(), .update().eq(), .delete().eq(),
   .insert().select().single() e a parte de autenticacao. */
function consulta(tabela){
  let linhas = (BANCO[tabela] || []).slice();
  const api = {
    select(){ return api; },
    eq(campo, valor){ linhas = linhas.filter(l => String(l[campo]) === String(valor)); return api; },
    order(){ return api; },
    limit(){ return api; },
    maybeSingle(){ return Promise.resolve({data: linhas[0] || null, error: null}); },
    single(){ return Promise.resolve({data: linhas[0] || null, error: null}); },
    then(res){ return Promise.resolve({data: linhas, error: null}).then(res); },
  };
  return api;
}
window.supabase = { createClient: () => ({
  from(tabela){
    return {
      select: () => consulta(tabela),
      update(valores){ return { eq(_c, id){
        window.__gravacoes.push({tabela, id, ...valores});
        const alvo = (BANCO[tabela]||[]).find(l => String(l.id) === String(id));
        if(alvo) Object.assign(alvo, valores);
        return Promise.resolve({error:null});
      }};},
      delete(){ return { eq(_c, id){
        window.__exclusoes.push({tabela, id});
        BANCO[tabela] = (BANCO[tabela]||[]).filter(l => String(l.id) !== String(id));
        return Promise.resolve({error:null});
      }};},
      insert(v){
        const novos = (Array.isArray(v) ? v : [v]).map((x,k) => ({id: 900+k, ...x}));
        BANCO[tabela] = (BANCO[tabela]||[]).concat(novos);
        const ret = {data: novos, error: null};
        return {select: () => ({
          single: () => Promise.resolve({data: novos[0], error: null}),
          then: (res) => Promise.resolve(ret).then(res),
        }), then: (res) => Promise.resolve(ret).then(res)};
      },
      upsert(){ return Promise.resolve({error:null}); },
    };
  },
  auth: {
    getSession: () => Promise.resolve({data:{session:{user:{id:'u1', email:'dono@teste.com'}}}}),
    onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}),
    signOut: () => Promise.resolve({}),
  },
})};
window.fetch = async () => ({ok:true, status:200, json: async () => ({results:[], uso:null})});
</script>
</head>
<body><div id="root"></div>
<script type="text/babel">
${src}
</script></body></html>`;

fs.writeFileSync(path.join(__dirname, 'app.html'), pagina);
console.log('app.html montada (aplicativo inteiro, 2 clientes)');
