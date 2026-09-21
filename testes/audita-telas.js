// Auditoria de responsividade. Abre cada tela em varias larguras e procura o
// que vaza: rolagem horizontal, elemento mais largo que a tela, texto
// encavalado e alvo de toque pequeno demais para o dedo.
//
// Mede em vez de opinar: o resultado e uma lista de problemas com o nome do
// elemento e quanto ele passa do limite.
const { chromium } = require('playwright');
const path = require('path');

const LARGURAS = [
  [375,  'celular'],
  [768,  'tablet'],
  [1150, 'notebook'],
];
const TELAS = [
  ['Community',  'bancada.html',  '.row'],
  ['Relatórios', 'dash.html',     '.periodo'],
  ['Conteúdos',  'conteudos.html','.mural'],
];

(async () => {
  // Garante que as tres paginas de teste estao na versao atual.
  require('./monta-bancada.js');
  require('./monta-dash.js');
  require('./monta-conteudos.js');

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const achados = [];

  for(const [nomeTela, arquivo, ancora] of TELAS){
    for(const [largura, apelido] of LARGURAS){
      const page = await browser.newPage({ viewport: {width: largura, height: 900} });
      await page.goto('file://' + path.join(__dirname, arquivo));
      await page.waitForSelector(ancora, { timeout: 15000 });
      await page.waitForTimeout(300);

      const problemas = await page.evaluate((largura) => {
        const achou = [];
        const doc = document.documentElement;

        // 1) A pagina inteira rola para o lado?
        if(doc.scrollWidth > largura + 1){
          achou.push({tipo:'rolagem horizontal', quem:'a página',
            detalhe:`${doc.scrollWidth}px de largura numa tela de ${largura}px`});
        }

        // 2) Algum elemento passa da borda direita?
        document.querySelectorAll('*').forEach(el => {
          const c = el.getBoundingClientRect();
          if(c.width === 0 || c.height === 0) return;
          if(c.right > largura + 1){
            const nome = el.className && typeof el.className === 'string'
              ? '.' + el.className.split(' ').filter(Boolean).slice(0,2).join('.')
              : el.tagName.toLowerCase();
            achou.push({tipo:'passa da borda', quem:nome,
              detalhe:`termina em ${Math.round(c.right)}px`});
          }
        });

        // 3) Alvo de toque pequeno demais (o dedo pede uns 40px).
        if(largura <= 480){
          document.querySelectorAll('button, select, input, a').forEach(el => {
            const c = el.getBoundingClientRect();
            if(c.width === 0 || c.height === 0) return;
            if(c.height < 32){
              const txt = (el.textContent || el.tagName).trim().slice(0, 22);
              achou.push({tipo:'alvo pequeno para o dedo', quem: txt || el.tagName.toLowerCase(),
                detalhe:`${Math.round(c.height)}px de altura`});
            }
          });
        }
        return achou;
      }, largura);

      // Agrupa por tipo+quem para nao repetir a mesma queixa 30 vezes.
      const resumo = {};
      problemas.forEach(p => {
        const k = p.tipo + ' | ' + p.quem;
        if(!resumo[k]) resumo[k] = {...p, vezes: 0};
        resumo[k].vezes++;
      });
      Object.values(resumo).forEach(p => achados.push({tela:nomeTela, apelido, largura, ...p}));

      if(largura === 375){
        await page.screenshot({ path: path.join(__dirname, `celular-${arquivo.replace('.html','')}.png`), fullPage: false });
      }
      await page.close();
    }
  }

  await browser.close();

  if(!achados.length){ console.log('Nenhum problema de responsividade encontrado.'); process.exit(0); }

  console.log(`${achados.length} problema(s):\n`);
  let telaAtual = '';
  achados.forEach(a => {
    const cab = `${a.tela} @ ${a.apelido} (${a.largura}px)`;
    if(cab !== telaAtual){ console.log(`\n=== ${cab} ===`); telaAtual = cab; }
    console.log(`  ${a.tipo.padEnd(26)} ${String(a.quem).padEnd(28)} ${a.detalhe}${a.vezes>1?'  (x'+a.vezes+')':''}`);
  });
  // Reprova. Se so relatasse, uma regressao de responsividade passaria batido
  // na proxima alteracao de CSS — que e exatamente quando ela acontece.
  process.exit(1);
})();
