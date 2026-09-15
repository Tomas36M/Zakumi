// Stub de "server-only" para Vitest.
//
// El paquete real (node_modules/next/dist/compiled/server-only) solo se
// resuelve a un no-op cuando el bundler usa la condition "react-server"
// (así arma Next el build de Server Components); fuera de Next —como en
// Vitest, que corre sobre Node puro— cae al export "default" y ESE módulo
// hace `throw` incondicional. Sin este alias, todo test que importe (directa
// o transitivamente) un módulo con `import "server-only"` revienta al cargar,
// aunque el test corra en un contexto 100% servidor. Ver vitest.config.ts.
export {};
