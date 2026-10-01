// Hook PostToolUse: depois de o Claude editar um .js/.mjs, confere a sintaxe com node --check.
// Se quebrar, sai com código 2 e o erro volta para o Claude corrigir na hora.
import { execFileSync } from 'node:child_process';

let entrada = '';
process.stdin.on('data', (c) => { entrada += c; });
process.stdin.on('end', () => {
  let arquivo = '';
  try { arquivo = JSON.parse(entrada).tool_input?.file_path || ''; } catch { process.exit(0); }
  if (!/\.m?js$/.test(arquivo)) process.exit(0);
  try { execFileSync(process.execPath, ['--check', arquivo], { stdio: 'pipe' }); }
  catch (e) {
    process.stderr.write(`Erro de sintaxe em ${arquivo}:\n${String(e.stderr).trim()}\n`);
    process.exit(2);
  }
});
