// Compila o bloco <script type="text/babel"> exatamente como o navegador faria.
const fs = require('fs');
const Babel = require('@babel/standalone');
const alvo = process.argv[2] || require('path').join(__dirname,'..','index.html');
const html = fs.readFileSync(alvo, 'utf8');
const m = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (!m) { console.error('nao achei o bloco text/babel'); process.exit(2); }
try {
  Babel.transform(m[1], { presets: ['react'], filename: 'index.html' });
  console.log('OK: o JSX compila (' + m[1].split('\n').length + ' linhas)');
} catch (e) {
  console.error('ERRO DE SINTAXE NO JSX:\n' + e.message);
  process.exit(1);
}
