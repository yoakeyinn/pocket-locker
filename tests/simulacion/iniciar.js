const { spawn } = require('child_process');

const OPCIONES = ['--sin-vincular', '--bluetooth-apagado'];
const argumentos = process.argv.slice(2);
const activas = OPCIONES.filter((opcion) => argumentos.includes(opcion)).map((opcion) => opcion.slice(2));
const resto = argumentos.filter((a) => !OPCIONES.includes(a));

spawn('npx', ['expo', 'start', '--clear', ...resto], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EXPO_PUBLIC_SIMULAR_BT: activas.length ? activas.join(',') : '1' },
}).on('exit', (codigo) => process.exit(codigo ?? 0));
