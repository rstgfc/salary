/* sql.js 环境声明（WASM 版 SQLite 引擎） */
declare module "sql.js";
declare module "sql.js/dist/sql-wasm.wasm?url" {
  const url: string;
  export default url;
}
