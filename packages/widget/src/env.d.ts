// Vite `?inline` CSS imports return the compiled stylesheet as a string.
declare module "*.css?inline" {
  const css: string;
  export default css;
}
